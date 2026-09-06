/**
 * Bideo Accidental & Junk Video Audit & Cleanup Tool
 * 
 * Detects accidental pocket recordings, test/gibberish titles, duplicate uploads,
 * and abandoned 0-engagement videos to reclaim valuable disk storage.
 * 
 * Safety Features:
 *   - Dry Run by Default: Reports sizes and details without deleting anything.
 *   - Multi-Category Breakdown: See exactly what was flagged and why.
 *   - In-Flight Safety: Never touches videos uploaded within the last 2 hours.
 *   - Cascading Cleanup: Cleans both database records and physical video files on disk.
 * 
 * Usage:
 *   Dry Run (Report Only):        node scripts/auditJunkVideos.js
 *   Include Dead 0-View Videos:   node scripts/auditJunkVideos.js --include-dead
 *   Reclaim Space (Delete):       node scripts/auditJunkVideos.js --delete
 * 
 * Inside Server Docker:
 *   docker compose exec backend node scripts/auditJunkVideos.js
 *   docker compose exec backend node scripts/auditJunkVideos.js --delete
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const Video = require('../models/Video');
const Comment = require('../models/Comment');
const VideoReport = require('../models/VideoReport');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');

const shouldDelete = process.argv.includes('--delete');
const includeDead = process.argv.includes('--include-dead');

// 2 hours grace period to protect active in-flight uploads
const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000;
// 60 days threshold for abandoned dead videos
const DEAD_THRESHOLD_MS = 60 * 24 * 60 * 60 * 1000;

// Test & Gibberish title patterns
const JUNK_TITLE_REGEX = /^(test|testing|asdf|qwerty|1234?|a|aaa|demo|sample|check|trial|video|temp|tmp|new video|untitled|null|undefined|blank|hjhj|xyz|abc|abcd)$/i;

const formatBytes = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const resolveToLocalPath = (mediaUrl) => {
  if (!mediaUrl || typeof mediaUrl !== 'string') return null;
  let relativePath = '';
  const uploadsIdx = mediaUrl.indexOf('/uploads/');
  if (uploadsIdx !== -1) {
    relativePath = mediaUrl.substring(uploadsIdx + 1);
  } else if (mediaUrl.startsWith('uploads/') || mediaUrl.startsWith('uploads\\')) {
    relativePath = mediaUrl.replace(/\\/g, '/');
  } else {
    return null;
  }
  const absolutePath = path.resolve(path.join(__dirname, '..', relativePath));
  if (fs.existsSync(absolutePath)) {
    return absolutePath;
  }
  return null;
};

const getFileSize = (mediaUrl) => {
  try {
    const localPath = resolveToLocalPath(mediaUrl);
    if (localPath && fs.existsSync(localPath)) {
      return { size: fs.statSync(localPath).size, path: localPath };
    }
  } catch (err) {}
  return { size: 0, path: null };
};

const run = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment.');
    process.exit(1);
  }

  console.log('====================================================');
  console.log('     BIDEO ACCIDENTAL & JUNK VIDEO AUDIT TOOL       ');
  console.log('====================================================\n');
  console.log(`MODE: ${shouldDelete ? '🚨 LIVE DELETION (--delete)' : '🛡️  SAFE DRY-RUN (Report only)'}`);
  if (includeDead) {
    console.log('OPTIONS: Including dead 0-view videos older than 60 days (--include-dead)\n');
  } else {
    console.log('OPTIONS: Excluding dead videos (add --include-dead to also scan abandoned 0-view videos)\n');
  }

  console.log('⏳ Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.\n');

  console.log('🔍 Fetching all videos for analysis...');
  const videos = await Video.find({}).sort({ createdAt: -1 }).lean();
  console.log(`📦 Loaded ${videos.length} total videos from database.\n`);

  const now = Date.now();
  const flaggedVideos = [];

  // Group videos by owner to detect duplicate uploads
  const videosByOwner = new Map();
  videos.forEach((v) => {
    const ownerStr = String(v.owner);
    if (!videosByOwner.has(ownerStr)) {
      videosByOwner.set(ownerStr, []);
    }
    videosByOwner.get(ownerStr).push(v);
  });

  const flaggedIds = new Set();

  for (const v of videos) {
    const videoAgeMs = now - new Date(v.createdAt || 0).getTime();
    // In-flight upload grace period: skip any video created in last 2 hours
    if (videoAgeMs < GRACE_PERIOD_MS) continue;

    const likesCount = Array.isArray(v.likes) ? v.likes.length : 0;
    const views = v.views || 0;
    const duration = typeof v.duration === 'number' ? v.duration : 0;
    const title = (v.title || '').trim();

    let reason = null;
    let category = null;

    // Category 1: Accidental Ultra-Short Pocket Recording (<= 2 seconds, 0 views, 0 likes)
    if (duration > 0 && duration <= 2 && views === 0 && likesCount === 0) {
      category = 'Accidental Pocket Recording (≤ 2s)';
      reason = `Accidental clip: ${duration}s duration with 0 views and 0 likes`;
    }
    // Category 2: Zero or Missing Duration with 0 views (corrupted / aborted upload)
    else if (duration === 0 && views === 0 && likesCount === 0) {
      category = 'Zero-Duration Corrupted Upload';
      reason = '0s duration unplayable video with 0 views';
    }
    // Category 3: Test or Gibberish Title (e.g., 'test', 'asdf', '123') with low engagement
    else if (JUNK_TITLE_REGEX.test(title) && views <= 1 && likesCount === 0) {
      category = 'Test / Gibberish Title';
      reason = `Test title "${title}" with ${views} views`;
    }
    // Category 4: Dead 0-Engagement Abandoned Videos (> 60 days old, 0 views, 0 likes, 0 comments)
    else if (includeDead && videoAgeMs > DEAD_THRESHOLD_MS && views === 0 && likesCount === 0 && (v.commentsCount || 0) === 0) {
      const daysOld = Math.round(videoAgeMs / (24 * 60 * 60 * 1000));
      category = 'Abandoned Video (> 60 days, 0 views)';
      reason = `Dead video: ${daysOld} days old with 0 views, 0 likes, 0 comments`;
    }

    if (reason && !flaggedIds.has(String(v._id))) {
      flaggedIds.add(String(v._id));
      const videoFile = getFileSize(v.videoUrl);
      const thumbFile = getFileSize(v.thumbnail);
      const totalSize = videoFile.size + thumbFile.size;

      flaggedVideos.push({
        id: v._id,
        title: v.title,
        duration: v.duration,
        views: v.views,
        createdAt: v.createdAt,
        category,
        reason,
        size: totalSize,
        videoPath: videoFile.path,
        thumbPath: thumbFile.path,
      });
    }
  }

  // Category 5: Detect Duplicate Uploads (Double-taps by same user within 5 minutes)
  for (const [ownerId, userVideos] of videosByOwner.entries()) {
    // Sort oldest to newest
    userVideos.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

    for (let i = 0; i < userVideos.length; i++) {
      const original = userVideos[i];
      if (flaggedIds.has(String(original._id))) continue;

      for (let j = i + 1; j < userVideos.length; j++) {
        const copy = userVideos[j];
        if (flaggedIds.has(String(copy._id))) continue;

        const timeDiffMs = Math.abs(new Date(copy.createdAt) - new Date(original.createdAt));
        // If uploaded within 5 minutes with identical title
        if (timeDiffMs < 5 * 60 * 1000 && original.title.trim().toLowerCase() === copy.title.trim().toLowerCase()) {
          flaggedIds.add(String(copy._id));
          const videoFile = getFileSize(copy.videoUrl);
          const thumbFile = getFileSize(copy.thumbnail);
          const totalSize = videoFile.size + thumbFile.size;

          flaggedVideos.push({
            id: copy._id,
            title: copy.title,
            duration: copy.duration,
            views: copy.views,
            createdAt: copy.createdAt,
            category: 'Duplicate Double-Tap Upload',
            reason: `Duplicate copy of "${original.title}" uploaded within ${Math.round(timeDiffMs / 1000)}s`,
            size: totalSize,
            videoPath: videoFile.path,
            thumbPath: thumbFile.path,
          });
        }
      }
    }
  }

  // Group by Category for summary report
  const summaryByCategory = {};
  let totalReclaimableBytes = 0;

  flaggedVideos.forEach((item) => {
    if (!summaryByCategory[item.category]) {
      summaryByCategory[item.category] = { count: 0, bytes: 0 };
    }
    summaryByCategory[item.category].count++;
    summaryByCategory[item.category].bytes += item.size;
    totalReclaimableBytes += item.size;
  });

  console.log('====================================================');
  console.log('             JUNK VIDEO AUDIT BREAKDOWN             ');
  console.log('====================================================');
  if (Object.keys(summaryByCategory).length === 0) {
    console.log('🎉 No accidental or junk videos found! Your catalog is clean.');
    console.log('====================================================\n');
    await mongoose.disconnect();
    return;
  }

  for (const [catName, stats] of Object.entries(summaryByCategory)) {
    console.log(`• ${catName.padEnd(38)}: ${String(stats.count).padStart(5)} videos  (${formatBytes(stats.bytes)})`);
  }
  console.log('----------------------------------------------------');
  console.log(`TOTAL FLAGGED JUNK VIDEOS:             ${String(flaggedVideos.length).padStart(5)} videos  (${formatBytes(totalReclaimableBytes)})`);
  console.log('====================================================\n');

  // Print sample of flagged videos
  console.log('📋 SAMPLE OF FLAGGED VIDEOS (First 8):');
  flaggedVideos.slice(0, 8).forEach((f, idx) => {
    console.log(`  ${idx + 1}. [${f.category}] "${f.title}" (${f.duration}s, ${f.views} views) - ${formatBytes(f.size)}`);
    console.log(`     Reason: ${f.reason}`);
  });
  console.log('');

  if (!shouldDelete) {
    console.log(`💡 DRY RUN COMPLETE: Found ${formatBytes(totalReclaimableBytes)} in ${flaggedVideos.length} junk videos that can be safely freed.`);
    console.log('👉 To permanently delete these junk videos and recover storage, run:');
    console.log('   docker compose exec backend node scripts/auditJunkVideos.js --delete\n');
    console.log('ℹ️ Tip: To also scan abandoned 60-day 0-view videos, add --include-dead:');
    console.log('   docker compose exec backend node scripts/auditJunkVideos.js --include-dead\n');
  } else {
    console.log(`🚀 RECLAIMING SPACE: Deleting ${flaggedVideos.length} junk videos and files...`);
    let deletedCount = 0;
    let deletedBytes = 0;

    for (const item of flaggedVideos) {
      try {
        // 1. Delete physical files from disk
        if (item.videoPath && fs.existsSync(item.videoPath)) {
          fs.unlinkSync(item.videoPath);
        }
        if (item.thumbPath && fs.existsSync(item.thumbPath)) {
          fs.unlinkSync(item.thumbPath);
        }

        // 2. Cascade delete from MongoDB
        await Promise.allSettled([
          Video.findByIdAndDelete(item.id),
          Comment.deleteMany({ video: item.id }),
          VideoReport.deleteMany({ video: item.id }),
          VideoMonetizationReview.deleteMany({ video: item.id }),
        ]);

        deletedCount++;
        deletedBytes += item.size;
      } catch (err) {
        console.warn(`⚠️ Error deleting video ${item.id}:`, err.message);
      }
    }

    console.log(`\n✅ DONE! Successfully purged ${deletedCount} junk videos.`);
    console.log(`🎉 RECLAIMED STORAGE: ${formatBytes(deletedBytes)} of disk space is now free!`);
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('❌ Fatal error during audit:', err);
  process.exit(1);
});
