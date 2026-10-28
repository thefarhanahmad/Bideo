import api from './api';

// Uploads a (compressed) video straight to cloud storage (R2) in 10 MB parts using signed links
// from the server, then asks the server to finish. Parts upload 3 at a time and each part retries
// on its own; calling run() again after a failure continues with the parts still missing.
// Server: backend/controllers/directUpload.js. If the server has no direct upload yet, start()
// throws DirectUploadUnavailableError and the caller uses the regular upload instead.

export class DirectUploadUnavailableError extends Error {}

/** A failure with a message that can be shown to the user as-is */
export class DirectUploadError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

export interface UploadFile {
  uri: string;
  name: string;
  type: string;
}

const PARALLEL_PARTS = 3;
const PART_RETRIES = 4;
const SIGN_BATCH = 20;
const FINISH_RETRIES = 10;
const PART_TIMEOUT_MS = 5 * 60 * 1000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const CONNECTION_MESSAGE = 'Upload interrupted. Please check your internet connection and tap Upload again to continue.';

/**
 * Reads the video one part at a time straight from storage, so even a 2 GB file never has to fit in
 * the phone's memory. (A Blob made with fetch(uri).blob() holds the whole file in memory on Android,
 * which crashes the app for large videos.) Returns null when the file can't be read this way; the
 * caller then falls back to a Blob.
 */
const openPartReader = (uri: string): { size: number; read: (start: number, length: number) => Uint8Array } | null => {
  try {
    const { File } = require('expo-file-system');
    const file = new File(uri);
    const size = Number(file.size);
    if (!file.exists || !Number.isFinite(size) || size <= 0) return null;
    return {
      size,
      read: (start: number, length: number) => {
        const handle = file.open();
        try {
          handle.offset = start;
          return handle.readBytes(length);
        } finally {
          handle.close();
        }
      },
    };
  } catch {
    return null;
  }
};

/** PUT a blob (or bytes) to a signed link, reporting bytes sent so far */
const putBlob = (url: string, body: Blob | Uint8Array, contentType: string | null, onProgress?: (sent: number) => void) =>
  new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    if (contentType) xhr.setRequestHeader('Content-Type', contentType);
    xhr.timeout = PART_TIMEOUT_MS;
    if (onProgress && xhr.upload) xhr.upload.onprogress = (e) => onProgress(e.loaded);
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(Object.assign(new Error(`Upload failed (${xhr.status})`), { status: xhr.status }));
    xhr.onerror = () => reject(new Error('network'));
    xhr.ontimeout = () => reject(new Error('timeout'));
    xhr.send(body);
  });

const serverMessage = (err: any) => err?.response?.data?.message as string | undefined;

export class DirectVideoUpload {
  readonly videoUri: string;
  private thumbnail: UploadFile | null;
  private uploadId: string | null = null;
  private partSize = 0;
  private partCount = 0;
  private thumbnailUrl: string | null = null;
  private thumbnailContentType: string | null = null;
  private thumbnailDone = false;
  private reader: { size: number; read: (start: number, length: number) => Uint8Array } | null = null;
  private blob: Blob | null = null;
  private size = 0;
  private done = new Set<number>();
  private links = new Map<number, string>();
  private inFlight = new Map<number, number>();
  private result: any = null;

  constructor(private video: UploadFile, thumbnail: UploadFile | null) {
    this.videoUri = video.uri;
    this.thumbnail = thumbnail;
  }

  /** Same video file and thumbnail as an earlier, unfinished attempt (so it can be continued) */
  canContinue(videoUri: string, thumbnailUri?: string | null) {
    return Boolean(this.uploadId) && !this.result && videoUri === this.videoUri && (thumbnailUri || null) === (this.thumbnail?.uri || null);
  }

  /** Uploads (or continues) and returns the created video. onProgress gets 0..1 */
  async run(details: Record<string, any>, onProgress: (fraction: number) => void) {
    if (this.result) return this.result;
    if (!this.reader && !this.blob) {
      this.reader = openPartReader(this.video.uri);
      if (this.reader) {
        this.size = this.reader.size;
      } else {
        this.blob = await (await fetch(this.video.uri)).blob();
        this.size = this.blob.size;
      }
    }
    if (!this.uploadId) await this.start(details);
    if (this.thumbnailUrl && !this.thumbnailDone) await this.uploadThumbnail();
    await this.uploadParts(onProgress);
    this.result = await this.finish(details, onProgress);
    onProgress(1);
    return this.result;
  }

  /** Cancels the upload on the server (removes uploaded parts). Safe to call any time. */
  cancel() {
    if (this.uploadId && !this.result) api.post(`/videos/direct-upload/${this.uploadId}/abort`).catch(() => {});
  }

