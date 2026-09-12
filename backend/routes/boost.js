const express = require('express');
const {
  getBoostStatus,
  claimAdReward,
  createVideoBoost,
  getMyEligibleVideos,
} = require('../controllers/boost');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect); // All boost operations require authentication

router.get('/status', getBoostStatus);
router.post('/claim-ad-reward', claimAdReward);
router.post('/create', createVideoBoost);
router.get('/my-videos', getMyEligibleVideos);

module.exports = router;
