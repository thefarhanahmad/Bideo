import { useEffect, useState, useCallback } from "react";
import DataTableToolbar from "../components/DataTableToolbar";
import Pagination from "../components/Pagination";
import ConfirmModal from "../components/ConfirmModal";
import StatCard from "../components/StatCard";
import UserLink from "../components/UserLink";
import { TableSkeleton } from "../components/LoadingSkeleton";
import { ListIcon, EyeIcon, ShieldIcon, UsersIcon } from "../components/Icons";
import PlaylistDetailModal from "../components/playlists/PlaylistDetailModal";
import { adminFetch, resolveMediaUrl, formatDate, formatCount } from "../components/playlists/playlistApi";
import { useTableParams } from "../hooks/useTableParams";

const SORT_OPTIONS = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "most_videos", label: "Most videos" },
  { value: "name", label: "Name (A–Z)" },
];

const EMPTY_STATS = { total: 0, public: 0, private: 0, empty: 0, creators: 0, savedVideos: 0 };

const Playlists = () => {
  const [playlists, setPlaylists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState(EMPTY_STATS);
  const [sort, setSort] = useState("newest");
  const [openPlaylistId, setOpenPlaylistId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const { search, setSearch, filter, setFilter, page, setPage, limit, setLimit } = useTableParams({
    defaultFilter: "all",
    defaultLimit: 15,
  });

  const fetchPlaylists = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page, limit, sort });
      if (filter && filter !== "all") params.append("filter", filter);
      if (search && search.trim()) params.append("search", search.trim());
      const data = await adminFetch(`/api/admin/playlists?${params.toString()}`);
      setPlaylists(data.data || []);
      setTotalItems(data.total || 0);
      setTotalPages(data.pages || 1);
      setStats(data.stats || EMPTY_STATS);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, sort, filter, search]);

  useEffect(() => {
    fetchPlaylists();
  }, [fetchPlaylists]);

  // Keep the table and totals in sync after edits made here or in the detail modal
  const applyUpdate = useCallback(
    (id, changes) => {
      const before = playlists.find((p) => p._id === id);
      if (before) {
        setStats((s) => {
          const next = { ...s };
          if (changes.isPrivate !== undefined && changes.isPrivate !== before.isPrivate) {
            next.public += changes.isPrivate ? -1 : 1;
            next.private += changes.isPrivate ? 1 : -1;
          }
          if (changes.videoCount !== undefined && changes.videoCount !== before.videoCount) {
            next.savedVideos = Math.max(0, next.savedVideos - (before.videoCount - changes.videoCount));
            if (before.videoCount > 0 && changes.videoCount === 0) next.empty += 1;
          }
          return next;
        });
      }
      setPlaylists((prev) => prev.map((p) => (p._id === id ? { ...p, ...changes } : p)));
    },
    [playlists]
  );

  const applyDelete = useCallback(
    (id) => {
      const removed = playlists.find((p) => p._id === id);
      if (removed) {
        setStats((s) => ({
          ...s,
          total: Math.max(0, s.total - 1),
          public: s.public - (removed.isPrivate ? 0 : 1),
          private: s.private - (removed.isPrivate ? 1 : 0),
          empty: s.empty - (removed.videoCount === 0 ? 1 : 0),
          savedVideos: Math.max(0, s.savedVideos - (removed.videoCount || 0)),
        }));
      }
      setPlaylists((prev) => prev.filter((p) => p._id !== id));
      setTotalItems((n) => Math.max(0, n - 1));
    },
    [playlists]
  );

  const toggleVisibility = async (playlist) => {
    setBusyId(playlist._id);
    try {
      const data = await adminFetch(`/api/admin/playlists/${playlist._id}`, {
        method: "PUT",
        body: JSON.stringify({ isPrivate: !playlist.isPrivate }),
      });
      applyUpdate(playlist._id, { isPrivate: data.data.isPrivate });
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusyId(deleting._id);
    try {
      await adminFetch(`/api/admin/playlists/${deleting._id}`, { method: "DELETE" });
      applyDelete(deleting._id);
      setDeleting(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setBusyId(null);
    }
  };

  const filters = [
    { value: "all", label: "All", count: stats.total },
    { value: "public", label: "Public", count: stats.public },
    { value: "private", label: "Private", count: stats.private },
    { value: "empty", label: "Empty", count: stats.empty },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Playlists</h1>
          <p className="text-sm text-muted mt-1">
            Review every user playlist, change its visibility, remove videos, or delete it.
          </p>
        </div>
        <button
          type="button"
          onClick={fetchPlaylists}
          disabled={loading}
          className="inline-flex items-center gap-2 self-start sm:self-auto rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-xs hover:bg-surface transition-all disabled:opacity-60"
        >
          <span className={loading ? "animate-spin" : ""}>🔄</span>
          <span>Refresh</span>
        </button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={ListIcon}
          label="Total Playlists"
          value={formatCount(stats.total)}
          hint={`${formatCount(stats.savedVideos)} saved videos in all playlists`}
          tone="brand"
        />
        <StatCard icon={EyeIcon} label="Public" value={formatCount(stats.public)} hint="Shown on channels and in search" tone="green" />
        <StatCard icon={ShieldIcon} label="Private" value={formatCount(stats.private)} hint="Visible only to their creator" tone="violet" />
        <StatCard
          icon={UsersIcon}
          label="Creators"
          value={formatCount(stats.creators)}
          hint={`${formatCount(stats.empty)} empty playlist${stats.empty === 1 ? "" : "s"}`}
          tone="amber"
        />
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-line bg-white shadow-card overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-line">
          <DataTableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search by playlist name, creator name, channel, or email..."
            filter={filter}
            onFilterChange={setFilter}
            filters={filters}
            totalCount={totalItems}
            filteredCount={totalItems}
            className="mb-0"
            actions={
              <div className="flex items-center gap-2">
                <label htmlFor="playlist-sort" className="text-xs font-bold text-muted shrink-0">
                  Sort By:
                </label>
                <select
                  id="playlist-sort"
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setPage(1);
                  }}
                  className="rounded-xl border border-line bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-ink shadow-xs focus:border-brand focus:outline-hidden"
                >
                  {SORT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            }
          />
        </div>

        {error && <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={6} />
          </div>
        ) : playlists.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand mb-4">
              <ListIcon className="h-8 w-8" />
            </div>
            <h3 className="font-display text-lg font-bold text-ink">No playlists found</h3>
            <p className="mt-1 text-sm text-muted max-w-sm mx-auto">
              {search || filter !== "all" ? "No playlists match your search or filter." : "Users have not created any playlists yet."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-sm text-ink">
              <thead className="bg-surface/60 text-xs font-bold uppercase tracking-wider text-muted border-b border-line">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Playlist</th>
                  <th className="py-3.5 px-4">Creator</th>
                  <th className="py-3.5 px-4 text-center">Videos</th>
                  <th className="py-3.5 px-4 text-center">Visibility</th>
                  <th className="py-3.5 px-4">Created</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {playlists.map((p) => {
                  const owner = p.owner;
                  const busy = busyId === p._id;
                  return (
                    <tr key={p._id} className="hover:bg-surface/50 transition-colors">
                      <td className="py-4 px-4 sm:px-6">
                        <button
                          type="button"
                          onClick={() => setOpenPlaylistId(p._id)}
                          className="flex items-center gap-3 min-w-[220px] text-left group"
                          title="Open playlist"
                        >
                          <div className="relative h-12 w-20 shrink-0 overflow-hidden rounded-lg border border-line bg-surface">
                            {p.thumbnail ? (
                              <img src={resolveMediaUrl(p.thumbnail)} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-muted">
                                <ListIcon className="h-5 w-5" />
                              </div>
                            )}
                          </div>
                          <span className="font-bold text-ink truncate max-w-[220px] group-hover:text-brand group-hover:underline underline-offset-2">
                            {p.name}
                          </span>
                        </button>
                      </td>
                      <td className="py-4 px-4">
                        {owner ? (
                          <UserLink user={owner} className="flex items-center gap-2.5 min-w-0 group" title="Open creator profile & stats">
                            <img
                              src={resolveMediaUrl(owner.avatar, "https://via.placeholder.com/80x80.png?text=User")}
                              alt={owner.name}
                              className="h-8 w-8 shrink-0 rounded-full object-cover border border-line"
                            />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1 text-sm font-semibold text-ink truncate group-hover:text-brand">
                                {owner.channelName || owner.name}
                                {owner.isVerified && <span className="text-blue-500 text-xs">✓</span>}
                                {owner.isBlocked && (
                                  <span className="rounded-full bg-red-50 border border-red-200 px-1.5 text-[10px] font-bold text-red-700">Blocked</span>
                                )}
                              </div>
                              <div className="text-xs text-muted truncate">@{owner.name}</div>
                            </div>
                          </UserLink>
                        ) : (
                          <span className="text-xs text-muted">Deleted user</span>
                        )}
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${
                            p.videoCount > 0 ? "bg-violet-50 border-violet-200 text-violet-700" : "bg-surface border-line text-muted"
                          }`}
                        >
                          {formatCount(p.videoCount)}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <span
                          className={`inline-flex whitespace-nowrap rounded-full border px-3 py-1 text-xs font-bold ${
                            p.isPrivate ? "bg-slate-100 border-slate-200 text-slate-700" : "bg-emerald-50 border-emerald-200 text-emerald-700"
                          }`}
                        >
                          {p.isPrivate ? "🔒 Private" : "🌐 Public"}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-xs font-medium text-ink/80 whitespace-nowrap">{formatDate(p.createdAt)}</td>
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setOpenPlaylistId(p._id)}
                            className="rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-brand hover:bg-brand-dark transition-all"
                          >
                            Manage
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleVisibility(p)}
                            disabled={busy}
                            className="rounded-xl border border-line bg-white px-3 py-2 text-xs font-semibold text-ink hover:bg-surface transition-colors disabled:opacity-50"
                            title={p.isPrivate ? "Make public" : "Make private"}
                          >
                            {p.isPrivate ? "Make Public" : "Make Private"}
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(p)}
                            disabled={busy}
                            className="rounded-xl border border-line bg-surface/50 p-2 text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors disabled:opacity-50"
                            title="Delete playlist"
                            aria-label={`Delete playlist ${p.name}`}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={limit}
          onPageChange={setPage}
          onPageSizeChange={setLimit}
          pageSizeOptions={[10, 15, 30, 50]}
        />
      </div>

      {openPlaylistId && (
        <PlaylistDetailModal
          playlistId={openPlaylistId}
          onClose={() => setOpenPlaylistId(null)}
          onUpdated={applyUpdate}
          onDeleted={applyDelete}
        />
      )}

      {deleting && (
        <ConfirmModal
          title="Delete this playlist?"
          message={`"${deleting.name}" by ${deleting.owner?.channelName || deleting.owner?.name || "this user"} will be permanently deleted. The ${deleting.videoCount} video(s) in it stay on the platform.`}
          confirmText={busyId === deleting._id ? "Deleting…" : "Delete"}
          confirmClass="bg-red-600 hover:bg-red-700 text-white"
          onConfirm={confirmDelete}
          onCancel={() => busyId !== deleting._id && setDeleting(null)}
        />
      )}
    </div>
  );
};

export default Playlists;
