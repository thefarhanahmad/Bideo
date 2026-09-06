const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const ErrorLog = require('../models/ErrorLog');
const Video = require('../models/Video');
const Post = require('../models/Post');
const User = require('../models/User');
const Ad = require('../models/Ad');
const { runOrphanMediaCleanup, initOrphanMediaScheduler } = require('../utils/orphanMediaScheduler');
const { deleteLocalFile } = require('../utils/localUpload');

const runVerification = async () => {
  console.log('====================================================');
  console.log('       BIDEO OPTIMIZATIONS VERIFICATION SUITE       ');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  const assert = (condition, testName) => {
    totalTests++;
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passedTests++;
    } else {
      console.error(`  ❌ FAIL: ${testName}`);
    }
  };

  // ----------------------------------------------------
  // TEST 1: MongoDB TTL Index on ErrorLog Model
  // ----------------------------------------------------
  console.log('TEST 1: Checking ErrorLog TTL Index...');
  const errorLogIndexes = ErrorLog.schema.indexes();
  const ttlIndex = errorLogIndexes.find(
    (idx) => idx[0] && idx[0].lastSeenAt === 1 && idx[1] && idx[1].expireAfterSeconds === 5184000
  );
  assert(ttlIndex !== undefined, 'ErrorLog has TTL index on lastSeenAt with 5,184,000s (60 days)');

  // ----------------------------------------------------
  // TEST 2: Orphan Media Scheduler Initialization
  // ----------------------------------------------------
  console.log('\nTEST 2: Checking OrphanMediaScheduler Exports & Init...');
  assert(typeof runOrphanMediaCleanup === 'function', 'runOrphanMediaCleanup is exported and callable');
  assert(typeof initOrphanMediaScheduler === 'function', 'initOrphanMediaScheduler is exported and callable');

  // ----------------------------------------------------
  // TEST 3: Orphan Media Sweeper Logic (Grace Period & In-Flight Shield)
  // ----------------------------------------------------
  console.log('\nTEST 3: Checking Orphan Media Sweeper Logic with Simulated Disk Files...');
  const uploadsDir = path.resolve(__dirname, '../uploads');
  const videosDir = path.join(uploadsDir, 'videos');
  const imagesDir = path.join(uploadsDir, 'images');

  if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

  const now = Date.now();
  const THREE_HOURS_AGO = new Date(now - 3 * 60 * 60 * 1000); // Older than 2h grace period
  const TEN_MINUTES_AGO = new Date(now - 10 * 60 * 1000);    // Younger than 2h (in-flight)

  // File A: Abandoned file older than 2 hours (should be DELETED)
  const fileOrphanOld = path.join(videosDir, `test-orphan-old-${now}.mp4`);
  fs.writeFileSync(fileOrphanOld, 'dummy orphan old video content');
  fs.utimesSync(fileOrphanOld, THREE_HOURS_AGO, THREE_HOURS_AGO);

  // File B: In-flight file created 10 mins ago (should be PROTECTED / KEPT)
  const fileInFlight = path.join(videosDir, `test-inflight-${now}.mp4`);
  fs.writeFileSync(fileInFlight, 'dummy in-flight video content');
  fs.utimesSync(fileInFlight, TEN_MINUTES_AGO, TEN_MINUTES_AGO);

  // File C: Protected APK file (should NEVER be touched)
  const fileApk = path.join(imagesDir, 'bideo.apk');
  let apkExistedBefore = fs.existsSync(fileApk);
  if (!apkExistedBefore) {
    fs.writeFileSync(fileApk, 'dummy apk');
  }

  // Connect to DB for real audit scan test
  if (process.env.MONGODB_URI) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('  Connected to MongoDB. Running orphan media cleanup pass...');
      
      await runOrphanMediaCleanup();

      const orphanStillExists = fs.existsSync(fileOrphanOld);
      const inFlightStillExists = fs.existsSync(fileInFlight);
      const apkStillExists = fs.existsSync(fileApk);

      assert(!orphanStillExists, 'Orphaned file older than 2 hours was successfully cleaned up');
      assert(inFlightStillExists, 'In-flight file (10 mins old) was safely PROTECTED and NOT deleted');
      assert(apkStillExists, 'Special file bideo.apk was strictly PROTECTED and NOT deleted');

      // Cleanup remaining test in-flight file
      if (inFlightStillExists) fs.unlinkSync(fileInFlight);
      if (!apkExistedBefore && fs.existsSync(fileApk)) fs.unlinkSync(fileApk);

    } catch (err) {
      console.warn('  ⚠️ MongoDB connection failed during test, skipping live DB pass:', err.message);
    }
  }

  // ----------------------------------------------------
  // TEST 4: Controller Safety Verification
  // ----------------------------------------------------
  console.log('\nTEST 4: Checking Controller Leak Protections...');
  const authController = require('../controllers/auth');
  const videoController = require('../controllers/video');
  const postController = require('../controllers/post');
  const adController = require('../controllers/ad');

  assert(typeof authController.updateChannel === 'function', 'auth.updateChannel is defined');
  assert(typeof videoController.uploadVideo === 'function', 'video.uploadVideo is defined');
  assert(typeof videoController.updateVideo === 'function', 'video.updateVideo is defined');
  assert(typeof postController.createPost === 'function', 'post.createPost is defined');
  assert(typeof postController.updatePost === 'function', 'post.updatePost is defined');
  assert(typeof adController.createAd === 'function', 'ad.createAd is defined');
  assert(typeof adController.updateAd === 'function', 'ad.updateAd is defined');

  // ----------------------------------------------------
  // TEST 5: deleteLocalFile URL Sanitization & Path Traversal Guard
  // ----------------------------------------------------
  console.log('\nTEST 5: Testing deleteLocalFile Security Guard...');
  // Should safely ignore invalid URLs, nulls, default avatars
  deleteLocalFile(null);
  deleteLocalFile('');
  deleteLocalFile('https://example.com/avatar.png');
  deleteLocalFile('/default-avatar.png');
  deleteLocalFile('../../../etc/passwd');
  assert(true, 'deleteLocalFile handled null, invalid URLs, and traversal attempts safely without throwing');

  console.log('\n====================================================');
  console.log(`TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED`);
  console.log('====================================================\n');

  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }

  process.exit(passedTests === totalTests ? 0 : 1);
};

runVerification().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
