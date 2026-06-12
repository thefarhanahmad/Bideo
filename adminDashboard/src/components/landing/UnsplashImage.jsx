import { useState } from "react";

/**
 * Renders a direct Unsplash photo (hotlink-friendly, no API key needed).
 * If the image ever fails to load, it falls back to an on-brand gradient
 * so the layout never shows a broken-image icon.
 */
const UnsplashImage = ({ id, alt = "", w = 800, className = "", imgClassName = "" }) => {
  const [failed, setFailed] = useState(false);
  const src = `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${w}&q=80`;

  if (failed) {
    return (
      <div
        className={`bg-gradient-to-br from-brand via-brand-light to-amber-300 ${className}`}
        aria-label={alt}
        role="img"
      />
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${className} ${imgClassName}`}
    />
  );
};

export default UnsplashImage;
