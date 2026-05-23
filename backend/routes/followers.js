const express = require('express');
const {
  follow,
  getFollowings,
} = require('../controllers/follower');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.get('/me', protect, getFollowings);
router.post('/:channelId', protect, follow);

module.exports = router;
