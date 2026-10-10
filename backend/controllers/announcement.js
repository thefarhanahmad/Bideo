const Announcement = require('../models/Announcement');
const { saveLocalFile, deleteLocalFile } = require('../utils/localUpload');

// @desc    Get all announcements (admin only)
// @route   GET /api/announcements
// @access  Private/Admin
exports.getAnnouncements = async (req, res, next) => {
  try {
    const announcements = await Announcement.find().sort('-createdAt');
    res.status(200).json({ success: true, count: announcements.length, data: announcements });
  } catch (err) {
    next(err);
  }
};

// @desc    Get active announcements
// @route   GET /api/announcements/active
// @access  Public
exports.getActiveAnnouncements = async (req, res, next) => {
  try {
    const announcements = await Announcement.find({ activeStatus: true }).sort('-createdAt');
    res.status(200).json({ success: true, count: announcements.length, data: announcements });
  } catch (err) {
    next(err);
  }
};

// @desc    Create an announcement
// @route   POST /api/announcements
// @access  Private/Admin
exports.createAnnouncement = async (req, res, next) => {
  let savedImageUrl = null;
  try {
    const { title, type, activeStatus, link } = req.body;
    let imageUrl = '';

    if (req.file) {
      const result = await saveLocalFile(req, req.file, 'image');
      imageUrl = result.url;
      savedImageUrl = result.url;
    } else {
      return res.status(400).json({ success: false, message: 'Please upload an announcement image' });
    }

    const originalImageSize = Number(req.body.originalImageSize || 0);
    const compressedImageSize = req.file ? req.file.size : 0;

    const announcement = await Announcement.create({
      title,
      image: imageUrl,
      type: type || 'full',
      activeStatus: activeStatus === 'true' || activeStatus === true,
      link: link || '',
      originalImageSize,
      compressedImageSize,
    });

    res.status(201).json({ success: true, data: announcement });
  } catch (err) {
    if (savedImageUrl) {
      await deleteLocalFile(savedImageUrl);
    }
    next(err);
  }
};

// @desc    Update an announcement
// @route   PUT /api/announcements/:id
// @access  Private/Admin
exports.updateAnnouncement = async (req, res, next) => {
  let savedImageUrl = null;
  let oldImageToDelete = null;

  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    const { title, type, activeStatus, link } = req.body;
    let imageUrl = announcement.image;

    if (req.file) {
      if (announcement.image) {
        oldImageToDelete = announcement.image;
      }

      announcement.originalImageSize = Number(req.body.originalImageSize || 0);
      announcement.compressedImageSize = req.file.size || 0;

      const result = await saveLocalFile(req, req.file, 'image');
      imageUrl = result.url;
      savedImageUrl = result.url;
    }

    announcement.title = title || announcement.title;
    announcement.type = type || announcement.type;
    if (activeStatus !== undefined) {
      announcement.activeStatus = activeStatus === 'true' || activeStatus === true;
    }
    if (link !== undefined) {
      announcement.link = link;
    }
    announcement.image = imageUrl;

    await announcement.save();

    if (oldImageToDelete) {
      await deleteLocalFile(oldImageToDelete);
    }

    res.status(200).json({ success: true, data: announcement });
  } catch (err) {
    if (savedImageUrl) {
      await deleteLocalFile(savedImageUrl);
    }
    next(err);
  }
};

// @desc    Delete an announcement
// @route   DELETE /api/announcements/:id
// @access  Private/Admin
exports.deleteAnnouncement = async (req, res, next) => {
  try {
    const announcement = await Announcement.findById(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    if (announcement.image) {
      await deleteLocalFile(announcement.image);
    }

    await announcement.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};

// Backward compatibility exports
exports.getAds = exports.getAnnouncements;
exports.getActiveAds = exports.getActiveAnnouncements;
exports.createAd = exports.createAnnouncement;
exports.updateAd = exports.updateAnnouncement;
exports.deleteAd = exports.deleteAnnouncement;
