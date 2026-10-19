import { useEffect, useState } from "react";
import Modal from "../Modal";
import UserLink from "../UserLink";
import UserAvatar from "../UserAvatar";
import { Badge, StatusBadge, ErrorState } from "./ui";
import { ShimmerBar } from "../LoadingSkeleton";
import { adminFetch, isAbortError, resolveMediaUrl } from "../../lib/adminApi";
import { formatCompact, formatDate, formatDateTime, timeAgo, displayName } from "../../lib/format";

/** Followers (`field="follower"`) or following (`field="channel"`). */
export const PeopleList = ({ items, field }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
    {items.map((row) => {
      const person = row[field];
      return (
        <div key={row._id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3 shadow-card">
          <UserLink user={person} withAvatar avatarSize="md" showHandle />
          <div className="shrink-0 text-right text-[11px] text-muted">
            {person && <p className="font-semibold text-ink">{formatCompact(person.followersCount)} followers</p>}
            <p>since {formatDate(row.createdAt)}</p>
          </div>
        </div>
      );
    })}
  </div>
);

export const CommentsList = ({ items, onPlay }) => (
  <div className="space-y-3">
    {items.map((c) => (
      <article key={c._id} className="rounded-2xl border border-line bg-white p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-muted">
          <span className="min-w-0 truncate">
            On{" "}
            {c.video ? (
              <button type="button" onClick={() => onPlay(c.video)} className="font-semibold text-ink hover:text-brand hover:underline">
                {c.video.isShort ? "short" : "video"}: {c.video.title || "Untitled"}
              </button>
            ) : c.post ? (
              <span className="font-semibold text-ink">post: {(c.post.text || "image post").slice(0, 60)}</span>
            ) : (
              <span>deleted content</span>
            )}
          </span>
          <span>{formatDateTime(c.createdAt)}</span>
        </div>
        <p className="mt-2 whitespace-pre-line text-sm text-ink">{c.text}</p>
        <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] text-muted">
          <span>❤ {formatCompact(c.likesCount)}</span>
          <span>· 💬 {formatCompact(c.repliesCount)} replies</span>
          {c.isPinned && <Badge tone="brand">Pinned</Badge>}
          {c.isLoved && <Badge tone="red">Loved by creator</Badge>}
        </div>
      </article>
    ))}
  </div>
);

const ChatViewerModal = ({ conversation, profileUserId, onClose }) => {
  const [state, setState] = useState({ loading: true, error: null, messages: [] });

  useEffect(() => {
    const controller = new AbortController();
    adminFetch(`/api/admin/conversations/${conversation._id}/messages`, { signal: controller.signal })
      .then((res) => setState({ loading: false, error: null, messages: res.data || [] }))
      .catch((err) => !isAbortError(err) && setState({ loading: false, error: err.message, messages: [] }));
    return () => controller.abort();
  }, [conversation._id]);

  const title = conversation.isGroup
    ? conversation.groupName || "Group chat"
    : (conversation.participants || []).filter((p) => String(p._id) !== String(profileUserId)).map(displayName).join(", ") || "Chat";

  return (
    <Modal title={`Chat · ${title}`} maxWidth="max-w-2xl" onClose={onClose}>
      {state.loading && (
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <ShimmerBar key={i} className={`h-10 rounded-2xl ${i % 2 ? "ml-auto w-1/2" : "w-2/3"}`} />
          ))}
        </div>
      )}
      {state.error && <ErrorState message={state.error} />}
      {!state.loading && !state.error && state.messages.length === 0 && <p className="py-8 text-center text-sm text-muted">No messages.</p>}
      <div className="space-y-2.5">
        {state.messages.map((m) => {
          const mine = m.sender && String(m.sender._id) === String(profileUserId);
          return (
            <div key={m._id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              <UserAvatar user={m.sender} size="xs" />
              <div className={`max-w-[78%] rounded-2xl px-3.5 py-2 text-sm ${mine ? "bg-brand text-white rounded-br-md" : "bg-surface text-ink border border-line rounded-bl-md"}`}>
                {!mine && conversation.isGroup && <p className="mb-0.5 text-[11px] font-bold opacity-80">{displayName(m.sender)}</p>}
                {m.text && <p className="whitespace-pre-line break-words">{m.text}</p>}
                {m.video && (
                  <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-black/10 p-1.5">
                    {m.video.thumbnail && <img src={resolveMediaUrl(m.video.thumbnail)} alt="" loading="lazy" className="h-10 w-16 rounded-md object-cover" />}
                    <span className="line-clamp-2 text-xs font-semibold">🎬 {m.video.title || "Shared video"}</span>
                  </div>
                )}
                {m.post && <p className="mt-1.5 rounded-xl bg-black/10 p-1.5 text-xs">📝 {(m.post.text || "Shared post").slice(0, 80)}</p>}
                <p className={`mt-1 text-[10px] ${mine ? "text-white/75" : "text-muted"}`}>{formatDateTime(m.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
};

export const ChatsList = ({ items, profileUserId }) => {
  const [open, setOpen] = useState(null);
  return (
    <>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        {items.map((c) => {
          const others = (c.participants || []).filter((p) => String(p._id) !== String(profileUserId));
          const label = c.isGroup ? c.groupName || "Group chat" : others.map(displayName).join(", ") || "Unknown user";
          return (
            <button key={c._id} type="button" onClick={() => setOpen(c)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface/60">
              <div className="flex shrink-0 -space-x-3">
                {(others.length ? others : c.participants || []).slice(0, 3).map((p) => (
                  <UserAvatar key={p._id} user={p} size="md" className="ring-2 ring-white" />
                ))}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 truncate text-sm font-semibold text-ink">
                  <span className="truncate">{label}</span>
                  {c.isGroup && <Badge tone="violet">{c.participantCount} members</Badge>}
                  {c.status && c.status !== "accepted" && <StatusBadge status={c.status} />}
                </p>
                <p className="truncate text-xs text-muted">{(c.lastMessage && c.lastMessage.text) || "No messages yet"}</p>
              </div>
              <span className="shrink-0 text-[11px] text-muted">{timeAgo(c.updatedAt)}</span>
            </button>
          );
        })}
      </div>
      {open && <ChatViewerModal conversation={open} profileUserId={profileUserId} onClose={() => setOpen(null)} />}
    </>
  );
};
