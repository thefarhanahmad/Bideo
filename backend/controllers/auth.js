const User = require('../models/User');

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
        avatar,
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
        avatar: user.avatar,
        role: user.role,
        phone: user.phone
    }
  });
};
