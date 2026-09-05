const fs = require('fs');
const path = require('path');

const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

/**
 * Saves a uploaded file locally under the uploads directory.
 * Videos go to 'uploads/videos' and images go to 'uploads/images'.
 * Creates the directories if they don't exist.
 *
 * @param {Object} req The Express request object (to build host domain)
 * @param {Object} file The Multer file object
 * @param {string} type 'image' or 'video'
 * @returns {Object} { url, filename, path }
 */
const saveLocalFile = (req, file, type) => {
  if (!file) return null;

  // Determine subfolder based on type or mime type
  const isVideo = type === 'video' || (file.mimetype && file.mimetype.startsWith('video/'));
  const folderName = isVideo ? 'videos' : 'images';
  
  const targetDir = path.join(__dirname, '../uploads', folderName);

  // Auto create folder if not exist
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  // Generate unique file name with strictly whitelisted extension
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const rawExt = path.extname(file.originalname || '').toLowerCase();
  let safeExt = isVideo ? '.mp4' : '.jpg';
  if (isVideo && ALLOWED_VIDEO_EXTENSIONS.has(rawExt)) {
    safeExt = rawExt;
  } else if (!isVideo && ALLOWED_IMAGE_EXTENSIONS.has(rawExt)) {
    safeExt = rawExt;
  }

  const filename = `${uniqueSuffix}${safeExt}`;
  const targetPath = path.join(targetDir, filename);

  try {
    // Copy the file from temp path to destination
    fs.copyFileSync(file.path, targetPath);
    // Remove the temp file
    fs.unlinkSync(file.path);
  } catch (error) {
    console.error('Error saving local file:', error);
    throw error;
  }

  // Build the public URL
  const protocol = req.protocol;
  const host = req.get('host');
  const fileUrl = `${protocol}://${host}/api/uploads/${folderName}/${filename}`;

  return {
    url: fileUrl,
    filename: filename,
    path: targetPath,
  };
};

/**
 * Deletes a local file based on its public URL.
 * Strictly verifies the path stays inside the uploads directory to prevent traversal.
 *
 * @param {string} url The public URL of the file to delete
 */
const deleteLocalFile = (url) => {
  if (!url || url.includes('default-avatar.png') || url.includes('via.placeholder.com')) return;

  try {
    const uploadsIdx = url.indexOf('/uploads/');
    if (uploadsIdx === -1) return;

    // Extract relative path like 'uploads/images/filename.jpg'
    const relativePath = url.substring(uploadsIdx + 1);
    const uploadsBaseDir = path.resolve(__dirname, '../uploads');
    const absolutePath = path.resolve(path.join(__dirname, '..', relativePath));

    // Security check: Target path must be strictly within uploads directory
    if (!absolutePath.startsWith(uploadsBaseDir)) {
      console.warn(`Security alert: Path traversal attempt blocked: ${url}`);
      return;
    }

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      console.log(`Deleted local file: ${absolutePath}`);
    } else {
      console.log(`Local file not found for deletion: ${absolutePath}`);
    }
  } catch (error) {
    console.error(`Failed to delete local file from URL ${url}:`, error);
  }
};

module.exports = {
  saveLocalFile,
  deleteLocalFile,
};
