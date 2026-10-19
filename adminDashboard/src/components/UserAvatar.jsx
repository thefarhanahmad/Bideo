import { useState } from "react";
import { resolveMediaUrl } from "../lib/adminApi";

const SIZES = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-8 w-8 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
  xl: "h-24 w-24 sm:h-28 sm:w-28 text-3xl",
};

/** Round avatar that falls back to the user's initial when there is no photo or it fails to load. */
const UserAvatar = ({ user, size = "md", className = "" }) => {
  const [failed, setFailed] = useState(false);
  const src = resolveMediaUrl(user && user.avatar);
  const initial = ((user && (user.name || user.channelName)) || "?").charAt(0).toUpperCase();
  const sizeClass = SIZES[size] || SIZES.md;

  if (src && !failed) {
    return (
      <img
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setFailed(true)}
        className={`${sizeClass} shrink-0 rounded-full object-cover border border-line bg-surface ${className}`}
      />
    );
  }
  return (
    <span
      className={`${sizeClass} grid shrink-0 place-items-center rounded-full bg-brand-50 font-bold text-brand border border-brand/20 ${className}`}
    >
      {initial}
    </span>
  );
};

export default UserAvatar;
