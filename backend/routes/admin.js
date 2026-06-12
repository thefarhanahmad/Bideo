const express = require('express');
const { loginAdmin, getStats, getVideoReports, updateVideoReport } = require('../controllers/admin');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.post('/login', loginAdmin);
router.get('/stats', protect, authorize('admin'), getStats);
router.get('/reports/videos', protect, authorize('admin'), getVideoReports);
router.put('/reports/videos/:id', protect, authorize('admin'), updateVideoReport);

module.exports = router;
