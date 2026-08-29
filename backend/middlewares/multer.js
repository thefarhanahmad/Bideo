const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({});

const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'video') {
    if (file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a video file'), false);
    }
  } else if (file.fieldname === 'thumbnail' || file.fieldname === 'image') {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Please upload an image file'), false);
    }
  } else if (file.fieldname === 'avatar' || file.fieldname === 'coverImage') {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Please upload an image for profile or cover'), false);
    }
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  },
});

module.exports = upload;
