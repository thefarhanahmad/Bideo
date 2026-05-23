const express = require('express');
const { googleLogin, getMe, signupWithPhone, loginWithPhone, updateChannel } = require('../controllers/auth');
const { protect } = require('../middlewares/auth');
const { authValidationRules, phoneSignupValidationRules, phoneLoginValidationRules, validate } = require('../validators');

const upload = require('../middlewares/multer');

const router = express.Router();

router.post('/google', authValidationRules(), validate, googleLogin);
router.post('/signup', phoneSignupValidationRules(), validate, signupWithPhone);
router.post('/login', phoneLoginValidationRules(), validate, loginWithPhone);
router.get('/me', protect, getMe);
router.put('/channel', protect, upload.single('avatar'), updateChannel);

module.exports = router;
