import { useCallback, useEffect, useState } from "react";
import Pagination from "./Pagination";
import UserLink from "./UserLink";
import { API_URL } from "../config";

// Blue tick (verified badge) purchases paid with coins — shown on the admin Boost page.

const resolveMediaUrl = (url) => {
  if (!url) return "https://via.placeholder.com/80x80.png?text=User";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const formatDateTime = (date) => {
  if (!date) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
};

const STATUS_STYLES = {
  active: { label: "Active", className: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  expired: { label: "Expired", className: "bg-slate-100 text-slate-600 border-slate-200" },
  verified_other: { label: "Verified (admin/views)", className: "bg-blue-50 text-blue-700 border-blue-200" },
};

const SummaryStat = ({ label, value, tone }) => (
  <div className={`rounded-xl border px-4 py-2 ${tone}`}>
    <span className="block text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</span>
    <span className="text-base font-black">{value}</span>
  </div>
);

const VerifiedBadgePurchases = () => {
  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPurchases = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      const params = new URLSearchParams({ page, limit });
      if (search.trim()) params.append("search", search.trim());
      const res = await fetch(`${API_URL}/api/admin/boost/verified-purchases?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load blue tick purchases");
      setRows(data.data || []);
      setSummary(data.summary || null);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    const timer = setTimeout(fetchPurchases, search ? 350 : 0);
    return () => clearTimeout(timer);
  }, [fetchPurchases, search]);

  return (
    <section className="overflow-hidden rounded-2xl border border-blue-200 bg-white shadow-xs">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-gradient-to-br from-white to-blue-50/40 p-4 sm:p-5">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-extrabold text-ink">
            <span className="mr-1.5 text-blue-600">✓</span>
            Blue Tick Purchases (Coins)
          </h3>
          <p className="mt-0.5 text-xs sm:text-sm text-muted">
            Every verified badge bought with coins, newest first.
          </p>
        </div>
        {summary && (
          <div className="flex flex-wrap gap-2">
            <SummaryStat label="Purchases" value={summary.totalPurchases.toLocaleString()} tone="border-blue-200 bg-blue-50 text-blue-700" />
            <SummaryStat label="Buyers" value={summary.uniqueBuyers.toLocaleString()} tone="border-purple-200 bg-purple-50 text-purple-700" />
            <SummaryStat label="Active now" value={summary.activeNow.toLocaleString()} tone="border-emerald-200 bg-emerald-50 text-emerald-700" />
            <SummaryStat label="Coins spent" value={`🪙 ${summary.totalCoinsSpent.toLocaleString()}`} tone="border-amber-200 bg-amber-50 text-amber-700" />
          </div>
        )}
      </div>

      <div className="border-b border-line p-3 sm:p-4">
        <input
          type="search"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search buyer by name, channel, or email..."
          aria-label="Search blue tick buyers"
          className="w-full sm:max-w-sm rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink shadow-xs focus:border-brand focus:outline-hidden"
        />
      </div>

      {error && <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-line bg-surface text-xs font-bold uppercase tracking-wider text-muted">
            <tr>
              <th className="p-4">Buyer</th>
              <th className="p-4 text-center">Coins Spent</th>
              <th className="p-4">Purchased</th>
              <th className="p-4">Valid Until</th>
              <th className="p-4 text-center">Badge Now</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {loading ? (
              <tr>
                <td colSpan="5" className="p-8 text-center text-muted">Loading purchases…</td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan="5" className="p-8 text-center text-muted">
                  {search ? "No buyers match your search." : "No blue tick purchases yet."}
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const status = STATUS_STYLES[row.badgeStatus] || STATUS_STYLES.expired;
                return (
                  <tr key={row._id} className="transition-colors hover:bg-surface/50">
                    <td className="p-4">
                      {row.user ? (
                        <UserLink user={row.user} className="flex items-center gap-3 min-w-[200px] group" title="Open user profile & stats">
                          <img
                            src={resolveMediaUrl(row.user.avatar)}
                            alt={row.user.name}
                            className="h-9 w-9 shrink-0 rounded-full object-cover border border-line"
                          />
                          <div className="min-w-0">
                            <div className="font-bold text-ink truncate group-hover:text-brand group-hover:underline underline-offset-2">
                              {row.user.name}
                            </div>
                            <div className="text-xs text-muted truncate">@{row.user.channelName || "no_channel"}</div>
                          </div>
                        </UserLink>
                      ) : (
                        <span className="text-muted">Deleted user</span>
                      )}
                    </td>
                    <td className="p-4 text-center font-bold text-amber-700">🪙 {row.coinsSpent.toLocaleString()}</td>
                    <td className="p-4 whitespace-nowrap text-ink">{formatDateTime(row.purchasedAt)}</td>
                    <td className="p-4 whitespace-nowrap text-ink">{formatDateTime(row.validUntil)}</td>
                    <td className="p-4 text-center">
                      <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-bold ${status.className}`}>
                        {status.label}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={limit}
        onPageChange={setPage}
        onPageSizeChange={(size) => {
          setLimit(size);
          setPage(1);
        }}
      />
    </section>
  );
};

export default VerifiedBadgePurchases;
