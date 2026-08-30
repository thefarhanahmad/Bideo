if (!globalThis.crypto) {
  try {
    globalThis.crypto = require("crypto").webcrypto || require("crypto");
  } catch (err) {
    console.warn("Failed to polyfill globalThis.crypto:", err.message);
  }
}

const app = require("./app");
const connectDB = require("./config/db");
const { initDeletionScheduler } = require("./utils/deletionScheduler");
const { initAutoBoostScheduler } = require("./utils/autoBoostScheduler");

// Connect to database
connectDB();

// Initialize deletion scheduler cron/timer
initDeletionScheduler();

// Initialize organic 5-day auto-boost scheduler
initAutoBoostScheduler();

const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, () => {
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
