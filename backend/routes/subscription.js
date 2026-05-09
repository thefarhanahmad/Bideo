const express = require('express');
const {
  subscribe,
  getSubscriptions,
} = require('../controllers/subscription');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.get('/me', protect, getSubscriptions);
router.post('/:channelId', protect, subscribe);

module.exports = router;
