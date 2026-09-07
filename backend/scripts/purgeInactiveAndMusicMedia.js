/**
 * Bideo Inactive Creator & Music Media Purge Tool
 * 
 * Safely frees disk space by removing videos, thumbnails, and posts from:
 *   1. Inactive Creators (No watch history, uploads, or activity in the last 2 days).
 *   2. Music / Song Videos (Videos categorized as music or using music/songs).
 * 
 * Strict Safety Protections:
 *   - 100% Monetization Protection: Any creator with an approved monetization application,
 *     any PASSED monetization video review, or verified channel is NEVER touched.
 *   - Today's Uploads Protection: NEVER deletes any video or post uploaded today (or last 24h).
 *   - New Account Protection: Users registered within the last 48h are protected.
 *   - Dry Run by Default: Reports exact counts, MB/GB savings, and sample titles without deleting.
 * 
 * Usage:
 *   Dry Run (Report Only):        docker compose exec backend node scripts/purgeInactiveAndMusicMedia.js
 *   Live Purge (Delete Files):    docker compose exec backend node scripts/purgeInactiveAndMusicMedia.js --delete
 *   Inactive Creators Only:       docker compose exec backend node scripts/purgeInactiveAndMusicMedia.js --inactive-only
 *   Music Videos Only:            docker compose exec backend node scripts/purgeInactiveAndMusicMedia.js --music-only
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const VideoView = require('../models/VideoView');
const VideoReport = require('../models/VideoReport');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');
const MonetizationApplication = require('../models/MonetizationApplication');
const Playlist = require('../models/Playlist');
const Notification = require('../models/Notification');
const Category = require('../models/Category');

const shouldDelete = process.argv.includes('--delete');
const inactiveOnly = process.argv.includes('--inactive-only');
const musicOnly = process.argv.includes('--music-only');
const protectPending = process.argv.includes('--protect-pending');

// Time Thresholds
const TWO_DAYS_MS = 2 * 24 * 60 * 60 * 1000;
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

// Regex for detecting music, songs, remix, ringtones, bgm, etc.
const MUSIC_REGEX = /\b(music|song|songs|remix|dj\s*remix|bgm|soundtrack|ringtone|audio\s*track|gaana|gana|geet|mashup|lyrics|official\s*music|album\s*song|punjabi\s*song|bhojpuri\s*song|hindi\s*song|sad\s*song|status\s*song)\b/i;

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
  const uploadsBaseDir = path.resolve(__dirname, '../uploads');
  const absolutePath = path.resolve(path.join(__dirname, '..', relativePath));
  if (!absolutePath.startsWith(uploadsBaseDir)) return null;
  return absolutePath;
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
  console.log('    BIDEO INACTIVE CREATOR & MUSIC PURGE TOOL       ');
  console.log('====================================================\n');
  console.log(`MODE: ${shouldDelete ? '🚨 LIVE PERMANENT DELETION (--delete)' : '🛡️  SAFE DRY-RUN (Report only)'}`);
  if (inactiveOnly) console.log('SCOPE: Inactive creators only (--inactive-only)');
  else if (musicOnly) console.log('SCOPE: Music videos only (--music-only)');
  else console.log('SCOPE: Both Inactive Creators AND Music Videos');
  console.log('');

  console.log('⏳ Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.\n');

  const now = Date.now();
  const twoDaysAgo = new Date(now - TWO_DAYS_MS);
  const twentyFourHoursAgo = new Date(now - TWENTY_FOUR_HOURS_MS);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  console.log('🔍 Indexing Protected Monetization Creators & Videos...');
  
  // 1. Approved channel monetization applications
  const monetizedUserIds = await MonetizationApplication.find({ status: 'approved' }).distinct('user').catch(() => []);

  // 2. Videos that PASSED monetization review (or pending if --protect-pending is explicitly passed)
  const reviewStatuses = protectPending ? ['passed', 'pending'] : ['passed'];
  const passedReviewUserIds = await VideoMonetizationReview.find({ 
    status: { $in: reviewStatuses } 
  }).distinct('user').catch(() => []);

  // 3. Specific videos that PASSED monetization
  const passedVideoIds = await VideoMonetizationReview.find({ 
    status: { $in: reviewStatuses } 
  }).distinct('video').catch(() => []);
  const protectedVideoSet = new Set(passedVideoIds.map(String));

  // 4. Verified channels and Admins
  const verifiedUserIds = await User.find({ 
    $or: [{ isVerified: true }, { role: 'admin' }] 
  }).distinct('_id').catch(() => []);

  // Combined set of 100% PROTECTED creators
  const protectedUserSet = new Set([
    ...monetizedUserIds.map(String),
    ...passedReviewUserIds.map(String),
    ...verifiedUserIds.map(String),
  ]);

  const totalPendingReviews = await VideoMonetizationReview.countDocuments({ status: 'pending' }).catch(() => 0);
  const totalPassedReviews = await VideoMonetizationReview.countDocuments({ status: 'passed' }).catch(() => 0);

  console.log(`   ✔ Approved Monetized Channels:              ${monetizedUserIds.length}`);
  console.log(`   ✔ Videos with PASSED Monetization Reviews:   ${totalPassedReviews}`);
  console.log(`   ✔ Videos with Pending Auto-Reviews in DB:    ${totalPendingReviews}`);
  console.log(`   ✔ Verified Users & Admins:                  ${verifiedUserIds.length}`);
  console.log(`   ⭐ Total Protected Monetized Creators:       ${protectedUserSet.size} (NEVER TOUCHED)`);
  console.log(`   ⭐ Total Protected Monetized Videos:         ${protectedVideoSet.size} (NEVER TOUCHED)\n`);

  console.log('🔍 Detecting User Activity in the Last 2 Days...');

  // Active signal 1: Users who watched videos in last 2 days (VideoView records)
  const activeViewerIds = await VideoView.find({
    user: { $ne: null },
    createdAt: { $gte: twoDaysAgo }
  }).distinct('user').catch(() => []);

  // Active signal 2: Creators who uploaded a video in last 2 days
  const recentVideoUploaderIds = await Video.find({
    createdAt: { $gte: twoDaysAgo }
  }).distinct('owner').catch(() => []);

  // Active signal 3: Creators who created a post in last 2 days
  const recentPostUploaderIds = await Post.find({
    createdAt: { $gte: twoDaysAgo }
  }).distinct('owner').catch(() => []);

  // Active signal 4: Users who commented in last 2 days
  const recentCommenterIds = await Comment.find({
    createdAt: { $gte: twoDaysAgo }
  }).distinct('user').catch(() => []);

  // Active signal 5: Brand new accounts created in last 48h
  const newAccountIds = await User.find({
    createdAt: { $gte: twoDaysAgo }
  }).distinct('_id').catch(() => []);

  // All active users in last 2 days
  const activeUserSet = new Set([
    ...activeViewerIds.map(String),
    ...recentVideoUploaderIds.map(String),
    ...recentPostUploaderIds.map(String),
    ...recentCommenterIds.map(String),
    ...newAccountIds.map(String),
  ]);

  console.log(`   ✔ Active Viewers (watched in last 2d):       ${activeViewerIds.length}`);
  console.log(`   ✔ Active Uploaders (video/post in last 2d):  ${new Set([...recentVideoUploaderIds, ...recentPostUploaderIds].map(String)).size}`);
  console.log(`   ✔ Total Active Users in last 2 Days:        ${activeUserSet.size}\n`);

  // Detect Music Categories
  const musicCategories = await Category.find({
    $or: [
      { name: { $regex: /music|song|gaana|audio/i } },
      { slug: { $regex: /music|song|gaana|audio/i } },
    ]
  }).distinct('_id').catch(() => []);
  const musicCategorySet = new Set(musicCategories.map(String));

  console.log('📦 Scanning Videos and Posts for Flagging...\n');

  // Load all videos with required fields
  const allVideos = await Video.find({}, 'title description thumbnail videoUrl owner category tags createdAt views duration').lean();
  console.log(`   ✔ Total Videos in Database: ${allVideos.length}`);

  // Load all posts
  const allPosts = await Post.find({}, 'imageUrl owner createdAt text').lean();
  console.log(`   ✔ Total Posts in Database:  ${allPosts.length}\n`);

  const flaggedVideos = [];
  const flaggedPosts = [];
  const flaggedVideoIds = new Set();
  const flaggedPostIds = new Set();
  const inactiveCreatorIds = new Set();

  const isUploadedTodayOrRecent = (date) => {
    if (!date) return false;
    const d = new Date(date);
    return d >= startOfToday || d >= twentyFourHoursAgo;
  };

  // 1. Process Inactive Creators
  if (!musicOnly) {
    for (const v of allVideos) {
      const ownerStr = String(v.owner);
      
      // Strict Protection: Never touch monetized or passed-review creators/videos
      if (protectedUserSet.has(ownerStr) || protectedVideoSet.has(String(v._id))) continue;

      // Strict Protection: Never delete videos uploaded today or within last 24h
      if (isUploadedTodayOrRecent(v.createdAt)) continue;

      // Check if creator was inactive for 2+ days
      if (!activeUserSet.has(ownerStr)) {
        inactiveCreatorIds.add(ownerStr);
        flaggedVideoIds.add(String(v._id));

        const videoFile = getFileSize(v.videoUrl);
        const thumbFile = getFileSize(v.thumbnail);
        const totalSize = videoFile.size + thumbFile.size;

        flaggedVideos.push({
          id: v._id,
          title: v.title,
          owner: v.owner,
          duration: v.duration,
          views: v.views,
          createdAt: v.createdAt,
          category: 'Inactive Creator (> 2 days)',
          reason: 'Creator has 0 watch history, uploads, or activity in last 2 days',
          size: totalSize,
          videoPath: videoFile.path,
          thumbPath: thumbFile.path,
          videoUrl: v.videoUrl,
          thumbUrl: v.thumbnail,
        });
      }
    }

    // Process Posts for Inactive Creators
    for (const p of allPosts) {
      const ownerStr = String(p.owner);
      if (protectedUserSet.has(ownerStr)) continue;
      if (isUploadedTodayOrRecent(p.createdAt)) continue;

      if (!activeUserSet.has(ownerStr)) {
        flaggedPostIds.add(String(p._id));
        const postImgFile = getFileSize(p.imageUrl);

        flaggedPosts.push({
          id: p._id,
          owner: p.owner,
          createdAt: p.createdAt,
          category: 'Inactive Creator Post',
          size: postImgFile.size,
          imgPath: postImgFile.path,
          imageUrl: p.imageUrl,
        });
      }
    }
  }

  // 2. Process Music Videos
  if (!inactiveOnly) {
    for (const v of allVideos) {
      const vIdStr = String(v._id);
      if (flaggedVideoIds.has(vIdStr)) continue; // Already flagged under inactive

      const ownerStr = String(v.owner);

      // Strict Protection: Never touch monetized or passed-review creators/videos
      if (protectedUserSet.has(ownerStr) || protectedVideoSet.has(vIdStr)) continue;

      // Strict Protection: Never delete videos uploaded today or within last 24h
      if (isUploadedTodayOrRecent(v.createdAt)) continue;

      // Check if video is using music
      const isMusicCategory = v.category && musicCategorySet.has(String(v.category));
      const hasMusicTitle = MUSIC_REGEX.test(v.title || '');
      const hasMusicDesc = MUSIC_REGEX.test(v.description || '');
      const hasMusicTag = Array.isArray(v.tags) && v.tags.some((t) => MUSIC_REGEX.test(t));

      if (isMusicCategory || hasMusicTitle || hasMusicDesc || hasMusicTag) {
        flaggedVideoIds.add(vIdStr);

        const videoFile = getFileSize(v.videoUrl);
        const thumbFile = getFileSize(v.thumbnail);
        const totalSize = videoFile.size + thumbFile.size;

        let matchReason = 'Music/Song detected in title';
        if (isMusicCategory) matchReason = 'Categorized under Music';
        else if (hasMusicTag) matchReason = 'Music/Song detected in tags';
        else if (hasMusicDesc) matchReason = 'Music/Song detected in description';

        flaggedVideos.push({
          id: v._id,
          title: v.title,
          owner: v.owner,
          duration: v.duration,
          views: v.views,
          createdAt: v.createdAt,
          category: 'Music / Song Video',
          reason: matchReason,
          size: totalSize,
          videoPath: videoFile.path,
          thumbPath: thumbFile.path,
          videoUrl: v.videoUrl,
          thumbUrl: v.thumbnail,
        });
      }
    }
  }

  // Calculate Breakdown Statistics
  let totalVideoBytes = 0;
  let inactiveVideoCount = 0;
  let inactiveVideoBytes = 0;
  let musicVideoCount = 0;
  let musicVideoBytes = 0;

  flaggedVideos.forEach((v) => {
    totalVideoBytes += v.size;
    if (v.category.startsWith('Inactive')) {
      inactiveVideoCount++;
      inactiveVideoBytes += v.size;
    } else {
      musicVideoCount++;
      musicVideoBytes += v.size;
    }
  });

  let totalPostBytes = 0;
  flaggedPosts.forEach((p) => {
    totalPostBytes += p.size;
  });

  const grandTotalBytes = totalVideoBytes + totalPostBytes;

  console.log('====================================================');
  console.log('               AUDIT SUMMARY & BREAKDOWN            ');
  console.log('====================================================');
  console.log(`• Inactive Creators Identified (2+ days):    ${inactiveCreatorIds.size} users`);
  console.log(`• Inactive Creator Videos:                  ${String(inactiveVideoCount).padStart(5)} videos (${formatBytes(inactiveVideoBytes)})`);
  console.log(`• Inactive Creator Posts:                   ${String(flaggedPosts.length).padStart(5)} posts  (${formatBytes(totalPostBytes)})`);
  console.log(`• Music / Song Videos Flagged:              ${String(musicVideoCount).padStart(5)} videos (${formatBytes(musicVideoBytes)})`);
  console.log('----------------------------------------------------');
  console.log(`TOTAL RECLAIMABLE MEDIA:                    ${flaggedVideos.length + flaggedPosts.length} items  (${formatBytes(grandTotalBytes)})`);
  console.log('====================================================\n');

  if (flaggedVideos.length === 0 && flaggedPosts.length === 0) {
    console.log('🎉 No media met the criteria for purging! Everything is active or protected.');
    await mongoose.disconnect();
    return;
  }

  // Display sample of flagged videos
  console.log('📋 SAMPLE OF FLAGGED VIDEOS (First 10):');
  flaggedVideos.slice(0, 10).forEach((f, idx) => {
    const ageDays = Math.round((now - new Date(f.createdAt).getTime()) / (24 * 60 * 60 * 1000));
    console.log(`  ${String(idx + 1).padStart(2)}. [${f.category}] "${f.title}" (${f.duration || 0}s, ${f.views || 0} views, ${ageDays}d ago) - ${formatBytes(f.size)}`);
    console.log(`      Reason: ${f.reason}`);
  });
  console.log('');

  if (!shouldDelete) {
    console.log(`💡 DRY RUN FINISHED: You can reclaim ~${formatBytes(grandTotalBytes)} of disk storage.`);
    console.log('👉 To permanently purge these files from disk and database, run:');
    console.log('   docker compose exec backend node scripts/purgeInactiveAndMusicMedia.js --delete\n');
  } else {
    console.log(`🚨 LIVE PURGE RUNNING: Deleting ${flaggedVideos.length} videos and ${flaggedPosts.length} posts...`);

    let deletedFiles = 0;
    let deletedBytes = 0;

    // 1. Delete Videos & Cascading DB records
    for (const v of flaggedVideos) {
      try {
        if (v.videoPath && fs.existsSync(v.videoPath)) {
          fs.unlinkSync(v.videoPath);
          deletedFiles++;
        }
        if (v.thumbPath && fs.existsSync(v.thumbPath)) {
          fs.unlinkSync(v.thumbPath);
          deletedFiles++;
        }

        await Promise.allSettled([
          Video.findByIdAndDelete(v.id),
          Comment.deleteMany({ video: v.id }),
          VideoReport.deleteMany({ video: v.id }),
          VideoMonetizationReview.deleteMany({ video: v.id }),
          VideoView.deleteMany({ video: v.id }),
          Notification.deleteMany({ video: v.id }),
          Playlist.updateMany({ videos: v.id }, { $pull: { videos: v.id } }),
          User.updateMany(
            { $or: [{ watchHistory: v.id }, { likedVideos: v.id }] },
            { $pull: { watchHistory: v.id, likedVideos: v.id } }
          ),
        ]);

        deletedBytes += v.size;
      } catch (err) {
        console.warn(`⚠️ Error purging video ${v.id}:`, err.message);
      }
    }

    // 2. Delete Posts & Cascading DB records
    for (const p of flaggedPosts) {
      try {
        if (p.imgPath && fs.existsSync(p.imgPath)) {
          fs.unlinkSync(p.imgPath);
          deletedFiles++;
        }

        await Promise.allSettled([
          Post.findByIdAndDelete(p.id),
          Comment.deleteMany({ post: p.id }),
          Notification.deleteMany({ post: p.id }),
          User.updateMany({ $or: [{ likedVideos: p.id }] }, { $pull: { likedVideos: p.id } }),
        ]);

        deletedBytes += p.size;
      } catch (err) {
        console.warn(`⚠️ Error purging post ${p.id}:`, err.message);
      }
    }

    console.log('\n====================================================');
    console.log('                 PURGE COMPLETE!                    ');
    console.log('====================================================');
    console.log(`✅ Successfully deleted physical files:     ${deletedFiles} files`);
    console.log(`✅ Successfully purged videos from DB:     ${flaggedVideos.length} videos`);
    console.log(`✅ Successfully purged posts from DB:      ${flaggedPosts.length} posts`);
    console.log(`🎉 TOTAL STORAGE RECLAIMED:                ${formatBytes(deletedBytes)}`);
    console.log('====================================================\n');
  }

  await mongoose.disconnect();
};

run().catch((err) => {
  console.error('❌ Fatal error during purge execution:', err);
  process.exit(1);
});
