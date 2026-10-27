const express = require('express');
const {
  getVideos,
  getVideo,
  uploadVideo,
  updateVideo,
  deleteVideo,
  bulkDeleteVideos,
  searchVideos,
  searchSuggestions,
  toggleLike,
  toggleDislike,
  getMyVideos,
  getFollowedVideos,
  recordView,
  recordWatchTime,
  reportVideo,
} = require('../controllers/video');
const { protect, softProtect } = require('../middlewares/auth');
const upload = require('../middlewares/multer');
const uploadMaintenance = require('../middlewares/uploadMaintenance');
const {
  startDirectUpload,
  signDirectUploadParts,
  completeDirectUpload,
  abortDirectUpload,
} = require('../controllers/directUpload');

const router = express.Router();

const { videoValidationRules, validate } = require('../validators');

router.route('/')
  .get(softProtect, getVideos);

router.get('/search/suggestions', searchSuggestions);
router.get('/search', softProtect, searchVideos);
router.get('/me', protect, getMyVideos);
router.get('/followed', protect, getFollowedVideos);

// Direct-to-R2 upload in parts (controllers/directUpload.js); POST /upload below is unchanged
router.post('/direct-upload', protect, uploadMaintenance, videoValidationRules(), validate, startDirectUpload);
router.post('/direct-upload/:id/parts', protect, signDirectUploadParts);
router.post('/direct-upload/:id/complete', protect, videoValidationRules(), validate, completeDirectUpload);
router.post('/direct-upload/:id/abort', protect, abortDirectUpload);

router.post('/:id/like', protect, toggleLike);
router.post('/:id/dislike', protect, toggleDislike);
router.post('/:id/view', softProtect, recordView);
router.post('/:id/watch-time', softProtect, recordWatchTime);
router.post('/:id/report', protect, reportVideo);

router.post('/upload', protect, uploadMaintenance, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), videoValidationRules(), validate, uploadVideo);

router.post('/bulk-delete', protect, bulkDeleteVideos);

router.route('/:id')
  .get(softProtect, getVideo)
  .put(protect, upload.fields([{ name: 'thumbnail', maxCount: 1 }]), videoValidationRules(), validate, updateVideo)
  .delete(protect, deleteVideo);
module.exports = router;
