import { useEffect, useState, useMemo } from "react";
import DataTableToolbar from "../components/DataTableToolbar";
import Pagination from "../components/Pagination";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useTableParams } from "../hooks/useTableParams";
import { API_URL } from "../config";

const resolveMediaUrl = (url) => {
  if (!url) return "https://via.placeholder.com/640x360.png?text=No+Thumbnail";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const API = API_URL;

  // URL-synced search, filter, and pagination
  const { search, setSearch, filter, setFilter, page, setPage, limit, setLimit } =
    useTableParams({ defaultFilter: "all", defaultLimit: 10 });

  const fetchReports = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + "/api/admin/reports/videos", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load reports");
      setReports(data.data || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const updateStatus = async (id, nextStatus) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + "/api/admin/reports/videos/" + id, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Update failed");
      fetchReports();
    } catch (err) {
      alert(err.message);
    }
  };

  const deleteVideo = async (videoId) => {
    if (!videoId || !window.confirm("Delete this reported video permanently?")) return;
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + "/api/videos/" + videoId, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Delete failed");
      fetchReports();
    } catch (err) {
      alert(err.message);
    }
  };

  const statusBadge = (s) => {
    const map = {
      open: "bg-amber-50 text-amber-700 border border-amber-200",
      reviewed: "bg-sky-50 text-sky-700 border border-sky-200",
      dismissed: "bg-surface text-muted border border-line",
      actioned: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    };
    return map[s] || "bg-surface text-muted border border-line";
  };

  // Search & Filter Logic
  const { filteredReports, filterCounts } = useMemo(() => {
    const counts = {
      all: reports.length,
      open: 0,
      reviewed: 0,
      actioned: 0,
      dismissed: 0,
    };

    reports.forEach((r) => {
      if (counts[r.status] !== undefined) counts[r.status] += 1;
    });

    const searchLower = (search || "").trim().toLowerCase();

    const filtered = reports.filter((r) => {
      // 1. Filter status
      if (filter !== "all" && r.status !== filter) return false;

      // 2. Search
      if (!searchLower) return true;
      const title = (r.video?.title || "").toLowerCase();
      const owner = (r.video?.owner?.name || r.video?.owner?.channelName || "").toLowerCase();
      const reporter = (r.reporter?.name || r.reporter?.channelName || "").toLowerCase();
      const reason = (r.reason || "").toLowerCase();

      return (
        title.includes(searchLower) ||
        owner.includes(searchLower) ||
        reporter.includes(searchLower) ||
        reason.includes(searchLower)
      );
    });

    return { filteredReports: filtered, filterCounts: counts };
  }, [reports, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredReports.length / limit));
  const paginatedReports = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredReports.slice(startIndex, startIndex + limit);
  }, [filteredReports, page, limit]);

  const filterOptions = [
    { label: "All Reports", value: "all", count: filterCounts.all },
    { label: "Open", value: "open", count: filterCounts.open },
    { label: "Reviewed", value: "reviewed", count: filterCounts.reviewed },
    { label: "Actioned", value: "actioned", count: filterCounts.actioned },
    { label: "Dismissed", value: "dismissed", count: filterCounts.dismissed },
  ];

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">Reported Content</h2>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted">
            Review and moderate user-reported videos and community violations.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by video title, owner, reporter, or reason..."
        filter={filter}
        onFilterChange={setFilter}
        filters={filterOptions}
        totalCount={reports.length}
        filteredCount={filteredReports.length}
      />

      {loading ? (
        <LoadingSkeleton type="table" rows={6} cols={5} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="p-4 font-semibold">Reported Video</th>
                  <th className="p-4 font-semibold">Reported By</th>
                  <th className="p-4 font-semibold">Reason</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedReports.map((report) => (
                  <tr
                    key={report._id}
                    className="border-t border-line align-top hover:bg-surface/50 transition-colors"
                  >
                    <td className="p-4">
                      <div className="flex gap-3 min-w-0">
                        {report.video?.thumbnail && (
                          <img
                            src={resolveMediaUrl(report.video.thumbnail)}
                            alt=""
                            className="h-12 w-20 shrink-0 rounded-lg bg-surface object-cover border border-line"
                            onError={(e) => {
                              e.currentTarget.style.visibility = "hidden";
                            }}
                          />
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-semibold text-ink text-sm">
                            {report.video?.title || "Deleted video"}
                          </div>
                          <div className="truncate text-xs text-muted mt-0.5">
                            Creator:{" "}
                            {report.video?.owner?.channelName ||
                              report.video?.owner?.name ||
                              "Unknown"}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-muted text-xs">
                      <div className="font-semibold text-ink">
                        {report.reporter?.channelName || report.reporter?.name || "Anonymous"}
                      </div>
                      <div className="text-muted mt-0.5">{report.reporter?.phone || report.reporter?.email || ""}</div>
                    </td>
                    <td className="p-4 max-w-xs text-ink text-xs font-medium">
                      <div className="rounded-lg bg-surface p-2 border border-line/60">
                        "{report.reason}"
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${statusBadge(
                          report.status
                        )}`}
                      >
                        {report.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end flex-wrap gap-1.5 whitespace-nowrap">
                        {["reviewed", "actioned", "dismissed"].map(
                          (next) =>
                            report.status !== next && (
                              <button
                                key={next}
                                onClick={() => updateStatus(report._id, next)}
                                className="rounded-lg bg-brand-50 border border-brand/20 px-2.5 py-1 text-xs font-semibold capitalize text-brand hover:bg-brand-100"
                              >
                                {next}
                              </button>
                            )
                        )}
                        {report.video?._id && (
                          <button
                            onClick={() => deleteVideo(report.video._id)}
                            className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                          >
                            Delete Video
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedReports.length === 0 && (
                  <tr>
                    <td className="p-8 text-center text-muted" colSpan="5">
                      No matching reports found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredReports.length}
            pageSize={limit}
            onPageChange={setPage}
            onPageSizeChange={setLimit}
          />
        </div>
      )}
    </div>
  );
};

export default Reports;
