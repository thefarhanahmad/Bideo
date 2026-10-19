import { Link } from "react-router-dom";
import UserAvatar from "./UserAvatar";
import { displayName } from "../lib/format";

/**
 * Clickable user name (optionally with avatar) that opens the admin user profile and stats page.
 * Renders plain text or fallback when the user is missing (e.g. a deleted account).
 * If children are provided, wraps children in the Link to the stats page.
 */
const UserLink = ({
  user,
  withAvatar = false,
  avatarSize = "sm",
  showHandle = false,
  subtitle = null,
  tab = null,
  className = "",
  children,
  title = "Open user profile & stats",
}) => {
  const id = user?._id || user?.id || (typeof user === "string" ? user : null);
  const targetUrl = id ? `/admin/users/${id}${tab ? `?tab=${tab}` : ""}` : null;

  if (!targetUrl) {
    return children ? (
      <span className={className}>{children}</span>
    ) : (
      <span className={`text-muted ${className}`}>Unknown user</span>
    );
  }

  if (children) {
    return (
      <Link
        to={targetUrl}
        onClick={(e) => e.stopPropagation()}
        className={className}
        title={title}
      >
        {children}
      </Link>
    );
  }

  const primaryName = user?.name || user?.channelName || displayName(user);
  const handle = user?.channelName || user?.name;

  return (
    <Link
      to={targetUrl}
      onClick={(e) => e.stopPropagation()}
      className={`group inline-flex min-w-0 max-w-full items-center gap-2 ${className}`}
      title={title}
    >
      {withAvatar && <UserAvatar user={user} size={avatarSize} />}
      <span className="min-w-0">
        <span className="block truncate font-semibold text-ink group-hover:text-brand group-hover:underline underline-offset-2">
          {primaryName}
          {user?.isVerified && <span className="ml-1 text-sky-500" aria-label="Verified">✔</span>}
        </span>
        {showHandle && handle && (
          <span className="block truncate text-[11px] text-muted group-hover:text-ink">
            @{handle}
          </span>
        )}
        {subtitle && (
          <span className="block truncate text-[11px] text-muted">{subtitle}</span>
        )}
      </span>
    </Link>
  );
};

export default UserLink;
