// Uploads a video straight to cloud storage (R2) in 10 MB parts using signed links from the
// server, then asks the server to finish (backend/controllers/directUpload.js). Parts upload
// 3 at a time and each retries on its own; calling run() again after a failure continues with
// the parts still missing. If the server has no direct upload yet, run() throws
// DirectUploadUnavailableError and the caller uploads through the server instead.

export class DirectUploadUnavailableError extends Error {}

const PARALLEL_PARTS = 3;
const PART_RETRIES = 4;
const SIGN_BATCH = 20;
const FINISH_RETRIES = 10;
const PART_TIMEOUT_MS = 5 * 60 * 1000;
const CONNECTION_MESSAGE = "Upload interrupted. Please check your internet connection and click Upload again to continue.";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/** PUT a file slice to a signed link, reporting bytes sent so far */
const putBlob = (url, body, contentType, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    if (contentType) xhr.setRequestHeader("Content-Type", contentType);
    xhr.timeout = PART_TIMEOUT_MS;
    if (onProgress) xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(Object.assign(new Error(`Upload failed (${xhr.status})`), { status: xhr.status }));
    xhr.onerror = () => reject(new Error("network"));
    xhr.ontimeout = () => reject(new Error("timeout"));
    xhr.send(body);
  });

export class DirectVideoUpload {
  /**
   * @param {{ apiUrl: string, token: string }} server
   * @param {File} videoFile
   * @param {File|null} thumbnailFile
   */
  constructor(server, videoFile, thumbnailFile) {
    this.server = server;
    this.videoFile = videoFile;
    this.thumbnailFile = thumbnailFile || null;
    this.uploadId = null;
    this.partSize = 0;
    this.partCount = 0;
    this.thumbnailUrl = null;
    this.thumbnailContentType = null;
    this.thumbnailDone = false;
    this.done = new Set();
    this.links = new Map();
    this.inFlight = new Map();
    this.result = null;
  }

  /** Same files as an earlier, unfinished attempt (so it can be continued) */
  canContinue(videoFile, thumbnailFile) {
    return Boolean(this.uploadId) && !this.result && videoFile === this.videoFile && (thumbnailFile || null) === this.thumbnailFile;
  }

