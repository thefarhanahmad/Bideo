import Modal from "./Modal";
import UserLink from "./UserLink";
import { resolveMediaUrl } from "../lib/adminApi";
import { formatDuration, formatNumber, formatDateTime } from "../lib/format";

const VISIBILITY_BADGE = {
  public: "bg-emerald-50 text-emerald-700 border-emerald-200",
  unlisted: "bg-amber-50 text-amber-700 border-amber-200",
  private: "bg-slate-100 text-slate-700 border-slate-200",
};

const Detail = ({ label, children }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="text-muted shrink-0">{label}</span>
    <span className="font-semibold text-ink text-right min-w-0 truncate">{children}</span>
  </div>
);

/**
 * Plays a video in a modal with its key details and a link to the creator's profile.
 * `actions` renders extra buttons (e.g. delete) in the footer.
 */
const VideoPreviewModal = ({ video, onClose, actions = null }) => {
  if (!video) return null;
  const isShort = Boolean(video.isShort);
  const src = resolveMediaUrl(video.videoUrl);

  return (
    <Modal title={video.title || "Video preview"} maxWidth={isShort ? "max-w-md" : "max-w-3xl"} onClose={onClose}>
      <div className="space-y-4">
        <div className={`overflow-hidden rounded-xl bg-black flex items-center justify-center ${isShort ? "aspect-[9/16] max-h-[60vh] mx-auto" : "aspect-video"}`}>
          {src ? (
            <video
              key={src}
              src={src}
              poster={resolveMediaUrl(video.thumbnail) || undefined}
              controls
              autoPlay
              playsInline
              preload="metadata"
              className="h-full w-full object-contain"
            />
          ) : (
            <p className="p-6 text-sm text-white/70">This video file is no longer available.</p>
          )}
        </div>

        <div className="rounded-xl border border-line bg-surface p-3.5 text-xs divide-y divide-line/70">
          {video.owner && (
            <Detail label="Creator">
              <UserLink user={video.owner} withAvatar avatarSize="xs" />
            </Detail>
          )}
          <Detail label="Type">{isShort ? "Short" : "Video"}{video.duration ? ` • ${formatDuration(video.duration)}` : ""}</Detail>
          <Detail label="Views">{formatNumber(video.views)}</Detail>
          {video.visibility && (
            <Detail label="Visibility">
              <span className={`rounded-full border px-2 py-0.5 text-[11px] capitalize ${VISIBILITY_BADGE[video.visibility] || VISIBILITY_BADGE.private}`}>
                {video.visibility}
              </span>
            </Detail>
          )}
          {video.createdAt && <Detail label="Uploaded">{formatDateTime(video.createdAt)}</Detail>}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap gap-2">{actions}</div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-line bg-surface px-4 py-2 text-xs sm:text-sm font-semibold text-ink hover:bg-line"
          >
            Close
          </button>
        </div>
      </div>
    </Modal>
  );
};

export default VideoPreviewModal;
