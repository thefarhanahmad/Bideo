const express = require('express');
const {
  getVideos,
  getVideo,
  uploadVideo,
  updateVideo,
  deleteVideo,
  searchVideos,
  toggleLike,
  toggleDislike,
  getMyVideos,
  getFollowedVideos,
} = require('../controllers/video');
const { protect, softProtect } = require('../middlewares/auth');
const upload = require('../middlewares/multer');

const router = express.Router();

const { videoValidationRules, validate } = require('../validators');

router.route('/')
  .get(softProtect, getVideos);

router.get('/search', softProtect, searchVideos);
router.get('/me', protect, getMyVideos);
router.get('/followed', protect, getFollowedVideos);

router.post('/:id/like', protect, toggleLike);
router.post('/:id/dislike', protect, toggleDislike);

router.post('/upload', protect, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), videoValidationRules(), validate, uploadVideo);

router.route('/:id')
  .get(softProtect, getVideo)
  .put(protect, updateVideo)
  .delete(protect, deleteVideo);
module.exports = router;
