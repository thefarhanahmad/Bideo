const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({});

const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();

  if (file.fieldname === 'video') {
    if (file.mimetype.startsWith('video/') && ALLOWED_VIDEO_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a valid video file (MP4, MOV, MKV, WEBM, AVI)'), false);
    }
  } else if (file.fieldname === 'thumbnail' || file.fieldname === 'image') {
    if (file.mimetype.startsWith('image/') && ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a valid image file (JPG, PNG, WEBP)'), false);
    }
  } else if (file.fieldname === 'avatar' || file.fieldname === 'coverImage') {
    if (file.mimetype.startsWith('image/') && ALLOWED_IMAGE_EXTENSIONS.has(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a valid image for profile or cover (JPG, PNG, WEBP)'), false);
    }
  } else {
    cb(new Error('Unexpected upload field: ' + file.fieldname), false);
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
