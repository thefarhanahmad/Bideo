const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const Video = require('../models/Video');
const Post = require('../models/Post');
const User = require('../models/User');
const Ad = require('../models/Ad');

const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000; // 2 hours in-flight safety shield

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const extractFilename = (url) => {
  if (!url || typeof url !== 'string') return null;
  const cleanUrl = url.split('?')[0].split('#')[0];
  return path.basename(cleanUrl);
};

/**
 * Runs a full audit against MongoDB and unlinks any abandoned media files
 * that are not referenced by any Video, Post, User, or Ad document,
 * strictly skipping any files created within the last 2 hours.
 */
const runOrphanMediaCleanup = async () => {
  console.log('\n[OrphanMediaScheduler] 🧹 Starting scheduled orphan media scan...');
  const startTime = Date.now();

  try {
    const activeFilenames = new Set();

    // 1. Index Videos & Thumbnails
    const videos = await Video.find({}, 'videoUrl thumbnail').lean();
    videos.forEach((v) => {
      const vFile = extractFilename(v.videoUrl);
      if (vFile) activeFilenames.add(vFile);
      const tFile = extractFilename(v.thumbnail);
      if (tFile) activeFilenames.add(tFile);
    });

    // 2. Index Posts
    const posts = await Post.find({}, 'imageUrl').lean();
    posts.forEach((p) => {
      const pFile = extractFilename(p.imageUrl);
      if (pFile) activeFilenames.add(pFile);
    });

    // 3. Index User Avatars & Cover Images
    const users = await User.find({}, 'avatar coverImage').lean();
    users.forEach((u) => {
      const aFile = extractFilename(u.avatar);
      if (aFile) activeFilenames.add(aFile);
      const cFile = extractFilename(u.coverImage);
      if (cFile) activeFilenames.add(cFile);
    });

    // 4. Index Ads
    const ads = await Ad.find({}, 'image').lean();
    ads.forEach((a) => {
      const aFile = extractFilename(a.image);
      if (aFile) activeFilenames.add(aFile);
    });

    // 5. Scan physical disk directories
    const uploadsBase = path.resolve(__dirname, '../uploads');
    const targetDirs = ['videos', 'images', 'thumbnails'];

    let scannedFiles = 0;
    let deletedCount = 0;
    let deletedBytes = 0;
    let protectedInFlight = 0;

    const now = Date.now();

    for (const dir of targetDirs) {
      const fullDirPath = path.join(uploadsBase, dir);
      if (!fs.existsSync(fullDirPath)) continue;

      let files = [];
      try {
        files = fs.readdirSync(fullDirPath);
      } catch (err) {
        console.warn(`[OrphanMediaScheduler] Could not read dir ${fullDirPath}:`, err.message);
        continue;
      }

      for (const file of files) {
        if (file.startsWith('.') || file === 'bideo.apk') continue;

        const filePath = path.join(fullDirPath, file);
        try {
          const stat = fs.statSync(filePath);
          if (!stat.isFile()) continue;

          scannedFiles++;

          // If file is referenced in DB, it is active
          if (activeFilenames.has(file)) {
            continue;
          }

          // Safety guard: Is the file younger than 2 hours (in-flight upload)?
          const fileAgeMs = now - stat.mtimeMs;
          if (fileAgeMs < GRACE_PERIOD_MS) {
            protectedInFlight++;
            continue;
          }

          // Abandoned orphan file - safely remove
          fs.unlinkSync(filePath);
          deletedCount++;
          deletedBytes += stat.size;
        } catch (err) {
          // File might have been locked or deleted concurrently
        }
      }
    }

    const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
    if (deletedCount > 0) {
      console.log(
        `✅ [OrphanMediaScheduler] Completed in ${durationSec}s. Purged ${deletedCount} orphaned files (${formatBytes(deletedBytes)} reclaimed). (Protected in-flight: ${protectedInFlight})`
      );
    } else {
      console.log(
        `✅ [OrphanMediaScheduler] Completed in ${durationSec}s. 0 orphaned files found. Storage is 100% clean. (Scanned: ${scannedFiles}, Protected in-flight: ${protectedInFlight})`
      );
    }
  } catch (err) {
    console.error('[OrphanMediaScheduler] ❌ Error during scheduled orphan media cleanup:', err.message);
  }
};

/**
 * Initializes the weekly orphan media cleanup cron job.
 * Runs every Sunday at 3:30 AM (server local / UTC depending on VPS config).
 * Cron syntax: '30 3 * * 0' (minute 30, hour 3, every Sunday)
 */
const initOrphanMediaScheduler = () => {
  cron.schedule('30 3 * * 0', () => {
    console.log('[OrphanMediaScheduler] Weekly Sunday cron triggered (30 3 * * 0)');
    runOrphanMediaCleanup();
  });

  console.log('✅ [OrphanMediaScheduler] Weekly cleanup cron initialized (Every Sunday at 3:30 AM).');
};

module.exports = {
  runOrphanMediaCleanup,
  initOrphanMediaScheduler,
};
