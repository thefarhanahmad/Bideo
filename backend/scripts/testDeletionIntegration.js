const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const User = require('../models/User');
const Video = require('../models/Video');
const Post = require('../models/Post');
const Comment = require('../models/Comment');
const Playlist = require('../models/Playlist');
const VideoView = require('../models/VideoView');
const VideoReport = require('../models/VideoReport');
const VideoMonetizationReview = require('../models/VideoMonetizationReview');
const Notification = require('../models/Notification');
const { permanentlyDeleteUser } = require('../utils/deletionScheduler');

const runTest = async () => {
  console.log('--- STARTING DELETION VERIFICATION TEST ---');
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('✅ Connected to MongoDB');

  // Ensure upload folders exist
  const uploadsDir = path.resolve(__dirname, '../uploads');
  const videosDir = path.join(uploadsDir, 'videos');
  const imagesDir = path.join(uploadsDir, 'images');
  if (!fs.existsSync(videosDir)) fs.mkdirSync(videosDir, { recursive: true });
  if (!fs.existsSync(imagesDir)) fs.mkdirSync(imagesDir, { recursive: true });

  // 1. Create dummy files on disk
  const testVideoFile = path.join(videosDir, `test-del-video-${Date.now()}.mp4`);
  const testThumbFile = path.join(imagesDir, `test-del-thumb-${Date.now()}.jpg`);
  const testPostFile = path.join(imagesDir, `test-del-post-${Date.now()}.jpg`);
  const testAvatarFile = path.join(imagesDir, `test-del-avatar-${Date.now()}.jpg`);

  fs.writeFileSync(testVideoFile, 'test video binary content');
  fs.writeFileSync(testThumbFile, 'test thumbnail content');
  fs.writeFileSync(testPostFile, 'test post image content');
  fs.writeFileSync(testAvatarFile, 'test avatar content');

  console.log('✅ Created temporary test files on disk');

  // Convert to URLs
  const videoUrl = `http://localhost:5000/api/uploads/videos/${path.basename(testVideoFile)}`;
  const thumbUrl = `http://localhost:5000/api/uploads/images/${path.basename(testThumbFile)}`;
  const postImgUrl = `http://localhost:5000/api/uploads/images/${path.basename(testPostFile)}`;
  const avatarUrl = `http://localhost:5000/api/uploads/images/${path.basename(testAvatarFile)}`;

  // 2. Create primary test user (to be deleted)
  const testUser = await User.create({
    name: 'Test Deletion User',
    email: `testdel_${Date.now()}@example.com`,
    password: 'password123',
    avatar: avatarUrl,
  });
  console.log(`✅ Created test user: ${testUser._id}`);

  // 3. Create secondary test user (to verify pulling dangling references)
  const viewerUser = await User.create({
    name: 'Test Viewer User',
    email: `testviewer_${Date.now()}@example.com`,
    password: 'password123',
  });
  console.log(`✅ Created viewer user: ${viewerUser._id}`);

  // 4. Create video owned by testUser
  const testVideo = await Video.create({
    title: 'Test Video To Delete',
    description: 'Testing file deletion',
    videoUrl: videoUrl,
    thumbnail: thumbUrl,
    owner: testUser._id,
    duration: 60,
  });
  console.log(`✅ Created test video: ${testVideo._id}`);

  // 5. Create post owned by testUser
  const testPost = await Post.create({
    owner: testUser._id,
    text: 'Test post with image to delete',
    imageUrl: postImgUrl,
  });
  console.log(`✅ Created test post: ${testPost._id}`);

  // 6. Create comment & view on video
  await Comment.create({
    user: viewerUser._id,
    video: testVideo._id,
    text: 'Nice test video!',
  });
  await VideoView.create({
    video: testVideo._id,
    user: viewerUser._id,
  });

  // 7. Add video to viewer's playlist and likedVideos
  const testPlaylist = await Playlist.create({
    owner: viewerUser._id,
    name: 'Test Playlist',
    videos: [testVideo._id],
  });
  await User.findByIdAndUpdate(viewerUser._id, {
    $push: { likedVideos: testVideo._id, watchHistory: testVideo._id, followingChannels: testUser._id },
  });

  console.log('✅ Created linked playlist, comments, views, and watch history references');

  // Verify files exist before deletion
  if (!fs.existsSync(testVideoFile) || !fs.existsSync(testThumbFile) || !fs.existsSync(testPostFile) || !fs.existsSync(testAvatarFile)) {
    throw new Error('Pre-check failed: Test files do not exist on disk before deletion');
  }

  // --- EXECUTE PERMANENT USER DELETION ---
  console.log('\n--- EXECUTING permanentlyDeleteUser ---');
  await permanentlyDeleteUser(testUser._id);
  console.log('Execution finished.');

  // --- VERIFY RESULTS ---
  console.log('\n--- VERIFYING RESULTS ---');

  // 1. Files on disk
  const videoFileExists = fs.existsSync(testVideoFile);
  const thumbFileExists = fs.existsSync(testThumbFile);
  const postFileExists = fs.existsSync(testPostFile);
  const avatarFileExists = fs.existsSync(testAvatarFile);

  console.log(`Disk check - Video file deleted: ${!videoFileExists ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Disk check - Thumbnail file deleted: ${!thumbFileExists ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Disk check - Post image file deleted: ${!postFileExists ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Disk check - Avatar file deleted: ${!avatarFileExists ? 'YES ✅' : 'NO ❌'}`);

  if (videoFileExists || thumbFileExists || postFileExists || avatarFileExists) {
    throw new Error('FAILURE: One or more files were NOT deleted from the server disk!');
  }

  // 2. Database checks
  const userInDb = await User.findById(testUser._id);
  const videoInDb = await Video.findById(testVideo._id);
  const postInDb = await Post.findById(testPost._id);
  const commentsInDb = await Comment.find({ video: testVideo._id });
  const viewsInDb = await VideoView.find({ video: testVideo._id });

  console.log(`DB check - User document deleted: ${!userInDb ? 'YES ✅' : 'NO ❌'}`);
  console.log(`DB check - Video document deleted: ${!videoInDb ? 'YES ✅' : 'NO ❌'}`);
  console.log(`DB check - Post document deleted: ${!postInDb ? 'YES ✅' : 'NO ❌'}`);
  console.log(`DB check - Comments on video deleted: ${commentsInDb.length === 0 ? 'YES ✅' : 'NO ❌'}`);
  console.log(`DB check - Views on video deleted: ${viewsInDb.length === 0 ? 'YES ✅' : 'NO ❌'}`);

  if (userInDb || videoInDb || postInDb || commentsInDb.length > 0 || viewsInDb.length > 0) {
    throw new Error('FAILURE: Records were not deleted from MongoDB!');
  }

  // 3. Check dangling references pulled
  const updatedPlaylist = await Playlist.findById(testPlaylist._id);
  const updatedViewer = await User.findById(viewerUser._id);

  const videoInPlaylist = updatedPlaylist.videos.some((v) => v.toString() === testVideo._id.toString());
  const videoInLiked = updatedViewer.likedVideos.some((v) => v.toString() === testVideo._id.toString());
  const videoInHistory = updatedViewer.watchHistory.some((v) => v.toString() === testVideo._id.toString());
  const userInFollowing = updatedViewer.followingChannels.some((u) => u.toString() === testUser._id.toString());

  console.log(`Ref check - Video pulled from viewer playlist: ${!videoInPlaylist ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Ref check - Video pulled from viewer likedVideos: ${!videoInLiked ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Ref check - Video pulled from viewer watchHistory: ${!videoInHistory ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Ref check - User pulled from viewer followingChannels: ${!userInFollowing ? 'YES ✅' : 'NO ❌'}`);

  if (videoInPlaylist || videoInLiked || videoInHistory || userInFollowing) {
    throw new Error('FAILURE: Dangling references were not cleaned up from other users!');
  }

  // Clean up viewer user & playlist
  await Playlist.findByIdAndDelete(testPlaylist._id);
  await User.findByIdAndDelete(viewerUser._id);

  // --- TEST SINGLE VIDEO DELETION ---
  console.log('\n--- TESTING SINGLE VIDEO DELETION (deleteVideo controller) ---');
  const singleVideoFile = path.join(videosDir, `test-single-vid-${Date.now()}.mp4`);
  const singleThumbFile = path.join(imagesDir, `test-single-thumb-${Date.now()}.jpg`);
  fs.writeFileSync(singleVideoFile, 'single video content');
  fs.writeFileSync(singleThumbFile, 'single thumb content');

  const singleVideoUrl = `http://localhost:5000/api/uploads/videos/${path.basename(singleVideoFile)}`;
  const singleThumbUrl = `http://localhost:5000/api/uploads/images/${path.basename(singleThumbFile)}`;

  const tempCreator = await User.create({
    name: 'Temp Creator',
    email: `tempcreator_${Date.now()}@example.com`,
    password: 'password123',
  });

  const singleVideo = await Video.create({
    title: 'Single Test Video',
    videoUrl: singleVideoUrl,
    thumbnail: singleThumbUrl,
    owner: tempCreator._id,
  });

  const singlePlaylist = await Playlist.create({
    owner: tempCreator._id,
    name: 'Single Playlist',
    videos: [singleVideo._id],
  });

  // Call deleteVideo controller directly
  const { deleteVideo } = require('../controllers/video');
  const mockReq = {
    params: { id: singleVideo._id.toString() },
    user: { id: tempCreator._id.toString(), role: 'user' },
  };
  let responseStatus = 0;
  let responseData = null;
  const mockRes = {
    status(code) { responseStatus = code; return this; },
    json(data) { responseData = data; return this; },
  };

  await deleteVideo(mockReq, mockRes, (err) => { if (err) throw err; });

  const singleVidDeletedOnDisk = !fs.existsSync(singleVideoFile);
  const singleThumbDeletedOnDisk = !fs.existsSync(singleThumbFile);
  const singleVidInDb = await Video.findById(singleVideo._id);
  const updatedSinglePlaylist = await Playlist.findById(singlePlaylist._id);
  const inPlaylist = updatedSinglePlaylist.videos.some((v) => v.toString() === singleVideo._id.toString());

  console.log(`Single Video - Controller status code: ${responseStatus} (expected 200)`);
  console.log(`Single Video - Video file deleted on disk: ${singleVidDeletedOnDisk ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Single Video - Thumbnail file deleted on disk: ${singleThumbDeletedOnDisk ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Single Video - Video document deleted from DB: ${!singleVidInDb ? 'YES ✅' : 'NO ❌'}`);
  console.log(`Single Video - Video pulled from playlist: ${!inPlaylist ? 'YES ✅' : 'NO ❌'}`);

  if (!singleVidDeletedOnDisk || !singleThumbDeletedOnDisk || singleVidInDb || inPlaylist || responseStatus !== 200) {
    throw new Error('FAILURE: Single video deletion controller did not perform properly!');
  }

  // Clean up temp creator & playlist
  await Playlist.findByIdAndDelete(singlePlaylist._id);
  await User.findByIdAndDelete(tempCreator._id);

  console.log('\n🎉 ALL TESTS PASSED SUCCESSFULLY! EVERYTHING IS WORKING 100% CORRECTLY.');
  process.exit(0);
};

runTest().catch((err) => {
  console.error('\n❌ TEST FAILED:', err);
  process.exit(1);
});
