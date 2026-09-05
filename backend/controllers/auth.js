const User = require('../models/User');
const { cleanPhone } = require('../validators');

const escapeRegex = (str) => {
  if (!str || typeof str !== 'string') return '';
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const normalizeAvatar = (avatar) => {
  if (!avatar || typeof avatar !== 'string') return null;
  const value = avatar.trim();
  if (!value || value === 'default-avatar.png') return null;
  return value;
};

exports.signupWithPhone = async (req, res, next) => {
  try {
    const password = (req.body.password || '').trim();
    const name = (req.body.name || '').trim();
    const phone = cleanPhone(req.body.phone);

    if (!name) {
      return res.status(400).json({ success: false, message: 'Username is required' });
    }

    if (/\s/.test(name)) {
      return res.status(400).json({ success: false, message: 'Username cannot contain spaces' });
    }

    if (!/^[a-zA-Z0-9._]+$/.test(name)) {
      return res.status(400).json({ success: false, message: 'Username can only contain letters, numbers, underscores, and periods' });
    }

    if (name.length < 3 || name.length > 30) {
      return res.status(400).json({ success: false, message: 'Username must be between 3 and 30 characters' });
    }

    if (!phone || phone.length !== 10) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 10-digit phone number' });
    }

    const existingPhone = await User.findOne({
      $or: [
        { phone },
        { phone: { $regex: new RegExp(`${phone}$`) } },
      ],
    });
    if (existingPhone) {
      return res.status(400).json({ success: false, message: 'This phone number is already registered. Please login instead.' });
    }

    const existingUsername = await User.findOne({
      name: { $regex: new RegExp(`^${escapeRegex(name)}$`, 'i') },
    });
    if (existingUsername) {
      return res.status(400).json({ success: false, message: 'Username already exists. Please choose another username.' });
    }

    const user = await User.create({
      name,
      phone,
      password,
      authProvider: 'phone',
      channelNameEditCount: 0,
      channelNameChangedAt: null,
    });

    sendTokenResponse(user, 201, res);
  } catch (err) {
    next(err);
  }
};

exports.loginWithPhone = async (req, res, next) => {
  try {
    const rawIdentifier = String(req.body.phone || req.body.username || req.body.email || req.body.identifier || '').trim();
    const password = req.body.password;

    if (!rawIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'Phone number or username and password are required' });
    }

    const cleanedPhone = cleanPhone(rawIdentifier);

    // Build flexible query matching phone (with any prefix variations), username, or email
    const orConditions = [];

    if (cleanedPhone && cleanedPhone.length === 10) {
      orConditions.push({ phone: cleanedPhone });
      orConditions.push({ phone: { $regex: new RegExp(`${cleanedPhone}$`) } });
    }

    if (rawIdentifier) {
      orConditions.push({ phone: rawIdentifier });
      orConditions.push({ name: { $regex: new RegExp(`^${escapeRegex(rawIdentifier)}$`, 'i') } });
      if (rawIdentifier.includes('@')) {
        orConditions.push({ email: rawIdentifier.toLowerCase() });
      }
    }

    const user = await User.findOne({ $or: orConditions }).select('+password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Incorrect phone number or password' });
    }

    // Match password with trimming fallback
    const passwordStr = String(password);
    let isMatch = await user.matchPassword(passwordStr.trim());
    if (!isMatch && passwordStr !== passwordStr.trim()) {
      isMatch = await user.matchPassword(passwordStr);
    }

    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect phone number or password' });
    }

    if (user.isBlocked) {
      return res.status(403).json({
        success: false,
        message: user.blockReason || 'Your account has been suspended by an administrator.',
        isBlocked: true,
      });
    }

    // Self-healing: if user has a legacy non-standard phone format, normalize it
    if (cleanedPhone && cleanedPhone.length === 10 && user.phone !== cleanedPhone) {
      user.phone = cleanedPhone;
      await user.save().catch(() => {});
    }

    sendTokenResponse(user, 200, res);
  } catch (err) {
    next(err);
  }
};

// @desc    Forgot Password - Request instructions
// @route   POST /api/auth/forgot-password
// @access  Public
exports.forgotPassword = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      message: 'To reset your password, please contact official support at bideoapps@gmail.com with your registered details.',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Reset Password
// @route   POST /api/auth/reset-password
// @access  Public
exports.resetPassword = async (req, res, next) => {
  try {
    return res.status(403).json({
      success: false,
      message: 'Direct password reset via API is disabled for account security. Please contact official Bideo support at bideoapps@gmail.com.',
    });
  } catch (err) {
    next(err);
  }
};

