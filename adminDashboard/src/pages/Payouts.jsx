import { useEffect, useState, useMemo, useCallback } from "react";
import Modal from "../components/Modal";
import DataTableToolbar from "../components/DataTableToolbar";
import Pagination from "../components/Pagination";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useTableParams } from "../hooks/useTableParams";
import { API_URL } from "../config";

const resolveMediaUrl = (url) => {
  if (!url) return "https://via.placeholder.com/80x80.png?text=User";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const Payouts = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterCounts, setFilterCounts] = useState({ all: 0, pending: 0, approved: 0, rejected: 0 });
  const [totalPendingAmount, setTotalPendingAmount] = useState(0);
  const [totalPaidAmount, setTotalPaidAmount] = useState(0);

  // Modal states
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  // URL-synced search, filter, and pagination
  const { search, setSearch, filter, setFilter, page, setPage, limit, setLimit } =
    useTableParams({ defaultFilter: "all", defaultLimit: 10 });

  const API = API_URL;

  const fetchWithdrawals = useCallback(
    async (currentPage = page, currentLimit = limit, currentFilter = filter, currentSearch = search) => {
      setLoading(true);
      setError(null);
      try {
        const token = localStorage.getItem("admin_token");
        const params = new URLSearchParams({
          page: currentPage,
          limit: currentLimit,
        });
        if (currentFilter && currentFilter !== "all") params.append("status", currentFilter);
        if (currentSearch && currentSearch.trim()) params.append("search", currentSearch.trim());

        const res = await fetch(`${API}/api/admin/withdrawals?${params.toString()}`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to fetch payouts");
        setWithdrawals(data.data || []);
        setTotalItems(data.total || 0);
        setTotalPages(data.pages || 1);
        if (data.filterCounts) setFilterCounts(data.filterCounts);
        if (data.meta) {
          setTotalPendingAmount(data.meta.totalPendingAmount || 0);
          setTotalPaidAmount(data.meta.totalPaidAmount || 0);
        }
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    },
    [API, page, limit, filter, search]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWithdrawals(page, limit, filter, search);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchWithdrawals, page, limit, filter, search]);

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

  const handleCopy = (text, fieldKey) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(fieldKey);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleApprove = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + `/api/admin/withdrawals/${selectedWithdrawal._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "approve",
          transactionId: transactionId || "PAID-" + Date.now(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Approval failed");

      setShowApproveModal(false);
      setSelectedWithdrawal(null);
      setTransactionId("");
      await fetchWithdrawals(page, limit, filter, search);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (e) => {
    e.preventDefault();
    setProcessing(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + `/api/admin/withdrawals/${selectedWithdrawal._id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          action: "reject",
          adminNote: rejectReason,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Rejection failed");

      setShowRejectModal(false);
      setSelectedWithdrawal(null);
      setRejectReason("");
      await fetchWithdrawals(page, limit, filter, search);
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const filterOptions = [
    { label: "All Requests", value: "all", count: filterCounts.all },
    { label: "Pending", value: "pending", count: filterCounts.pending },
    { label: "Paid / Approved", value: "approved", count: filterCounts.approved },
    { label: "Rejected", value: "rejected", count: filterCounts.rejected },
  ];

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center min-w-0">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">Creator Payouts</h2>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted">
            Manage creator wallet withdrawal requests, process direct UPI / Bank transfers, and verify payout records.
          </p>
        </div>

        {/* Quick Summary Badges */}
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <div className="rounded-xl border border-line bg-white px-4 py-2 shadow-sm min-w-[140px]">
            <span className="text-[10px] font-semibold uppercase text-muted">Pending Payouts</span>
            <div className="font-display text-base sm:text-lg font-extrabold text-amber-600">
              ₹{totalPendingAmount.toLocaleString("en-IN")} ({filterCounts.pending})
            </div>
          </div>
          <div className="rounded-xl border border-line bg-white px-4 py-2 shadow-sm min-w-[140px]">
            <span className="text-[10px] font-semibold uppercase text-muted">Total Paid</span>
            <div className="font-display text-base sm:text-lg font-extrabold text-emerald-600">
              ₹{totalPaidAmount.toLocaleString("en-IN")} ({filterCounts.approved})
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, phone, UPI, bank, UTR..."
        filter={filter}
        onFilterChange={setFilter}
        filters={filterOptions}
        totalCount={filterCounts.all || totalItems}
        filteredCount={totalItems}
      />

      {loading ? (
        <LoadingSkeleton type="table" rows={6} cols={6} />
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="p-4 font-semibold">Creator</th>
                  <th className="p-4 font-semibold">Amount</th>
                  <th className="p-4 font-semibold">Payout Destination</th>
                  <th className="p-4 font-semibold">Requested At</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {withdrawals.map((w) => (
                  <tr key={w._id} className="border-t border-line align-top hover:bg-surface/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={resolveMediaUrl(w.user?.avatar)}
                          alt="avatar"
                          className="h-10 w-10 shrink-0 rounded-full bg-surface object-cover border border-line"
                          onError={(e) => {
                            e.currentTarget.src = "https://via.placeholder.com/80x80.png?text=User";
                          }}
                        />
                        <div className="min-w-0">
                          <div className="font-bold text-ink text-sm truncate">{w.payoutDetails?.holderName || w.user?.name}</div>
                          <div className="text-xs text-muted truncate">
                            @{w.user?.channelName || "channel"} • {w.user?.phone || w.user?.email || "No contact"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <div className="font-extrabold text-ink text-base">
                        ₹{Number(w.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                      <div className="text-[11px] text-muted">
                        Remaining: ₹{Number(w.user?.walletBalance || 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                      </div>
                    </td>

                    <td className="p-4 text-xs">
                      {w.payoutMethod === "upi" ? (
                        <div className="rounded-lg border border-line bg-surface/40 p-2.5">
                          <span className="font-semibold text-brand">⚡ UPI Destination:</span>
                          <div className="font-mono text-ink mt-1 flex items-center justify-between gap-2">
                            <span className="font-bold text-xs">{w.payoutDetails?.upiId}</span>
                            <button
                              onClick={() => handleCopy(w.payoutDetails?.upiId, `upi-${w._id}`)}
                              className="rounded bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand hover:bg-brand/20 transition-colors"
                            >
                              {copiedField === `upi-${w._id}` ? "Copied!" : "Copy UPI"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-line bg-surface/40 p-2.5 space-y-1">
                          <div className="font-semibold text-sky-700 flex items-center justify-between">
                            <span>🏦 {w.payoutDetails?.bankName || "Bank Transfer"}</span>
                            <span className="text-[10px] text-muted font-normal">A/C Holder: {w.payoutDetails?.holderName}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 font-mono">
                            <span>A/C: <strong>{w.payoutDetails?.accountNumber}</strong></span>
                            <button
                              onClick={() => handleCopy(w.payoutDetails?.accountNumber, `acc-${w._id}`)}
                              className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 hover:bg-sky-200"
                            >
                              {copiedField === `acc-${w._id}` ? "Copied!" : "Copy A/C"}
                            </button>
                          </div>
                          <div className="flex items-center justify-between gap-2 font-mono text-[11px] text-muted">
                            <span>IFSC: {w.payoutDetails?.ifscCode}</span>
                            <button
                              onClick={() => handleCopy(w.payoutDetails?.ifscCode, `ifsc-${w._id}`)}
                              className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] font-bold text-gray-800 hover:bg-gray-300"
                            >
                              {copiedField === `ifsc-${w._id}` ? "Copied!" : "Copy IFSC"}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="p-4 text-muted whitespace-nowrap text-xs">
                      {formatDate(w.createdAt)}
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      {w.status === "approved" ? (
                        <div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-bold text-emerald-700 border border-emerald-200">
                            ✓ Paid / Approved
                          </span>
                          {w.transactionId && (
                            <div className="font-mono text-[11px] text-muted mt-1">
                              Txn: {w.transactionId}
                            </div>
                          )}
                        </div>
                      ) : w.status === "rejected" ? (
                        <div>
                          <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-700 border border-red-200">
                            ✕ Rejected & Refunded
                          </span>
                          {w.adminNote && (
                            <div className="text-[11px] text-red-600 mt-1 max-w-xs">
                              "{w.adminNote}"
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-bold text-amber-700 border border-amber-200">
                          ⏳ Pending Approval
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="flex justify-end gap-1.5 whitespace-nowrap">
                        {w.status === "pending" ? (
                          <>
                            <button
                              onClick={() => {
                                setSelectedWithdrawal(w);
                                setTransactionId("");
                                setShowApproveModal(true);
                              }}
                              className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm transition-colors"
                            >
                              Mark as Paid
                            </button>
                            <button
                              onClick={() => {
                                setSelectedWithdrawal(w);
                                setRejectReason("");
                                setShowRejectModal(true);
                              }}
                              className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors"
                            >
                              Reject & Refund
                            </button>
                          </>
                        ) : (
                          <span className="text-xs text-muted font-medium">Completed</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {withdrawals.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-muted">
                      No payout requests found.
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

      {/* Approve Modal */}
      {showApproveModal && selectedWithdrawal && (
        <Modal
          title="Confirm Payout Transfer"
          onClose={() => {
            setShowApproveModal(false);
            setSelectedWithdrawal(null);
          }}
        >
          <form onSubmit={handleApprove} className="space-y-4">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3.5 text-xs text-emerald-900">
              <p className="font-semibold text-sm text-emerald-800">
                Confirm ₹{Number(selectedWithdrawal.amount).toLocaleString("en-IN")} Payout to {selectedWithdrawal.payoutDetails?.holderName || selectedWithdrawal.user?.name}
              </p>
              <p className="mt-1">
                Please transfer the funds to the creator's {selectedWithdrawal.payoutMethod.toUpperCase()} destination, then enter the Bank UTR / Transaction Reference ID below.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                Bank UTR / Transaction ID (Optional)
              </label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g. UTR1234567890 / IMPS / UPI Ref"
                className="mt-1.5 w-full rounded-xl border border-line p-2.5 text-sm text-ink outline-none focus:border-brand"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedWithdrawal(null);
                }}
                className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {processing ? "Saving..." : "Confirm Paid"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedWithdrawal && (
        <Modal
          title="Reject Withdrawal Request"
          onClose={() => {
            setShowRejectModal(false);
            setSelectedWithdrawal(null);
          }}
        >
          <form onSubmit={handleReject} className="space-y-4">
            <div className="rounded-xl border border-red-200 bg-red-50 p-3.5 text-xs text-red-900">
              <p className="font-semibold text-sm text-red-800">
                Reject & Refund ₹{Number(selectedWithdrawal.amount).toLocaleString("en-IN")}
              </p>
              <p className="mt-1">
                The requested amount will automatically be refunded back to the creator's wallet balance.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase tracking-wider">
                Reason for Rejection
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Incorrect UPI ID / Invalid Bank IFSC Code / KYC mismatch"
                rows={3}
                required
                className="mt-1.5 w-full rounded-xl border border-line p-2.5 text-sm text-ink outline-none focus:border-brand"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedWithdrawal(null);
                }}
                className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className="rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              >
                {processing ? "Rejecting..." : "Confirm Reject & Refund"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Payouts;
