import { useEffect, useState, useMemo, useCallback } from "react";
import Modal from "../components/Modal";
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

const Monetization = () => {
  const [applications, setApplications] = useState([]);
  const [videoReviews, setVideoReviews] = useState([]);
  const [monetizedUsers, setMonetizedUsers] = useState([]);
  const [counts, setCounts] = useState({ videos: 0, applications: 0, monetized: 0 });
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Approval modal states
  const [showApproveApp, setShowApproveApp] = useState(false);
  const [showPassVideo, setShowPassVideo] = useState(false);

  // Rejection modal states
  const [showRejectApp, setShowRejectApp] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  const [showRejectVideo, setShowRejectVideo] = useState(false);
  const [selectedVideoReview, setSelectedVideoReview] = useState(null);
  const [videoRejectReason, setVideoRejectReason] = useState("");

  // Monetized User detail modal states
  const [selectedMonetizedUser, setSelectedMonetizedUser] = useState(null);
  const [showMonetizedDetailsModal, setShowMonetizedDetailsModal] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // URL-synced search, filter (active tab), and pagination
  const { search, setSearch, filter: activeTab, setFilter: setActiveTab, page, setPage, limit, setLimit } =
    useTableParams({ defaultFilter: "videos", defaultLimit: 10 });

  const API = API_URL;

  const fetchData = useCallback(
    async (
      currentTab = activeTab,
      currentPage = page,
      currentLimit = limit,
      currentSearch = search
    ) => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("admin_token");
        const headers = token ? { Authorization: `Bearer ${token}` } : {};

        if (currentTab === "videos") {
          const params = new URLSearchParams();
          if (currentSearch && currentSearch.trim()) params.append("search", currentSearch.trim());
          const res = await fetch(`${API}/api/admin/videos/pending-reviews?${params.toString()}`, {
            headers,
            credentials: "include",
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Failed to load video reviews");
          setVideoReviews(data.data || []);
          if (data.counts) setCounts(data.counts);
          setTotalItems(data.count || 0);
          setTotalPages(1);
        } else if (currentTab === "applications") {
          const params = new URLSearchParams({
            status: "pending",
            page: currentPage,
            limit: currentLimit,
          });
          if (currentSearch && currentSearch.trim()) params.append("search", currentSearch.trim());
          const res = await fetch(`${API}/api/admin/monetization-applications?${params.toString()}`, {
            headers,
            credentials: "include",
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Failed to load applications");
          setApplications(data.data || []);
          if (data.counts) setCounts(data.counts);
          setTotalItems(data.total || 0);
          setTotalPages(data.pages || 1);
        } else if (currentTab === "monetized") {
          const params = new URLSearchParams({
            status: "approved",
            page: currentPage,
            limit: currentLimit,
          });
          if (currentSearch && currentSearch.trim()) params.append("search", currentSearch.trim());
          const res = await fetch(`${API}/api/admin/monetization-applications?${params.toString()}`, {
            headers,
            credentials: "include",
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Failed to load monetized creators");
          setMonetizedUsers(data.data || []);
          if (data.counts) setCounts(data.counts);
          setTotalItems(data.total || 0);
          setTotalPages(data.pages || 1);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [API, activeTab, page, limit, search]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchData(activeTab, page, limit, search);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchData, activeTab, page, limit, search]);

  const formatDate = (date) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const handleCopy = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleApproveAppSubmit = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + `/api/admin/users/${selectedApp.user._id}/review-monetization`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "approved" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Approval failed");

      setShowApproveApp(false);
      setSelectedApp(null);
      await fetchData(activeTab, page, limit, search);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRejectAppSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + `/api/admin/users/${selectedApp.user._id}/review-monetization`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: "rejected",
          reviewMessage: rejectReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Rejection failed");

      setShowRejectApp(false);
      setSelectedApp(null);
      setRejectReason("");
      await fetchData(activeTab, page, limit, search);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleApproveVideoSubmit = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + `/api/admin/videos/${selectedVideoReview._id}/review`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "passed" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Video audit approval failed");

      setShowPassVideo(false);
      setSelectedVideoReview(null);
      await fetchData(activeTab, page, limit, search);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRejectVideoSubmit = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + `/api/admin/videos/${selectedVideoReview._id}/review`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: "failed",
          reviewMessage: videoRejectReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Video audit failure failed");

      setShowRejectVideo(false);
      setSelectedVideoReview(null);
      setVideoRejectReason("");
      await fetchData(activeTab, page, limit, search);
    } catch (err) {
      alert(err.message);
    }
  };

  const filterOptions = [
    { label: "Video Audits", value: "videos", count: counts.videos },
    { label: "Monetization Apps", value: "applications", count: counts.applications },
    { label: "Monetized Creators", value: "monetized", count: counts.monetized },
  ];

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center min-w-0">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">Monetization Audits</h2>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted">
            Review creator onboarding KYC applications, video approvals, and active monetized partners.
          </p>
        </div>
      </div>

      {/* Toolbar: Search and Filter Tabs */}
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by creator, channel, phone, UPI, video title, or KYC details..."
        filter={activeTab}
        onFilterChange={setActiveTab}
        filters={filterOptions}
        totalCount={
          activeTab === "videos"
            ? counts.videos
            : activeTab === "applications"
            ? counts.applications
            : counts.monetized
        }
        filteredCount={totalItems}
      />

      {loading ? (
        <LoadingSkeleton type="table" rows={6} cols={6} />
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : (
        <>
          {/* TAB 1: Video Audits */}
          {activeTab === "videos" && (
            <div className="space-y-6">
              {videoReviews.map((group) => (
                <div
                  key={group.user._id}
                  className="overflow-hidden rounded-2xl border-2 border-brand-dark bg-white shadow-card p-4 sm:p-5"
                >
                  {/* Creator Header */}
                  <div className="flex items-center gap-3 border-b border-gray-200 pb-4 mb-4">
                    <img
                      src={resolveMediaUrl(group.user?.avatar)}
                      alt="avatar"
                      className="h-10 w-10 rounded-full bg-surface object-cover border border-line"
                      onError={(e) => {
                        e.currentTarget.src = "https://via.placeholder.com/80x80.png?text=User";
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <h4 className="font-display font-bold text-ink text-base truncate">{group.user?.name}</h4>
                      <p className="text-xs text-muted truncate">
                        @{group.user?.channelName || "No channel"} • {group.user?.phone || "No phone"} • {group.user?.email || "No email"}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2 shrink-0 flex-wrap justify-end">
                      {group.passedCount > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700 border border-emerald-200">
                          ✓ {group.passedCount} / 3 Passed
                        </span>
                      )}
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 px-3 py-1 text-xs font-bold border border-amber-200">
                        {group.pendingCount || group.reviews.length} In Review
                      </span>
                    </div>
                  </div>

                  {/* Inner Video List */}
                  <div className="space-y-3">
                    {group.reviews.map((rev) => (
                      <div
                        key={rev._id}
                        className={`flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border p-3 transition-colors ${
                          rev.status === "passed"
                            ? "border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50/60"
                            : "border-line bg-surface/30 hover:bg-surface/50"
                        }`}
                      >
                        {rev.video ? (
                          <>
                            {/* Thumbnail & Duration */}
                            <div className="relative shrink-0 w-24 h-14 bg-surface rounded-md overflow-hidden border border-line">
                              <img
                                src={resolveMediaUrl(rev.video.thumbnail)}
                                alt="thumb"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = "https://via.placeholder.com/640x360.png?text=Thumbnail";
                                }}
                              />
                              <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] px-1 rounded font-semibold">
                                {rev.video.duration ? `${Math.round(rev.video.duration)}s` : "0s"}
                              </span>
                            </div>

                            {/* Title & Info */}
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-ink text-sm truncate" title={rev.video.title}>
                                {rev.video.title}
                              </div>
                              <div className="text-xs text-muted mt-1 flex items-center gap-2">
                                <span
                                  className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                    rev.video.isShort ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                                  }`}
                                >
                                  {rev.video.isShort ? "Short" : "Long video"}
                                </span>
                                <span>•</span>
                                <span>Uploaded: {new Date(rev.video.createdAt).toLocaleDateString("en-IN")}</span>
                              </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-2 shrink-0 mt-3 sm:mt-0">
                              <a
                                href={rev.video.videoUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink hover:bg-surface transition-colors"
                              >
                                Play Video
                              </a>
                              {rev.status === "passed" ? (
                                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800 border border-emerald-300">
                                  ✓ Passed
                                </span>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setSelectedVideoReview(rev);
                                      setShowPassVideo(true);
                                    }}
                                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                                  >
                                    Pass
                                  </button>
                                  <button
                                    onClick={() => {
                                      setSelectedVideoReview(rev);
                                      setShowRejectVideo(true);
                                    }}
                                    className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                            </div>
                          </>
                        ) : (
                          <div className="text-sm text-muted">Video content not available</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {videoReviews.length === 0 && (
                <div className="rounded-2xl border border-line bg-white p-12 text-center text-muted shadow-card">
                  <div className="mx-auto mb-2 grid h-12 w-12 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                    ✓
                  </div>
                  <h3 className="font-display font-bold text-ink text-lg">No Pending Video Audits</h3>
                  <p className="mt-1 text-sm">All uploaded monetization review videos have been audited.</p>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: Applications */}
          {activeTab === "applications" && (
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card min-w-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wider text-muted">
                      <th className="p-4 font-semibold">Creator</th>
                      <th className="p-4 font-semibold">Contact</th>
                      <th className="p-4 font-semibold">Aadhaar Card</th>
                      <th className="p-4 font-semibold">UPI ID</th>
                      <th className="p-4 font-semibold">Bank details</th>
                      <th className="p-4 font-semibold">Applied Date</th>
                      <th className="p-4 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => (
                      <tr key={app._id} className="border-t border-line align-top hover:bg-surface/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={resolveMediaUrl(app.user?.avatar)}
                              alt="avatar"
                              className="h-10 w-10 shrink-0 rounded-full bg-surface object-cover border border-line"
                              onError={(e) => {
                                e.currentTarget.src = "https://via.placeholder.com/80x80.png?text=User";
                              }}
                            />
                            <div>
                              <div className="font-semibold text-ink">{app.name}</div>
                              <div className="text-xs text-muted">@{app.user?.channelName || app.user?.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-muted whitespace-nowrap text-xs">
                          <div>{app.phone}</div>
                          <div className="text-muted mt-0.5">{app.user?.email}</div>
                        </td>
                        <td className="p-4 font-mono text-ink whitespace-nowrap text-xs">{app.adharNumber || "-"}</td>
                        <td className="p-4 font-mono text-brand whitespace-nowrap text-xs">{app.upiId || "-"}</td>
                        <td className="p-4 text-xs text-muted">
                          <div className="font-semibold text-ink">{app.bankDetails?.bankName}</div>
                          <div>A/C: {app.bankDetails?.accountNumber}</div>
                          <div>IFSC: {app.bankDetails?.ifscCode}</div>
                        </td>
                        <td className="p-4 text-muted whitespace-nowrap text-xs">{formatDate(app.createdAt)}</td>
                        <td className="p-4">
                          <div className="flex justify-end gap-1.5 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedApp(app);
                                setShowApproveApp(true);
                              }}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedApp(app);
                                setRejectReason("");
                                setShowRejectApp(true);
                              }}
                              className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {applications.length === 0 && (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-muted">
                          No pending monetization applications.
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
                totalItems={totalItems}
                pageSize={limit}
                onPageChange={setPage}
                onPageSizeChange={setLimit}
              />
            </div>
          )}

          {/* TAB 3: Monetized Creators */}
          {activeTab === "monetized" && (
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card min-w-0">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[960px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wider text-muted">
                      <th className="p-4 font-semibold">Creator</th>
                      <th className="p-4 font-semibold">Contact</th>
                      <th className="p-4 font-semibold">Aadhaar Card</th>
                      <th className="p-4 font-semibold">UPI ID</th>
                      <th className="p-4 font-semibold">Bank details</th>
                      <th className="p-4 font-semibold">Approved Date</th>
                      <th className="p-4 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monetizedUsers.map((app) => (
                      <tr key={app._id} className="border-t border-line align-top hover:bg-surface/50 transition-colors">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={resolveMediaUrl(app.user?.avatar)}
                              alt="avatar"
                              className="h-10 w-10 shrink-0 rounded-full bg-surface object-cover border border-line"
                              onError={(e) => {
                                e.currentTarget.src = "https://via.placeholder.com/80x80.png?text=User";
                              }}
                            />
                            <div>
                              <div className="font-semibold text-ink flex items-center gap-1.5">
                                <span>{app.name}</span>
                                <span
                                  className="inline-block rounded-full bg-emerald-100 p-0.5 text-[10px] text-emerald-700"
                                  title="Monetized Creator"
                                >
                                  ✓
                                </span>
                              </div>
                              <div className="text-xs text-muted">@{app.user?.channelName || app.user?.name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-4 text-muted whitespace-nowrap text-xs">
                          <div>{app.phone}</div>
                          <div className="text-muted mt-0.5">{app.user?.email}</div>
                        </td>
                        <td className="p-4 font-mono text-ink whitespace-nowrap text-xs">{app.adharNumber}</td>
                        <td className="p-4 font-mono text-brand whitespace-nowrap text-xs">{app.upiId}</td>
                        <td className="p-4 text-xs text-muted">
                          <div className="font-semibold text-ink">{app.bankDetails?.bankName}</div>
                          <div>A/C: {app.bankDetails?.accountNumber}</div>
                          <div>IFSC: {app.bankDetails?.ifscCode}</div>
                        </td>
                        <td className="p-4 text-muted whitespace-nowrap text-xs">
                          {formatDate(app.updatedAt || app.createdAt)}
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => {
                              setSelectedMonetizedUser(app);
                              setShowMonetizedDetailsModal(true);
                            }}
                            className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface hover:border-brand transition-colors"
                          >
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                    {monetizedUsers.length === 0 && (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-muted">
                          No monetized creators found.
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
                totalItems={totalItems}
                pageSize={limit}
                onPageChange={setPage}
                onPageSizeChange={setLimit}
              />
            </div>
          )}
        </>
      )}

      {/* Approve Application Modal */}
      {showApproveApp && selectedApp && (
        <Modal
          title="Approve Monetization Application"
          onClose={() => {
            setShowApproveApp(false);
            setSelectedApp(null);
          }}
        >
          <div className="space-y-4">
            <p className="text-sm text-ink">
              Are you sure you want to approve monetization eligibility for{" "}
              <strong>{selectedApp.name}</strong> (@{selectedApp.user?.channelName})?
            </p>
            <div className="rounded-xl border border-line bg-surface/50 p-4 space-y-2 text-xs">
              <div>
                <strong>Aadhaar:</strong> {selectedApp.adharNumber || "Not Provided"}
              </div>
              <div>
                <strong>UPI ID:</strong> {selectedApp.upiId || "Not Provided"}
              </div>
              <div>
                <strong>Bank:</strong> {selectedApp.bankDetails?.bankName} ({selectedApp.bankDetails?.accountNumber})
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowApproveApp(false);
                  setSelectedApp(null);
                }}
                className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveAppSubmit}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-emerald-700"
              >
                Confirm Approval
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Application Modal */}
      {showRejectApp && selectedApp && (
        <Modal
          title="Reject Monetization Application"
          onClose={() => {
            setShowRejectApp(false);
            setSelectedApp(null);
          }}
        >
          <form onSubmit={handleRejectAppSubmit} className="space-y-4">
            <p className="text-sm text-ink">
              Rejecting application for <strong>{selectedApp.name}</strong>. Provide a reason so the creator knows why:
            </p>
            <textarea
              required
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Aadhaar details mismatched or unclear KYC documents"
              className="w-full rounded-xl border border-line p-3 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectApp(false);
                  setSelectedApp(null);
                }}
                className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-red-700"
              >
                Reject Application
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Pass Video Modal */}
      {showPassVideo && selectedVideoReview && (
        <Modal
          title="Pass Video for Monetization"
          onClose={() => {
            setShowPassVideo(false);
            setSelectedVideoReview(null);
          }}
        >
          <div className="space-y-4">
            <p className="text-sm text-ink">
              Pass video <strong>"{selectedVideoReview.video?.title}"</strong> for monetization? This confirms it is original, advertiser-friendly, and complies with community guidelines.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowPassVideo(false);
                  setSelectedVideoReview(null);
                }}
                className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleApproveVideoSubmit}
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-emerald-700"
              >
                Pass Video
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Reject Video Modal */}
      {showRejectVideo && selectedVideoReview && (
        <Modal
          title="Reject Video for Monetization"
          onClose={() => {
            setShowRejectVideo(false);
            setSelectedVideoReview(null);
          }}
        >
          <form onSubmit={handleRejectVideoSubmit} className="space-y-4">
            <p className="text-sm text-ink">
              Rejecting video <strong>"{selectedVideoReview.video?.title}"</strong>. Explain reason to the creator:
            </p>
            <textarea
              required
              rows={3}
              value={videoRejectReason}
              onChange={(e) => setVideoRejectReason(e.target.value)}
              placeholder="e.g. Copyright violation, reused content, or non-original material"
              className="w-full rounded-xl border border-line p-3 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectVideo(false);
                  setSelectedVideoReview(null);
                }}
                className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-red-700"
              >
                Reject Video
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Monetized Creator Full Details Modal */}
      {showMonetizedDetailsModal && selectedMonetizedUser && (
        <Modal
          title="Monetized Creator Details"
          maxWidth="max-w-xl"
          onClose={() => {
            setShowMonetizedDetailsModal(false);
            setSelectedMonetizedUser(null);
          }}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-xl border border-line bg-surface/40 p-4">
              <img
                src={resolveMediaUrl(selectedMonetizedUser.user?.avatar)}
                alt="avatar"
                className="h-16 w-16 rounded-full bg-white object-cover border-2 border-brand/20 shadow-sm"
                onError={(e) => {
                  e.currentTarget.src = "https://via.placeholder.com/80x80.png?text=User";
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-display font-bold text-ink text-lg truncate">{selectedMonetizedUser.name}</h3>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-800">
                    Monetized
                  </span>
                </div>
                <p className="text-xs text-brand font-semibold">@{selectedMonetizedUser.user?.channelName || "no-channel"}</p>
                <p className="text-xs text-muted mt-0.5">
                  Followers: {selectedMonetizedUser.user?.followersCount || 0} • Joined:{" "}
                  {new Date(selectedMonetizedUser.user?.createdAt || selectedMonetizedUser.createdAt).toLocaleDateString("en-IN")}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-line bg-white p-4 space-y-3">
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-xs font-semibold text-muted uppercase">Phone Number</span>
                <span className="text-sm font-semibold text-ink">{selectedMonetizedUser.phone || "-"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-xs font-semibold text-muted uppercase">Email Address</span>
                <span className="text-sm font-semibold text-ink">{selectedMonetizedUser.user?.email || "-"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-xs font-semibold text-muted uppercase">Aadhaar Card UID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-ink">{selectedMonetizedUser.adharNumber || "-"}</span>
                  <button
                    onClick={() => handleCopy(selectedMonetizedUser.adharNumber, "modal-adhar")}
                    className="rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand hover:bg-brand-100"
                  >
                    {copiedField === "modal-adhar" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-xs font-semibold text-muted uppercase">UPI ID</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-brand">{selectedMonetizedUser.upiId || "-"}</span>
                  <button
                    onClick={() => handleCopy(selectedMonetizedUser.upiId, "modal-upi")}
                    className="rounded bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand hover:bg-brand-100"
                  >
                    {copiedField === "modal-upi" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <div>
                <span className="text-xs font-semibold text-muted uppercase">Bank Account Details</span>
                <div className="mt-2 rounded-lg bg-surface/50 p-3 space-y-1.5 text-xs text-ink">
                  <div className="flex justify-between">
                    <span className="text-muted">Bank Name:</span>
                    <strong>{selectedMonetizedUser.bankDetails?.bankName || "-"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Account Number:</span>
                    <strong className="font-mono">{selectedMonetizedUser.bankDetails?.accountNumber || "-"}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">IFSC Code:</span>
                    <strong className="font-mono">{selectedMonetizedUser.bankDetails?.ifscCode || "-"}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowMonetizedDetailsModal(false);
                  setSelectedMonetizedUser(null);
                }}
                className="rounded-full bg-surface px-5 py-2 text-sm font-semibold text-ink hover:bg-line"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Monetization;
