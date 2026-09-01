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
  requestWithdrawal,
  getWithdrawalHistory,
  scheduleProfileDeletion,
  recoverAccount,
  getDeletionStatus,
  getScheduledDeletions,
  cancelDeletionByAdmin,
  rejectRecoveryByAdmin,
  requestWebDeletion,
  toggleVerifyUser,
  toggleBlockUser,
} = require('../controllers/users');
const { protect, authorize, softProtect } = require('../middlewares/auth');

const router = express.Router();

router.get('/channels/:id', softProtect, getChannelProfile);
router.post('/web-deletion-request', requestWebDeletion);

router.use(protect);

router.post('/history', addToHistory);
router.get('/history', getHistory);
router.get('/liked-videos', getLikedVideos);
router.post('/search-history', addSearchHistory);
router.get('/search-history', getSearchHistory);
router.delete('/search-history', clearSearchHistory);
router.get('/monetization/status', getMonetizationStatus);
router.post('/monetization/apply', applyMonetization);
router.post('/withdraw', requestWithdrawal);
router.get('/withdrawals', getWithdrawalHistory);
router.post('/schedule-deletion', scheduleProfileDeletion);
router.post('/recover-account', recoverAccount);
router.get('/deletion-status', getDeletionStatus);

// Admin only routes
router.use(authorize('admin'));

router.get('/scheduled-deletions', getScheduledDeletions);
router.post('/:id/cancel-deletion', cancelDeletionByAdmin);
router.post('/:id/reject-recovery', rejectRecoveryByAdmin);
router.put('/:id/verify', toggleVerifyUser);
router.put('/:id/block', toggleBlockUser);

router.route('/').get(getUsers).post(createUser);
router.route('/:id').get(getUser).put(updateUser).delete(deleteUser);

module.exports = router;
