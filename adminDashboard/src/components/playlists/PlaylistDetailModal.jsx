import { useEffect, useState } from "react";
import Modal from "../Modal";
import ConfirmModal from "../ConfirmModal";
import UserLink from "../UserLink";
import {
  adminFetch,
  resolveMediaUrl,
  formatDate,
  formatDuration,
  formatCount,
  PLAYLIST_NAME_MAX,
} from "./playlistApi";

/**
 * Review and manage one playlist: rename, Public/Private, remove videos, delete.
 * Parent callbacks keep the list in sync without a full reload.
 */
const PlaylistDetailModal = ({ playlistId, onClose, onUpdated, onDeleted }) => {
  const [playlist, setPlaylist] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [name, setName] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removingVideo, setRemovingVideo] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await adminFetch(`/api/admin/playlists/${playlistId}`);
        if (cancelled) return;
        setPlaylist(data.data);
        setName(data.data.name || "");
        setIsPrivate(Boolean(data.data.isPrivate));
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [playlistId]);

  const trimmedName = name.trim();
  const hasChanges =
    playlist && (trimmedName !== playlist.name || isPrivate !== Boolean(playlist.isPrivate));
  const canSave = hasChanges && trimmedName.length > 0 && !saving;

  const handleSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const data = await adminFetch(`/api/admin/playlists/${playlistId}`, {
        method: "PUT",
        body: JSON.stringify({ name: trimmedName, isPrivate }),
      });
      setPlaylist((prev) => ({ ...prev, name: data.data.name, isPrivate: data.data.isPrivate }));
      setName(data.data.name);
      onUpdated?.(playlistId, { name: data.data.name, isPrivate: data.data.isPrivate });
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveVideo = async () => {
    if (!removingVideo) return;
    setBusy(true);
    try {
      const data = await adminFetch(`/api/admin/playlists/${playlistId}/videos/${removingVideo._id}`, {
        method: "DELETE",
      });
      setPlaylist((prev) => ({
        ...prev,
        videos: prev.videos.filter((v) => v._id !== removingVideo._id),
        videoCount: data.data.videoCount,
      }));
      onUpdated?.(playlistId, { videoCount: data.data.videoCount });
      setRemovingVideo(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    setBusy(true);
    try {
      await adminFetch(`/api/admin/playlists/${playlistId}`, { method: "DELETE" });
      setConfirmDelete(false);
      onDeleted?.(playlistId);
      onClose();
    } catch (err) {
      alert(err.message);
    } finally {
      setBusy(false);
    }
  };

  const owner = playlist?.owner;
  const videos = playlist?.videos || [];

  return (
    <>
      <Modal title={playlist ? `Playlist: ${playlist.name}` : "Playlist"} onClose={onClose} maxWidth="max-w-3xl">
        {loading ? (
          <div className="py-12 text-center text-sm text-muted">Loading playlist…</div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">{error}</div>
        ) : (
          <div className="space-y-5">
            {/* Owner summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-line bg-surface/70 p-3.5 sm:p-4">
              {owner ? (
                <UserLink user={owner} className="flex items-center gap-3 min-w-0 group" title="Open creator profile & stats">
                  <img
                    src={resolveMediaUrl(owner.avatar, "https://via.placeholder.com/80x80.png?text=User")}
                    alt={owner.name}
                    className="h-11 w-11 shrink-0 rounded-full object-cover border border-line"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-bold text-ink truncate group-hover:text-brand group-hover:underline underline-offset-2">
                        {owner.channelName || owner.name}
                      </span>
                      {owner.isVerified && <span className="text-blue-500 text-xs" title="Verified">✓</span>}
                      {owner.isBlocked && (
                        <span className="rounded-full bg-red-50 border border-red-200 px-2 py-0.5 text-[10px] font-bold text-red-700">
                          Blocked
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-muted truncate">
                      @{owner.name}
                      {owner.email && <span className="ml-1 text-muted/70">• {owner.email}</span>}
                    </div>
                  </div>
                </UserLink>
              ) : (
                <span className="text-sm text-muted">Owner account no longer exists</span>
              )}
              <div className="flex flex-wrap gap-2 text-xs font-semibold">
                <span className="rounded-full bg-violet-50 border border-violet-200 px-3 py-1 text-violet-700">
                  {formatCount(videos.length)} {videos.length === 1 ? "video" : "videos"}
                </span>
                <span className="rounded-full bg-surface border border-line px-3 py-1 text-ink/70">
                  Created {formatDate(playlist.createdAt)}
                </span>
              </div>
            </div>

            {/* Edit name & visibility */}
            <div className="rounded-2xl border border-line p-4 space-y-3">
              <h4 className="text-sm font-bold text-ink">Playlist settings</h4>
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  value={name}
                  maxLength={PLAYLIST_NAME_MAX}
                  onChange={(e) => setName(e.target.value)}
                  aria-label="Playlist name"
                  className="flex-1 rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink shadow-xs focus:border-brand focus:outline-hidden"
                />
                <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="radiogroup" aria-label="Visibility">
                  {[
                    { value: false, label: "🌐 Public" },
                    { value: true, label: "🔒 Private" },
                  ].map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      role="radio"
                      aria-checked={isPrivate === opt.value}
                      onClick={() => setIsPrivate(opt.value)}
                      className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                        isPrivate === opt.value ? "bg-white text-ink shadow-sm" : "text-muted hover:text-ink"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={!canSave}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-brand-dark transition-all disabled:opacity-50"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
              </div>
              <p className="text-xs text-muted">
                Public playlists show on the creator&apos;s channel and in search. Private ones are visible only to the creator.
              </p>
            </div>

            {/* Videos */}
            <div className="rounded-2xl border border-line overflow-hidden">
              <div className="flex items-center justify-between border-b border-line bg-surface/60 px-4 py-2.5">
                <h4 className="text-sm font-bold text-ink">Videos in this playlist</h4>
                <span className="text-xs text-muted">Newest saved last</span>
              </div>
              {videos.length === 0 ? (
                <div className="py-10 text-center text-sm text-muted">This playlist is empty.</div>
              ) : (
                <ul className="divide-y divide-line max-h-[42vh] overflow-y-auto">
                  {videos.map((v) => (
                    <li key={v._id} className="flex items-center gap-3 px-4 py-3 hover:bg-surface/50">
                      <div className="relative shrink-0">
                        <img
                          src={resolveMediaUrl(v.thumbnail)}
                          alt={v.title}
                          className={`rounded-lg object-cover border border-line ${v.isShort ? "h-16 w-9" : "h-12 w-20"}`}
                        />
                        <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 text-[9px] font-bold text-white">
                          {formatDuration(v.duration)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-ink truncate">{v.title || "Untitled"}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          <span>{v.owner?.channelName || v.owner?.name || "Unknown"}</span>
                          <span>•</span>
                          <span>{formatCount(v.views)} views</span>
                          {v.isShort && (
                            <span className="rounded-full bg-sky-50 border border-sky-200 px-1.5 text-[10px] font-bold text-sky-700">Short</span>
                          )}
                          {v.visibility !== "public" && (
                            <span className="rounded-full bg-amber-50 border border-amber-200 px-1.5 text-[10px] font-bold text-amber-700">
                              Private video
                            </span>
                          )}
                          {v.owner?.isBlocked && (
                            <span className="rounded-full bg-red-50 border border-red-200 px-1.5 text-[10px] font-bold text-red-700">
                              Blocked channel
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setRemovingVideo(v)}
                        className="shrink-0 rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Danger zone */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-red-200 bg-red-50/50 p-4">
              <div>
                <h4 className="text-sm font-bold text-red-700">Delete playlist</h4>
                <p className="text-xs text-red-700/80">Removes the playlist only. The videos stay on the platform.</p>
              </div>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 transition-colors"
              >
                Delete playlist
              </button>
            </div>
          </div>
        )}
      </Modal>

      {removingVideo && (
        <ConfirmModal
          title="Remove video from playlist?"
          message={`"${removingVideo.title || "This video"}" will be removed from this playlist. The video itself is not deleted.`}
          confirmText={busy ? "Removing…" : "Remove"}
          confirmClass="bg-red-600 hover:bg-red-700 text-white"
          onConfirm={handleRemoveVideo}
          onCancel={() => !busy && setRemovingVideo(null)}
        />
      )}

      {confirmDelete && (
        <ConfirmModal
          title="Delete this playlist?"
          message={`"${playlist?.name}" will be permanently deleted. The ${videos.length} video(s) in it stay on the platform.`}
          confirmText={busy ? "Deleting…" : "Delete"}
          confirmClass="bg-red-600 hover:bg-red-700 text-white"
          onConfirm={handleDelete}
          onCancel={() => !busy && setConfirmDelete(false)}
        />
      )}
    </>
  );
};

export default PlaylistDetailModal;
