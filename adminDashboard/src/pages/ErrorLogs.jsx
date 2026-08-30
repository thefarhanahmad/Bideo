import { useEffect, useState, useMemo } from "react";
import DataTableToolbar from "../components/DataTableToolbar";
import Pagination from "../components/Pagination";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useTableParams } from "../hooks/useTableParams";
import { API_URL } from "../config";
import { AlertOctagonIcon, TerminalIcon } from "../components/Icons";

const formatDateTime = (dateStr) => {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
};

const ErrorLogs = () => {
  const [logs, setLogs] = useState([]);
  const [counts, setCounts] = useState({ unresolved: 0, resolved: 0, all: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Selected Log for Inspector Modal
  const [selectedLog, setSelectedLog] = useState(null);
  const [adminNote, setAdminNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [copiedStack, setCopiedStack] = useState(false);

  // Confirm delete or clear modals
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  // Table pagination and filters
  const { search, setSearch, filter, setFilter, page, setPage, limit, setLimit } =
    useTableParams({ defaultFilter: "unresolved", defaultLimit: 15 });

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      const url = new URL(API_URL + "/api/admin/error-logs");
      url.searchParams.set("status", filter);
      url.searchParams.set("page", page);
      url.searchParams.set("limit", limit);
      if (search) url.searchParams.set("search", search);

      const res = await fetch(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load error logs");
      setLogs(data.data || []);
      if (data.counts) setCounts(data.counts);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, [filter, page, limit, search]);

  const handleOpenInspector = (log) => {
    setSelectedLog(log);
    setAdminNote(log.adminNote || "");
    setCopiedStack(false);
  };

  const handleToggleStatus = async (log, targetStatus) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/admin/error-logs/${log._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: targetStatus,
          adminNote: adminNote,
        }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to update log");

      if (selectedLog && selectedLog._id === log._id) {
        setSelectedLog(data.data);
      }
      fetchLogs();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveNote = async () => {
    if (!selectedLog) return;
    setSavingNote(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/admin/error-logs/${selectedLog._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ adminNote }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to save note");
      setSelectedLog(data.data);
      fetchLogs();
    } catch (err) {
      alert(err.message);
    }
    setSavingNote(false);
  };

  const handleDeleteLog = async () => {
    if (!deleteTarget) return;
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/admin/error-logs/${deleteTarget._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete log");
      setDeleteTarget(null);
      if (selectedLog && selectedLog._id === deleteTarget._id) {
        setSelectedLog(null);
      }
      fetchLogs();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleClearResolved = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/admin/error-logs/clear-resolved`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to clear resolved logs");
      setShowClearConfirm(false);
      fetchLogs();
    } catch (err) {
      alert(err.message);
    }
  };

  const copyStackToClipboard = () => {
    if (!selectedLog?.stack) return;
    navigator.clipboard.writeText(selectedLog.stack);
    setCopiedStack(true);
    setTimeout(() => setCopiedStack(false), 2500);
  };

  const filterOptions = [
    { label: "Unresolved", value: "unresolved", count: counts.unresolved },
    { label: "Resolved", value: "resolved", count: counts.resolved },
    { label: "All Logs", value: "all", count: counts.all },
  ];

  const totalPages = Math.max(1, Math.ceil((counts[filter] || logs.length) / limit));

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">
              Server Error Logs
            </h2>
            {counts.unresolved > 0 && (
              <span className="rounded-full bg-red-100 text-red-700 px-2.5 py-0.5 text-xs font-bold animate-pulse">
                {counts.unresolved} Unresolved
              </span>
            )}
          </div>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted">
            Track, inspect, and resolve backend server runtime exceptions and API errors.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {counts.resolved > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="rounded-xl border border-line bg-white px-3.5 py-2 text-xs sm:text-sm font-semibold text-muted hover:text-ink hover:border-ink transition-all shadow-xs"
            >
              Clear Resolved ({counts.resolved})
            </button>
          )}
          <button
            onClick={fetchLogs}
            className="rounded-xl bg-surface border border-line px-3.5 py-2 text-xs sm:text-sm font-semibold text-ink hover:bg-surface/80 transition-all shadow-xs"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search error message, endpoint (e.g. /api/videos)..."
        filter={filter}
        onFilterChange={setFilter}
        filters={filterOptions}
        totalCount={counts.all}
        filteredCount={counts[filter] || logs.length}
      />

      {loading ? (
        <LoadingSkeleton type="table" rows={8} cols={6} />
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : logs.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-12 text-center shadow-card">
          <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-600">
            ✓
          </div>
          <h3 className="font-display font-bold text-ink text-base">No errors found!</h3>
          <p className="text-xs sm:text-sm text-muted mt-1">
            {filter === "unresolved"
              ? "All server errors have been resolved or none have occurred."
              : "No logs match your filter criteria."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm text-left">
              <thead>
                <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-muted bg-surface/60">
                  <th className="p-4">Status & Code</th>
                  <th className="p-4">HTTP Method & Endpoint</th>
                  <th className="p-4">Error Message</th>
                  <th className="p-4">Occurrences</th>
                  <th className="p-4">Last Seen Date & Time</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {logs.map((log) => {
                  const is5xx = log.statusCode >= 500;
                  const isResolved = log.status === "resolved";

                  return (
                    <tr
                      key={log._id}
                      className={`align-middle hover:bg-surface/50 transition-colors ${
                        isResolved ? "opacity-60 bg-surface/30" : ""
                      }`}
                    >
                      {/* Status Code */}
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
                            is5xx
                              ? "bg-red-100 text-red-800 border border-red-200"
                              : "bg-amber-100 text-amber-900 border border-amber-200"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              is5xx ? "bg-red-600" : "bg-amber-600"
                            }`}
                          />
                          {log.statusCode || 500}
                        </span>
                      </td>

                      {/* Method & Endpoint */}
                      <td className="p-4 font-mono text-xs whitespace-nowrap">
                        <span
                          className={`mr-2 rounded px-1.5 py-0.5 font-bold ${
                            log.method === "POST"
                              ? "bg-blue-100 text-blue-800"
                              : log.method === "PUT"
                              ? "bg-purple-100 text-purple-800"
                              : log.method === "DELETE"
                              ? "bg-red-100 text-red-800"
                              : "bg-emerald-100 text-emerald-800"
                          }`}
                        >
                          {log.method || "GET"}
                        </span>
                        <span className="font-semibold text-ink">{log.endpoint || "—"}</span>
                      </td>

                      {/* Error Message */}
                      <td className="p-4 max-w-xs">
                        <div className="font-semibold text-ink text-xs line-clamp-2" title={log.message}>
                          {log.message}
                        </div>
                        {log.adminNote && (
                          <div className="mt-1 text-[11px] text-muted italic">
                            Note: {log.adminNote}
                          </div>
                        )}
                      </td>

                      {/* Occurrences Count */}
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                            log.count > 10
                              ? "bg-red-50 text-red-700 border border-red-200"
                              : log.count > 1
                              ? "bg-amber-50 text-amber-700 border border-amber-200"
                              : "bg-surface text-muted"
                          }`}
                        >
                          x{log.count || 1}
                        </span>
                      </td>

                      {/* Date & Time */}
                      <td className="p-4 text-xs text-muted whitespace-nowrap">
                        <div className="font-medium text-ink">{formatDateTime(log.lastSeenAt)}</div>
                        {log.count > 1 && log.firstSeenAt && (
                          <div className="text-[11px] text-muted mt-0.5">
                            First: {formatDateTime(log.firstSeenAt)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenInspector(log)}
                            className="rounded-lg bg-surface border border-line px-2.5 py-1.5 text-xs font-semibold text-ink hover:bg-surface/80 transition-all shadow-xs"
                          >
                            Inspect Log
                          </button>
                          <button
                            onClick={() =>
                              handleToggleStatus(
                                log,
                                isResolved ? "unresolved" : "resolved"
                              )
                            }
                            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all shadow-xs ${
                              isResolved
                                ? "bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {isResolved ? "Reopen" : "✓ Resolve"}
                          </button>
                          <button
                            onClick={() => setDeleteTarget(log)}
                            className="rounded-lg bg-red-50 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100 transition-all shadow-xs"
                            title="Delete this log"
                          >
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            limit={limit}
            onLimitChange={setLimit}
            totalItems={counts[filter] || logs.length}
          />
        </div>
      )}

      {/* Inspector Modal */}
      {selectedLog && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedLog(null)}
          title="Error Log Details & Stack Trace"
        >
          <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1">
            {/* Header info */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-surface/60 p-3.5 rounded-xl border border-line text-xs">
              <div>
                <span className="text-muted block text-[10px] uppercase font-semibold">Status Code</span>
                <span className="font-bold text-red-600 text-sm">{selectedLog.statusCode || 500}</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-semibold">Method</span>
                <span className="font-bold text-ink text-sm">{selectedLog.method || "GET"}</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-semibold">Occurrences</span>
                <span className="font-bold text-ink text-sm">x{selectedLog.count || 1}</span>
              </div>
              <div>
                <span className="text-muted block text-[10px] uppercase font-semibold">Status</span>
                <span
                  className={`inline-block font-bold text-xs capitalize ${
                    selectedLog.status === "resolved" ? "text-emerald-700" : "text-red-600"
                  }`}
                >
                  {selectedLog.status}
                </span>
              </div>
            </div>

            {/* Endpoint */}
            <div>
              <label className="text-xs font-bold text-ink block mb-1">API Endpoint</label>
              <div className="font-mono text-xs bg-surface p-2.5 rounded-lg border border-line break-all">
                {selectedLog.endpoint || "—"}
              </div>
            </div>

            {/* Message */}
            <div>
              <label className="text-xs font-bold text-ink block mb-1">Error Message</label>
              <div className="font-semibold text-xs text-red-700 bg-red-50 p-2.5 rounded-lg border border-red-100 break-words">
                {selectedLog.message}
              </div>
            </div>

            {/* Timestamps */}
            <div className="text-xs text-muted flex flex-wrap gap-4 border-t border-b border-line py-2.5">
              <div>
                <strong>First Recorded:</strong> {formatDateTime(selectedLog.firstSeenAt)}
              </div>
              <div>
                <strong>Last Recorded:</strong> {formatDateTime(selectedLog.lastSeenAt)}
              </div>
              {selectedLog.resolvedAt && (
                <div>
                  <strong>Resolved At:</strong> {formatDateTime(selectedLog.resolvedAt)}
                </div>
              )}
            </div>

            {/* Stack Trace Box */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-ink flex items-center gap-1.5">
                  <TerminalIcon className="h-4 w-4 text-muted" /> Server Stack Trace
                </label>
                {selectedLog.stack && (
                  <button
                    onClick={copyStackToClipboard}
                    className="text-xs font-semibold text-brand hover:underline"
                  >
                    {copiedStack ? "✓ Copied to clipboard!" : "Copy Stack"}
                  </button>
                )}
              </div>
              <pre className="bg-[#1e1e1e] text-[#d4d4d4] p-3.5 rounded-xl text-xs font-mono overflow-x-auto max-h-56 leading-relaxed select-all">
                {selectedLog.stack || "No stack trace recorded."}
              </pre>
            </div>

            {/* Admin Resolution Note */}
            <div>
              <label className="text-xs font-bold text-ink block mb-1">Admin Notes / Resolution Remarks</label>
              <textarea
                rows={2}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Add notes about why this error occurred or how it was resolved..."
                className="w-full rounded-xl border border-line bg-surface p-2.5 text-xs text-ink focus:border-brand focus:outline-none"
              />
              <div className="mt-1.5 flex justify-end">
                <button
                  type="button"
                  onClick={handleSaveNote}
                  disabled={savingNote}
                  className="rounded-lg bg-surface border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-surface/80 transition-all shadow-xs"
                >
                  {savingNote ? "Saving..." : "Save Note"}
                </button>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-between pt-3 border-t border-line">
              <button
                type="button"
                onClick={() => setDeleteTarget(selectedLog)}
                className="rounded-xl bg-red-50 text-red-600 px-3.5 py-2 text-xs font-bold hover:bg-red-100 transition-all"
              >
                Delete Log
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedLog(null)}
                  className="rounded-xl border border-line bg-white px-4 py-2 text-xs font-semibold text-muted hover:text-ink transition-all"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={() =>
                    handleToggleStatus(
                      selectedLog,
                      selectedLog.status === "resolved" ? "unresolved" : "resolved"
                    )
                  }
                  className={`rounded-xl px-4 py-2 text-xs font-bold text-white transition-all shadow-md ${
                    selectedLog.status === "resolved"
                      ? "bg-amber-600 hover:bg-amber-700"
                      : "bg-emerald-600 hover:bg-emerald-700"
                  }`}
                >
                  {selectedLog.status === "resolved" ? "Reopen Error" : "✓ Mark as Resolved"}
                </button>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <ConfirmModal
          isOpen={true}
          title="Delete Error Log"
          message={`Are you sure you want to permanently delete this error log (${deleteTarget.endpoint})?`}
          confirmText="Delete Log"
          tone="danger"
          onConfirm={handleDeleteLog}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

      {/* Clear Resolved Confirmation Modal */}
      {showClearConfirm && (
        <ConfirmModal
          isOpen={true}
          title="Clear All Resolved Logs"
          message={`Are you sure you want to delete all ${counts.resolved} resolved error logs? This will keep only active, unresolved errors.`}
          confirmText="Clear All Resolved"
          tone="danger"
          onConfirm={handleClearResolved}
          onCancel={() => setShowClearConfirm(false)}
        />
      )}
    </div>
  );
};

export default ErrorLogs;