  private async start(details: Record<string, any>) {
    try {
      const res = await api.post('/videos/direct-upload', {
        ...details,
        video: { name: this.video.name, size: this.size, type: this.video.type },
        thumbnail: this.thumbnail ? await this.thumbnailInfo() : undefined,
      });
      const data = res.data?.data;
      this.uploadId = data.uploadId;
      this.partSize = data.partSize;
      this.partCount = data.partCount;
      this.thumbnailUrl = data.thumbnailUploadUrl || null;
      this.thumbnailContentType = data.thumbnailContentType || null;
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 404 || err?.response?.data?.code === 'DIRECT_UPLOAD_UNAVAILABLE') {
        throw new DirectUploadUnavailableError('Direct upload not available');
      }
      if (!err?.response) throw new DirectUploadError(CONNECTION_MESSAGE, 'NETWORK');
      throw new DirectUploadError(serverMessage(err) || 'Upload failed. Please try again.', err?.response?.data?.code);
    }
  }

  private thumbnailBlob: Blob | null = null;
  private async thumbnailInfo() {
    if (!this.thumbnail) return undefined;
    this.thumbnailBlob = await (await fetch(this.thumbnail.uri)).blob();
    return { name: this.thumbnail.name, size: this.thumbnailBlob.size, type: this.thumbnail.type };
  }

  private async uploadThumbnail() {
    if (!this.thumbnailBlob && this.thumbnail) this.thumbnailBlob = await (await fetch(this.thumbnail.uri)).blob();
    for (let attempt = 0; ; attempt++) {
      try {
        await putBlob(this.thumbnailUrl as string, this.thumbnailBlob as Blob, this.thumbnailContentType);
        this.thumbnailDone = true;
        return;
      } catch {
        if (attempt >= PART_RETRIES) throw new DirectUploadError(CONNECTION_MESSAGE, 'NETWORK');
        await sleep(1000 * 2 ** attempt);
      }
    }
  }

  // Signed links for the next parts that still need one
  private async ensureLinks(fromPart: number) {
    const needed: number[] = [];
    for (let n = fromPart; n <= this.partCount && needed.length < SIGN_BATCH; n++) {
      if (!this.done.has(n) && !this.links.has(n)) needed.push(n);
    }
    if (needed.length === 0) return;
    const res = await api.post(`/videos/direct-upload/${this.uploadId}/parts`, { partNumbers: needed });
    (res.data?.data?.parts || []).forEach((p: any) => this.links.set(p.partNumber, p.url));
  }

  // This part's bytes: read from storage only while it is being sent
  private partBody(partNumber: number): Blob | Uint8Array {
    const start = (partNumber - 1) * this.partSize;
    const end = Math.min(start + this.partSize, this.size);
    if (this.reader) return this.reader.read(start, end - start);
    return (this.blob as Blob).slice(start, end);
  }

  private async uploadPart(partNumber: number, report: () => void) {
    for (let attempt = 0; ; attempt++) {
      try {
        if (!this.links.has(partNumber)) await this.ensureLinks(partNumber);
        // Raw bytes need a content type on Android; the signed link does not cover this header
        const body = this.partBody(partNumber);
        const contentType = body instanceof Uint8Array ? 'application/octet-stream' : null;
        await putBlob(this.links.get(partNumber) as string, body, contentType, (sent) => {
          this.inFlight.set(partNumber, sent);
          report();
        });
        this.done.add(partNumber);
        this.inFlight.delete(partNumber);
        report();
        return;
      } catch (err: any) {
        this.inFlight.delete(partNumber);
        // An expired or rejected link: get a fresh one on the next try
        if (err?.status === 403 || err?.status === 400) this.links.delete(partNumber);
        if (attempt >= PART_RETRIES) throw new DirectUploadError(CONNECTION_MESSAGE, 'NETWORK');
        await sleep(1000 * 2 ** attempt);
      }
    }
  }

  private async uploadParts(onProgress: (fraction: number) => void) {
    const report = () => {
      let sent = 0;
      this.done.forEach((n) => (sent += Math.min(this.partSize, this.size - (n - 1) * this.partSize)));
      this.inFlight.forEach((bytes) => (sent += bytes));
      onProgress(Math.min(0.99, sent / this.size));
    };
    const queue: number[] = [];
    for (let n = 1; n <= this.partCount; n++) if (!this.done.has(n)) queue.push(n);
    report();
    let failure: any = null;
    const worker = async () => {
      while (queue.length > 0 && !failure) {
        const partNumber = queue.shift() as number;
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

  private async finish(details: Record<string, any>, onProgress: (fraction: number) => void) {
    let missingRounds = 0;
    for (let attempt = 0; ; attempt++) {
      try {
        const res = await api.post(`/videos/direct-upload/${this.uploadId}/complete`, details, { timeout: 60000 });
        return res.data?.data;
      } catch (err: any) {
        const code = err?.response?.data?.code;
        if (code === 'PARTS_MISSING' && missingRounds < 2) {
          missingRounds++;
          // Upload what the server says is missing, then finish again
          const present = new Set<number>(err.response.data.uploadedParts || []);
          this.done = present;
          this.links.clear();
          await this.uploadParts(onProgress);
          continue;
        }
        const retryable = !err?.response || code === 'UPLOAD_FINISHING' || err.response.status >= 500;
        if (retryable && attempt < FINISH_RETRIES) {
          await sleep(3000);
          continue;
        }
        if (!err?.response) throw new DirectUploadError(CONNECTION_MESSAGE, 'NETWORK');
        throw new DirectUploadError(serverMessage(err) || 'Upload failed. Please try again.', code);
      }
    }
  }
}
