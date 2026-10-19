import { useState } from "react";
import UserAvatar from "../UserAvatar";
import { Badge, StatusBadge } from "./ui";
import { resolveMediaUrl } from "../../lib/adminApi";
import { formatDate, formatDateTime, timeAgo } from "../../lib/format";

const ActionButton = ({ onClick, children, tone = "default" }) => {
  const tones = {
    default: "bg-white text-ink border border-line hover:bg-surface",
    brand: "bg-brand text-white hover:bg-brand-dark shadow-sm",
    green: "bg-emerald-600 text-white hover:bg-emerald-700",
    red: "bg-white text-red-600 border border-red-200 hover:bg-red-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${tones[tone]}`}
    >
      {children}
    </button>
  );
};

const MetaItem = ({ label, children }) => (
  <div className="min-w-0">
    <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</dt>
    <dd className="mt-0.5 truncate text-sm font-semibold text-ink">{children || "—"}</dd>
  </div>
);

const DeletionBanner = ({ user, actions }) => {
  const recovery = user.recoveryRequested || user.deletionStatus === "recovery_requested";
  if (!user.deletionScheduled && !recovery) return null;
  return (
    <div className={`rounded-xl border p-3.5 text-xs ${recovery ? "border-amber-200 bg-amber-50 text-amber-900" : "border-red-200 bg-red-50 text-red-800"}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="font-bold">
            {recovery ? "Recovery requested" : "Account scheduled for deletion"}
            {user.scheduledDeletionDate && ` · deletes on ${formatDate(user.scheduledDeletionDate)}`}
          </p>
          {user.deletionReason && <p>Deletion reason: “{user.deletionReason}”</p>}
          {user.recoveryReason && <p>Recovery reason: “{user.recoveryReason}”</p>}
          {user.recoveryNotes && <p>Notes: “{user.recoveryNotes}”</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          {recovery ? (
            <>
              <ActionButton tone="green" onClick={() => actions.approveRecovery(user)}>Approve &amp; restore</ActionButton>
              <ActionButton onClick={() => actions.rejectRecovery(user)}>Reject request</ActionButton>
            </>
          ) : (
            <ActionButton tone="green" onClick={() => actions.stopDeletion(user)}>Stop deletion</ActionButton>
          )}
        </div>
      </div>
    </div>
  );
};

const ProfileHeader = ({ user, monetization, stats, actions }) => {
  const [coverFailed, setCoverFailed] = useState(false);
  const cover = resolveMediaUrl(user.coverImage);
  const socialLinks = (user.socialLinks || []).filter((l) => l && l.url);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
      <div className="relative h-28 sm:h-40 bg-gradient-to-r from-brand via-brand-light to-amber-300">
        {cover && !coverFailed && (
          <img src={cover} alt="" onError={() => setCoverFailed(true)} className="absolute inset-0 h-full w-full object-cover" />
        )}
      </div>

      <div className="px-4 pb-5 sm:px-6">
        <div className="-mt-12 sm:-mt-14 flex flex-wrap items-end justify-between gap-4">
          <div className="relative z-10">
            <UserAvatar user={user} size="xl" className="ring-4 ring-white shadow-card" />
          </div>
          <div className="flex flex-wrap gap-2 pt-2">
            <ActionButton onClick={() => actions.edit(user)}>✏️ Edit</ActionButton>
            <ActionButton onClick={() => actions.assignCoins(user)}>🪙 Assign coins</ActionButton>
            <ActionButton onClick={() => actions.toggleVerify(user)}>{user.isVerified ? "Remove badge" : "✔ Verify"}</ActionButton>
            <ActionButton onClick={() => actions.toggleMonetize(user)}>{user.isMonetized ? "Revoke monetization" : "💰 Monetize"}</ActionButton>
            <ActionButton tone={user.isBlocked ? "green" : "red"} onClick={() => actions.toggleBlock(user)}>
              {user.isBlocked ? "Unblock" : "⛔ Block"}
            </ActionButton>
            <ActionButton tone="red" onClick={() => actions.remove(user)}>🗑 Delete</ActionButton>
          </div>
        </div>

        <div className="mt-3 min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 font-display text-xl sm:text-2xl font-extrabold text-ink">
            <span className="truncate">{user.channelName || user.name || "Unnamed user"}</span>
            {user.isVerified && <span className="text-sky-500 text-lg" title="Verified creator">✔</span>}
          </h2>
          {user.name && <p className="text-sm text-muted">@{user.name}</p>}

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {user.role === "admin" && <Badge tone="violet">Admin</Badge>}
            {user.isVerified && <Badge tone="blue">Verified{user.verifiedSource ? ` by ${String(user.verifiedSource).replace(/_/g, " ")}` : ""}</Badge>}
            {user.isMonetized && <Badge tone="green">Monetized</Badge>}
            {!user.isMonetized && monetization && <Badge tone="amber">Monetization {monetization.status}</Badge>}
            {user.isBlocked && <Badge tone="red">Blocked</Badge>}
            {user.deletionScheduled && <Badge tone="red">Deletion scheduled</Badge>}
            {user.authProvider && <Badge>{user.authProvider} login</Badge>}
            {stats.activeStories > 0 && <Badge tone="brand">{stats.activeStories} live stor{stats.activeStories === 1 ? "y" : "ies"}</Badge>}
          </div>

          {user.about && <p className="mt-3 max-w-3xl whitespace-pre-line text-sm text-ink/80">{user.about}</p>}
        </div>

        {user.isBlocked && (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-800">
            Blocked {user.blockedAt ? `on ${formatDateTime(user.blockedAt)}` : ""}{user.blockReason ? ` — “${user.blockReason}”` : ""}
          </p>
        )}

        <div className="mt-3">
          <DeletionBanner user={user} actions={actions} />
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-line pt-4 sm:grid-cols-3 lg:grid-cols-6">
          <MetaItem label="Phone">{user.phone}</MetaItem>
          <MetaItem label="Email">
            {user.email ? (
              <span title={user.email}>
                {user.email} {user.isEmailVerified && <span className="text-emerald-600" title="Email verified">✔</span>}
              </span>
            ) : null}
          </MetaItem>
          <MetaItem label="Joined">{formatDate(user.createdAt)}</MetaItem>
          <MetaItem label="Last updated">{user.updatedAt ? timeAgo(user.updatedAt) : null}</MetaItem>
          <MetaItem label="Devices (push)">{String(stats.devices)}</MetaItem>
          <MetaItem label="Monetization">{monetization ? <StatusBadge status={monetization.status} /> : "Not applied"}</MetaItem>
        </dl>

        {(socialLinks.length > 0 || (user.nameHistory || []).length > 0) && (
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
            {socialLinks.map((l) => (
              <a
                key={l.url}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-line bg-surface px-2.5 py-1 font-semibold text-ink hover:border-brand hover:text-brand"
              >
                {l.platform || l.label || "Link"} ↗
              </a>
            ))}
            {(user.nameHistory || []).length > 0 && (
              <span className="text-muted">
                Previous channel names: {user.nameHistory.map((n) => (typeof n === "string" ? n : n.name || n.channelName)).filter(Boolean).join(", ")}
              </span>
            )}
          </div>
        )}
      </div>
    </section>
  );
};

export default ProfileHeader;
