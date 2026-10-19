import { useState } from "react";
import Modal from "../Modal";
import UserLink from "../UserLink";
import { StatusBadge, Badge } from "./ui";
import { resolveMediaUrl } from "../../lib/adminApi";
import { formatCompact, formatDate, formatDuration, timeAgo } from "../../lib/format";

const Thumb = ({ src, alt = "", className = "" }) => {
  const [failed, setFailed] = useState(false);
  const url = resolveMediaUrl(src);
  if (!url || failed) {
    return <div className={`grid place-items-center bg-surface text-2xl text-muted ${className}`} aria-hidden="true">🎬</div>;
  }
  return <img src={url} alt={alt} loading="lazy" decoding="async" onError={() => setFailed(true)} className={`object-cover bg-surface ${className}`} />;
};

/** Grid of videos/shorts. `showOwner` is used for watch history and liked videos. */
export const VideoGrid = ({ items, onPlay, showOwner = false }) => {
  const shortsOnly = items.length > 0 && items.every((v) => v.isShort);
  return (
    <div className={`grid gap-4 ${shortsOnly ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"}`}>
      {items.map((v) =>
        v.deleted ? (
          <div key={v._id} className="grid aspect-video place-items-center rounded-2xl border border-dashed border-line bg-white text-xs text-muted">
            Video removed
          </div>
        ) : (
          <article key={v._id} className="group overflow-hidden rounded-2xl border border-line bg-white shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
            <button type="button" onClick={() => onPlay(v)} className="relative block w-full text-left" aria-label={`Play ${v.title || "video"}`}>
              <Thumb src={v.thumbnail} className={`w-full ${v.isShort ? "aspect-[9/16]" : "aspect-video"}`} />
              <span className="absolute inset-0 grid place-items-center bg-black/0 transition-colors group-hover:bg-black/25">
                <span className="grid h-11 w-11 place-items-center rounded-full bg-white/90 text-brand opacity-0 shadow-lg transition-opacity group-hover:opacity-100">▶</span>
              </span>
              {v.duration > 0 && (
                <span className="absolute bottom-2 right-2 rounded-md bg-black/75 px-1.5 py-0.5 text-[10px] font-semibold text-white">{formatDuration(v.duration)}</span>
              )}
              {v.visibility && v.visibility !== "public" && (
                <span className="absolute left-2 top-2"><StatusBadge status={v.visibility} /></span>
              )}
            </button>
            <div className="space-y-1 p-3">
              <h4 className="line-clamp-2 text-sm font-semibold leading-snug text-ink" title={v.title}>{v.title || "Untitled"}</h4>
              {showOwner && v.owner && <UserLink user={v.owner} className="text-xs" />}
              <p className="text-[11px] text-muted">
                {formatCompact(v.views)} views
                {v.likesCount !== undefined && ` · ${formatCompact(v.likesCount)} likes`}
                {v.commentsCount !== undefined && ` · ${formatCompact(v.commentsCount)} comments`}
              </p>
              <p className="text-[11px] text-muted">
                {timeAgo(v.createdAt)}
                {v.category && v.category.name && ` · ${v.category.name}`}
              </p>
            </div>
          </article>
        )
      )}
    </div>
  );
};

export const PostsList = ({ items }) => (
  <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
    {items.map((p) => (
      <article key={p._id} className="flex flex-col overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        {p.imageUrl && <Thumb src={p.imageUrl} className="aspect-video w-full" />}
        {!p.imageUrl && p.previewMedia && p.previewMedia.thumbnail && <Thumb src={p.previewMedia.thumbnail} className="aspect-video w-full" />}
        <div className="flex flex-1 flex-col gap-2 p-3.5">
          <p className="line-clamp-4 whitespace-pre-line text-sm text-ink">{p.text || <span className="text-muted">No text</span>}</p>
          <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted">
            <span>❤ {formatCompact(p.likesCount)} · 💬 {formatCompact(p.commentsCount)}</span>
            <span className="flex items-center gap-1.5">
              <StatusBadge status={p.visibility} />
              {formatDate(p.createdAt)}
            </span>
          </div>
        </div>
      </article>
    ))}
  </div>
);

export const StoriesGrid = ({ items }) => {
  const [open, setOpen] = useState(null);
  const now = Date.now();
  return (
    <>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {items.map((s) => {
          const live = new Date(s.expiresAt).getTime() > now;
          return (
            <button key={s._id} type="button" onClick={() => setOpen(s)} className="group relative overflow-hidden rounded-2xl border border-line bg-white text-left shadow-card">
              {s.mediaType === "video" ? (
                <video src={resolveMediaUrl(s.mediaUrl)} preload="metadata" muted playsInline className="aspect-[9/16] w-full bg-black object-cover" />
              ) : (
                <Thumb src={s.mediaUrl} className="aspect-[9/16] w-full" />
              )}
              <span className="absolute left-2 top-2">{live ? <Badge tone="green">Live</Badge> : <Badge>Expired</Badge>}</span>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2.5 text-[11px] text-white">
                {s.caption && <p className="line-clamp-2 font-semibold">{s.caption}</p>}
                <p className="opacity-80">👁 {formatCompact(s.viewsCount)} · {timeAgo(s.createdAt)}</p>
              </div>
            </button>
          );
        })}
      </div>
      {open && (
        <Modal title={open.caption || "Story"} maxWidth="max-w-sm" onClose={() => setOpen(null)}>
          {open.mediaType === "video" ? (
            <video src={resolveMediaUrl(open.mediaUrl)} controls autoPlay playsInline className="aspect-[9/16] w-full rounded-xl bg-black object-contain" />
          ) : (
            <img src={resolveMediaUrl(open.mediaUrl)} alt="" className="w-full rounded-xl object-contain" />
          )}
          <p className="mt-3 text-xs text-muted">
            {formatCompact(open.viewsCount)} views · posted {timeAgo(open.createdAt)} · expires {formatDate(open.expiresAt)}
          </p>
        </Modal>
      )}
    </>
  );
};
