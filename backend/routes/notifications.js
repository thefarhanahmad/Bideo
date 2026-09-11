const express = require('express');
const {
  getNotifications,
  getUnreadNotificationCount,
  markNotificationsViewed,
  markNotificationRead,
  markAllNotificationsRead,
} = require('../controllers/notification');
const { protect } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.get('/', getNotifications);
router.get('/unread-count', getUnreadNotificationCount);
router.put('/viewed', markNotificationsViewed);
router.put('/read-all', markAllNotificationsRead);
router.put('/:id/read', markNotificationRead);

module.exports = router;
