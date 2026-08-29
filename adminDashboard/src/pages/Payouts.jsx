import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import { API_URL } from "../config";

const Payouts = () => {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeStatus, setActiveStatus] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [selectedWithdrawal, setSelectedWithdrawal] = useState(null);
  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [transactionId, setTransactionId] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [processing, setProcessing] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  const API = API_URL;

  const fetchWithdrawals = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + "/api/admin/withdrawals", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch payouts");
      setWithdrawals(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchWithdrawals();
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
      await fetchWithdrawals();
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
      await fetchWithdrawals();
    } catch (err) {
      alert("Error: " + err.message);
    } finally {
      setProcessing(false);
    }
  };

  const filteredWithdrawals = withdrawals.filter((w) => {
    const matchesStatus = activeStatus === "all" ? true : w.status === activeStatus;
    if (!matchesStatus) return false;

    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = (w.payoutDetails?.holderName || w.user?.name || "").toLowerCase();
    const channel = (w.user?.channelName || "").toLowerCase();
    const phone = (w.user?.phone || "").toLowerCase();
    const upi = (w.payoutDetails?.upiId || "").toLowerCase();
    const bank = (w.payoutDetails?.bankName || "").toLowerCase();
    const acc = (w.payoutDetails?.accountNumber || "").toLowerCase();
    const ifsc = (w.payoutDetails?.ifscCode || "").toLowerCase();
    const txn = (w.transactionId || "").toLowerCase();

    return (
      name.includes(q) ||
      channel.includes(q) ||
      phone.includes(q) ||
      upi.includes(q) ||
      bank.includes(q) ||
      acc.includes(q) ||
      ifsc.includes(q) ||
      txn.includes(q)
    );
  });

  const pendingCount = withdrawals.filter((w) => w.status === "pending").length;
  const approvedCount = withdrawals.filter((w) => w.status === "approved").length;
  const rejectedCount = withdrawals.filter((w) => w.status === "rejected").length;

  const totalPaidAmount = withdrawals
    .filter((w) => w.status === "approved")
    .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

  const totalPendingAmount = withdrawals
    .filter((w) => w.status === "pending")
    .reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

  return (
    <div>
      <div className="mb-6 flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-ink">Creator Payouts</h2>
          <p className="mt-1 text-sm text-muted">
            Manage creator wallet withdrawal requests, process direct UPI / Bank transfers, and verify payout records.
          </p>
        </div>

        {/* Quick Summary Badges */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="rounded-xl border border-line bg-white px-4 py-2 shadow-sm">
            <span className="text-[11px] font-semibold uppercase text-muted">Pending Payouts</span>
            <div className="font-display text-lg font-extrabold text-amber-600">
              ₹{totalPendingAmount.toLocaleString("en-IN")} ({pendingCount})
            </div>
          </div>
          <div className="rounded-xl border border-line bg-white px-4 py-2 shadow-sm">
            <span className="text-[11px] font-semibold uppercase text-muted">Total Paid</span>
            <div className="font-display text-lg font-extrabold text-emerald-600">
              ₹{totalPaidAmount.toLocaleString("en-IN")} ({approvedCount})
            </div>
          </div>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-nowrap overflow-x-auto rounded-xl bg-surface p-1 border border-line gap-1">
          <button
            onClick={() => setActiveStatus("all")}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeStatus === "all" ? "bg-white text-brand shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            All Requests ({withdrawals.length})
          </button>
          <button
            onClick={() => setActiveStatus("pending")}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeStatus === "pending" ? "bg-white text-amber-700 shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            Pending ({pendingCount})
          </button>
          <button
            onClick={() => setActiveStatus("approved")}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeStatus === "approved" ? "bg-white text-emerald-700 shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            Paid / Approved ({approvedCount})
          </button>
          <button
            onClick={() => setActiveStatus("rejected")}
            className={`whitespace-nowrap rounded-lg px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors ${
              activeStatus === "rejected" ? "bg-white text-red-700 shadow-sm" : "text-muted hover:text-ink"
            }`}
          >
            Rejected ({rejectedCount})
          </button>
        </div>

        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, phone, UPI, bank, UTR..."
          className="w-full max-w-xs rounded-xl border border-line bg-white px-3.5 py-2 text-sm text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand shadow-sm"
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted shadow-card">
          Loading payout requests...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
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
                {filteredWithdrawals.map((w) => (
                  <tr key={w._id} className="border-t border-line align-top hover:bg-surface/50">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={w.user?.avatar}
                          alt="avatar"
                          className="h-10 w-10 shrink-0 rounded-full bg-surface object-cover border border-line"
                          onError={(e) => {
                            e.currentTarget.src = "https://via.placeholder.com/80x80.png?text=User";
                          }}
                        />
                        <div>
                          <div className="font-semibold text-ink">{w.payoutDetails?.holderName || w.user?.name}</div>
                          <div className="text-xs text-muted">
                            @{w.user?.channelName || "channel"} • {w.user?.phone || w.user?.email || "No contact"}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td className="p-4 whitespace-nowrap">
                      <div className="font-bold text-ink text-base">
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
                          <div className="font-semibold text-ink">{w.payoutDetails?.bankName}</div>
                          <div className="text-muted flex items-center justify-between gap-2">
                            <span>A/C: <strong className="text-ink font-mono">{w.payoutDetails?.accountNumber}</strong></span>
                            <button
                              onClick={() => handleCopy(w.payoutDetails?.accountNumber, `acc-${w._id}`)}
                              className="rounded bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand hover:bg-brand/20 transition-colors"
                            >
                              {copiedField === `acc-${w._id}` ? "Copied!" : "Copy A/C"}
                            </button>
                          </div>
                          <div className="text-muted flex items-center justify-between gap-2">
                            <span>IFSC: <strong className="text-ink font-mono">{w.payoutDetails?.ifscCode}</strong></span>
                            <button
                              onClick={() => handleCopy(w.payoutDetails?.ifscCode, `ifsc-${w._id}`)}
                              className="rounded bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand hover:bg-brand/20 transition-colors"
                            >
                              {copiedField === `ifsc-${w._id}` ? "Copied!" : "Copy IFSC"}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    <td className="p-4 text-muted text-xs whitespace-nowrap">{formatDate(w.createdAt)}</td>

                    <td className="p-4 whitespace-nowrap">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wider ${
                          w.status === "approved"
                            ? "bg-emerald-100 text-emerald-800"
                            : w.status === "rejected"
                            ? "bg-red-100 text-red-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {w.status === "approved" ? "Paid" : w.status}
                      </span>
                      {w.transactionId && (
                        <div className="text-[11px] text-muted mt-1.5 font-mono">
                          Ref: <strong className="text-ink">{w.transactionId}</strong>
                        </div>
                      )}
                      {w.adminNote && (
                        <div className="text-[11px] text-red-600 mt-1 max-w-xs">{w.adminNote}</div>
                      )}
                    </td>

                    <td className="p-4 text-right">
                      {w.status === "pending" ? (
                        <div className="flex justify-end gap-2 whitespace-nowrap">
                          <button
                            onClick={() => {
                              setSelectedWithdrawal(w);
                              setShowApproveModal(true);
                            }}
                            className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
                          >
                            Mark as Paid
                          </button>
                          <button
                            onClick={() => {
                              setSelectedWithdrawal(w);
                              setShowRejectModal(true);
                            }}
                            className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200 transition-colors"
                          >
                            Reject & Refund
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-muted font-medium">Processed</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredWithdrawals.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-muted">
                      No payout requests found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Approve / Mark as Paid Modal */}
      {showApproveModal && selectedWithdrawal && (
        <Modal
          title="Approve & Mark Payout as Paid"
          onClose={() => {
            setShowApproveModal(false);
            setSelectedWithdrawal(null);
            setTransactionId("");
          }}
        >
          <form onSubmit={handleApprove} className="space-y-4">
            <div className="rounded-xl border border-line bg-surface/40 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted">Beneficiary Name:</span>
                <span className="font-semibold text-ink">
                  {selectedWithdrawal.payoutDetails?.holderName || selectedWithdrawal.user?.name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Payout Amount:</span>
                <span className="font-bold text-brand text-base">
                  ₹{Number(selectedWithdrawal.amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted">Destination:</span>
                <span className="font-mono text-ink text-xs">
                  {selectedWithdrawal.payoutMethod === "upi"
                    ? `UPI: ${selectedWithdrawal.payoutDetails?.upiId}`
                    : `${selectedWithdrawal.payoutDetails?.bankName} (A/C: ${selectedWithdrawal.payoutDetails?.accountNumber})`}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">
                Bank / UPI Reference ID (UTR / Transaction ID)
              </label>
              <input
                type="text"
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value)}
                placeholder="e.g. UTR123456789 or UPI-TXN-98765"
                className="w-full rounded-lg border border-line p-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              />
              <p className="text-[11px] text-muted mt-1">Leave empty to auto-generate a reference number.</p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => {
                  setShowApproveModal(false);
                  setSelectedWithdrawal(null);
                  setTransactionId("");
                }}
                disabled={processing}
                className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className="rounded-full bg-emerald-600 px-6 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-75"
              >
                {processing ? "Processing..." : "Confirm & Mark as Paid"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reject Withdrawal Modal */}
      {showRejectModal && selectedWithdrawal && (
        <Modal
          title="Reject Withdrawal Request"
          onClose={() => {
            setShowRejectModal(false);
            setSelectedWithdrawal(null);
            setRejectReason("");
          }}
        >
          <form onSubmit={handleReject} className="space-y-4">
            <p className="text-sm text-muted">
              Rejecting this withdrawal will <strong>automatically refund ₹{Number(selectedWithdrawal.amount).toLocaleString("en-IN")}</strong> back into the creator's wallet balance.
            </p>

            <div>
              <label className="block text-xs font-bold text-ink uppercase mb-1">Reason for Rejection</label>
              <textarea
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="e.g. Incorrect UPI ID or account number. Please verify and request again."
                className="w-full rounded-lg border border-line p-3 text-sm focus:border-brand focus:ring-1 focus:ring-brand outline-none h-24 resize-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedWithdrawal(null);
                  setRejectReason("");
                }}
                disabled={processing}
                className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={processing}
                className="rounded-full bg-red-600 px-6 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-75"
              >
                {processing ? "Refunding..." : "Reject & Refund"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

export default Payouts;
