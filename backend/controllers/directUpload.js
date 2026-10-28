const path = require('path');
const mongoose = require('mongoose');
const {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  ListPartsCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const UploadSession = require('../models/UploadSession');
const Video = require('../models/Video');
const {
  getS3Client,
  getPresignClient,
  isR2Configured,
  getContentType,
  newStorageName,
  r2PublicUrl,
} = require('../utils/localUpload');
const { readUploadShape, getUploadRejection, createUploadedVideo, FALLBACK_THUMBNAIL } = require('./video');

// Direct-to-R2 video upload. The video never passes through Cloudflare's proxy, nginx or this
// server's disk: the client uploads it in parts straight to R2 with short-lived signed links, then
// asks the server to finish. The server-side upload route (POST /api/videos/upload) is unchanged.
//
//   POST /api/videos/direct-upload                 start: checks, opens the R2 multipart upload
//   POST /api/videos/direct-upload/:id/parts       signed links for the next parts
//   POST /api/videos/direct-upload/:id/complete    assembles the parts, creates the video
//   POST /api/videos/direct-upload/:id/abort       cancels and removes uploaded parts
const MB = 1024 * 1024;
const LIMITS = {
  maxVideoBytes: (parseInt(process.env.DIRECT_UPLOAD_MAX_MB, 10) || 2048) * MB,
  maxThumbnailBytes: 10 * MB,
  partSize: 10 * MB, // R2: every part except the last must be the same size (min 5 MB)
  maxParts: 10000,
  partsPerRequest: 100,
  linkSeconds: 60 * 60,
};
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.3gp']);
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

const MAINTENANCE_MESSAGE =
  'Video & Shorts upload is temporarily under scheduled maintenance while we upgrade our cloud storage servers. Uploads will be back shortly. Thank you for your patience and support! 🙏';
const bucket = () => process.env.R2_BUCKET_NAME;
const fail = (res, status, message, extra = {}) => res.status(status).json({ success: false, message, ...extra });

const isAllowedFile = (file, kind) => {
  const ext = path.extname(String(file?.name || '')).toLowerCase();
  const type = String(file?.type || '').toLowerCase();
  if (kind === 'video') return type.startsWith('video/') && (VIDEO_EXTENSIONS.has(ext) || !ext);
  return type.startsWith('image/') && (IMAGE_EXTENSIONS.has(ext) || !ext);
};

const objectKey = (file, isVideo) => {
  const { uniqueSuffix, safeExt } = newStorageName(file.name, isVideo);
  return `${isVideo ? 'videos' : 'images'}/${uniqueSuffix}${safeExt}`;
};

// The session must exist and belong to the signed-in user
const loadOwnSession = async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) {
    fail(res, 404, 'Upload not found');
    return null;
  }
  const session = await UploadSession.findOne({ _id: req.params.id, user: req.user._id });
  if (!session) fail(res, 404, 'Upload not found');
  return session;
};

const removeObject = (key) =>
  key ? getS3Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key })).catch(() => {}) : Promise.resolve();

const abortParts = (session) =>
  getS3Client()
    .send(new AbortMultipartUploadCommand({ Bucket: bucket(), Key: session.videoKey, UploadId: session.multipartUploadId }))
    .catch(() => {});

// Every uploaded part, in order (R2 lists up to 1000 per call)
const listUploadedParts = async (session) => {
  const parts = [];
  let marker;
  for (;;) {
    const out = await getS3Client().send(
      new ListPartsCommand({
        Bucket: bucket(),
        Key: session.videoKey,
        UploadId: session.multipartUploadId,
        PartNumberMarker: marker,
      })
    );
    (out.Parts || []).forEach((p) => parts.push({ PartNumber: p.PartNumber, ETag: p.ETag, Size: p.Size }));
    if (!out.IsTruncated) break;
    marker = out.NextPartNumberMarker;
  }
  return parts.sort((a, b) => a.PartNumber - b.PartNumber);
};