// @desc    Google Login
// @route   POST /api/auth/google
// @access  Public
exports.googleLogin = async (req, res, next) => {
  try {
    const { name, email, avatar: providedAvatar } = req.body;

    let user = await User.findOne({ email }).select('+password');

    if (!user) {
      user = await User.create({
        name,
        email,
        avatar: normalizeAvatar(providedAvatar),
        authProvider: 'google',
        channelNameEditCount: 0,
        channelNameChangedAt: null,
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

const { saveLocalFile, deleteLocalFile } = require('../utils/localUpload');

// @desc    Update current user channel
// @route   PUT /api/auth/channel
// @access  Private
exports.updateChannel = async (req, res, next) => {
  try {
    const { name, channelName, about } = req.body;
    let avatar = req.body.avatar ? normalizeAvatar(req.body.avatar) : undefined;
    let coverImage = req.body.coverImage;

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    if (req.files) {
      if (req.files.avatar && req.files.avatar[0]) {
        const result = await saveLocalFile(req, req.files.avatar[0], 'image');
        avatar = result.url;
        if (user.avatar) {
          deleteLocalFile(user.avatar);
        }
      }
      if (req.files.coverImage && req.files.coverImage[0]) {
        const result = await saveLocalFile(req, req.files.coverImage[0], 'image');
        coverImage = result.url;
        if (user.coverImage) {
          deleteLocalFile(user.coverImage);
        }
      }
    }

    let trimmedChannelName = undefined;
    let shouldUpdateChannelName = false;

    if (channelName !== undefined) {
      if (typeof channelName !== 'string' || channelName.trim().length === 0) {
        return res.status(400).json({ success: false, message: 'Channel name cannot be empty' });
      }
      trimmedChannelName = channelName.trim();
      if (trimmedChannelName.length > 25) {
        return res.status(400).json({ success: false, message: 'Channel name cannot exceed 25 characters' });
      }

      const currentChannelName = user.channelName ? user.channelName.trim() : '';
      if (trimmedChannelName.toLowerCase() !== currentChannelName.toLowerCase()) {
        shouldUpdateChannelName = true;

        // 1. Check uniqueness (case-insensitive across all other users)
        const existingChannel = await User.findOne({
          _id: { $ne: user._id },
          channelName: { $regex: new RegExp(`^${escapeRegex(trimmedChannelName)}$`, 'i') },
        });

        if (existingChannel) {
          return res.status(400).json({
            success: false,
            message: 'Channel name already exists. Please choose a different channel name.',
          });
        }

        // 2. Check 60-day edit cooldown
        const isFirstCreation = !user.channelName;
        if (!isFirstCreation) {
          const editCount = user.channelNameEditCount || 0;
          if (editCount >= 1 && user.channelNameChangedAt) {
            const COOLDOWN_DAYS = 60;
            const COOLDOWN_MS = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
            const timeSinceLastChange = Date.now() - new Date(user.channelNameChangedAt).getTime();

            if (timeSinceLastChange < COOLDOWN_MS) {
              const daysRemaining = Math.max(1, Math.ceil((COOLDOWN_MS - timeSinceLastChange) / (24 * 60 * 60 * 1000)));
              const nextAllowedDate = new Date(new Date(user.channelNameChangedAt).getTime() + COOLDOWN_MS);
              return res.status(400).json({
                success: false,
                message: `You can only change your channel name once every 60 days. You will be able to change it again in ${daysRemaining} day${daysRemaining === 1 ? '' : 's'}.`,
                daysRemaining,
                nextAllowedDate,
              });
            }
          }
        }
      }
    }

    const updateData = {};
    if (typeof name === 'string' && name.trim()) {
      updateData.name = name.trim();
    }
    if (about !== undefined) {
      updateData.about = about;
    }
    if (avatar !== undefined) updateData.avatar = avatar;
    if (coverImage !== undefined) updateData.coverImage = coverImage;

    if (shouldUpdateChannelName && trimmedChannelName) {
      updateData.channelName = trimmedChannelName;
      const isFirstCreation = !user.channelName;
      if (isFirstCreation) {
        updateData.channelNameEditCount = 0;
        updateData.channelNameChangedAt = new Date();
      } else {
        updateData.channelNameEditCount = (user.channelNameEditCount || 0) + 1;
        updateData.channelNameChangedAt = new Date();
      }
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedUser,
    });
  } catch (err) {
    if (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000)) {
      let duplicateMessage = 'Channel name already exists. Please choose a different channel name.';
      if (err.message && err.message.includes('name_1')) {
        duplicateMessage = 'Username already exists. Please choose another username.';
      }
      return res.status(400).json({
        success: false,
        message: duplicateMessage,
      });
    }
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
        channelNameEditCount: user.channelNameEditCount || 0,
        channelNameChangedAt: user.channelNameChangedAt || null,
        coverImage: user.coverImage || null,
        about: user.about,
        isVerified: !!user.isVerified,
        deletionScheduled: !!user.deletionScheduled,
        scheduledDeletionDate: user.scheduledDeletionDate,
        deletionReason: user.deletionReason,
        deletionStatus: user.deletionStatus || 'none',
        recoveryRequested: !!user.recoveryRequested,
        recoveryReason: user.recoveryReason,
        recoveryNotes: user.recoveryNotes,
    }
  });
};
