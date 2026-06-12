import { useEffect, useState } from "react";
import { API_URL } from "../config";

const Reports = () => {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const API = API_URL;

  const fetchReports = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + "/api/admin/reports/videos" + (status ? `?status=${status}` : ""), {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

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
      open: "bg-amber-50 text-amber-600",
      reviewed: "bg-sky-50 text-sky-600",
      dismissed: "bg-surface text-muted",
      actioned: "bg-emerald-50 text-emerald-600",
    };
    return map[s] || "bg-surface text-muted";
  };

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-ink">Reported Videos</h2>
          <p className="mt-1 text-sm text-muted">Moderate content flagged by users</p>
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-lg border border-line bg-white p-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20">
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="reviewed">Reviewed</option>
          <option value="dismissed">Dismissed</option>
          <option value="actioned">Actioned</option>
        </select>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted shadow-card">Loading reports...</div>
      ) : (
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wider text-muted">
              <th className="p-4 font-semibold">Video</th>
              <th className="p-4 font-semibold">Reporter</th>
              <th className="p-4 font-semibold">Reason</th>
              <th className="p-4 font-semibold">Status</th>
              <th className="p-4 font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {reports.map((report) => (
              <tr key={report._id} className="border-t border-line align-top hover:bg-surface/50">
                <td className="p-4">
                  <div className="flex gap-3">
                    {report.video?.thumbnail && <img src={report.video.thumbnail} alt="" className="h-14 w-24 shrink-0 rounded-lg bg-surface object-cover" onError={(e)=>{e.currentTarget.style.visibility='hidden';}} />}
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-ink">{report.video?.title || "Deleted video"}</div>
                      <div className="truncate text-xs text-muted">{report.video?.owner?.channelName || report.video?.owner?.name || "-"}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-muted">{report.reporter?.channelName || report.reporter?.name || "-"}</td>
                <td className="p-4 max-w-xs text-muted">{report.reason}</td>
                <td className="p-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${statusBadge(report.status)}`}>{report.status}</span>
                </td>
                <td className="p-4">
                  <div className="flex flex-wrap gap-2">
                    {["reviewed", "dismissed", "actioned"].map((next) => (
                      <button key={next} onClick={() => updateStatus(report._id, next)} className="rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-semibold capitalize text-brand hover:bg-brand-100">
                        {next}
                      </button>
                    ))}
                    {report.video?.videoUrl && (
                      <a href={report.video.videoUrl} target="_blank" rel="noreferrer" className="rounded-lg bg-surface px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-line">
                        Open
                      </a>
                    )}
                    {report.video?._id && (
                      <button onClick={() => deleteVideo(report.video._id)} className="rounded-lg bg-red-100 px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200">
                        Delete Video
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td className="p-8 text-center text-muted" colSpan="5">No reports found</td>
              </tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      )}
    </div>
  );
};

export default Reports;
