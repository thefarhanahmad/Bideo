const express = require('express');
const {
  getAnnouncements,
  getActiveAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} = require('../controllers/announcement');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/multer');

const router = express.Router();

router.get('/active', getActiveAnnouncements);

router
  .route('/')
  .get(protect, authorize('admin'), getAnnouncements)
  .post(protect, authorize('admin'), upload.single('image'), createAnnouncement);

router
  .route('/:id')
  .put(protect, authorize('admin'), upload.single('image'), updateAnnouncement)
  .delete(protect, authorize('admin'), deleteAnnouncement);

module.exports = router;
