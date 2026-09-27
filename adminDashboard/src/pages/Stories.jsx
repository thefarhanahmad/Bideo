import { useEffect, useState, useCallback } from "react";
import DataTableToolbar from "../components/DataTableToolbar";
import Pagination from "../components/Pagination";
import ConfirmModal from "../components/ConfirmModal";
import Modal from "../components/Modal";
import StatCard from "../components/StatCard";
import { TableSkeleton } from "../components/LoadingSkeleton";
import {
  StoryIcon,
  CameraIcon,
  EyeIcon,
  UsersIcon,
  PlayIcon,
} from "../components/Icons";
import { useTableParams } from "../hooks/useTableParams";
import { API_URL } from "../config";

const resolveMediaUrl = (url) => {
  if (!url) return "https://via.placeholder.com/300x400.png?text=Story";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const resolveAvatarUrl = (url) => {
  if (!url) return "https://via.placeholder.com/100x100.png?text=User";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
};

const formatTimeRemaining = (expiresAt) => {
  if (!expiresAt) return "";
  const diff = new Date(expiresAt).getTime() - Date.now();
  if (diff <= 0) return "Expiring soon";
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
};

const Stories = () => {
  const [creatorGroups, setCreatorGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [stats, setStats] = useState({
    activeStories: 0,
    activeCreators: 0,
    totalViews: 0,
    avgViewsPerStory: "0",
  });

  // User Stories Studio Modal State
  const [selectedUserGroup, setSelectedUserGroup] = useState(null);
  const [activeStoryIndex, setActiveStoryIndex] = useState(0);

  // Viewers Modal State (Rendered with higher zIndex on top of Studio)
  const [viewersStory, setViewersStory] = useState(null);
  const [viewersList, setViewersList] = useState([]);
  const [loadingViewers, setLoadingViewers] = useState(false);

  // Deletion States
  const [deletingSingleStory, setDeletingSingleStory] = useState(null);
  const [deletingAllUserStories, setDeletingAllUserStories] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // URL-synced search and pagination
  const { search, setSearch, page, setPage, limit, setLimit } = useTableParams({
    defaultLimit: 15,
  });

  // Fetch stories - ONLY depends on page, limit, and search (NEVER on modal states!)
  const fetchStories = useCallback(
    async (currentPage = page, currentLimit = limit, currentSearch = search) => {
      setLoading(true);
      try {
        const token = localStorage.getItem("admin_token");
        const params = new URLSearchParams({
          page: currentPage,
          limit: currentLimit,
        });
        if (currentSearch && currentSearch.trim()) {
          params.append("search", currentSearch.trim());
        }

        const res = await fetch(`${API_URL}/api/admin/stories?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load stories");

        setCreatorGroups(data.data || []);
        setTotalItems(data.total || 0);
        setTotalPages(data.pages || 1);
        if (data.stats) setStats(data.stats);
      } catch (err) {
        console.error("fetchStories error:", err);
      } finally {
        setLoading(false);
      }
    },
    [page, limit, search]
  );

  useEffect(() => {
    fetchStories();
  }, [fetchStories]);

  // Open User Stories Studio Modal
  const handleOpenUserStories = (group) => {
    setSelectedUserGroup(group);
    setActiveStoryIndex(0);
  };

  // Close User Stories Studio Modal
  const handleCloseUserStories = () => {
    setSelectedUserGroup(null);
    setActiveStoryIndex(0);
  };

  // Currently displayed story in the Studio Modal
  const currentStoriesList = selectedUserGroup?.stories || [];
  const safeActiveIndex = Math.min(
    Math.max(0, activeStoryIndex),
    Math.max(0, currentStoriesList.length - 1)
  );
  const activeStory = currentStoriesList[safeActiveIndex] || null;

  // Open viewers list modal for a specific story
  const handleOpenViewers = async (story) => {
    if (!story?._id) return;
    setViewersStory(story);
    setLoadingViewers(true);
    setViewersList([]);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/admin/stories/${story._id}/viewers`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch viewers");
      setViewersList(data.data || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingViewers(false);
    }
  };

  // Delete a single story cleanly without re-fetching storm
  const handleConfirmDeleteSingleStory = async () => {
    if (!deletingSingleStory) return;
    setIsDeleting(true);
    const storyId = deletingSingleStory._id;
    const viewsCount = deletingSingleStory.viewsCount || 0;

    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/admin/stories/${storyId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete story");

      // 1. Update creator groups list in state
      setCreatorGroups((prev) =>
        prev
          .map((g) => {
            const remaining = (g.stories || []).filter((s) => s._id !== storyId);
            if (remaining.length === 0) return null;
            return {
              ...g,
              stories: remaining,
              storiesCount: remaining.length,
              totalViews: remaining.reduce((sum, s) => sum + (s.viewsCount || 0), 0),
            };
          })
          .filter(Boolean)
      );

      // 2. Update selected user group if open
      if (selectedUserGroup) {
        const remainingStories = (selectedUserGroup.stories || []).filter(
          (s) => s._id !== storyId
        );
        if (remainingStories.length === 0) {
          setSelectedUserGroup(null);
        } else {
          setSelectedUserGroup((prev) => ({
            ...prev,
            stories: remainingStories,
            storiesCount: remainingStories.length,
            totalViews: remainingStories.reduce((sum, s) => sum + (s.viewsCount || 0), 0),
          }));
          setActiveStoryIndex((prev) => Math.max(0, Math.min(prev, remainingStories.length - 1)));
        }
      }

      // 3. Update stats
      setStats((prev) => ({
        ...prev,
        activeStories: Math.max(0, prev.activeStories - 1),
        totalViews: Math.max(0, prev.totalViews - viewsCount),
      }));

      if (viewersStory?._id === storyId) setViewersStory(null);
      setDeletingSingleStory(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  // Delete all active stories for a user cleanly
  const handleConfirmDeleteAllUserStories = async () => {
    if (!deletingAllUserStories) return;
    setIsDeleting(true);
    const userId = deletingAllUserStories.user?._id;
    const storiesCount = deletingAllUserStories.storiesCount || 0;
    const totalViews = deletingAllUserStories.totalViews || 0;

    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/admin/stories/user/${userId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete user stories");

      setCreatorGroups((prev) => prev.filter((g) => g.user?._id !== userId));
      setTotalItems((prev) => Math.max(0, prev - 1));
      setStats((prev) => ({
        ...prev,
        activeStories: Math.max(0, prev.activeStories - storiesCount),
        activeCreators: Math.max(0, prev.activeCreators - 1),
        totalViews: Math.max(0, prev.totalViews - totalViews),
      }));

      if (selectedUserGroup?.user?._id === userId) setSelectedUserGroup(null);
      setDeletingAllUserStories(null);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-ink">Active User Stories</h1>
          <p className="text-sm text-muted mt-1">
            Browse all users with currently active (live) stories, view counts, and moderate content.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchStories()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3.5 py-2 text-sm font-semibold text-ink shadow-xs hover:bg-surface transition-all disabled:opacity-60"
          >
            <span className={loading ? "animate-spin" : ""}>🔄</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Top Stats Bar - Strictly Live Active Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={StoryIcon}
          label="Live Stories"
          value={stats.activeStories}
          hint="Within 24-hour expiration window"
          tone="green"
          badge={
            <span className="rounded-full bg-emerald-100 text-emerald-800 px-2 py-0.5 text-xs font-semibold">
              Live Now
            </span>
          }
        />
        <StatCard
          icon={UsersIcon}
          label="Active Creators"
          value={stats.activeCreators}
          hint="Users currently sharing active stories"
          tone="brand"
        />
        <StatCard
          icon={EyeIcon}
          label="Total Live Views"
          value={stats.totalViews}
          hint="Combined views across live stories"
          tone="violet"
        />
        <StatCard
          icon={CameraIcon}
          label="Avg Views / Story"
          value={stats.avgViewsPerStory}
          hint="Average audience engagement per photo"
          tone="amber"
        />
      </div>

      {/* Main Table: List of Users with Stories */}
      <div className="rounded-2xl border border-line bg-white shadow-card overflow-hidden">
        {/* Search Toolbar */}
        <div className="p-4 sm:p-5 border-b border-line">
          <DataTableToolbar
            search={search}
            onSearchChange={setSearch}
            searchPlaceholder="Search creators by name, channel name, or email..."
            totalCount={totalItems}
            className="mb-0"
          />
        </div>

        {/* Users Table */}
        {loading ? (
          <div className="p-4">
            <TableSkeleton rows={6} cols={6} />
          </div>
        ) : creatorGroups.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-brand-50 text-brand mb-4">
              <CameraIcon className="h-8 w-8" />
            </div>
            <h3 className="font-display text-lg font-bold text-ink">No active stories right now</h3>
            <p className="mt-1 text-sm text-muted max-w-sm mx-auto">
              {search
                ? "No creators match your search query."
                : "No users have posted stories in the last 24 hours."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto min-w-0">
            <table className="w-full text-left text-sm text-ink">
              <thead className="bg-surface/60 text-xs font-bold uppercase tracking-wider text-muted border-b border-line">
                <tr>
                  <th className="py-3.5 px-4 sm:px-6">Creator / User</th>
                  <th className="py-3.5 px-4 text-center">Active Stories</th>
                  <th className="py-3.5 px-4 text-center">Total Views</th>
                  <th className="py-3.5 px-4">Latest Story</th>
                  <th className="py-3.5 px-4">Time Left</th>
                  <th className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {creatorGroups.map((group) => {
                  const creator = group.user || {};
                  const avatarUrl = resolveAvatarUrl(creator.avatar);
                  const storiesCount = group.storiesCount || (group.stories || []).length;
                  const totalViews = group.totalViews || 0;
                  const latestStoryTime = formatTimeAgo(group.latestStoryAt);
                  const timeLeft = formatTimeRemaining(group.earliestExpiresAt);

                  return (
                    <tr
                      key={creator._id || Math.random()}
                      className="hover:bg-surface/50 transition-colors"
                    >
                      {/* Creator Profile */}
                      <td className="py-4 px-4 sm:px-6">
                        <div className="flex items-center gap-3 min-w-0">
                          {/* Story Avatar Ring (Instagram style) */}
                          <div className="relative shrink-0">
                            <div className="h-11 w-11 rounded-full p-[2px] bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]">
                              <img
                                src={avatarUrl}
                                alt={creator.name || "User"}
                                className="h-full w-full rounded-full object-cover bg-white"
                              />
                            </div>
                            <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[10px] text-white border-2 border-white">
                              ✓
                            </span>
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-ink text-sm truncate">
                                {creator.channelName || creator.name || "Creator"}
                              </span>
                              {creator.isVerified && (
                                <span className="text-blue-500 text-xs" title="Verified Creator">
                                  ✓
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted truncate">
                              @{creator.name || "user"}
                              {creator.email && (
                                <span className="ml-1 text-muted/70 hidden md:inline">
                                  • {creator.email}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Active Stories Count */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 border border-sky-200 px-3 py-1 text-xs font-bold text-sky-700 shadow-2xs">
                          <CameraIcon className="h-3.5 w-3.5 text-sky-500" />
                          <span>
                            {storiesCount} {storiesCount === 1 ? "story" : "stories"}
                          </span>
                        </span>
                      </td>

                      {/* Total Views Count */}
                      <td className="py-4 px-4 text-center">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 border border-violet-200 px-3 py-1 text-xs font-bold text-violet-700 shadow-2xs">
                          <EyeIcon className="h-3.5 w-3.5 text-violet-500" />
                          <span>{totalViews} views</span>
                        </span>
                      </td>

                      {/* Latest Story Posted */}
                      <td className="py-4 px-4 text-xs font-medium text-ink/80 whitespace-nowrap">
                        {latestStoryTime}
                      </td>

                      {/* Time Remaining */}
                      <td className="py-4 px-4 text-xs font-semibold whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                          {timeLeft}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenUserStories(group)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-3.5 py-2 text-xs font-semibold text-white shadow-brand hover:bg-brand-dark transition-all"
                          >
                            <PlayIcon className="h-3.5 w-3.5" />
                            <span>View Stories ({storiesCount})</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingAllUserStories(group)}
                            className="rounded-xl border border-line bg-surface/50 p-2 text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors"
                            title="Delete all stories of this user"
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

        {/* Pagination */}
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

      {/* ========================================================
          USER STORIES STUDIO MODAL (Modern, Fast, Lag-free)
      ======================================================== */}
      {selectedUserGroup && (
        <Modal
          title={`Stories by ${
            selectedUserGroup.user?.channelName || selectedUserGroup.user?.name || "Creator"
          }`}
          onClose={handleCloseUserStories}
          maxWidth="max-w-4xl"
          zIndex="z-50"
        >
          <div className="space-y-5">
            {/* Creator Header Summary */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-surface/70 border border-line">
              <div className="flex items-center gap-3 min-w-0">
                <div className="h-12 w-12 rounded-full p-[2px] bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF] shrink-0">
                  <img
                    src={resolveAvatarUrl(selectedUserGroup.user?.avatar)}
                    alt="Creator"
                    className="h-full w-full rounded-full object-cover bg-white"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h3 className="font-bold text-base text-ink truncate">
                      {selectedUserGroup.user?.channelName ||
                        selectedUserGroup.user?.name ||
                        "Creator"}
                    </h3>
                    {selectedUserGroup.user?.isVerified && (
                      <span className="text-blue-500 text-xs font-bold">✓ Verified</span>
                    )}
                  </div>
                  <p className="text-xs text-muted truncate">
                    @{selectedUserGroup.user?.name || "user"}{" "}
                    {selectedUserGroup.user?.email && `• ${selectedUserGroup.user.email}`}
                  </p>
                </div>
              </div>

              {/* Badges Overview & Delete All */}
              <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
                <span className="rounded-full bg-sky-50 text-sky-700 border border-sky-200 px-3 py-1 text-xs font-bold">
                  {currentStoriesList.length} Active {currentStoriesList.length === 1 ? "Photo" : "Photos"}
                </span>
                <span className="rounded-full bg-violet-50 text-violet-700 border border-violet-200 px-3 py-1 text-xs font-bold">
                  {selectedUserGroup.totalViews || 0} Total Views
                </span>
                <button
                  type="button"
                  onClick={() => setDeletingAllUserStories(selectedUserGroup)}
                  className="rounded-full bg-red-50 text-red-600 border border-red-200 px-3 py-1 text-xs font-semibold hover:bg-red-100 transition-colors"
                >
                  Delete All
                </button>
              </div>
            </div>

            {/* Segmented Top Indicator Pills for Stories */}
            {currentStoriesList.length > 1 && (
              <div className="flex items-center gap-1.5 px-1">
                {currentStoriesList.map((s, idx) => (
                  <button
                    key={s._id || idx}
                    type="button"
                    onClick={() => setActiveStoryIndex(idx)}
                    className={`flex-1 h-1.5 rounded-full transition-all ${
                      idx === safeActiveIndex
                        ? "bg-brand ring-2 ring-brand/30"
                        : "bg-line hover:bg-muted"
                    }`}
                    title={`Jump to story ${idx + 1}`}
                  />
                ))}
              </div>
            )}

            {/* Main Story Showcase (Viewer Stage + Detail Panel) */}
            {activeStory && (
              <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
                {/* Visual Stage (Aspect 9:16) */}
                <div className="md:col-span-6 lg:col-span-7 flex flex-col items-center">
                  <div className="relative aspect-[9/16] w-full max-w-[320px] max-h-[480px] bg-black rounded-2xl overflow-hidden shadow-lg border border-line flex items-center justify-center">
                    <img
                      src={resolveMediaUrl(activeStory.mediaUrl)}
                      alt={activeStory.caption || "Story"}
                      className="max-h-full max-w-full object-contain"
                    />

                    {/* Gradient scrim for overlays */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/50 pointer-events-none" />

                    {/* Top Badges */}
                    <div className="absolute top-3 inset-x-3 flex items-center justify-between pointer-events-none">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/90 text-white px-2.5 py-1 text-[11px] font-bold shadow-xs backdrop-blur-md">
                        <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                        {formatTimeRemaining(activeStory.expiresAt)}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full bg-black/65 text-white px-2.5 py-1 text-[11px] font-bold backdrop-blur-md border border-white/15">
                        <EyeIcon className="h-3 w-3 text-sky-400" />
                        <span>{activeStory.viewsCount || 0} views</span>
                      </span>
                    </div>

                    {/* Prev & Next Floating Buttons */}
                    {currentStoriesList.length > 1 && (
                      <>
                        {safeActiveIndex > 0 && (
                          <button
                            type="button"
                            onClick={() => setActiveStoryIndex(safeActiveIndex - 1)}
                            className="absolute left-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black/85 backdrop-blur-md shadow-md text-base"
                            title="Previous story"
                          >
                            ‹
                          </button>
                        )}
                        {safeActiveIndex < currentStoriesList.length - 1 && (
                          <button
                            type="button"
                            onClick={() => setActiveStoryIndex(safeActiveIndex + 1)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white hover:bg-black/85 backdrop-blur-md shadow-md text-base"
                            title="Next story"
                          >
                            ›
                          </button>
                        )}
                      </>
                    )}

                    {/* Caption Overlay */}
                    {activeStory.caption && (
                      <div className="absolute bottom-3 inset-x-3 pointer-events-none">
                        <div className="rounded-xl bg-black/75 backdrop-blur-md border border-white/15 p-2.5 text-center text-xs text-white leading-relaxed">
                          "{activeStory.caption}"
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detail & Moderation Panel */}
                <div className="md:col-span-6 lg:col-span-5 space-y-4">
                  <div className="p-4 rounded-2xl bg-surface/60 border border-line space-y-3">
                    <div className="flex items-center justify-between border-b border-line pb-2.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-muted">
                        Story {safeActiveIndex + 1} of {currentStoriesList.length}
                      </span>
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2.5 py-0.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        {formatTimeRemaining(activeStory.expiresAt)}
                      </span>
                    </div>

                    <div className="space-y-2 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Views recorded:</span>
                        <span className="font-bold text-ink text-sm">
                          {activeStory.viewsCount || 0} unique views
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Uploaded:</span>
                        <span className="font-medium text-ink">
                          {formatTimeAgo(activeStory.createdAt)} (
                          {new Date(activeStory.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                          )
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted">Auto-expires at:</span>
                        <span className="font-medium text-ink">
                          {new Date(activeStory.expiresAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    </div>

                    {activeStory.caption && (
                      <div className="pt-2 border-t border-line">
                        <span className="text-xs font-semibold text-muted block mb-1">
                          Caption:
                        </span>
                        <p className="text-xs text-ink bg-white p-2.5 rounded-xl border border-line italic leading-relaxed">
                          "{activeStory.caption}"
                        </p>
                      </div>
                    )}

                    {/* Action Buttons for this story */}
                    <div className="pt-3 border-t border-line flex flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenViewers(activeStory)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-violet-700 transition-colors"
                      >
                        <EyeIcon className="h-4 w-4" />
                        <span>Inspect Viewers ({activeStory.viewsCount || 0})</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDeletingSingleStory(activeStory)}
                        className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-2.5 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors"
                      >
                        <span>Delete This Photo</span>
                      </button>
                    </div>
                  </div>

                  {/* Thumbnail Filmstrip */}
                  {currentStoriesList.length > 1 && (
                    <div>
                      <span className="text-xs font-bold text-muted uppercase tracking-wider block mb-2">
                        All Photos in this Story ({currentStoriesList.length}):
                      </span>
                      <div className="flex items-center gap-2.5 overflow-x-auto pb-1">
                        {currentStoriesList.map((s, idx) => (
                          <div
                            key={s._id || idx}
                            onClick={() => setActiveStoryIndex(idx)}
                            className={`relative h-20 w-14 shrink-0 rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                              idx === safeActiveIndex
                                ? "border-brand ring-2 ring-brand/30 scale-105"
                                : "border-line opacity-75 hover:opacity-100"
                            }`}
                          >
                            <img
                              src={resolveMediaUrl(s.mediaUrl)}
                              alt="Thumbnail"
                              className="h-full w-full object-cover"
                            />
                            <span className="absolute bottom-1 right-1 rounded bg-black/75 px-1 text-[9px] font-bold text-white">
                              {s.viewsCount || 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ========================================================
          VIEWERS SHEET MODAL (Layered smoothly on top)
      ======================================================== */}
      {viewersStory && (
        <Modal
          title={`Story Viewers (${viewersList.length})`}
          onClose={() => setViewersStory(null)}
          maxWidth="max-w-md"
          zIndex="z-60"
        >
          <div className="space-y-4">
            {/* Story Thumbnail Snippet */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface/80 border border-line">
              <img
                src={resolveMediaUrl(viewersStory.mediaUrl)}
                alt="Story thumbnail"
                className="h-14 w-12 rounded-lg object-cover bg-slate-900 border border-line shrink-0"
              />
              <div className="min-w-0 flex-1">
                <span className="text-xs font-bold text-ink block truncate">
                  Story by {selectedUserGroup?.user?.channelName || "Creator"}
                </span>
                {viewersStory.caption && (
                  <p className="text-xs text-muted truncate mt-0.5">
                    "{viewersStory.caption}"
                  </p>
                )}
                <span className="text-[11px] text-emerald-700 font-medium block mt-0.5">
                  ⏱ {formatTimeRemaining(viewersStory.expiresAt)}
                </span>
              </div>
            </div>

            {/* Viewers List */}
            {loadingViewers ? (
              <div className="py-12 text-center text-sm text-muted">
                <span className="animate-spin inline-block mr-2">🔄</span>
                Loading viewers...
              </div>
            ) : viewersList.length === 0 ? (
              <div className="py-12 text-center">
                <EyeIcon className="h-10 w-10 text-muted mx-auto mb-2 opacity-50" />
                <h4 className="font-semibold text-ink text-sm">No viewers yet</h4>
                <p className="text-xs text-muted mt-1">
                  This photo has not been viewed by any followers yet.
                </p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-line pr-1 space-y-0.5">
                {viewersList.map((viewer) => (
                  <div
                    key={viewer._id}
                    className="flex items-center justify-between py-2.5 px-2 hover:bg-surface/50 rounded-xl transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <img
                        src={resolveAvatarUrl(viewer.avatar)}
                        alt={viewer.name || "Viewer"}
                        className="h-10 w-10 rounded-full object-cover border border-line bg-surface shrink-0"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-ink truncate">
                            {viewer.channelName || viewer.name || "User"}
                          </span>
                          {viewer.isVerified && (
                            <span className="text-blue-500 text-xs">✓</span>
                          )}
                        </div>
                        <span className="text-xs text-muted truncate block">
                          @{viewer.name || "user"}
                        </span>
                      </div>
                    </div>
                    {viewer.email && (
                      <span className="text-xs text-muted/80 truncate ml-2 hidden sm:inline">
                        {viewer.email}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ========================================================
          CONFIRM DELETE SINGLE STORY
      ======================================================== */}
      {deletingSingleStory && (
        <ConfirmModal
          title="Delete Story Photo"
          message="Are you sure you want to permanently delete this story photo? The photo will be permanently unlinked from storage and removed from the user's feed."
          confirmText={isDeleting ? "Deleting..." : "Delete Photo"}
          confirmClass="bg-red-600 hover:bg-red-700 text-white"
          onConfirm={handleConfirmDeleteSingleStory}
          onCancel={() => setDeletingSingleStory(null)}
        />
      )}

      {/* ========================================================
          CONFIRM DELETE ALL USER STORIES
      ======================================================== */}
      {deletingAllUserStories && (
        <ConfirmModal
          title="Delete All Stories For Creator"
          message={`Are you sure you want to delete all ${
            deletingAllUserStories.storiesCount || ""
          } active stories for "${
            deletingAllUserStories.user?.channelName ||
            deletingAllUserStories.user?.name ||
            "this user"
          }"? All their current media will be permanently deleted.`}
          confirmText={isDeleting ? "Deleting All..." : "Delete All Stories"}
          confirmClass="bg-red-600 hover:bg-red-700 text-white"
          onConfirm={handleConfirmDeleteAllUserStories}
          onCancel={() => setDeletingAllUserStories(null)}
        />
      )}
    </div>
  );
};

export default Stories;
