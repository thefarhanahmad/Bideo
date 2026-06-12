// Central place for environment-driven config used across the app.

// Backend API base URL (no trailing slash). Falls back to local dev.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Public Android APK download link shown on the landing page.
// Empty string when not configured — the UI disables the button gracefully.
export const APP_DOWNLOAD_URL = import.meta.env.VITE_APP_DOWNLOAD_URL || "";

export const BRAND = {
  name: "Bideo",
  tagline: "Watch. Create. Grow.",
};
