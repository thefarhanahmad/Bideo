
// Bideo wordmark: a play glyph in a rounded brand tile + the name.
const Logo = ({ className = "", dark = false, compact = false }) => (
  <span className={`inline-flex items-center gap-2 font-display font-bold ${className}`}>
    <span className="grid h-9 w-9 place-items-center rounded-xl bg-brand shadow-brand">
      <svg viewBox="0 0 24 24" className="h-5 w-5 text-white" fill="currentColor">
        <polygon points="6 4 20 12 6 20 6 4" />
      </svg>
    </span>
    {!compact && (
      <span className={`text-xl tracking-tight ${dark ? "text-white" : "text-ink"}`}>
        Bideo
      </span>
    )}
  </span>
);

export default Logo;
