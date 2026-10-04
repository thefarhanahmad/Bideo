const express = require('express');
const {
  getStoryTray,
  createStory,
  viewStory,
  getStoryViewers,
  deleteStory,
} = require('../controllers/story');
const { protect } = require('../middlewares/auth');
const upload = require('../middlewares/multer');

const router = express.Router();

const storyUpload = upload.fields([
  { name: 'image', maxCount: 1 },
  { name: 'media', maxCount: 1 },
  { name: 'video', maxCount: 1 },
]);

const extractStoryFile = (req, res, next) => {
  if (req.files) {
    req.file = req.files['image']?.[0] || req.files['media']?.[0] || req.files['video']?.[0] || null;
  }
  next();
};

router.get('/tray', protect, getStoryTray);
router.post('/', protect, storyUpload, extractStoryFile, createStory);
router.post('/:id/view', protect, viewStory);
router.get('/:id/viewers', protect, getStoryViewers);
router.delete('/:id', protect, deleteStory);

module.exports = router;
