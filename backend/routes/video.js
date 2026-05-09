const express = require('express');
const {
  getVideos,
  getVideo,
  uploadVideo,
  updateVideo,
  deleteVideo,
} = require('../controllers/video');
const { protect } = require('../middlewares/auth');
const upload = require('../middlewares/multer');

const router = express.Router();

const { videoValidationRules, validate } = require('../validators');

router.route('/')
  .get(getVideos);

router.post('/upload', protect, upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]), videoValidationRules(), validate, uploadVideo);

router.route('/:id')
  .get(getVideo)
  .put(protect, updateVideo)
  .delete(protect, deleteVideo);

module.exports = router;
