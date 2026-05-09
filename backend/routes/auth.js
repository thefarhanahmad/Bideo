const express = require('express');
const { googleLogin, getMe } = require('../controllers/auth');
const { protect } = require('../middlewares/auth');
const { authValidationRules, validate } = require('../validators');

const router = express.Router();

router.post('/google', authValidationRules(), validate, googleLogin);
router.get('/me', protect, getMe);

module.exports = router;
