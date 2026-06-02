const express = require('express');
const {
  getComments,
  addComment,
  deleteComment,
  toggleCommentLike,
  addReply,
  toggleReplyLike,
} = require('../controllers/comment');
const { protect } = require('../middlewares/auth');

const router = express.Router();

const { commentValidationRules, validate } = require('../validators');

router.route('/')
  .get(getComments)
  .post(protect, commentValidationRules(), validate, addComment);

router.route('/:videoId')
  .get(getComments);

router.post('/:id/like', protect, toggleCommentLike);
router.post('/:id/replies', protect, addReply);
router.post('/:id/replies/:replyId/like', protect, toggleReplyLike);

router.route('/:id')
  .delete(protect, deleteComment);

module.exports = router;
