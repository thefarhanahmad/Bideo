const express = require('express');
const { googleLogin, getMe, signupWithPhone, loginWithPhone, updateChannel, forgotPassword, resetPassword, updatePushToken, removePushToken, logPushDiagnostic } = require('../controllers/auth');
const { protect, softProtect } = require('../middlewares/auth');
const { authLimiter } = require('../middlewares/security');
const { authValidationRules, phoneSignupValidationRules, phoneLoginValidationRules, validate } = require('../validators');

const upload = require('../middlewares/multer');

const router = express.Router();

router.post('/google', authLimiter, authValidationRules(), validate, googleLogin);
router.post('/signup', authLimiter, phoneSignupValidationRules(), validate, signupWithPhone);
router.post('/login', authLimiter, phoneLoginValidationRules(), validate, loginWithPhone);
router.post('/forgot-password', authLimiter, forgotPassword);
router.post('/reset-password', authLimiter, resetPassword);
router.get('/me', protect, getMe);
router.put('/channel', protect, upload.fields([{ name: 'avatar', maxCount: 1 }, { name: 'coverImage', maxCount: 1 }]), updateChannel);
router.put('/push-token', protect, updatePushToken);
router.delete('/push-token', protect, removePushToken);
router.post('/push-token-log', softProtect, logPushDiagnostic);

module.exports = router;
