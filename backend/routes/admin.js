const express = require('express');
const { 
  loginAdmin, 
  getStats, 
  getVideoReports, 
  updateVideoReport,
  getPendingVideoReviews,
  reviewVideoMonetization,
  getMonetizationApplications,
  reviewMonetizationApplication,
  getWithdrawals,
  processWithdrawal,
  boostVideoEngagement,
  getErrorLogs,
  updateErrorLog,
  deleteErrorLog,
  clearResolvedErrorLogs,
  globalAdminSearch,
} = require('../controllers/admin');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.post('/login', loginAdmin);

// Protected Admin Routes
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getStats);
router.get('/search', globalAdminSearch);
router.get('/reports/videos', getVideoReports);
router.put('/reports/videos/:id', updateVideoReport);

// Engagement Boost
router.post('/videos/boost-engagement', boostVideoEngagement);

// Monetization Audits
router.get('/videos/pending-reviews', getPendingVideoReviews);
router.put('/videos/:id/review', reviewVideoMonetization);
router.get('/monetization-applications', getMonetizationApplications);
router.put('/users/:userId/review-monetization', reviewMonetizationApplication);

// Creator Withdrawals / Payouts
router.get('/withdrawals', getWithdrawals);
router.put('/withdrawals/:id', processWithdrawal);

// Error Logs & Monitoring
router.get('/error-logs', getErrorLogs);
router.delete('/error-logs/clear-resolved', clearResolvedErrorLogs);
router.put('/error-logs/:id', updateErrorLog);
router.delete('/error-logs/:id', deleteErrorLog);

module.exports = router;
