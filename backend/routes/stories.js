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

router.get('/tray', protect, getStoryTray);
router.post('/', protect, upload.single('image'), createStory);
router.post('/:id/view', protect, viewStory);
router.get('/:id/viewers', protect, getStoryViewers);
router.delete('/:id', protect, deleteStory);

module.exports = router;