  async request(path, body) {
    let res;
    try {
      res = await fetch(`${this.server.apiUrl}/api/videos/direct-upload${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${this.server.token}` },
        credentials: "include",
        body: JSON.stringify(body || {}),
      });
    } catch {
      throw Object.assign(new Error(CONNECTION_MESSAGE), { network: true });
    }
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw Object.assign(new Error(data?.message || `Upload failed (${res.status})`), {
        status: res.status,
        code: data?.code,
        data,
      });
    }
    return data?.data;
  }

  /** Uploads (or continues) and returns the created video. onProgress gets 0..1 */
  async run(details, onProgress) {
    if (this.result) return this.result;
    if (!this.uploadId) {
      await this.start(details);
      await this.checkStorageReachable();
    }
    if (this.thumbnailUrl && !this.thumbnailDone) await this.uploadThumbnail();
    await this.uploadParts(onProgress);
    this.result = await this.finish(details, onProgress);
    onProgress(1);
    return this.result;
  }

  /** Cancels the upload on the server (removes uploaded parts). Safe to call any time. */
  cancel() {
    if (this.uploadId && !this.result) this.request(`/${this.uploadId}/abort`).catch(() => {});
  }

  async start(details) {
    try {
      const data = await this.request("", {
        ...details,
        video: { name: this.videoFile.name, size: this.videoFile.size, type: this.videoFile.type || "video/mp4" },
        thumbnail: this.thumbnailFile
          ? { name: this.thumbnailFile.name, size: this.thumbnailFile.size, type: this.thumbnailFile.type || "image/jpeg" }
          : undefined,
      });
      this.uploadId = data.uploadId;
      this.partSize = data.partSize;
      this.partCount = data.partCount;
      this.thumbnailUrl = data.thumbnailUploadUrl || null;
      this.thumbnailContentType = data.thumbnailContentType || null;
    } catch (err) {
      if (err.status === 404 || err.code === "DIRECT_UPLOAD_UNAVAILABLE") {
        throw new DirectUploadUnavailableError("Direct upload not available");
      }
      throw err;
    }
  }

  /**
   * The browser must be allowed to send files to the storage (R2 bucket CORS rule for this site).
   * If our server answers but the storage can't be reached at all, cancel and let the caller
   * upload through the server instead, exactly as before.
   */
  async checkStorageReachable() {
    const firstUrl = this.thumbnailUrl;
    let ok = true;
    try {
      if (firstUrl) {
        await putBlob(firstUrl, this.thumbnailFile, this.thumbnailContentType);
        this.thumbnailDone = true;
      } else {
        await this.ensureLinks(1);
        const body = this.videoFile.slice(0, Math.min(this.partSize, this.videoFile.size));
        await putBlob(this.links.get(1), body, null);
        this.done.add(1);
      }
    } catch (err) {
      ok = Boolean(err?.status); // an HTTP answer means the storage is reachable (retried later)
    }
    if (ok) return;
    const serverUp = await fetch(`${this.server.apiUrl}/api/categories`).then((r) => r.ok).catch(() => false);
    if (serverUp) {
      this.cancel();
      this.uploadId = null;
      throw new DirectUploadUnavailableError("Storage not reachable from the browser");
    }
    throw new Error(CONNECTION_MESSAGE);
  }

  async uploadThumbnail() {
    for (let attempt = 0; ; attempt++) {
      try {
        await putBlob(this.thumbnailUrl, this.thumbnailFile, this.thumbnailContentType);
        this.thumbnailDone = true;
        return;
      } catch {
        if (attempt >= PART_RETRIES) throw new Error(CONNECTION_MESSAGE);
        await sleep(1000 * 2 ** attempt);
      }
    }
  }

  // Signed links for the next parts that still need one
  async ensureLinks(fromPart) {
    const needed = [];
    for (let n = fromPart; n <= this.partCount && needed.length < SIGN_BATCH; n++) {
      if (!this.done.has(n) && !this.links.has(n)) needed.push(n);
    }
    if (needed.length === 0) return;
    const data = await this.request(`/${this.uploadId}/parts`, { partNumbers: needed });
    (data?.parts || []).forEach((p) => this.links.set(p.partNumber, p.url));
  }

  async uploadPart(partNumber, report) {
    const start = (partNumber - 1) * this.partSize;
    const body = this.videoFile.slice(start, Math.min(start + this.partSize, this.videoFile.size));
    for (let attempt = 0; ; attempt++) {
      try {
        if (!this.links.has(partNumber)) await this.ensureLinks(partNumber);
        await putBlob(this.links.get(partNumber), body, null, (sent) => {
          this.inFlight.set(partNumber, sent);
          report();
        });
        this.done.add(partNumber);
        this.inFlight.delete(partNumber);
        report();
        return;
      } catch (err) {
        this.inFlight.delete(partNumber);
        // An expired or rejected link: get a fresh one on the next try
        if (err?.status === 403 || err?.status === 400) this.links.delete(partNumber);
        if (attempt >= PART_RETRIES) throw new Error(CONNECTION_MESSAGE);
        await sleep(1000 * 2 ** attempt);
      }
    }
  }

  async uploadParts(onProgress) {
    const size = this.videoFile.size;
    const report = () => {
      let sent = 0;
      this.done.forEach((n) => (sent += Math.min(this.partSize, size - (n - 1) * this.partSize)));
      this.inFlight.forEach((bytes) => (sent += bytes));
      onProgress(Math.min(0.99, sent / size));
    };
    const queue = [];
    for (let n = 1; n <= this.partCount; n++) if (!this.done.has(n)) queue.push(n);
    report();
    let failure = null;
    const worker = async () => {
      while (queue.length > 0 && !failure) {
        const partNumber = queue.shift();
        try {
          await this.uploadPart(partNumber, report);
        } catch (err) {
          failure = err;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.min(PARALLEL_PARTS, queue.length) }, worker));
    if (failure) throw failure;
  }

  async finish(details, onProgress) {
    let missingRounds = 0;
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.request(`/${this.uploadId}/complete`, details);
      } catch (err) {
        if (err.code === "PARTS_MISSING" && missingRounds < 2) {
          // Upload what the server says is missing, then finish again
          missingRounds++;
          this.done = new Set(err.data?.uploadedParts || []);
          this.links.clear();
          await this.uploadParts(onProgress);
          continue;
        }
        const retryable = err.network || err.code === "UPLOAD_FINISHING" || err.status >= 500;
        if (retryable && attempt < FINISH_RETRIES) {
          await sleep(3000);
          continue;
        }
        throw err;
      }
    }
  }
}
