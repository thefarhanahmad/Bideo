import { useEffect, useState, useCallback } from "react";
import DataTableToolbar from "../components/DataTableToolbar";
import Pagination from "../components/Pagination";
import LoadingSkeleton from "../components/LoadingSkeleton";
import Modal from "../components/Modal";
import { useTableParams } from "../hooks/useTableParams";
import { API_URL } from "../config";
import {
  RocketIcon,
  CoinsIcon,
  TvIcon,
  TrendingUpIcon,
  SparkIcon,
  EyeIcon,
  UsersIcon,
} from "../components/Icons";

const resolveMediaUrl = (url) => {
  if (!url) return "https://via.placeholder.com/80x80.png?text=User";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const formatRemainingTime = (seconds) => {
  if (seconds == null || isNaN(seconds) || seconds <= 0) return "Expired";
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  if (hrs > 0) return `${hrs}h ${mins}m left`;
  if (mins > 0) return `${mins}m ${secs}s left`;
  return `${secs}s left`;
};

const formatDate = (date) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
};

const formatDateTime = (date) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(date));
};

const Boost = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState("coins_desc");

  // User details modal state
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [userDetails, setUserDetails] = useState(null);
  const [modalError, setModalError] = useState(null);
  const [modalTab, setModalTab] = useState("boosts"); // "boosts" | "transactions"

  const [kpi, setKpi] = useState({
    totalCirculatingCoins: 0,
    usersWithCoins: 0,
    usersReadyToBoost: 0,
    activeHighlights: 0,
    queuedHighlights: 0,
    totalBoostsAllTime: 0,
    totalCoinsSpent: 0,
    todayAdsWatched: 0,
    todayCoinsAwarded: 0,
    todayActiveViewers: 0,
  });

  // URL-synced search, filter, and pagination
  const { search, setSearch, filter, setFilter, page, setPage, limit, setLimit } =
    useTableParams({ defaultFilter: "all", defaultLimit: 10 });

  const API = API_URL;

  const fetchBoostData = useCallback(
    async (
      currentPage = page,
      currentLimit = limit,
      currentFilter = filter,
      currentSearch = search,
      currentSort = sortBy
    ) => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("admin_token");
        const params = new URLSearchParams({
          page: currentPage,
          limit: currentLimit,
          sort: currentSort,
        });
        if (currentFilter && currentFilter !== "all") params.append("filter", currentFilter);
        if (currentSearch && currentSearch.trim()) params.append("search", currentSearch.trim());

        const res = await fetch(`${API}/api/admin/boost?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to fetch boost data");

        setUsers(data.data || []);
        setTotalItems(data.total || 0);
        setTotalPages(data.pages || 1);
        if (data.kpi) setKpi(data.kpi);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [API, page, limit, filter, search, sortBy]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchBoostData(page, limit, filter, search, sortBy);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchBoostData, page, limit, filter, search, sortBy]);

  // Open user details modal and fetch ledger + boosts
  const handleOpenDetails = async (userId) => {
    setSelectedUserId(userId);
    setModalLoading(true);
    setModalError(null);
    setUserDetails(null);
    setModalTab("boosts");

    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${API}/api/admin/boost/user/${userId}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load user boost details");
      setUserDetails(data.data);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalLoading(false);
    }
  };

  const handleCloseModal = () => {
    setSelectedUserId(null);
    setUserDetails(null);
    setModalError(null);
  };

  const filterOptions = [
    { label: "All Users with Coins", value: "all", count: totalItems },
    { label: "🟢 Live on Feed", value: "active", count: kpi.activeHighlights },
    { label: "⏳ Up Next in Queue", value: "queued", count: kpi.queuedHighlights },
    { label: "📺 Watched Ads Today", value: "ads_today", count: kpi.todayActiveViewers },
    { label: "🪙 100+ Coins Ready", value: "high_coins", count: kpi.usersReadyToBoost },
    { label: "🚀 All-Time Boosters", value: "has_boosted" },
  ];

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand">
              <RocketIcon className="h-5 w-5" />
            </div>
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">
              Channel Boost & Highlights
            </h2>
          </div>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted">
            Monitor user coin balances, daily ad reward participation, live boosted videos on feed, and queue schedules.
          </p>
        </div>

        <button
          onClick={() => fetchBoostData(page, limit, filter, search, sortBy)}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-line bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-ink shadow-xs transition-all hover:bg-surface disabled:opacity-60"
        >
          <span className={loading ? "animate-spin" : ""}>🔄</span>
          <span>Refresh Data</span>
        </button>
      </div>

      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Circulating Coins */}
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-br from-white to-amber-50/40 p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-800">
              Circulating Coins
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-700">
              <CoinsIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-amber-700">
              🪙 {Number(kpi.totalCirculatingCoins || 0).toLocaleString()}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Held by <strong className="text-ink">{kpi.usersWithCoins || 0}</strong> users (
            <span className="text-amber-700 font-semibold">{kpi.usersReadyToBoost || 0}</span> ready to boost)
          </p>
        </div>

        {/* Card 2: Live & Queued Highlights */}
        <div className="rounded-2xl border border-purple-200 bg-gradient-to-br from-white to-purple-50/40 p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-800">
              Feed Highlights
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-700">
              <RocketIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-purple-700">
              {kpi.activeHighlights || 0} Live
            </span>
            <span className="text-xs font-bold text-purple-900">
              (+{kpi.queuedHighlights || 0} in queue)
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Videos actively highlighted at the top of the Home Feed
          </p>
        </div>

        {/* Card 3: All-Time Boosts Burned */}
        <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-white to-brand-50/30 p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-dark">
              Boost Activity
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand">
              <TrendingUpIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-ink">
              {Number(kpi.totalBoostsAllTime || 0).toLocaleString()} Boosts
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            🪙 <strong className="text-brand font-bold">{Number(kpi.totalCoinsSpent || 0).toLocaleString()}</strong> coins burned on video highlights
          </p>
        </div>

        {/* Card 4: Today's Sponsored Ads Activity */}
        <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Today's Ad Rewards
            </span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
              <TvIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-emerald-700">
              {Number(kpi.todayAdsWatched || 0).toLocaleString()} Ads
            </span>
            <span className="text-xs font-bold text-emerald-800">
              (+{Number(kpi.todayCoinsAwarded || 0).toLocaleString()} 🪙)
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">
            Watched by <strong className="text-emerald-700">{kpi.todayActiveViewers || 0}</strong> active viewers today
          </p>
        </div>
      </div>

      {/* Toolbar: Search, Filters & Sorting */}
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search creator by name, channel, or email..."
        filter={filter}
        onFilterChange={setFilter}
        filters={filterOptions}
        totalCount={totalItems}
        filteredCount={totalItems}
        actions={
          <div className="flex items-center gap-2">
            <label className="text-xs font-bold text-muted shrink-0">Sort By:</label>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              aria-label="Sort users by boost criteria"
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-ink shadow-xs focus:border-brand focus:outline-hidden"
            >
              <option value="coins_desc">Coins: Highest to Lowest</option>
              <option value="coins_asc">Coins: Lowest to Highest</option>
              <option value="ads_desc">Ads Watched Today: Highest first</option>
              <option value="boosts_desc">Total Boosts: Highest first</option>
              <option value="latest">Recently Active</option>
            </select>
          </div>
        }
      />

      {/* Error Banner */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Main Boost Table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="p-4">Rank / Creator</th>
                <th className="p-4 text-center">Coin Balance</th>
                <th className="p-4 text-center">Ads Watched Today</th>
                <th className="p-4">Current Highlight</th>
                <th className="p-4 text-center">Total Boosts</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <LoadingSkeleton rows={6} cols={7} />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="7" className="p-8 text-center text-muted">
                    No creators or coin holders found matching your criteria.
                  </td>
                </tr>
              ) : (
                users.map((u, idx) => {
                  const rankNumber = (page - 1) * limit + idx + 1;
                  const hasActive = Boolean(u.activeBoost);
                  const hasQueued = Boolean(u.queuedBoosts && u.queuedBoosts.length > 0);

                  return (
                    <tr key={u._id} className="transition-colors hover:bg-surface/50">
                      {/* Creator Info */}
                      <td className="p-4">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <span
                            className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                              rankNumber === 1
                                ? "bg-amber-100 text-amber-800"
                                : rankNumber === 2
                                ? "bg-slate-200 text-slate-800"
                                : rankNumber === 3
                                ? "bg-amber-700/20 text-amber-900"
                                : "text-muted"
                            }`}
                          >
                            #{rankNumber}
                          </span>
                          <img
                            src={resolveMediaUrl(u.avatar)}
                            alt={u.name}
                            className="h-10 w-10 shrink-0 rounded-full object-cover border border-line"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-ink truncate">{u.name}</span>
                              {u.isVerified && (
                                <span className="text-brand text-xs font-bold" title="Verified Creator">
                                  ✓
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-muted truncate">
                              @{u.channelName || "no_channel"}
                            </div>
                            <div className="text-[11px] text-muted/80 truncate">{u.email || "-"}</div>
                          </div>
                        </div>
                      </td>

                      {/* Coin Balance */}
                      <td className="p-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1 text-sm font-extrabold shadow-2xs border ${
                              u.coins >= 100
                                ? "bg-amber-50 text-amber-800 border-amber-300"
                                : u.coins > 0
                                ? "bg-purple-50 text-purple-700 border-purple-200"
                                : "bg-surface text-muted border-line"
                            }`}
                          >
                            <span>🪙</span>
                            <span>{Number(u.coins || 0).toLocaleString()}</span>
                          </span>
                          {u.coins >= 100 && (
                            <span className="mt-1 text-[10px] font-bold text-emerald-600">
                              Ready to Boost (1 hr)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Ads Activity Today */}
                      <td className="p-4 text-center">
                        <div className="inline-flex flex-col items-center">
                          <span
                            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-bold border ${
                              u.dailyAdsCount >= 16
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : u.dailyAdsCount > 0
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-surface text-muted border-line"
                            }`}
                          >
                            <span>📺</span>
                            <span>{u.dailyAdsCount || 0} / 16</span>
                          </span>
                          {u.lastAdWatchedAt && (
                            <span className="mt-1 text-[10px] text-muted">
                              Last: {formatDateTime(u.lastAdWatchedAt)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Current Highlight Video */}
                      <td className="p-4">
                        {hasActive ? (
                          <div className="flex items-center gap-3 min-w-[240px]">
                            {u.activeBoost.video?.thumbnail ? (
                              <img
                                src={resolveMediaUrl(u.activeBoost.video.thumbnail)}
                                alt="Highlight Thumbnail"
                                className="h-11 w-16 shrink-0 rounded-lg object-cover border border-line"
                              />
                            ) : (
                              <div className="flex h-11 w-16 shrink-0 items-center justify-center rounded-lg bg-surface text-muted text-xs border border-line">
                                🎬 Video
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-ink truncate max-w-[180px]">
                                {u.activeBoost.video?.title || "Boosted Video"}
                              </div>
                              <div className="mt-1 flex items-center gap-2">
                                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-extrabold text-emerald-800 animate-pulse">
                                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600"></span>
                                  {formatRemainingTime(u.activeBoost.remainingSeconds)}
                                </span>
                                <span className="text-[11px] text-muted">
                                  {u.activeBoost.video?.views ?? 0} views
                                </span>
                              </div>
                            </div>
                          </div>
                        ) : hasQueued ? (
                          <div className="flex items-center gap-3 min-w-[240px]">
                            {u.queuedBoosts[0]?.video?.thumbnail ? (
                              <img
                                src={resolveMediaUrl(u.queuedBoosts[0].video.thumbnail)}
                                alt="Queued Thumbnail"
                                className="h-11 w-16 shrink-0 rounded-lg object-cover border border-line opacity-80"
                              />
                            ) : (
                              <div className="flex h-11 w-16 shrink-0 items-center justify-center rounded-lg bg-surface text-muted text-xs border border-line">
                                🎬 Video
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-ink truncate max-w-[180px]">
                                {u.queuedBoosts[0]?.video?.title || "Upcoming Highlight"}
                              </div>
                              <div className="mt-1 flex items-center gap-1.5">
                                <span className="inline-flex items-center gap-1 rounded-md bg-amber-100 px-2 py-0.5 text-[11px] font-bold text-amber-800">
                                  <span>⏳</span> Position #{u.queuedBoosts[0]?.queuePosition || 1}
                                </span>
                                {u.queuedBoosts.length > 1 && (
                                  <span className="text-[10px] font-bold text-purple-700">
                                    +{u.queuedBoosts.length - 1} more
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted italic">No active highlight</span>
                        )}
                      </td>

                      {/* Total Boosts */}
                      <td className="p-4 text-center">
                        <div className="text-xs font-bold text-ink">
                          {u.totalBoosts || 0} times
                        </div>
                        <div className="text-[11px] text-muted">
                          🪙 {Number(u.totalCoinsSpent || 0).toLocaleString()} spent
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        {u.status === "live" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-ping"></span>
                            Live on Feed
                          </span>
                        ) : u.status === "queued" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700 border border-amber-200">
                            <span>⏳</span> Up Next
                          </span>
                        ) : u.status === "ready" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-bold text-purple-700 border border-purple-200">
                            <span>✨</span> 100+ Ready
                          </span>
                        ) : u.status === "active_viewer" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 border border-blue-200">
                            <span>📺</span> Watching Ads
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-muted border border-line">
                            Idle
                          </span>
                        )}
                      </td>

                      {/* Action */}
                      <td className="p-4 text-center">
                        <button
                          onClick={() => handleOpenDetails(u._id)}
                          className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink shadow-2xs transition-all hover:border-brand hover:text-brand"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={limit}
          onPageChange={setPage}
          onPageSizeChange={setLimit}
        />
      </div>

      {/* User Boost & Coins Details Modal */}
      {selectedUserId && (
        <Modal
          title="Creator Boost & Coin Ledger Details"
          onClose={handleCloseModal}
          maxWidth="max-w-4xl"
        >
          {modalLoading ? (
            <div className="py-12 text-center">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-brand border-r-transparent"></div>
              <p className="mt-3 text-sm font-semibold text-muted">
                Loading user boost history and coin transactions...
              </p>
            </div>
          ) : modalError ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600">
              {modalError}
            </div>
          ) : userDetails ? (
            <div className="space-y-6">
              {/* User Overview Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface p-4 border border-line">
                <div className="flex items-center gap-3">
                  <img
                    src={resolveMediaUrl(userDetails.user?.avatar)}
                    alt={userDetails.user?.name}
                    className="h-14 w-14 rounded-full object-cover border-2 border-white shadow-xs"
                  />
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-display font-extrabold text-ink text-base">
                        {userDetails.user?.name}
                      </h4>
                      {userDetails.user?.isVerified && (
                        <span className="text-brand text-xs font-bold">✓ Verified</span>
                      )}
                    </div>
                    <div className="text-xs text-muted">
                      @{userDetails.user?.channelName || "no_channel"} • {userDetails.user?.email}
                    </div>
                    <div className="mt-1 text-[11px] text-muted">
                      Joined: {formatDate(userDetails.user?.createdAt)}
                    </div>
                  </div>
                </div>

                {/* Quick Balances */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="rounded-xl bg-amber-50 px-4 py-2 border border-amber-200 text-right">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-amber-800">
                      Coins Balance
                    </span>
                    <span className="text-base font-black text-amber-700">
                      🪙 {Number(userDetails.user?.coins || 0).toLocaleString()}
                    </span>
                  </div>

                  <div className="rounded-xl bg-purple-50 px-4 py-2 border border-purple-200 text-right">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-purple-800">
                      Total Boosts
                    </span>
                    <span className="text-base font-black text-purple-700">
                      {userDetails.boosts?.length || 0}
                    </span>
                  </div>

                  <div className="rounded-xl bg-blue-50 px-4 py-2 border border-blue-200 text-right">
                    <span className="block text-[10px] font-bold uppercase tracking-wider text-blue-800">
                      Today's Ads
                    </span>
                    <span className="text-base font-black text-blue-700">
                      {userDetails.user?.adRewards?.dailyCount || 0} / 16
                    </span>
                  </div>
                </div>
              </div>

              {/* Modal Tabs Navigation */}
              <div className="flex border-b border-line gap-4">
                <button
                  onClick={() => setModalTab("boosts")}
                  className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
                    modalTab === "boosts"
                      ? "border-brand text-brand"
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  🚀 Boosted Videos History ({userDetails.boosts?.length || 0})
                </button>
                <button
                  onClick={() => setModalTab("transactions")}
                  className={`pb-3 text-sm font-bold border-b-2 transition-colors ${
                    modalTab === "transactions"
                      ? "border-brand text-brand"
                      : "border-transparent text-muted hover:text-ink"
                  }`}
                >
                  🪙 Coin Ledger Transactions ({userDetails.transactions?.length || 0})
                </button>
              </div>

              {/* Tab 1: Boosted Videos History */}
              {modalTab === "boosts" && (
                <div className="space-y-3">
                  {userDetails.boosts?.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted">
                      This user has not boosted any videos yet.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-line">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-line bg-surface font-bold uppercase tracking-wider text-muted">
                          <tr>
                            <th className="p-3">Video</th>
                            <th className="p-3 text-center">Duration</th>
                            <th className="p-3 text-center">Coins Spent</th>
                            <th className="p-3 text-center">Status</th>
                            <th className="p-3 text-right">Boosted Date</th>
                            <th className="p-3 text-right">Live / Expiry</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {userDetails.boosts.map((b) => (
                            <tr key={b._id} className="hover:bg-surface/50">
                              <td className="p-3">
                                <div className="flex items-center gap-2 max-w-[240px]">
                                  {b.video?.thumbnail ? (
                                    <img
                                      src={resolveMediaUrl(b.video.thumbnail)}
                                      alt={b.video.title}
                                      className="h-10 w-16 shrink-0 rounded object-cover border border-line"
                                    />
                                  ) : (
                                    <div className="flex h-10 w-16 shrink-0 items-center justify-center rounded bg-surface text-[10px] text-muted border border-line">
                                      Video
                                    </div>
                                  )}
                                  <div className="min-w-0">
                                    <div className="font-bold text-ink truncate">
                                      {b.video?.title || "Deleted Video"}
                                    </div>
                                    <div className="text-[10px] text-muted">
                                      {b.video?.views || 0} views
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 text-center font-semibold">
                                {b.durationHours || 1} Hour{b.durationHours > 1 ? "s" : ""}
                              </td>
                              <td className="p-3 text-center font-bold text-amber-700">
                                🪙 {b.coinsSpent || 100}
                              </td>
                              <td className="p-3 text-center">
                                {b.status === "active" ? (
                                  <span className="inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-extrabold text-emerald-800">
                                    🟢 Active Now
                                  </span>
                                ) : b.status === "queued" ? (
                                  <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                    ⏳ In Queue (#{b.queuePosition || 1})
                                  </span>
                                ) : b.status === "completed" ? (
                                  <span className="inline-flex rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted border border-line">
                                    Completed
                                  </span>
                                ) : (
                                  <span className="inline-flex rounded-full bg-surface px-2 py-0.5 text-[10px] font-semibold text-muted border border-line">
                                    {b.status}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right text-muted">
                                {formatDateTime(b.createdAt)}
                              </td>
                              <td className="p-3 text-right text-muted">
                                {b.expiresAt ? formatDateTime(b.expiresAt) : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Coin Ledger Transactions */}
              {modalTab === "transactions" && (
                <div className="space-y-3">
                  {userDetails.transactions?.length === 0 ? (
                    <div className="py-8 text-center text-sm text-muted">
                      No coin transactions recorded for this user.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-xl border border-line">
                      <table className="w-full text-left text-xs">
                        <thead className="border-b border-line bg-surface font-bold uppercase tracking-wider text-muted">
                          <tr>
                            <th className="p-3">Type</th>
                            <th className="p-3 text-right">Amount</th>
                            <th className="p-3 text-right">Balance After</th>
                            <th className="p-3">Description</th>
                            <th className="p-3 text-right">Date & Time</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {userDetails.transactions.map((tx) => (
                            <tr key={tx._id} className="hover:bg-surface/50">
                              <td className="p-3 font-semibold">
                                {tx.type === "ad_reward" ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-bold text-blue-700 border border-blue-200">
                                    📺 Ad Reward
                                  </span>
                                ) : tx.type === "boost_spend" ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 border border-purple-200">
                                    🚀 Video Boost
                                  </span>
                                ) : tx.type === "admin_adjustment" ? (
                                  <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-700 border border-amber-200">
                                    ⚙️ Admin Action
                                  </span>
                                ) : (
                                  <span className="rounded-md bg-surface px-2 py-0.5 text-[11px] font-medium text-muted border border-line">
                                    {tx.type}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right font-black">
                                {tx.amount > 0 ? (
                                  <span className="text-emerald-600">
                                    +{tx.amount} 🪙
                                  </span>
                                ) : (
                                  <span className="text-red-500">
                                    {tx.amount} 🪙
                                  </span>
                                )}
                              </td>
                              <td className="p-3 text-right font-bold text-ink">
                                🪙 {Number(tx.balanceAfter || 0).toLocaleString()}
                              </td>
                              <td className="p-3 text-ink max-w-[280px] truncate">
                                {tx.description || "-"}
                              </td>
                              <td className="p-3 text-right text-muted">
                                {formatDateTime(tx.createdAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Close Button */}
              <div className="flex justify-end pt-2">
                <button
                  onClick={handleCloseModal}
                  className="rounded-xl border border-line bg-surface px-5 py-2 text-xs sm:text-sm font-bold text-ink transition-colors hover:bg-line/60"
                >
                  Close
                </button>
              </div>
            </div>
          ) : null}
        </Modal>
      )}
    </div>
  );
};

export default Boost;
