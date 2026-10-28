if (!globalThis.crypto) {
  try {
    globalThis.crypto = require("crypto").webcrypto || require("crypto");
  } catch (err) {
    console.warn("Failed to polyfill globalThis.crypto:", err.message);
  }
}

const http = require("http");
const app = require("./app");
const { initSocket } = require("./socket");
const connectDB = require("./config/db");
const { initDeletionScheduler } = require("./utils/deletionScheduler");
const { initAutoBoostScheduler } = require("./utils/autoBoostScheduler");
const { initOrphanMediaScheduler } = require("./utils/orphanMediaScheduler");
const { initWalletSettlementScheduler } = require("./utils/walletSettlementScheduler");
const { initBoostQueueScheduler } = require("./utils/boostQueueScheduler");
const { initVerifiedBadgeScheduler } = require("./utils/verifiedBadgeScheduler");
const { initMonetizationScheduler } = require("./utils/monetizationScheduler");
const { initStoryCleanupScheduler } = require("./utils/storyCleanupScheduler");
const { initUploadPushScheduler } = require("./utils/uploadPushScheduler");
const { initDirectUploadCleanup } = require("./utils/directUploadCleanup");

// Connect to database
connectDB();

// Initialize deletion scheduler cron/timer
initDeletionScheduler();

// Initialize organic 5-day auto-boost scheduler
initAutoBoostScheduler();

// Initialize automated weekly orphan media garbage collection
initOrphanMediaScheduler();

// Initialize daily 12:00 AM midnight wallet credit settlement scheduler
initWalletSettlementScheduler();

// Initialize video boost queue scheduler (evaluates and promotes pinned video boosts)
initBoostQueueScheduler();

// Initialize 1-month verified badge expiration scheduler
initVerifiedBadgeScheduler();

// Initialize 48-hour monetization auto-approval scheduler
initMonetizationScheduler();

// Initialize 24-hour story auto-cleanup scheduler (DB & media storage purge)
initStoryCleanupScheduler();

// Send upload pushes held overnight (10 PM - 8 AM IST) from 8 AM
initUploadPushScheduler();

// Cancel direct-to-R2 uploads left unfinished for over a day
initDirectUploadCleanup();

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);
// Node 20 aborts a request that takes longer than 5 minutes to arrive; large video uploads
// through the server need longer (matches the app's 60-minute upload timeout)
server.requestTimeout = 60 * 60 * 1000;
initSocket(server);

server.listen(PORT, () => {
  console.log(
    `Server running in ${process.env.NODE_ENV || "development"} mode on port ${PORT}`,
  );
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (err, promise) => {
  console.log(`Error: ${err.message}`);
  // Close server & exit process
  server.close(() => process.exit(1));
});