// @desc    Start a direct upload: check everything that can be checked before any data is sent
// @route   POST /api/videos/direct-upload
// @access  Private
exports.startDirectUpload = async (req, res, next) => {
  try {
    // Same maintenance switch as the server upload (POST /api/videos/upload)
    if (process.env.UPLOAD_MAINTENANCE_ENABLED !== 'false') {
      return fail(res, 503, MAINTENANCE_MESSAGE, { code: 'UPLOAD_MAINTENANCE' });
    }
    if (!isR2Configured()) return fail(res, 503, 'Direct upload is not available right now', { code: 'DIRECT_UPLOAD_UNAVAILABLE' });

    const video = req.body?.video;
    const thumbnail = req.body?.thumbnail || null;
    const videoSize = Number(video?.size);
    if (!video || !isAllowedFile(video, 'video')) {
      return fail(res, 400, 'Please upload a valid video file (MP4, MOV, MKV, WEBM, AVI)');
    }
    if (!Number.isFinite(videoSize) || videoSize <= 0) return fail(res, 400, 'The video file is empty');
    if (videoSize > LIMITS.maxVideoBytes) {
      return fail(res, 413, `Videos can be up to ${Math.round(LIMITS.maxVideoBytes / MB / 1024 * 10) / 10} GB. Please trim it or upload a shorter video.`, {
        code: 'VIDEO_TOO_LARGE',
      });
    }
    if (thumbnail) {
      const thumbSize = Number(thumbnail.size);
      if (!isAllowedFile(thumbnail, 'image')) return fail(res, 400, 'Please upload a valid image file (JPG, PNG, WEBP)');
      if (!Number.isFinite(thumbSize) || thumbSize <= 0 || thumbSize > LIMITS.maxThumbnailBytes) {
        return fail(res, 400, 'The thumbnail must be an image up to 10 MB');
      }
    }
    // Shape, Shorts length and file weight: say so now rather than after a long upload
    const rejection = getUploadRejection(readUploadShape(req.body, videoSize), videoSize);
    if (rejection) return fail(res, 400, rejection);

    const partSize = Math.max(LIMITS.partSize, Math.ceil(videoSize / LIMITS.maxParts));
    const partCount = Math.ceil(videoSize / partSize);
    const videoKey = objectKey(video, true);
    const videoContentType = getContentType(videoKey, video.type, true);

    const created = await getS3Client().send(
      new CreateMultipartUploadCommand({ Bucket: bucket(), Key: videoKey, ContentType: videoContentType })
    );

    const session = await UploadSession.create({
      user: req.user._id,
      videoKey,
      multipartUploadId: created.UploadId,
      videoSize,
      videoContentType,
      partSize,
      partCount,
      thumbnailKey: thumbnail ? objectKey(thumbnail, false) : null,
      thumbnailSize: thumbnail ? Number(thumbnail.size) : 0,
      thumbnailContentType: thumbnail ? getContentType(String(thumbnail.name || ''), thumbnail.type, false) : null,
    });

    let thumbnailUploadUrl = null;
    if (session.thumbnailKey) {
      thumbnailUploadUrl = await getSignedUrl(
        getPresignClient(),
        new PutObjectCommand({ Bucket: bucket(), Key: session.thumbnailKey, ContentType: session.thumbnailContentType }),
        { expiresIn: LIMITS.linkSeconds }
      );
    }

    res.status(201).json({
      success: true,
      data: {
        uploadId: session._id,
        partSize,
        partCount,
        thumbnailUploadUrl,
        thumbnailContentType: session.thumbnailContentType,
      },
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Signed links for the next video parts (fetched as the upload goes, so links never run out)
// @route   POST /api/videos/direct-upload/:id/parts   body: { partNumbers: [1, 2, ...] }
// @access  Private (owner of the upload)
exports.signDirectUploadParts = async (req, res, next) => {
  try {
    const session = await loadOwnSession(req, res);
    if (!session) return;
    if (session.status !== 'uploading') return fail(res, 409, 'This upload is no longer active');

    const requested = Array.isArray(req.body?.partNumbers) ? req.body.partNumbers : [];
    const partNumbers = [...new Set(requested.map(Number))];
    if (
      partNumbers.length === 0 ||
      partNumbers.length > LIMITS.partsPerRequest ||
      partNumbers.some((n) => !Number.isInteger(n) || n < 1 || n > session.partCount)
    ) {
      return fail(res, 400, `Ask for 1 to ${LIMITS.partsPerRequest} valid part numbers`);
    }

    const client = getPresignClient();
    const urls = await Promise.all(
      partNumbers.map(async (partNumber) => ({
        partNumber,
        url: await getSignedUrl(
          client,
          new UploadPartCommand({
            Bucket: bucket(),
            Key: session.videoKey,
            UploadId: session.multipartUploadId,
            PartNumber: partNumber,
          }),
          { expiresIn: LIMITS.linkSeconds }
        ),
      }))
    );
    res.status(200).json({ success: true, data: { parts: urls } });
  } catch (err) {
    next(err);
  }
};

// @desc    Finish: assemble the parts R2 actually has, check the file, create the video
// @route   POST /api/videos/direct-upload/:id/complete   body: video details (title, category, ...)
// @access  Private (owner of the upload)
exports.completeDirectUpload = async (req, res, next) => {
  let session = null;
  try {
    session = await loadOwnSession(req, res);
    if (!session) return;

    // A repeated "finish" (e.g. after a dropped connection) returns the video already created
    if (session.status === 'completed' && session.video) {
      const existing = await Video.findById(session.video);
      if (existing) return res.status(201).json({ success: true, data: existing });
    }
    // Only one "finish" may run for an upload at a time
    const claimed = await UploadSession.findOneAndUpdate(
      { _id: session._id, status: 'uploading' },
      { $set: { status: 'completing' } },
      { new: true }
    );
    if (!claimed) {
      // Cancelled: start again. Being finished (e.g. an earlier attempt still running): retry
      // "finish" in a moment and it returns the video once it is ready.
      return session.status === 'aborted'
        ? fail(res, 409, 'This upload was cancelled', { code: 'UPLOAD_CANCELLED' })
        : fail(res, 409, 'Your video is still being finished', { code: 'UPLOAD_FINISHING' });
    }
    session = claimed;

    const shape = readUploadShape(req.body, session.videoSize);
    const rejection = getUploadRejection(shape, session.videoSize);
    if (rejection) {
      await abortParts(session);
      await removeObject(session.thumbnailKey);
      await UploadSession.updateOne({ _id: session._id }, { $set: { status: 'aborted' } });
      return fail(res, 400, rejection);
    }

    // Trust only what R2 has: every part present and the sizes adding up to the declared size
    const parts = await listUploadedParts(session);
    const total = parts.reduce((sum, p) => sum + (p.Size || 0), 0);
    const complete =
      parts.length === session.partCount &&
      parts.every((p, i) => p.PartNumber === i + 1) &&
      total === session.videoSize;
    if (!complete) {
      await UploadSession.updateOne({ _id: session._id }, { $set: { status: 'uploading' } });
      return fail(res, 409, 'Some parts of the video are missing. Please retry the upload.', {
        code: 'PARTS_MISSING',
        uploadedParts: parts.map((p) => p.PartNumber),
      });
    }

    await getS3Client().send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket(),
        Key: session.videoKey,
        UploadId: session.multipartUploadId,
        MultipartUpload: { Parts: parts.map(({ PartNumber, ETag }) => ({ PartNumber, ETag })) },
      })
    );
    const stored = await getS3Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: session.videoKey }));
    if (Number(stored.ContentLength) !== session.videoSize) {
      await removeObject(session.videoKey);
      await UploadSession.updateOne({ _id: session._id }, { $set: { status: 'aborted' } });
      return fail(res, 422, 'The uploaded video was incomplete. Please upload it again.');
    }

    // Thumbnail is optional: use it only if it really arrived and is within the limit
    let thumbnail = null;
    let compressedThumbnailSize = 0;
    if (session.thumbnailKey) {
      const head = await getS3Client()
        .send(new HeadObjectCommand({ Bucket: bucket(), Key: session.thumbnailKey }))
        .catch(() => null);
      const size = Number(head?.ContentLength || 0);
      if (size > 0 && size <= LIMITS.maxThumbnailBytes) {
        thumbnail = r2PublicUrl(session.thumbnailKey);
        compressedThumbnailSize = size;
      } else if (head) {
        await removeObject(session.thumbnailKey);
      }
    }

    const video = await createUploadedVideo(req, {
      videoUrl: r2PublicUrl(session.videoKey),
      thumbnail: thumbnail || FALLBACK_THUMBNAIL,
      shape,
      compressedVideoSize: session.videoSize,
      originalThumbnailSize: thumbnail ? Number(req.body.originalThumbnailSize || 0) : 0,
      compressedThumbnailSize,
    });

    await UploadSession.updateOne({ _id: session._id }, { $set: { status: 'completed', video: video._id } });
    res.status(201).json({ success: true, data: video });
  } catch (err) {
    // Let the client retry "finish" (the parts are kept until the upload is cancelled or expires)
    if (session?._id) {
      await UploadSession.updateOne({ _id: session._id, status: 'completing' }, { $set: { status: 'uploading' } }).catch(() => {});
    }
    next(err);
  }
};

// @desc    Cancel an upload and remove what was uploaded
// @route   POST /api/videos/direct-upload/:id/abort
// @access  Private (owner of the upload)
exports.abortDirectUpload = async (req, res, next) => {
  try {
    const session = await loadOwnSession(req, res);
    if (!session) return;
    if (session.status === 'completed') return res.status(200).json({ success: true, data: { status: 'completed' } });
    const claimed = await UploadSession.findOneAndUpdate(
      { _id: session._id, status: 'uploading' },
      { $set: { status: 'aborted' } },
      { new: true }
    );
    if (claimed) {
      await abortParts(claimed);
      await removeObject(claimed.thumbnailKey);
    }
    res.status(200).json({ success: true, data: { status: 'aborted' } });
  } catch (err) {
    next(err);
  }
};

exports.DIRECT_UPLOAD_LIMITS = LIMITS;
exports.removeUploadedVideo = (session) => removeObject(session.videoKey);
exports.abortStaleUpload = async (session) => {
  await abortParts(session);
  await removeObject(session.thumbnailKey);
};
