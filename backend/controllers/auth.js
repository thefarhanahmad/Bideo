const User = require('../models/User');
const normalizeAvatar = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return null;
  const value = avatar.trim();
  if (!value || value === 'default-avatar.png') return null;
  return value;
};

exports.signupWithPhone = async (req, res, next) => {
  try {
    const { name, phone, password } = req.body;
    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Phone already registered' });
    }
    const user = await User.create({ name, phone, password, authProvider: 'phone' });
    sendTokenResponse(user, 201, res);
  } catch (err) {
    next(err);
  }
};

exports.loginWithPhone = async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    const user = await User.findOne({ phone }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid phone or password' });
    }
    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// @desc    Forgot Password - Request OTP (Dummy 1234)
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    const { phone } = req.body;
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    // Since we use dummy OTP "1234", we don't actually need to store it or send it.
    // In a real app, we would generate a token, save it with expiry, and send SMS.
    res.status(200).json({ success: true, message: 'OTP sent to phone' });
  } catch (err) {
    next(err);
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    const { phone, otp, password } = req.body;
    if (otp !== '1234') {
      return res.status(400).json({ success: false, message: 'Invalid OTP' });
    }
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    user.password = password;
    await user.save();
    res.status(200).json({ success: true, message: 'Password reset successful' });
  } catch (err) {
    next(err);
  }
};

// @desc    Google Login
// @route   POST /api/auth/google
// @access  Public
exports.googleLogin = async (req, res, next) => {
  try {
    const { name, email, avatar } = req.body;

    let user = await User.findOne({ email }).select('+password');

    if (!user) {
      user = await User.create({
        name,
        email,
        avatar: normalizeAvatar(avatar),
        authProvider: 'google',
      });
    } else if (!user.authProvider) {
      user.authProvider = 'google';
      await user.save();
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

const cloudinary = require('cloudinary').v2;

// @desc    Update current user channel
// @route   PUT /api/auth/channel
// @access  Private
exports.updateChannel = async (req, res, next) => {
  try {
    console.log('Update Channel request received:', req.body);
    const { name, channelName, about } = req.body;
    let avatar = normalizeAvatar(req.body.avatar);

    if (req.file) {
      console.log('File detected, uploading to Cloudinary...');
      const result = await cloudinary.uploader.upload(req.file.path, {
        folder: 'tubeindia/avatars',
      });
      console.log('Cloudinary upload success:', result.secure_url);
      avatar = result.secure_url;
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name, channelName, about, avatar },
      { new: true, runValidators: true }
    );

    console.log('User updated successfully');
    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    console.error('Update Channel Error:', err);
    next(err);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);

    res.status(200).json({
      success: true,
      data: user,
    });
  } catch (err) {
    next(err);
  }
};

// Get token from model, create cookie and send response
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  const options = {
    expires: new Date(
      Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000
    ),
    httpOnly: true,
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res.status(statusCode).cookie('token', token, options).json({
    success: true,
    token,
    user: {
        _id: user._id,
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: normalizeAvatar(user.avatar),
        role: user.role,
        phone: user.phone,
        channelName: user.channelName,
        about: user.about,
    }
  });
};
