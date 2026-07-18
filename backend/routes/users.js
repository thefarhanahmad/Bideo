const express = require('express');
const {
  createUser,
  getUsers,
  getUser,
  updateUser,
  deleteUser,
  addToHistory,
  getHistory,
  getLikedVideos,
  addSearchHistory,
  getSearchHistory,
  clearSearchHistory,
  getChannelProfile,
  getMonetizationStatus,
  applyMonetization,
} = require('../controllers/users');
const { protect, authorize, softProtect } = require('../middlewares/auth');

const router = express.Router();

router.get('/channels/:id', softProtect, getChannelProfile);

router.use(protect);

router.post('/history', addToHistory);
router.get('/history', getHistory);
router.get('/liked-videos', getLikedVideos);
router.post('/search-history', addSearchHistory);
router.get('/search-history', getSearchHistory);
router.delete('/search-history', clearSearchHistory);
router.get('/monetization/status', getMonetizationStatus);
router.post('/monetization/apply', applyMonetization);

// Admin only routes
router.use(authorize('admin'));

router.route('/').get(getUsers).post(createUser);
router.route('/:id').get(getUser).put(updateUser).delete(deleteUser);

module.exports = router;
