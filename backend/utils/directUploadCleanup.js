const UploadSession = require('../models/UploadSession');
const Video = require('../models/Video');
const { abortStaleUpload, removeUploadedVideo } = require('../controllers/directUpload');
const { r2PublicUrl, isR2Configured } = require('./localUpload');

// Direct uploads that were started but not finished within a day are cancelled: their uploaded
// parts and thumbnail are removed from R2 so abandoned uploads never leave files behind.
const STALE_AFTER_MS = 24 * 60 * 60 * 1000;
const BATCH = 200;
const CHECK_EVERY_MS = 60 * 60 * 1000;
let cleaning = false;

const cleanupStaleDirectUploads = async (now = new Date()) => {
  if (cleaning || !isR2Configured()) return 0;
  cleaning = true;
  let cleaned = 0;
  try {
    const cutoff = new Date(now.getTime() - STALE_AFTER_MS);
    // One batch per run; anything left is handled by the next hourly run
    const stale = await UploadSession.find({ status: { $in: ['uploading', 'completing'] }, createdAt: { $lt: cutoff } })
      .sort({ createdAt: 1 })
      .limit(BATCH)
      .lean();
    for (const session of stale) {
      await abortStaleUpload(session);
      // A "finish" that stopped half-way may have assembled the file without creating the video
      if (session.status === 'completing') {
        const videoUrl = r2PublicUrl(session.videoKey);
        if (!(await Video.exists({ videoUrl }))) await removeUploadedVideo(session);
      }
      await UploadSession.updateOne({ _id: session._id, status: session.status }, { $set: { status: 'aborted' } });
      cleaned++;
    }
    if (cleaned) console.log(`[DirectUpload] Cancelled ${cleaned} unfinished upload(s) older than a day`);
  } catch (err) {
    console.error('[DirectUpload] Cleanup failed:', err?.message || err);
  } finally {
    cleaning = false;
  }
  return cleaned;
};

const initDirectUploadCleanup = () => {
  setTimeout(() => cleanupStaleDirectUploads().catch(() => {}), 2 * 60 * 1000);
  setInterval(() => cleanupStaleDirectUploads().catch(() => {}), CHECK_EVERY_MS);
  console.log('[Scheduler] Unfinished direct upload cleanup initialized (hourly).');
};

module.exports = { initDirectUploadCleanup, cleanupStaleDirectUploads };
