const express = require('express');
const { createPost, getPosts, getFollowedPosts, togglePostLike } = require('../controllers/post');
const { protect } = require('../middlewares/auth');
const upload = require('../middlewares/multer');

const router = express.Router();

router.get('/', getPosts);
router.get('/followed', protect, getFollowedPosts);
router.post('/', protect, upload.single('image'), createPost);
router.post('/:id/like', protect, togglePostLike);

module.exports = router;
