const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const morgan = require("morgan");
const dotenv = require("dotenv");

// Load env vars
dotenv.config();

const app = express();

// Route files
const auth = require("./routes/auth");
const admin = require("./routes/admin");
const users = require("./routes/users");
const categories = require("./routes/categories");
const video = require("./routes/video");
const comment = require("./routes/comment");
const subscription = require("./routes/subscription");

// Middlewares
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
const allowedOrigins = [
  "http://localhost:5173",
  "http://192.168.3.107:5173",
  "exp://192.168.3.107:8081",
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
app.use(helmet());

if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Mount routers
app.use("/api/auth", auth);
app.use("/api/admin", admin);
app.use("/api/users", users);
app.use("/api/categories", categories);
app.use("/api/videos", video);
app.use("/api/comments", comment);
app.use("/api/subscriptions", subscription);

// Basic route
app.get("/", (req, res) => {
  res.json({ message: "Welcome to IndiaTube API" });
});

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    stack: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

module.exports = app;
