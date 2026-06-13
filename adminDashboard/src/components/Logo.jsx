
import logoSrc from "../assets/logo.jpeg";

// Bideo wordmark: a play glyph in a rounded brand tile + the name.
const Logo = ({ className = "", dark = false, compact = false }) => (
  <span className={`inline-flex items-center gap-3 font-display font-bold ${className}`}>
    <img src={logoSrc} alt="Bideo logo" className="h-10 w-10 rounded-2xl object-cover" />
    {!compact && (
      <span className={`text-xl tracking-tight ${dark ? "text-white" : "text-ink"}`}>
        Bideo
      </span>
    )}
  </span>
);

export default Logo;
