// Central place for environment-driven config used across the app.

// Backend API base URL (no trailing slash). Falls back to local dev.
export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

// Public Android APK download link shown on the landing page.
// Defaults to the direct APK download endpoint if not explicitly overridden.
export const APP_DOWNLOAD_URL =
  import.meta.env.VITE_APP_DOWNLOAD_URL || `${API_URL}/api/download/app`;

export const BRAND = {
  name: "Bideo",
  tagline: "Watch. Create. Grow.",
};
