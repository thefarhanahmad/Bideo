import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import { API_URL } from "../config";

const Monetization = () => {
  const [activeTab, setActiveTab] = useState("videos");
  const [applications, setApplications] = useState([]);
  const [videoReviews, setVideoReviews] = useState([]);
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

  const API = API_URL;

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      
      const [appsRes, vidsRes] = await Promise.all([
        fetch(API + "/api/admin/monetization-applications?status=pending", {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(API + "/api/admin/videos/pending-reviews", {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const appsData = await appsRes.json();
      const vidsData = await vidsRes.json();

      if (!appsRes.ok) throw new Error(appsData.message || "Failed to load applications");
      if (!vidsRes.ok) throw new Error(vidsData.message || "Failed to load video reviews");

      setApplications(appsData.data || []);
      setVideoReviews(vidsData.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

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
      if (!res.ok) throw new Error(data.message || "Failed to approve");
      setShowApproveApp(false);
      setSelectedApp(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRejectAppSubmit = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) return alert("Please provide a reason for rejection");
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + `/api/admin/users/${selectedApp.user._id}/review-monetization`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: "rejected", reviewMessage: rejectReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject");
      setShowRejectApp(false);
      setSelectedApp(null);
      setRejectReason("");
      fetchData();
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
      if (!res.ok) throw new Error(data.message || "Failed to pass video");
      setShowPassVideo(false);
      setSelectedVideoReview(null);
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleRejectVideoSubmit = async (e) => {
    e.preventDefault();
    if (!videoRejectReason.trim()) return alert("Please provide a reason for failing review");
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + `/api/admin/videos/${selectedVideoReview._id}/review`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status: "failed", reviewMessage: videoRejectReason })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject video");
      setShowRejectVideo(false);
      setSelectedVideoReview(null);
      setVideoRejectReason("");
      fetchData();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-ink">Monetization Audits</h2>
          <p className="mt-1 text-sm text-muted">Review creator onboarding applications and video approvals.</p>
        </div>
        
        {/* Tabs */}
        <div className="flex rounded-xl bg-surface p-1 border border-line">
          <button
            onClick={() => setActiveTab("videos")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "videos" ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            Video Verification Audits ({loading ? "..." : videoReviews.reduce((sum, g) => sum + g.reviews.length, 0)})
          </button>
          <button
            onClick={() => setActiveTab("applications")}
            className={`rounded-lg px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeTab === "applications" ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            Monetization Applications ({loading ? "..." : applications.length})
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
          {activeTab === "videos" ? (
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
                                src={rev.video.thumbnail}
                                alt="thumb"
                                className="w-full h-full object-cover"
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
          ) : (
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
                              className="h-10 w-10 shrink-0 rounded-full bg-surface object-cover"
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
                        <td className="p-4 font-mono font-semibold text-ink">{app.adharNumber}</td>
                        <td className="p-4 font-semibold text-brand">{app.upiId}</td>
                        <td className="p-4 text-muted">
                          <div className="font-semibold text-ink">{app.bankDetails?.bankName}</div>
                          <div className="text-xs">Acc: {app.bankDetails?.accountNumber}</div>
                          <div className="text-xs font-mono">IFSC: {app.bankDetails?.ifscCode}</div>
                        </td>
                        <td className="p-4">
                          <div className="flex justify-end gap-2 whitespace-nowrap">
                            <button
                              onClick={() => {
                                setSelectedApp(app);
                                setShowApproveApp(true);
                              }}
                              className="rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-200"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => {
                                setSelectedApp(app);
                                setShowRejectApp(true);
                              }}
                              className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200"
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
                          No pending applications.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
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
