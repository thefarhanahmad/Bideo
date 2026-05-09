const express = require('express');
const {
  getComments,
  addComment,
  deleteComment,
} = require('../controllers/comment');
const { protect } = require('../middlewares/auth');

const router = express.Router();

const { commentValidationRules, validate } = require('../validators');

router.route('/')
  .post(protect, commentValidationRules(), validate, addComment);

router.route('/:videoId')
  .get(getComments);

router.route('/:id')
  .delete(protect, deleteComment);

module.exports = router;
