/**
 * Middleware to pause video & shorts uploads during infrastructure / cloud storage maintenance.
 * Rejects upload requests immediately BEFORE multer disk buffering, preventing disk exhaustion.
 */
const uploadMaintenance = (req, res, next) => {
  // Can be toggled via backend/.env:
  // UPLOAD_MAINTENANCE_ENABLED=true  -> Uploads paused (maintenance active)
  // UPLOAD_MAINTENANCE_ENABLED=false -> Uploads enabled (normal operation)
  // Default is active while maintenance is in progress.
  const isMaintenanceActive = process.env.UPLOAD_MAINTENANCE_ENABLED !== 'false';

  if (isMaintenanceActive) {
    return res.status(503).json({
      success: false,
      code: 'UPLOAD_MAINTENANCE',
      message: 'Video & Shorts upload is temporarily under scheduled maintenance while we upgrade our cloud storage servers. Uploads will be back shortly. Thank you for your patience and support! 🙏',
    });
  }

  next();
};

module.exports = uploadMaintenance;
