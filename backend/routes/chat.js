const express = require('express');
const router = express.Router();
const {
  getConversations,
  getOrCreateConversation,
  getConversationById,
  getMessages,
  sendMessage,
  markAsRead,
  acceptChat,
  declineChat,
  blockUser,
  unblockUser,
  getUnreadCount,
  unsendMessage,
  deleteMessageForMe,
} = require('../controllers/chat');
const { protect } = require('../middlewares/auth');

// All chat routes require authentication
router.use(protect);

router.route('/conversations')
  .get(getConversations)
  .post(getOrCreateConversation);

router.get('/unread-count', getUnreadCount);

router.route('/conversations/:id')
  .get(getConversationById);

router.get('/conversations/:id/messages', getMessages);
router.put('/conversations/:id/read', markAsRead);
router.post('/conversations/:id/accept', acceptChat);
router.post('/conversations/:id/decline', declineChat);
router.post('/conversations/:id/block', blockUser);
router.post('/conversations/:id/unblock', unblockUser);

router.post('/messages', sendMessage);
router.post('/messages/:id/unsend', unsendMessage);
router.post('/messages/:id/delete', deleteMessageForMe);

module.exports = router;
