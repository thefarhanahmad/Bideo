const cloudinary = require('cloudinary').v2;

// Shared compression presets applied to uploads so stored/delivered media is smaller.
// Images use an incoming transformation (the stored asset itself is compressed).
// Video uses a delivery transformation (see optimizedVideoUrl) to avoid slow/way
// risky synchronous transcoding on large uploads.
const IMAGE_TRANSFORM = [{ width: 1600, height: 1600, crop: 'limit', quality: 'auto:good' }];
const VIDEO_TRANSFORM = [{ width: 1280, height: 1280, crop: 'limit', quality: 'auto' }];

// Default options to spread into cloudinary.uploader.upload for images.
const imageUploadOptions = (folder) => ({ folder, transformation: IMAGE_TRANSFORM });

/**
 * Builds a compressed delivery URL for an already-uploaded video public_id.
 * Cloudinary transcodes on first request and caches the result, so playback is
 * smaller without blocking the upload.
 */
const optimizedVideoUrl = (publicId) =>
  cloudinary.url(`${publicId}.mp4`, {
    resource_type: 'video',
    secure: true,
    transformation: VIDEO_TRANSFORM,
  });

/**
 * Extracts the public_id from a Cloudinary URL. Robust to transformation
 * segments (e.g. /upload/q_auto,w_1280/v123/folder/name.mp4) and query strings.
 * @param {string} url The Cloudinary URL
 * @returns {string|null} The public_id or null if not found
 */
const getPublicIdFromUrl = (url) => {
  if (!url || !url.includes('cloudinary.com')) return null;

  try {
    const clean = url.split('?')[0];
    const parts = clean.split('/');
    const uploadIndex = parts.indexOf('upload');
    if (uploadIndex === -1) return null;

    let rest = parts.slice(uploadIndex + 1);

    // If a version segment (v123456) is present, the public_id is everything after it.
    const versionIdx = rest.findIndex((p) => /^v\d+$/.test(p));
    if (versionIdx !== -1) {
      rest = rest.slice(versionIdx + 1);
    } else if (rest.length > 1 && /[,_]/.test(rest[0]) && !rest[0].includes('.')) {
      // No version, but a leading transformation segment — drop it.
      rest = rest.slice(1);
    }

    const publicIdWithExtension = rest.join('/');
    return publicIdWithExtension.replace(/\.[^/.]+$/, '');
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
};

/**
 * Deletes an asset from Cloudinary
 * @param {string} url The Cloudinary URL of the asset to delete
 * @param {string} resourceType 'image' or 'video'
 */
const deleteFromCloudinary = async (url, resourceType = 'image') => {
  if (!url || url.includes('default-avatar.png')) return;

  const publicId = getPublicIdFromUrl(url);
  if (!publicId) return;

  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType });
    console.log(`Deleted ${resourceType} from Cloudinary: ${publicId}`);
  } catch (error) {
    console.error(`Failed to delete ${resourceType} from Cloudinary:`, error);
  }
};

module.exports = {
  getPublicIdFromUrl,
  deleteFromCloudinary,
  optimizedVideoUrl,
  imageUploadOptions,
  IMAGE_TRANSFORM,
  VIDEO_TRANSFORM,
};
