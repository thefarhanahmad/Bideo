const Ad = require('../models/Ad');
const cloudinary = require('cloudinary').v2;
const { deleteFromCloudinary, imageUploadOptions } = require('../utils/cloudinary');

// @desc    Get all ads (admin only)
// @route   GET /api/ads
// @access  Private/Admin
exports.getAds = async (req, res, next) => {
  try {
    const ads = await Ad.find().sort('-createdAt');
    res.status(200).json({ success: true, count: ads.length, data: ads });
  } catch (err) {
    next(err);
  }
};

// @desc    Get active ads
// @route   GET /api/ads/active
// @access  Public
exports.getActiveAds = async (req, res, next) => {
  try {
    const ads = await Ad.find({ activeStatus: true }).sort('-createdAt');
    res.status(200).json({ success: true, count: ads.length, data: ads });
  } catch (err) {
    next(err);
  }
};

// @desc    Create an ad
// @route   POST /api/ads
// @access  Private/Admin
exports.createAd = async (req, res, next) => {
  try {
    const { title, type, activeStatus, link } = req.body;
    let imageUrl = '';

    if (req.file) {
      const result = await cloudinary.uploader.upload(req.file.path, imageUploadOptions('bideo/ads'));
      imageUrl = result.secure_url;
    } else {
      return res.status(400).json({ success: false, message: 'Please upload an ad image' });
    }

    const ad = await Ad.create({
      title,
      image: imageUrl,
      type: type || 'banner',
      activeStatus: activeStatus === 'true' || activeStatus === true,
      link: link || '',
    });

    res.status(201).json({ success: true, data: ad });
  } catch (err) {
    next(err);
  }
};

// @desc    Update an ad
// @route   PUT /api/ads/:id
// @access  Private/Admin
exports.updateAd = async (req, res, next) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    const { title, type, activeStatus, link } = req.body;
    let imageUrl = ad.image;

    if (req.file) {
      // Delete old image
      if (ad.image) {
        await deleteFromCloudinary(ad.image, 'image');
      }
      const result = await cloudinary.uploader.upload(req.file.path, imageUploadOptions('bideo/ads'));
      imageUrl = result.secure_url;
    }

    ad.title = title || ad.title;
    ad.type = type || ad.type;
    if (activeStatus !== undefined) {
      ad.activeStatus = activeStatus === 'true' || activeStatus === true;
    }
    if (link !== undefined) {
      ad.link = link;
    }
    ad.image = imageUrl;

    await ad.save();

    res.status(200).json({ success: true, data: ad });
  } catch (err) {
    next(err);
  }
};

// @desc    Delete an ad
// @route   DELETE /api/ads/:id
// @access  Private/Admin
exports.deleteAd = async (req, res, next) => {
  try {
    const ad = await Ad.findById(req.params.id);
    if (!ad) {
      return res.status(404).json({ success: false, message: 'Ad not found' });
    }

    if (ad.image) {
      await deleteFromCloudinary(ad.image, 'image');
    }

    await ad.deleteOne();

    res.status(200).json({ success: true, data: {} });
  } catch (err) {
    next(err);
  }
};
