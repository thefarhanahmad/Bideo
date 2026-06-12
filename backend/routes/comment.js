const express = require("express");
const {
  getComments,
  addComment,
  updateComment,
  deleteComment,
  toggleCommentLike,
  addReply,
  toggleReplyLike,
  updateReply,
  deleteReply,
} = require("../controllers/comment");
const { protect } = require("../middlewares/auth");

const router = express.Router();

const { commentValidationRules, validate } = require("../validators");

router
  .route("/")
  .get(getComments)
  .post(protect, commentValidationRules(), validate, addComment);

router.route("/:videoId").get(getComments);

router.post("/:id/like", protect, toggleCommentLike);
router.post("/:id/replies", protect, addReply);
router
  .route("/:id/replies/:replyId")
  .put(protect, updateReply)
  .delete(protect, deleteReply)
  .post(protect, toggleReplyLike);

router.post("/:id/replies/:replyId/like", protect, toggleReplyLike);

router.route("/:id").put(protect, updateComment).delete(protect, deleteComment);

module.exports = router;
