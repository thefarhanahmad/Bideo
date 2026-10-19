// Display formatting shared by admin pages.

const compactFormatter = new Intl.NumberFormat("en-IN", { notation: "compact", maximumFractionDigits: 1 });
const dateFormatter = new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});
const inrFormatter = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export const formatCompact = (n) => compactFormatter.format(Number(n) || 0);
export const formatNumber = (n) => (Number(n) || 0).toLocaleString("en-IN");
export const formatINR = (n) => inrFormatter.format(Number(n) || 0);

export const formatDate = (d) => (d ? dateFormatter.format(new Date(d)) : "—");
export const formatDateTime = (d) => (d ? dateTimeFormatter.format(new Date(d)) : "—");

export const formatDuration = (seconds) => {
  const total = Math.max(0, Math.round(Number(seconds) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
};

const UNITS = [
  ["year", 31536000],
  ["month", 2592000],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];
const relativeFormatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

export const timeAgo = (d) => {
  if (!d) return "—";
  const diffSec = (new Date(d).getTime() - Date.now()) / 1000;
  for (const [unit, size] of UNITS) {
    if (Math.abs(diffSec) >= size) return relativeFormatter.format(Math.round(diffSec / size), unit);
  }
  return "just now";
};

export const displayName = (u) => (u && (u.channelName || u.name)) || "Unknown user";
