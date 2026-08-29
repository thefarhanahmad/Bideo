import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import { API_URL } from "../config";

const resolveMediaUrl = (url) => {
  if (!url) return "https://via.placeholder.com/640x360.png?text=No+Thumbnail";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const Monetization = () => {
  const [activeTab, setActiveTab] = useState("videos");
  const [applications, setApplications] = useState([]);
  const [videoReviews, setVideoReviews] = useState([]);
  const [monetizedUsers, setMonetizedUsers] = useState([]);
  const [monetizedSearch, setMonetizedSearch] = useState("");
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

  const API = API_URL;

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");

      const [appsRes, vidsRes, monetizedRes] = await Promise.all([
        fetch(API + "/api/admin/monetization-applications?status=pending", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(API + "/api/admin/videos/pending-reviews", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(API + "/api/admin/monetization-applications?status=approved", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const appsData = await appsRes.json();
      const vidsData = await vidsRes.json();
      const monetizedData = await monetizedRes.json();

      if (!appsRes.ok) throw new Error(appsData.message || "Failed to load applications");
      if (!vidsRes.ok) throw new Error(vidsData.message || "Failed to load video reviews");
      if (!monetizedRes.ok) throw new Error(monetizedData.message || "Failed to load monetized creators");

      setApplications(appsData.data || []);
      setVideoReviews(vidsData.data || []);
      setMonetizedUsers(monetizedData.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: "approved" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Approval failed");

      setShowApproveApp(false);
      setSelectedApp(null);
      await fetchData();
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: "rejected",
          reviewMessage: rejectReason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Rejection failed");

      setShowRejectApp(false);
      setSelectedApp(null);
      setRejectReason("");
      await fetchData();
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: "passed" })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Video audit approval failed");

      setShowPassVideo(false);
      setSelectedVideoReview(null);
      await fetchData();
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
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          status: "failed",
          reviewMessage: videoRejectReason
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Video audit failure failed");

      setShowRejectVideo(false);
      setSelectedVideoReview(null);
      setVideoRejectReason("");
      await fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const filteredMonetizedUsers = monetizedUsers.filter((u) => {
    if (!monetizedSearch.trim()) return true;
    const q = monetizedSearch.toLowerCase();
    const name = (u.name || "").toLowerCase();
    const channel = (u.user?.channelName || "").toLowerCase();
    const email = (u.user?.email || "").toLowerCase();
    const phone = (u.phone || u.user?.phone || "").toLowerCase();
    const upi = (u.upiId || "").toLowerCase();
    const adhar = (u.adharNumber || "").toLowerCase();
    const bank = (u.bankDetails?.bankName || "").toLowerCase();
    const acc = (u.bankDetails?.accountNumber || "").toLowerCase();
    const ifsc = (u.bankDetails?.ifscCode || "").toLowerCase();

    return (
      name.includes(q) ||
      channel.includes(q) ||
      email.includes(q) ||
      phone.includes(q) ||
      upi.includes(q) ||
      adhar.includes(q) ||
      bank.includes(q) ||
      acc.includes(q) ||
      ifsc.includes(q)
    );
  });

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-ink">Monetization Audits</h2>
          <p className="mt-1 text-sm text-muted">Review creator onboarding applications, video approvals, and monetized users.</p>
        </div>
        
        {/* 3 Main Tabs in Single Row */}
        <div className="flex flex-nowrap overflow-x-auto rounded-xl bg-surface p-1 border border-line gap-1 shrink-0">
          <button
            onClick={() => setActiveTab("videos")}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "videos" ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            Video Audits ({loading ? "..." : videoReviews.reduce((sum, g) => sum + g.reviews.length, 0)})
          </button>
          <button
            onClick={() => setActiveTab("applications")}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "applications" ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            Monetization Apps ({loading ? "..." : applications.length})
          </button>
          <button
            onClick={() => setActiveTab("monetized")}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "monetized" ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            Monetized Users ({loading ? "..." : monetizedUsers.length})
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted shadow-card">
          Loading monetization data...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : (
        <>
          {activeTab === "videos" && (
            <div className="space-y-6">
              {videoReviews.map((group) => (
                <div key={group.user._id} className="overflow-hidden rounded-2xl border border-line bg-white shadow-card p-5">
                  {/* Creator Header */}
                  <div className="flex items-center gap-3 border-b border-line pb-4 mb-4">
                    <img
                      src={group.user?.avatar}
                      alt="avatar"
                      className="h-10 w-10 rounded-full bg-surface object-cover border border-line"
                      onError={(e) => {
                        e.currentTarget.src = "https://via.placeholder.com/80x80.png?text=User";
                      }}
                    />
                    <div>
                      <h4 className="font-display font-bold text-ink text-base">{group.user?.name}</h4>
                      <p className="text-xs text-muted">
                        @{group.user?.channelName || "No channel"} • {group.user?.phone || "No phone"} • {group.user?.email || "No email"}
                      </p>
                    </div>
                    <div className="ml-auto bg-brand-50 text-brand px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider">
                      {group.reviews.length} Pending
                    </div>
                  </div>

                  {/* Inner Video List (Compact vertical rows) */}
                  <div className="space-y-3">
                    {group.reviews.map((rev) => (
                      <div key={rev._id} className="flex flex-col sm:flex-row sm:items-center gap-4 rounded-xl border border-line bg-surface/30 p-3 hover:bg-surface/50 transition-colors">
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
                                <span className={`inline-block rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${
                                  rev.video.isShort ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-800"
                                }`}>
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
                                className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200 transition-colors"
                              >
                                Fail
                              </button>
                            </div>
                          </>
                        ) : (
                          <div className="text-red-500 font-semibold text-xs p-2">Video Deleted</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {videoReviews.length === 0 && (
                <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted shadow-card">
                  No pending video audits.
                </div>
              )}
            </div>
          )}

          {activeTab === "applications" && (
            <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wider text-muted">
                      <th className="p-4 font-semibold">Creator</th>
                      <th className="p-4 font-semibold">Contact</th>
                      <th className="p-4 font-semibold">Aadhaar Card</th>
                      <th className="p-4 font-semibold">UPI ID</th>
                      <th className="p-4 font-semibold">Bank details</th>
                      <th className="p-4 text-right font-semibold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => (
                      <tr key={app._id} className="border-t border-line align-top hover:bg-surface/50">
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <img
                              src={app.user?.avatar}
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
                        <td className="p-4 text-muted whitespace-nowrap">
                          <div>{app.phone}</div>
                          <div className="text-xs">{app.user?.email}</div>
                        </td>
                        <td className="p-4 font-mono text-ink whitespace-nowrap">{app.adharNumber}</td>
                        <td className="p-4 font-mono text-brand whitespace-nowrap">{app.upiId}</td>
                        <td className="p-4 text-xs text-muted">
                          <div className="font-semibold text-ink">{app.bankDetails?.bankName}</div>
                          <div>A/C: {app.bankDetails?.accountNumber}</div>
                          <div>IFSC: {app.bankDetails?.ifscCode}</div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex justify-end gap-2 whitespace-nowrap">
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
                                setShowRejectApp(true);
                              }}
                              className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200 transition-colors"
                            >
                              Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {applications.length === 0 && (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-muted">
                          No pending monetization applications.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "monetized" && (
            <div className="space-y-4">
              {/* Search filter bar */}
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  value={monetizedSearch}
                  onChange={(e) => setMonetizedSearch(e.target.value)}
                  placeholder="Search monetized creators by name, phone, channel, UPI, Aadhaar, Bank..."
                  className="w-full max-w-md rounded-xl border border-line bg-white px-4 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand shadow-sm"
                />
                <span className="text-xs text-muted font-medium">
                  Showing {filteredMonetizedUsers.length} of {monetizedUsers.length} monetized creators
                </span>
              </div>

              {/* Monetized Creators Table */}
              <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
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
                      {filteredMonetizedUsers.map((app) => (
                        <tr key={app._id} className="border-t border-line align-top hover:bg-surface/50">
                          <td className="p-4">
                            <div className="flex items-center gap-3">
                              <img
                                src={app.user?.avatar}
                                alt="avatar"
                                className="h-10 w-10 shrink-0 rounded-full bg-surface object-cover border border-line"
                                onError={(e) => {
                                  e.currentTarget.src = "https://via.placeholder.com/80x80.png?text=User";
                                }}
                              />
                              <div>
                                <div className="font-semibold text-ink flex items-center gap-1.5">
                                  <span>{app.name}</span>
                                  <span className="inline-block rounded-full bg-emerald-100 p-0.5 text-[10px] text-emerald-700" title="Monetized Creator">
                                    ✓
                                  </span>
                                </div>
                                <div className="text-xs text-muted">@{app.user?.channelName || app.user?.name}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-4 text-muted whitespace-nowrap">
                            <div>{app.phone}</div>
                            <div className="text-xs">{app.user?.email}</div>
                          </td>
                          <td className="p-4 font-mono text-ink whitespace-nowrap">{app.adharNumber}</td>
                          <td className="p-4 font-mono text-brand whitespace-nowrap">{app.upiId}</td>
                          <td className="p-4 text-xs text-muted">
                            <div className="font-semibold text-ink">{app.bankDetails?.bankName}</div>
                            <div>A/C: {app.bankDetails?.accountNumber}</div>
                            <div>IFSC: {app.bankDetails?.ifscCode}</div>
                          </td>
                          <td className="p-4 text-muted whitespace-nowrap">{formatDate(app.updatedAt || app.createdAt)}</td>
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
                      {filteredMonetizedUsers.length === 0 && (
                        <tr>
                          <td colSpan="7" className="p-8 text-center text-muted">
                            No monetized creators found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
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
                src={selectedMonetizedUser.user?.avatar}
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
                  Followers: {selectedMonetizedUser.user?.followersCount || 0} • Joined: {new Date(selectedMonetizedUser.user?.createdAt || selectedMonetizedUser.createdAt).toLocaleDateString("en-IN")}
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
                    className="rounded bg-surface px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10 transition-colors"
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
                    className="rounded bg-surface px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10 transition-colors"
                  >
                    {copiedField === "modal-upi" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-xs font-semibold text-muted uppercase">Bank Name</span>
                <span className="text-sm font-semibold text-ink">{selectedMonetizedUser.bankDetails?.bankName || "-"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-line pb-2">
                <span className="text-xs font-semibold text-muted uppercase">Bank Account No.</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-ink">{selectedMonetizedUser.bankDetails?.accountNumber || "-"}</span>
                  <button
                    onClick={() => handleCopy(selectedMonetizedUser.bankDetails?.accountNumber, "modal-acc")}
                    className="rounded bg-surface px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10 transition-colors"
                  >
                    {copiedField === "modal-acc" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted uppercase">IFSC Code</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-bold text-ink">{selectedMonetizedUser.bankDetails?.ifscCode || "-"}</span>
                  <button
                    onClick={() => handleCopy(selectedMonetizedUser.bankDetails?.ifscCode, "modal-ifsc")}
                    className="rounded bg-surface px-2 py-1 text-[11px] font-semibold text-brand hover:bg-brand/10 transition-colors"
                  >
                    {copiedField === "modal-ifsc" ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => {
                  setShowMonetizedDetailsModal(false);
                  setSelectedMonetizedUser(null);
                }}
                className="rounded-full bg-brand px-6 py-2 text-sm font-semibold text-white hover:bg-brand/90 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Approve Application Confirmation Modal */}
      {showApproveApp && selectedApp && (
        <Modal title="Approve Monetization" onClose={() => { setShowApproveApp(false); setSelectedApp(null); }}>
          <p className="text-sm text-muted mb-5">
            Are you sure you want to <strong>APPROVE</strong> the monetization application for <strong>{selectedApp.name}</strong>? This will instantly unlock their earnings metrics.
          </p>
          <div className="flex justify-end gap-2">
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
              onClick={handleApproveAppSubmit}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Approve Application
            </button>
          </div>
        </Modal>
      )}

      {/* Pass Video Audit Confirmation Modal */}
      {showPassVideo && selectedVideoReview && (
        <Modal title="Pass Video Audit" onClose={() => { setShowPassVideo(false); setSelectedVideoReview(null); }}>
          <p className="text-sm text-muted mb-5">
            Are you sure you want to mark <strong>"{selectedVideoReview.video?.title}"</strong> as a passed original video? It will count toward the creator's monetization eligibility requirement.
          </p>
          <div className="flex justify-end gap-2">
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
              onClick={handleApproveVideoSubmit}
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Pass Video Audit
            </button>
          </div>
        </Modal>
      )}

      {/* Reject Application Modal */}
      {showRejectApp && selectedApp && (
        <Modal title="Reject Monetization Application" onClose={() => { setShowRejectApp(false); setSelectedApp(null); setRejectReason(""); }}>
          <form onSubmit={handleRejectAppSubmit}>
            <p className="text-sm text-muted mb-3">Provide a clear reason for the rejection (visible to the user):</p>
            <textarea
              required
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="e.g. Aadhaar details do not match the account holder's name."
              className="w-full rounded-lg border border-line p-3 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none h-24 resize-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectApp(false);
                  setSelectedApp(null);
                  setRejectReason("");
                }}
                className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Reject Application
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Fail Video Audit Modal */}
      {showRejectVideo && selectedVideoReview && (
        <Modal title="Fail Video Auditing" onClose={() => { setShowRejectVideo(false); setSelectedVideoReview(null); setVideoRejectReason(""); }}>
          <form onSubmit={handleRejectVideoSubmit}>
            <p className="text-sm text-muted mb-3">Provide a reason why this video failed monetization verification:</p>
            <textarea
              required
              value={videoRejectReason}
              onChange={(e) => setVideoRejectReason(e.target.value)}
              placeholder="e.g. Video is not original content (copyrighted clip)."
              className="w-full rounded-lg border border-line p-3 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none h-24 resize-none mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectVideo(false);
                  setSelectedVideoReview(null);
                  setVideoRejectReason("");
                }}
                className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                Fail Review
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Monetization;
