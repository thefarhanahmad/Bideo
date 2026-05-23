const express = require('express');
const { createUser, getUsers, getUser, updateUser, deleteUser, addToHistory, getHistory } = require('../controllers/users');
const { protect, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(protect);

router.post('/history', addToHistory);
router.get('/history', getHistory);

// Admin only routes
router.use(authorize('admin'));

router.route('/').get(getUsers).post(createUser);
router.route('/:id').get(getUser).put(updateUser).delete(deleteUser);

module.exports = router;
