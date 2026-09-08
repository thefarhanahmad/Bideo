const fs = require('fs');
const path = require('path');
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');

const ALLOWED_VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.mkv', '.webm', '.avi']);
const ALLOWED_IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const MIME_TYPES = {
  '.mp4': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.webm': 'video/webm',
  '.avi': 'video/x-msvideo',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

/**
 * Checks if Cloudflare R2 cloud storage credentials are provided in the environment.
 */
const isR2Configured = () => {
  return Boolean(
    process.env.R2_ACCESS_KEY_ID &&
    process.env.R2_SECRET_ACCESS_KEY &&
    process.env.R2_BUCKET_NAME &&
    process.env.R2_ACCOUNT_ID
  );
};

let s3ClientInstance = null;

/**
 * Lazily creates and returns a singleton S3Client instance for Cloudflare R2.
 */
const getS3Client = () => {
  if (!s3ClientInstance && isR2Configured()) {
    s3ClientInstance = new S3Client({
      region: 'auto',
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
    });
  }
  return s3ClientInstance;
};

/**
 * Determines appropriate MIME content type.
 */
const getContentType = (filename, fileMime, isVideo) => {
  const ext = path.extname(filename || '').toLowerCase();
  if (MIME_TYPES[ext]) return MIME_TYPES[ext];
  if (fileMime) return fileMime;
  return isVideo ? 'video/mp4' : 'image/jpeg';
};

/**
 * Saves an uploaded file to Cloudflare R2 cloud storage (or fallback to local disk).
 * Videos go to 'videos/' and images go to 'images/'.
 * Temp multer files are immediately unlinked to eliminate server disk usage.
 *
 * @param {Object} req The Express request object (used for fallback host URL)
 * @param {Object} file The Multer file object
 * @param {string} type 'image' or 'video'
 * @returns {Promise<Object>} { url, filename, key, path }
 */
const saveLocalFile = async (req, file, type) => {
  if (!file) return null;

  const isVideo = type === 'video' || (file.mimetype && file.mimetype.startsWith('video/'));
  const folderName = isVideo ? 'videos' : 'images';

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
  const key = `${folderName}/${filename}`;
  const contentType = getContentType(filename, file.mimetype, isVideo);

  // Cloudflare R2 Upload Path (Zero VPS Disk Usage)
  if (isR2Configured()) {
    try {
      const client = getS3Client();
      const body = file.path ? fs.createReadStream(file.path) : file.buffer;

      const parallelUpload = new Upload({
        client,
        params: {
          Bucket: process.env.R2_BUCKET_NAME,
          Key: key,
          Body: body,
          ContentType: contentType,
        },
      });

      await parallelUpload.done();

      // Immediately delete temp file from server disk
      if (file.path && fs.existsSync(file.path)) {
        try {
          fs.unlinkSync(file.path);
        } catch (unlinkErr) {
          console.warn(`[Storage] Failed to unlink temp file ${file.path}:`, unlinkErr.message);
        }
      }

      const publicBase = (
        process.env.R2_PUBLIC_URL ||
        `https://${process.env.R2_BUCKET_NAME}.${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
      ).replace(/\/+$/, '');

      const fileUrl = `${publicBase}/${key}`;

      console.log(`[Storage] Uploaded to Cloudflare R2: ${fileUrl}`);
      return {
        url: fileUrl,
        filename: filename,
        key: key,
        path: file.path,
      };
    } catch (uploadError) {
      console.error('[Storage] Cloudflare R2 upload error:', uploadError);
      throw uploadError;
    }
  }

  // Fallback: Local disk storage under backend/uploads
  const targetDir = path.join(__dirname, '../uploads', folderName);
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const targetPath = path.join(targetDir, filename);

  try {
    if (file.path) {
      fs.copyFileSync(file.path, targetPath);
      fs.unlinkSync(file.path);
    } else if (file.buffer) {
      fs.writeFileSync(targetPath, file.buffer);
    }
  } catch (error) {
    console.error('Error saving local file:', error);
    throw error;
  }

  const protocol = req?.protocol || 'http';
  const host = req?.get ? req.get('host') : 'localhost:5000';
  const fileUrl = `${protocol}://${host}/api/uploads/${folderName}/${filename}`;

  return {
    url: fileUrl,
    filename: filename,
    key: key,
    path: targetPath,
  };
};

/**
 * Deletes a file based on its URL.
 * Automatically detects whether the file is on Cloudflare R2 or local disk.
 *
 * @param {string} url The public URL of the file to delete
 */
const deleteLocalFile = async (url) => {
  if (!url || typeof url !== 'string' || url.includes('default-avatar.png') || url.includes('via.placeholder.com')) return;

  try {
    // 1. Cloudflare R2 deletion
    let isR2Url = false;
    if (process.env.R2_PUBLIC_URL) {
      try {
        const publicHost = new URL(process.env.R2_PUBLIC_URL).hostname;
        if (url.includes(publicHost)) isR2Url = true;
      } catch (e) {}
    }
    if (url.includes('.r2.dev') || url.includes('.r2.cloudflarestorage.com')) {
      isR2Url = true;
    }

    if (isR2Url && isR2Configured()) {
      try {
        const urlToParse = (url.startsWith('http://') || url.startsWith('https://')) ? url : `https://${url}`;
        const parsedUrl = new URL(urlToParse);
        const objectKey = parsedUrl.pathname.replace(/^\/+/, '');
        if (objectKey) {
          const client = getS3Client();
          await client.send(new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: objectKey,
          }));
          console.log(`[Storage] Successfully deleted object from Cloudflare R2: ${objectKey}`);
          return;
        }
      } catch (r2Err) {
        console.error(`[Storage] Failed to delete object from R2 (${url}):`, r2Err.message);
        return;
      }
    }

    // 2. Local disk deletion (legacy / fallback)
    let relativePath = '';
    const uploadsIdx = url.indexOf('/uploads/');
    if (uploadsIdx !== -1) {
      relativePath = url.substring(uploadsIdx + 1);
    } else if (url.startsWith('uploads/') || url.startsWith('uploads\\')) {
      relativePath = url.replace(/\\/g, '/');
    } else {
      return;
    }

    const uploadsBaseDir = path.resolve(__dirname, '../uploads');
    const absolutePath = path.resolve(path.join(__dirname, '..', relativePath));

    // Security check: Target path must be strictly within uploads directory
    if (!absolutePath.startsWith(uploadsBaseDir)) {
      console.warn(`Security alert: Path traversal attempt blocked: ${url}`);
      return;
    }

    if (fs.existsSync(absolutePath)) {
      fs.unlinkSync(absolutePath);
      console.log(`[Storage] Deleted local file: ${absolutePath}`);
    } else {
      console.log(`[Storage] Local file not found for deletion: ${absolutePath}`);
    }
  } catch (error) {
    console.error(`[Storage] Failed to delete file from URL ${url}:`, error.message);
  }
};

module.exports = {
  saveLocalFile,
  deleteLocalFile,
  saveFile: saveLocalFile,
  deleteFile: deleteLocalFile,
  isR2Configured,
  getS3Client,
};
