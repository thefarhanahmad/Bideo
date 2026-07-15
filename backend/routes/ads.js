const express = require('express');
const {
  getAds,
  getActiveAds,
  createAd,
  updateAd,
  deleteAd,
} = require('../controllers/ad');
const { protect, authorize } = require('../middlewares/auth');
const upload = require('../middlewares/multer');

const router = express.Router();

router.get('/active', getActiveAds);

router.route('/')
  .get(protect, authorize('admin'), getAds)
  .post(protect, authorize('admin'), upload.single('image'), createAd);

router.route('/:id')
  .put(protect, authorize('admin'), upload.single('image'), updateAd)
  .delete(protect, authorize('admin'), deleteAd);

module.exports = router;
