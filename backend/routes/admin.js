const express = require('express');
const { 
  loginAdmin, 
  getStats, 
  getVideoReports, 
  updateVideoReport,
  getPendingVideoReviews,
  reviewVideoMonetization,
  getMonetizationApplications,
  reviewMonetizationApplication
} = require('../controllers/admin');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.post('/login', loginAdmin);

// Protected Admin Routes
router.use(protect);
router.use(authorize('admin'));

router.get('/stats', getStats);
router.get('/reports/videos', getVideoReports);
router.put('/reports/videos/:id', updateVideoReport);

// Monetization Audits
router.get('/videos/pending-reviews', getPendingVideoReviews);
router.put('/videos/:id/review', reviewVideoMonetization);
router.get('/monetization-applications', getMonetizationApplications);
router.put('/users/:userId/review-monetization', reviewMonetizationApplication);

module.exports = router;
