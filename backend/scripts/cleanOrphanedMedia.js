/**
 * Bideo Production Orphaned Media Audit & Cleanup Script
 * 
 * Safely audits and cleans abandoned video/image files from deleted videos,
 * failed uploads, and stale temp files without touching any live media.
 * 
 * Safety Features:
 *   - 2-Hour In-Flight Grace Period: Any file modified in the last 2 hours is NEVER deleted.
 *   - Full Multi-Model Indexing: Checks Video, Post, User, and Ad models.
 *   - Protected Folders: Never touches uploads/apk (where bideo.apk lives).
 *   - Dry Run by Default: Reports sizes without deleting anything unless --delete is passed.
 * 
 * Usage:
 *   Dry Run (Report Only):        node scripts/cleanOrphanedMedia.js
 *   Reclaim Space (Delete):       node scripts/cleanOrphanedMedia.js --delete
 * 
 * Inside Server Docker:
 *   docker compose exec backend node scripts/cleanOrphanedMedia.js
 *   docker compose exec backend node scripts/cleanOrphanedMedia.js --delete
 */

const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables from backend/.env
dotenv.config({ path: path.join(__dirname, '../.env') });

const Video = require('../models/Video');
const Post = require('../models/Post');
const User = require('../models/User');
const Ad = require('../models/Ad');

const shouldDelete = process.argv.includes('--delete');
const GRACE_PERIOD_MS = 2 * 60 * 60 * 1000; // 2 hours

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

const runAudit = async () => {
  const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('❌ MONGODB_URI not found in environment.');
    process.exit(1);
  }

  console.log('====================================================');
  console.log('        BIDEO STORAGE AUDIT & CLEANUP TOOL          ');
  console.log('====================================================\n');
  console.log(`MODE: ${shouldDelete ? '🚨 LIVE DELETION (--delete)' : '🛡️  SAFE DRY-RUN (Report only)'}\n`);

  console.log('⏳ Connecting to MongoDB...');
  await mongoose.connect(mongoUri);
  console.log('✅ Connected to MongoDB.\n');

  console.log('🔍 Indexing all live media references from database...');
  const activeFilenames = new Set();

  // 1. Index Videos & Thumbnails
  const videos = await Video.find({}, 'videoUrl thumbnail').lean();
  videos.forEach((v) => {
    const vFile = extractFilename(v.videoUrl);
    if (vFile) activeFilenames.add(vFile);
    const tFile = extractFilename(v.thumbnail);
    if (tFile) activeFilenames.add(tFile);
  });
  console.log(`   ✔ Videos indexed:     ${videos.length} videos`);

  // 2. Index Posts
  const posts = await Post.find({}, 'imageUrl').lean();
  posts.forEach((p) => {
    const pFile = extractFilename(p.imageUrl);
    if (pFile) activeFilenames.add(pFile);
  });
  console.log(`   ✔ Posts indexed:      ${posts.length} posts`);

  // 3. Index User Avatars & Covers
  const users = await User.find({}, 'avatar coverImage').lean();
  users.forEach((u) => {
    const aFile = extractFilename(u.avatar);
    if (aFile) activeFilenames.add(aFile);
    const cFile = extractFilename(u.coverImage);
    if (cFile) activeFilenames.add(cFile);
  });
  console.log(`   ✔ Users indexed:      ${users.length} users`);

  // 4. Index Ads
  const ads = await Ad.find({}, 'image').lean();
  ads.forEach((a) => {
    const aFile = extractFilename(a.image);
    if (aFile) activeFilenames.add(aFile);
  });
  console.log(`   ✔ Ads indexed:        ${ads.length} ads`);

  console.log(`\n📦 Total unique active media files in DB: ${activeFilenames.size}\n`);

  // 5. Scan uploads directories
  const uploadsBase = path.resolve(__dirname, '../uploads');
  const targetDirs = ['videos', 'images', 'thumbnails'];

  let totalDiskFiles = 0;
  let totalDiskBytes = 0;
  let activeDiskBytes = 0;
  let orphanedDiskBytes = 0;
  let inFlightSkippedCount = 0;

  const orphanedFiles = [];
  const now = Date.now();

  for (const dir of targetDirs) {
    const fullDirPath = path.join(uploadsBase, dir);
    if (!fs.existsSync(fullDirPath)) continue;

    const files = fs.readdirSync(fullDirPath);
    for (const file of files) {
      if (file.startsWith('.') || file === 'bideo.apk') continue;

      const filePath = path.join(fullDirPath, file);
      try {
        const stat = fs.statSync(filePath);
        if (!stat.isFile()) continue;

        totalDiskFiles++;
        totalDiskBytes += stat.size;

        // Is this file actively referenced in MongoDB?
        if (activeFilenames.has(file)) {
          activeDiskBytes += stat.size;
        } else {
          // Safety guard: Is the file newly created in the last 2 hours (in-flight upload)?
          const fileAgeMs = now - stat.mtimeMs;
          if (fileAgeMs < GRACE_PERIOD_MS) {
            inFlightSkippedCount++;
            activeDiskBytes += stat.size; // Treat as protected
          } else {
            // Truly orphaned/abandoned file
            orphanedDiskBytes += stat.size;
            orphanedFiles.push({ path: filePath, name: file, size: stat.size, dir });
          }
        }
      } catch (err) {
        // Skip unreadable files
      }
    }
  }

  console.log('====================================================');
  console.log('              STORAGE AUDIT BREAKDOWN               ');
  console.log('====================================================');
  console.log(`Total Media Files on Disk:    ${totalDiskFiles} (${formatBytes(totalDiskBytes)})`);
  console.log(`Active / Protected Files:     ${totalDiskFiles - orphanedFiles.length} (${formatBytes(activeDiskBytes)})`);
  if (inFlightSkippedCount > 0) {
    console.log(`In-Flight Uploads Protected:  ${inFlightSkippedCount} (Created < 2 hours ago)`);
  }
  console.log('----------------------------------------------------');
  console.log(`🗑️  ORPHANED / GHOST FILES:    ${orphanedFiles.length} (${formatBytes(orphanedDiskBytes)})`);
  console.log('====================================================\n');

  if (orphanedFiles.length === 0) {
    console.log('🎉 Amazing! No orphaned files found. All media on disk is active in your database.');
    await mongoose.disconnect();
    return;
  }

  if (!shouldDelete) {
    console.log(`💡 DRY RUN COMPLETE: Found ${formatBytes(orphanedDiskBytes)} of abandoned files that can be safely freed.`);
    console.log('👉 To permanently delete these orphaned files and reclaim space, run:');
    console.log('   docker compose exec backend node scripts/cleanOrphanedMedia.js --delete\n');
  } else {
    console.log(`🚀 RECLAIMING SPACE: Deleting ${orphanedFiles.length} orphaned files...`);
    let deletedCount = 0;
    let deletedBytes = 0;

    for (const item of orphanedFiles) {
      try {
        fs.unlinkSync(item.path);
        deletedCount++;
        deletedBytes += item.size;
      } catch (err) {
        console.warn(`⚠️ Could not delete ${item.name}:`, err.message);
      }
    }

    console.log(`\n✅ DONE! Successfully deleted ${deletedCount} abandoned files.`);
    console.log(`🎉 RECLAIMED STORAGE: ${formatBytes(deletedBytes)} of disk space is now free!`);
  }

  await mongoose.disconnect();
};

runAudit().catch((err) => {
  console.error('❌ Fatal error during audit:', err);
  process.exit(1);
});
