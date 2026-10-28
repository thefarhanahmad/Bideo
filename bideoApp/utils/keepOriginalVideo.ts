import type { ImagePickerAsset } from 'expo-image-picker';

// Compression re-encodes at about 1.5 Mbps (longest side 1280 px). A video that is already that
// small would only get bigger and lose a little quality, so it is uploaded as it is - but only an
// MP4 of at most full HD, which plays on every phone. Camera recordings (which may use formats
// some older phones can't play) are far above these bitrates and are always compressed.
export const KEEP_ORIGINAL_BELOW_BPS = 1.7 * 1000 * 1000; // skip compressing: it can't make the file smaller
export const KEEP_ORIGINAL_IF_SMALLER_BELOW_BPS = 2.5 * 1000 * 1000; // compressed came out bigger: use original
export const KEEP_ORIGINAL_MAX_SIDE = 1920;

const isMp4 = (asset: ImagePickerAsset) =>
  asset.mimeType === 'video/mp4' ||
  /\.mp4$/i.test(asset.fileName || '') ||
  /\.mp4$/i.test((asset.uri || '').split('?')[0]);

/**
 * True when an original that could not be compressed may be uploaded as it is: the same bitrate
 * limit as keeping an original whose compressed copy came out bigger. Camera recordings are far
 * heavier (10-20 Mbps); they buffer on slow mobile data and use a lot of every viewer's data.
 */
export const isLightEnoughToUploadRaw = (asset: ImagePickerAsset, originalBytes: number) => {
  const seconds = Number(asset.duration) / 1000; // the image picker reports milliseconds
  // Length or size unknown: can't judge here, the server checks the uploaded file
  if (!originalBytes || !seconds) return true;
  return (originalBytes * 8) / seconds <= KEEP_ORIGINAL_IF_SMALLER_BELOW_BPS;
};

/** True when the original file can be uploaded as it is (MP4, full HD at most, bitrate up to maxBps) */
export const canKeepOriginal = (asset: ImagePickerAsset, originalBytes: number, maxBps: number) => {
  const seconds = Number(asset.duration) / 1000; // the image picker reports milliseconds
  const longestSide = Math.max(Number(asset.width) || 0, Number(asset.height) || 0);
  if (!isMp4(asset) || !originalBytes || !seconds || !longestSide || longestSide > KEEP_ORIGINAL_MAX_SIDE) return false;
  return (originalBytes * 8) / seconds <= maxBps;
};
