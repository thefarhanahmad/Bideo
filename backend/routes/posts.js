const express = require('express');
const { createPost, getPosts, getFollowedPosts, togglePostLike, getPost, updatePost, deletePost } = require('../controllers/post');
const { protect } = require('../middlewares/auth');
const upload = require('../middlewares/multer');

const router = express.Router();

router.get('/', getPosts);
router.get('/followed', protect, getFollowedPosts);
router.get('/:id', getPost);
router.post('/', protect, upload.single('image'), createPost);
router.put('/:id', protect, upload.single('image'), updatePost);
router.delete('/:id', protect, deletePost);
router.post('/:id/like', protect, togglePostLike);

module.exports = router;
