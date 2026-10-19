import { Link } from "react-router-dom";
import UserAvatar from "./UserAvatar";
import { displayName } from "../lib/format";

/**
 * Clickable user name (optionally with avatar) that opens the admin user profile.
 * Renders plain text when the user is missing (e.g. a deleted account).
 */
const UserLink = ({ user, withAvatar = false, avatarSize = "sm", showHandle = false, className = "" }) => {
  if (!user || !user._id) {
    return <span className={`text-muted ${className}`}>Unknown user</span>;
  }
  return (
    <Link
      to={`/admin/users/${user._id}`}
      onClick={(e) => e.stopPropagation()}
      className={`group inline-flex min-w-0 max-w-full items-center gap-2 ${className}`}
      title="Open user profile"
    >
      {withAvatar && <UserAvatar user={user} size={avatarSize} />}
      <span className="min-w-0">
        <span className="block truncate font-semibold text-ink group-hover:text-brand group-hover:underline underline-offset-2">
          {displayName(user)}
          {user.isVerified && <span className="ml-1 text-sky-500" aria-label="Verified">✔</span>}
        </span>
        {showHandle && user.name && user.channelName && (
          <span className="block truncate text-[11px] text-muted">@{user.name}</span>
        )}
      </span>
    </Link>
  );
};

export default UserLink;
