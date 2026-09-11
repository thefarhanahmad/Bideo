import { useEffect, useState, useCallback } from "react";
import DataTableToolbar from "../components/DataTableToolbar";
import Pagination from "../components/Pagination";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useTableParams } from "../hooks/useTableParams";
import { API_URL } from "../config";
import { CashIcon, TrendingUpIcon, WalletIcon, UsersIcon } from "../components/Icons";

const resolveMediaUrl = (url) => {
  if (!url) return "https://via.placeholder.com/80x80.png?text=User";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const UserEarnings = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [sortBy, setSortBy] = useState("lifetime_desc");

  const [kpi, setKpi] = useState({
    totalLifetimeEarnings: 0,
    totalWalletBalance: 0,
    todayTotalEarnings: 0,
    todayActiveEarners: 0,
    totalPendingSettlement: 0,
    totalPendingCount: 0,
    totalMonetizedCreators: 0,
    totalActiveEarners: 0,
  });

  // URL-synced search, filter, and pagination
  const { search, setSearch, filter, setFilter, page, setPage, limit, setLimit } =
    useTableParams({ defaultFilter: "all", defaultLimit: 10 });

  const API = API_URL;

  const fetchEarnings = useCallback(
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

        const res = await fetch(`${API}/api/admin/earnings?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to fetch user earnings");
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
      fetchEarnings(page, limit, filter, search, sortBy);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchEarnings, page, limit, filter, search, sortBy]);

  const formatDate = (date) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(date));
  };

  const filterOptions = [
    { label: "All Users", value: "all", count: totalItems },
    { label: "Monetized Creators", value: "monetized", count: kpi.totalMonetizedCreators },
    { label: "⚡ Earned Today", value: "today", count: kpi.todayActiveEarners },
  ];

  return (
    <div className="space-y-6 min-w-0 max-w-full">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">
            Users Earnings Management
          </h2>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted">
            Track daily earnings, lifetime balances, 24-hour pending settlements, and monetized creator payouts.
          </p>
        </div>
      </div>

      {/* Top KPI Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Lifetime Earnings */}
        <div className="rounded-2xl border border-line bg-white p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted">Total Lifetime Earnings</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand">
              <CashIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-ink">
              ₹{Number(kpi.totalLifetimeEarnings || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">All-time earnings generated by creators</p>
        </div>

        {/* Card 2: Today's Earnings */}
        <div className="rounded-2xl border border-emerald-100 bg-gradient-to-br from-white to-emerald-50/40 p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">Today's Earnings</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600">
              <TrendingUpIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-emerald-600">
              ₹{Number(kpi.todayTotalEarnings || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-semibold text-emerald-700">
              ({kpi.todayActiveEarners} active today)
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">Generated across all monetized videos today</p>
        </div>

        {/* Card 3: 24h Pending Settlement */}
        <div className="rounded-2xl border border-amber-100 bg-gradient-to-br from-white to-amber-50/40 p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Pending 24h Release</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600">
              <WalletIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-amber-600">
              ₹{Number(kpi.totalPendingSettlement || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs font-semibold text-amber-700">
              ({kpi.totalPendingCount} items)
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">Credits maturing into wallet after 24 hours</p>
        </div>

        {/* Card 4: Monetized Creators */}
        <div className="rounded-2xl border border-purple-100 bg-gradient-to-br from-white to-purple-50/40 p-5 shadow-xs transition-all hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-purple-700">Monetized Creators</span>
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
              <UsersIcon className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold text-purple-700">
              {kpi.totalMonetizedCreators}
            </span>
            <span className="text-xs font-semibold text-purple-600">
              ({kpi.totalActiveEarners} lifetime earners)
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">Approved creators eligible for view revenue</p>
        </div>
      </div>

      {/* Toolbar: Search, Filters & Sorting */}
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search creator by name, channel, phone, or email..."
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
              aria-label="Sort users by earnings"
              className="rounded-xl border border-line bg-white px-3 py-2 text-xs sm:text-sm font-semibold text-ink shadow-xs focus:border-brand focus:outline-hidden"
            >
              <option value="lifetime_desc">Lifetime Earnings: Highest to Lowest</option>
              <option value="lifetime_asc">Lifetime Earnings: Lowest to Highest</option>
              <option value="today_desc">Today's Earnings: Highest to Lowest</option>
              <option value="today_asc">Today's Earnings: Lowest to Highest</option>
              <option value="wallet_desc">Wallet Balance: Highest to Lowest</option>
            </select>
          </div>
        }
      />

      {/* Error Message */}
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs sm:text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Users Earnings Table */}
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line bg-surface text-xs font-bold uppercase tracking-wider text-muted">
              <tr>
                <th className="p-4">Rank / Creator</th>
                <th className="p-4">Contact Info</th>
                <th className="p-4 text-right">Today's Earning</th>
                <th className="p-4 text-right">Lifetime Earning</th>
                <th className="p-4 text-right">Available Wallet</th>
                <th className="p-4 text-right">Pending (24h)</th>
                <th className="p-4 text-center">Status</th>
                <th className="p-4 text-center">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <LoadingSkeleton rows={5} cols={8} />
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan="8" className="p-8 text-center text-muted">
                    No creators found matching your criteria.
                  </td>
                </tr>
              ) : (
                users.map((u, idx) => {
                  const rankNumber = (page - 1) * limit + idx + 1;
                  return (
                    <tr key={u._id} className="transition-colors hover:bg-surface/50">
                      {/* Creator Info */}
                      <td className="p-4">
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <span
                            className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-extrabold ${
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
                          </div>
                        </div>
                      </td>

                      {/* Contact */}
                      <td className="p-4">
                        <div className="text-xs text-ink">{u.email || "-"}</div>
                        <div className="text-xs text-muted">{u.phone || "-"}</div>
                      </td>

                      {/* Today's Earning */}
                      <td className="p-4 text-right">
                        {u.todayEarnings > 0 ? (
                          <span className="inline-flex items-center rounded-md bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                            +₹{Number(u.todayEarnings).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">₹0.00</span>
                        )}
                      </td>

                      {/* Lifetime Earning */}
                      <td className="p-4 text-right">
                        <span className="font-display font-extrabold text-ink text-sm">
                          ₹{Number(u.totalEarnings || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Available Wallet Balance */}
                      <td className="p-4 text-right">
                        <span className="font-semibold text-brand text-sm">
                          ₹{Number(u.walletBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Pending 24h Balance */}
                      <td className="p-4 text-right">
                        {u.pendingBalance > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700 border border-amber-200">
                            <span>⏳</span> ₹{Number(u.pendingBalance).toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted">₹0.00</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-4 text-center">
                        {u.isMonetized ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                            <span>★</span> Monetized
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-muted border border-line">
                            Standard
                          </span>
                        )}
                      </td>

                      {/* Joined Date */}
                      <td className="p-4 text-center text-xs text-muted">
                        {formatDate(u.createdAt)}
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
    </div>
  );
};

export default UserEarnings;
