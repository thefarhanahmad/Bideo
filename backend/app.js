const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const dotenv = require("dotenv");

const path = require("path");

// Load env vars
dotenv.config();

const app = express();
app.set('trust proxy', true);

// Route files
const auth = require("./routes/auth");
const admin = require("./routes/admin");
const users = require("./routes/users");
const categories = require("./routes/categories");
const video = require("./routes/video");
const comment = require("./routes/comment");
const followers = require("./routes/followers");
const playlist = require("./routes/playlist");
const notifications = require("./routes/notifications");
const posts = require("./routes/posts");
const channels = require("./routes/channels");
const ads = require("./routes/ads");
const seo = require("./routes/seo");

// Middlewares
app.use(express.json({ limit: "500mb" }));
app.use(express.urlencoded({ extended: true, limit: "500mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/api/uploads", express.static(path.join(__dirname, "uploads")));

const allowedOrigins = [
  "http://localhost:5173",
  "http://192.168.3.107:5173",
  "exp://192.168.3.107:8081",
  "https://bideo-t.netlify.app",
  "https://bideo.in",
];

app.use(
  cors({
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
  }),
);
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Serve app-ads.txt directly for Google AdMob crawler verification
const APP_ADS_TXT_CONTENT = "google.com, pub-3108167135160132, DIRECT, f08c47fec0942fa0\n";
app.get(["/app-ads.txt", "/api/app-ads.txt"], (req, res) => {
  res.setHeader("Content-Type", "text/plain");
  res.status(200).send(APP_ADS_TXT_CONTENT);
});

// Mount routers
app.use("/api/auth", auth);
app.use("/api/admin", admin);
app.use("/api/users", users);
app.use("/api/categories", categories);
app.use("/api/videos", video);
app.use("/api/comments", comment);
app.use("/api/followers", followers);
app.use("/api/playlists", playlist);
app.use("/api/notifications", notifications);
app.use("/api/posts", posts);
app.use("/api/channels", channels);
app.use("/api/ads", ads);
app.use("/", seo);
app.use("/api", seo);

// Basic route
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Bideo API Running",
  });
});

// Error handling middleware
const ErrorLog = require("./models/ErrorLog");

app.use((err, req, res, next) => {
  // Mongoose validation error handling (return 400 Bad Request instead of 500)
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors || {}).map((e) => e.message);
    const message = messages[0] || 'Validation error';
    return res.status(400).json({
      success: false,
      message,
      errors: messages,
    });
  }

  // Mongoose bad ObjectId (CastError)
  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: `Invalid ID: ${err.value}`,
    });
  }

  const statusCode = err.statusCode || (err.name === "MulterError" ? 413 : 500);
  const message = err.message || "Internal Server Error";
  const endpoint = req.originalUrl || req.url || "Unknown";
  const method = req.method || "GET";
  const stack = err.stack || "";

  // Asynchronously record genuine server-side errors (5xx) without blocking response
  if (statusCode >= 500) {
    (async () => {
      try {
        const existing = await ErrorLog.findOne({
          message,
          endpoint,
          method,
          status: "unresolved",
        });

        if (existing) {
          existing.count += 1;
          existing.lastSeenAt = new Date();
          existing.stack = stack;
          await existing.save();
        } else {
          await ErrorLog.create({
            message,
            stack,
            statusCode,
            endpoint,
            method,
            status: "unresolved",
            count: 1,
            firstSeenAt: new Date(),
            lastSeenAt: new Date(),
          });
        }
      } catch (logErr) {
        console.error("Error logging to database:", logErr.message);
      }
    })();
  }

  // Duplicate key error handling (E11000)
  if (err && (err.code === 11000 || (err.name === 'MongoServerError' && err.code === 11000))) {
    let duplicateMessage = 'Duplicate value entered';
    if (err.keyPattern) {
      if (err.keyPattern.channelName) {
        duplicateMessage = 'Channel name already exists. Please choose a different channel name.';
      } else if (err.keyPattern.name) {
        duplicateMessage = 'Username already exists. Please choose another username.';
      } else if (err.keyPattern.phone) {
        duplicateMessage = 'This phone number is already registered. Please login instead.';
      } else if (err.keyPattern.email) {
        duplicateMessage = 'This email is already registered.';
      }
    } else if (err.message) {
      if (err.message.includes('channelName')) {
        duplicateMessage = 'Channel name already exists. Please choose a different channel name.';
      } else if (err.message.includes('name')) {
        duplicateMessage = 'Username already exists. Please choose another username.';
      } else if (err.message.includes('phone')) {
        duplicateMessage = 'This phone number is already registered. Please login instead.';
      } else if (err.message.includes('email')) {
        duplicateMessage = 'This email is already registered.';
      }
    }

    return res.status(400).json({
      success: false,
      message: duplicateMessage,
    });
  }

  // Friendly messages for file-upload (multer) errors instead of a generic 500.
  if (err && err.name === "MulterError") {
    const messages = {
      LIMIT_FILE_SIZE:
        "This file is too large. Please upload a video or media file under 500MB.",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field in upload.",
    };
    return res.status(413).json({
      success: false,
      message: messages[err.code] || "Upload error. Please try a smaller file.",
    });
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

module.exports = app;
