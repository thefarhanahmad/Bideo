const express = require('express');
const { googleLogin, getMe, signupWithPhone, loginWithPhone } = require('../controllers/auth');
const { protect } = require('../middlewares/auth');
const { authValidationRules, phoneSignupValidationRules, phoneLoginValidationRules, validate } = require('../validators');

const router = express.Router();

router.post('/google', authValidationRules(), validate, googleLogin);
router.post('/signup', phoneSignupValidationRules(), validate, signupWithPhone);
router.post('/login', phoneLoginValidationRules(), validate, loginWithPhone);
router.get('/me', protect, getMe);

module.exports = router;
