const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({});

const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi', '.m4v', '.3gp']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif']);

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const isVideo = file.mimetype && file.mimetype.startsWith('video/');
  const isImage = file.mimetype && file.mimetype.startsWith('image/');

  if (file.fieldname === 'video') {
    if (isVideo && (ALLOWED_VIDEO_EXTENSIONS.has(ext) || !ext)) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a valid video file (MP4, MOV, MKV, WEBM, AVI)'), false);
    }
  } else if (file.fieldname === 'media' || file.fieldname === 'storyMedia' || file.fieldname === 'image') {
    if (
      (isImage && (ALLOWED_IMAGE_EXTENSIONS.has(ext) || !ext)) ||
      (isVideo && (ALLOWED_VIDEO_EXTENSIONS.has(ext) || !ext))
    ) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a valid image (JPG, PNG, WEBP) or video (MP4, MOV, WEBM)'), false);
    }
  } else if (file.fieldname === 'thumbnail') {
    if (isImage && (ALLOWED_IMAGE_EXTENSIONS.has(ext) || !ext)) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a valid image file (JPG, PNG, WEBP)'), false);
    }
  } else if (file.fieldname === 'avatar' || file.fieldname === 'coverImage') {
    if (isImage && (ALLOWED_IMAGE_EXTENSIONS.has(ext) || !ext)) {
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
