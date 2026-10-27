const mongoose = require('mongoose');

// One direct-to-R2 video upload (controllers/directUpload.js). The app / admin uploads the video
// in parts straight to R2 using signed links; this record ties the R2 multipart upload to the
// user so only they can sign parts and finish it. Unfinished uploads are aborted after a day
// (utils/directUploadCleanup.js); records expire after 7 days.
const uploadSessionSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.ObjectId, ref: 'User', required: true },
  status: {
    type: String,
    enum: ['uploading', 'completing', 'completed', 'aborted'],
    default: 'uploading',
  },
  videoKey: { type: String, required: true },
  multipartUploadId: { type: String, required: true },
  videoSize: { type: Number, required: true },
  videoContentType: { type: String, required: true },
  partSize: { type: Number, required: true },
  partCount: { type: Number, required: true },
  // Optional thumbnail, uploaded with one signed link
  thumbnailKey: { type: String, default: null },
  thumbnailSize: { type: Number, default: 0 },
  thumbnailContentType: { type: String, default: null },
  // Set once the video record is created (a repeated "finish" returns it instead of a duplicate)
  video: { type: mongoose.Schema.ObjectId, ref: 'Video', default: null },
  createdAt: { type: Date, default: Date.now, expires: 7 * 24 * 60 * 60 },
});

uploadSessionSchema.index({ status: 1, createdAt: 1 });

module.exports = mongoose.model('UploadSession', uploadSessionSchema);
