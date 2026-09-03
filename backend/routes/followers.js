const express = require('express');
const {
  follow,
  getFollowings,
  getChannelFollowers,
  getChannelFollowings,
} = require('../controllers/follower');
const { protect, softProtect } = require('../middlewares/auth');

const router = express.Router();

router.get('/me', protect, getFollowings);
router.get('/:channelId/followers', softProtect, getChannelFollowers);
router.get('/:channelId/followings', softProtect, getChannelFollowings);
router.post('/:channelId', protect, follow);

module.exports = router;
