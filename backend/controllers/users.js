const User = require('../models/User');

// @desc Create user
// @route POST /api/users
// @access Private/Admin
exports.createUser = async (req, res, next) => {
  try {
    const { name, email, avatar, role } = req.body;
    if (!name || !email) return res.status(400).json({ success: false, message: 'Name and email are required' });

    let existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ success: false, message: 'User with this email already exists' });

    const user = await User.create({ name, email, avatar: avatar || '', role: role || 'user' });
    res.status(201).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc Update user channel info
// @route PUT /api/users/channel
// @access Private
exports.updateChannel = async (req, res, next) => {
  try {
    const { channelName, about, avatar } = req.body;
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { channelName, about, avatar },
      { new: true, runValidators: true }
    ).select('-password');

    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc Get all users
// @route GET /api/users
// @access Private/Admin
exports.getUsers = async (req, res, next) => {
  try {
    const users = await User.find().select('-__v');
    res.status(200).json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
};

// @desc Get single user
// @route GET /api/users/:id
// @access Private/Admin
exports.getUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id).select('-__v');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc Update user
// @route PUT /api/users/:id
// @access Private/Admin
exports.updateUser = async (req, res, next) => {
  try {
    const update = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true }).select('-__v');
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    res.status(200).json({ success: true, data: user });
  } catch (err) {
    next(err);
  }
};

// @desc    Add video to watch history
// @route   POST /api/users/history
// @access  Private
exports.addToHistory = async (req, res, next) => {
  try {
    const { videoId } = req.body;
    const user = await User.findById(req.user.id);

    // Remove if already exists to move to top
    user.watchHistory = user.watchHistory.filter(id => id.toString() !== videoId);
    user.watchHistory.unshift(videoId);
    
    // Keep only last 50
    if (user.watchHistory.length > 50) {
      user.watchHistory = user.watchHistory.slice(0, 50);
    }

    await user.save();
    res.status(200).json({ success: true, data: user.watchHistory });
  } catch (err) {
    next(err);
  }
};

// @desc    Get watch history
// @route   GET /api/users/history
// @access  Private
exports.getHistory = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate({
      path: 'watchHistory',
      populate: { path: 'owner', select: 'name channelName avatar' }
    });

    res.status(200).json({ success: true, data: user.watchHistory });
  } catch (err) {
    next(err);
  }
};

// @desc Delete user
// @route DELETE /api/users/:id
// @access Private/Admin
exports.deleteUser = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });
    await user.deleteOne();
    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
