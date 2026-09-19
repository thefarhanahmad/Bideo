const express = require('express');
const {
  createPost,
  getPosts,
  getFollowedPosts,
  togglePostLike,
  getPost,
  updatePost,
  deletePost,
  bulkDeletePosts,
  checkDailyPostLimit,
  getDailyPostLimitStatus,
} = require('../controllers/post');
const { protect, softProtect } = require('../middlewares/auth');
const upload = require('../middlewares/multer');

const router = express.Router();

router.get('/', softProtect, getPosts);
router.get('/followed', protect, getFollowedPosts);
router.get('/daily-limit', protect, getDailyPostLimitStatus);
router.post('/bulk-delete', protect, bulkDeletePosts);
router.get('/:id', getPost);
router.post('/', protect, checkDailyPostLimit, upload.single('image'), createPost);
router.put('/:id', protect, upload.single('image'), updatePost);
router.delete('/:id', protect, deletePost);
router.post('/:id/like', protect, togglePostLike);

module.exports = router;
