import logoSrc from "../assets/logo.jpeg";

// Bideo wordmark: a play glyph in a rounded brand tile + the name.
const Logo = ({ className = "", dark = false, compact = false }) => (
  <span
    className={`inline-flex items-center gap-3 font-display font-bold ${className}`}
  >
    <img src={logoSrc} alt="Bideo logo" className="w-16 object-cover" />
  </span>
);

export default Logo;
