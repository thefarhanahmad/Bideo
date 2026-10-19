import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import DataTableToolbar from "../components/DataTableToolbar";
import Pagination from "../components/Pagination";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useTableParams } from "../hooks/useTableParams";
import UserForm from "../components/UserForm";
import { API_URL } from "../config";

const resolveMediaUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    admins: 0,
    monetized: 0,
    blocked: 0,
    scheduled: 0,
    recovery: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState(null);

  // Assign coins state
  const [assignCoinsUser, setAssignCoinsUser] = useState(null);
  const [coinsAmount, setCoinsAmount] = useState("");
  const [coinsNote, setCoinsNote] = useState("");
  const [assigningCoins, setAssigningCoins] = useState(false);
  const [coinsError, setCoinsError] = useState(null);

  // Custom confirmation modal state for styled dialogs
  const [confirmDialog, setConfirmDialog] = useState(null);

  // URL-synced search, filter, and pagination
  const {
    search,
    setSearch,
    filter,
    setFilter,
    page,
    setPage,
    limit,
    setLimit,
  } = useTableParams({ defaultFilter: "all", defaultLimit: 10 });

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      const url = new URL(`${API_URL}/api/users`);
      url.searchParams.set("page", page);
      url.searchParams.set("limit", limit);
      url.searchParams.set("filter", filter);
      if (search && search.trim()) {
        url.searchParams.set("search", search.trim());
      }

      const res = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch users");
      setUsers(data.data || []);
      setTotalItems(data.total || 0);
      setTotalPages(data.pages || 1);
      if (data.filterCounts) {
        setFilterCounts(data.filterCounts);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }, [page, limit, filter, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [fetchUsers, search]);

  const formatJoinedDate = (date) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const handleCreate = async (payload) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/users", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Create failed");
      setShowAdd(false);
      fetchUsers();
    } catch (err) {
      setConfirmDialog({
        title: "Error",
        message: err.message,
        confirmText: "OK",
        confirmClass: "bg-brand hover:bg-brand-dark text-white",
        onConfirm: () => setConfirmDialog(null),
      });
    }
  };

  const handleUpdate = async (id, payload) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/users/" + id, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Update failed");
      setShowEdit(false);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      setConfirmDialog({
        title: "Error",
        message: err.message,
        confirmText: "OK",
        confirmClass: "bg-brand hover:bg-brand-dark text-white",
        onConfirm: () => setConfirmDialog(null),
      });
    }
  };

  const handleAssignCoins = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!assignCoinsUser) return;
    const amountNum = Number(coinsAmount);
    if (!coinsAmount || isNaN(amountNum) || amountNum <= 0) {
      setCoinsError("Please enter a valid positive number of coins.");
      return;
    }

    setAssigningCoins(true);
    setCoinsError(null);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${API_URL}/api/users/${assignCoinsUser._id}/assign-coins`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
        body: JSON.stringify({
          amount: amountNum,
          note: coinsNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to assign coins");

      setAssignCoinsUser(null);
      setCoinsAmount("");
      setCoinsNote("");
      await fetchUsers();
    } catch (err) {
      setCoinsError(err.message);
    } finally {
      setAssigningCoins(false);
    }
  };

  const handleDeleteUser = (u) => {
    setConfirmDialog({
      title: "Confirm Permanent Deletion",
      message: `Are you sure you want to permanently delete user "${u.name}"? This action cannot be undone.`,
      confirmText: "Delete User",
      confirmClass: "bg-red-600 hover:bg-red-700 text-white",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const token = localStorage.getItem("admin_token");
          const res = await fetch(API_URL + "/api/users/" + u._id, {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            credentials: "include",
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Delete failed");
          fetchUsers();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  };

  const executeApproveRecovery = async (u) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/users/" + u._id + "/cancel-deletion", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to approve recovery");
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const executeRejectRecovery = async (u) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/users/" + u._id + "/reject-recovery", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to reject recovery request");
      fetchUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleApproveRecovery = (u) => {
    if (filter === "recovery") {
      executeApproveRecovery(u);
      return;
    }
    setConfirmDialog({
      title: "Approve & Restore Account",
      message: `Are you sure you want to approve the recovery request for "${u.name}" and restore full profile access?`,
      confirmText: "Approve & Restore",
      confirmClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
      onConfirm: async () => {
        setConfirmDialog(null);
        await executeApproveRecovery(u);
      },
    });
  };

  const handleStopDeletionSchedule = (u) => {
    setConfirmDialog({
      title: "Stop Deletion Schedule",
      message: `Are you sure you want to cancel the deletion schedule for "${u.name}" and restore profile?`,
      confirmText: "Stop Deletion",
      confirmClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
      onConfirm: async () => {
        setConfirmDialog(null);
        await executeApproveRecovery(u);
      },
    });
  };

  const handleRejectRecovery = (u) => {
    if (filter === "recovery") {
      executeRejectRecovery(u);
      return;
    }
    setConfirmDialog({
      title: "Reject Recovery Request",
      message: `Are you sure you want to reject the recovery request for "${u.name}"? The account will remain scheduled for deletion.`,
      confirmText: "Reject Request",
      confirmClass: "bg-amber-600 hover:bg-amber-700 text-white",
      onConfirm: async () => {
        setConfirmDialog(null);
        await executeRejectRecovery(u);
      },
    });
  };

  const promptToggleVerify = (u) => {
    const isGranting = !u.isVerified;
    setConfirmDialog({
      title: isGranting ? "Grant Verified Creator Badge" : "Remove Verified Badge",
      message: isGranting
        ? `Are you sure you want to grant the official blue Verified Creator badge to "${u.name || "this user"}" (@${u.channelName || u.name || "user"})? This will display the blue checkmark badge next to their profile, channel, videos, shorts, and comments across the app.`
        : `Are you sure you want to remove the Verified Creator badge from "${u.name || "this user"}"? The blue checkmark badge will be removed from all their content and profile across the app.`,
      confirmText: isGranting ? "Grant Verification" : "Remove Badge",
      confirmClass: isGranting
        ? "bg-blue-600 hover:bg-blue-700 text-white"
        : "bg-red-600 hover:bg-red-700 text-white",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const token = localStorage.getItem("admin_token");
          const res = await fetch(`${API_URL}/api/users/${u._id}/verify`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`,
            },
            credentials: "include",
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Failed to update verified badge");
          await fetchUsers();
        } catch (err) {
          setConfirmDialog({
            title: "Error",
            message: err.message,
            confirmText: "OK",
            confirmClass: "bg-brand hover:bg-brand-dark text-white",
            onConfirm: () => setConfirmDialog(null),
          });
        }
      },
    });
  };

  const promptToggleBlock = (u) => {
    const isBlocking = !u.isBlocked;
    setConfirmDialog({
      title: isBlocking ? "Block User Account & Hide Content" : "Unblock User Account",
      message: isBlocking
        ? `Are you sure you want to block user "${u.name || "this user"}" (@${u.channelName || u.name || "user"})? When blocked, all their videos, reels/shorts, posts, and channel profile will immediately be hidden from the app feed, search results, and public views.`
        : `Are you sure you want to unblock user "${u.name || "this user"}"? Their account, channel, and videos will become visible again on the app.`,
      confirmText: isBlocking ? "Block User" : "Unblock User",
      confirmClass: isBlocking
        ? "bg-rose-600 hover:bg-rose-700 text-white"
        : "bg-emerald-600 hover:bg-emerald-700 text-white",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const token = localStorage.getItem("admin_token");
          const res = await fetch(`${API_URL}/api/users/${u._id}/block`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              reason: isBlocking ? "Blocked by administrator" : null,
            }),
            credentials: "include",
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Failed to update user block status");
          await fetchUsers();
        } catch (err) {
          setConfirmDialog({
            title: "Error",
            message: err.message,
            confirmText: "OK",
            confirmClass: "bg-brand hover:bg-brand-dark text-white",
            onConfirm: () => setConfirmDialog(null),
          });
        }
      },
    });
  };

  const promptToggleMonetize = (u) => {
    const isMonetizing = !u.isMonetized;
    setConfirmDialog({
      title: isMonetizing ? "Directly Monetize Channel" : "Revoke Channel Monetization",
      message: isMonetizing
        ? `Are you sure you want to directly approve monetization for "${u.name || "this user"}" (@${u.channelName || u.name || "channel"})? This will immediately enable monetization and video view earnings without requiring 3 video audits or verification documents. They can start earning from day 1!`
        : `Are you sure you want to revoke monetization for "${u.name || "this user"}"? They will stop earning from video views until re-enabled.`,
      confirmText: isMonetizing ? "Approve Monetization" : "Revoke Monetization",
      confirmClass: isMonetizing
        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
        : "bg-rose-600 hover:bg-rose-700 text-white",
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const token = localStorage.getItem("admin_token");
          const res = await fetch(`${API_URL}/api/users/${u._id}/monetize`, {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            credentials: "include",
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || "Failed to update channel monetization");
          await fetchUsers();
        } catch (err) {
          setConfirmDialog({
            title: "Error",
            message: err.message,
            confirmText: "OK",
            confirmClass: "bg-brand hover:bg-brand-dark text-white",
            onConfirm: () => setConfirmDialog(null),
          });
        }
      },
    });
  };

  const calculateDaysRemaining = (scheduledDateStr) => {
    if (!scheduledDateStr) return "Pending";
    const diff = new Date(scheduledDateStr).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} day(s) left` : "Expiring soon";
  };

  const filterOptions = [
    { label: "All Users", value: "all", count: filterCounts.all },
    { label: "Admins", value: "admins", count: filterCounts.admins },
    { label: "Monetized", value: "monetized", count: filterCounts.monetized },
    { label: "Blocked Users", value: "blocked", count: filterCounts.blocked },
    { label: "Scheduled Deletions", value: "scheduled", count: filterCounts.scheduled },
    { label: "Recovery Requests", value: "recovery", count: filterCounts.recovery },
  ];

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">Users Management</h2>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted">
            Manage user accounts, channels, creator wallet balances, and deletion recovery requests.
          </p>
        </div>
      </div>

      {/* Toolbar: Search, Filters, Add Button */}
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, channel, email, or phone..."
        filter={filter}
        onFilterChange={setFilter}
        filters={filterOptions}
        totalCount={filterCounts.all || totalItems}
        filteredCount={totalItems}
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
          >
            <span>+ Add User</span>
          </button>
        }
      />

      {loading ? (
        <LoadingSkeleton type="table" rows={8} cols={8} />
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="p-4 font-semibold">User & Profile</th>
                  <th className="p-4 font-semibold">Contact</th>
                  <th className="p-4 font-semibold">Channel</th>
                  <th className="p-4 font-semibold">Wallet & Earnings</th>
                  <th className="p-4 font-semibold">Status / Role</th>
                  <th className="p-4 font-semibold text-center">Verified Badge</th>
                  <th className="p-4 font-semibold">Joined / Schedule</th>
                  <th className="p-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isScheduled = u.deletionScheduled;
                  const isRecoveryRequested =
                    u.recoveryRequested || u.deletionStatus === "recovery_requested";
                  const avatarUrl = resolveMediaUrl(u.avatar);

                  return (
                    <tr
                      key={u._id}
                      className={`border-t border-line hover:bg-surface/50 transition-colors ${
                        isRecoveryRequested
                          ? "bg-amber-50/60"
                          : isScheduled
                          ? "bg-red-50/40"
                          : ""
                      }`}
                    >
                      {/* User Avatar & Name */}
                      <td className="p-4 font-medium text-ink">
                        <div className="flex items-center gap-3">
                          <Link
                            to={`/admin/users/${u._id}`}
                            className="shrink-0 group"
                            title="Open user profile & stats"
                          >
                            {avatarUrl ? (
                              <img
                                src={avatarUrl}
                                alt={u.name || ""}
                                className="h-10 w-10 shrink-0 rounded-full object-cover border border-line bg-surface group-hover:ring-2 group-hover:ring-brand/40 transition-all"
                                onError={(e) => {
                                  e.currentTarget.style.display = "none";
                                  if (e.currentTarget.nextSibling) {
                                    e.currentTarget.nextSibling.style.display = "grid";
                                  }
                                }}
                              />
                            ) : null}
                            <span
                              style={{ display: avatarUrl ? "none" : "grid" }}
                              className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand border border-brand/20 group-hover:ring-2 group-hover:ring-brand/40 transition-all"
                            >
                              {(u.name || "?").charAt(0).toUpperCase()}
                            </span>
                          </Link>

                          <div className="min-w-0 flex-1">
                            <Link
                              to={`/admin/users/${u._id}`}
                              className="block font-bold text-ink text-sm truncate hover:text-brand hover:underline underline-offset-2"
                              title="Open user profile & stats"
                            >
                              {u.name || "Unnamed"}
                            </Link>
                            {u.deletionReason && (
                              <div className="mt-1 text-xs text-red-600 font-normal">
                                Reason: "{u.deletionReason}"
                              </div>
                            )}
                            {(isRecoveryRequested || u.recoveryReason) && (
                              <div className="mt-1 text-xs text-amber-800 font-medium bg-amber-100/80 p-1.5 rounded-md">
                                <div>Recovery: "{u.recoveryReason}"</div>
                                {u.recoveryNotes && (
                                  <div className="text-[10px] text-amber-900 mt-0.5">
                                    Notes: "{u.recoveryNotes}"
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="p-4 text-muted">
                        <div className="text-xs font-medium text-ink truncate">{u.email || "—"}</div>
                        <div className="text-xs text-muted mt-0.5 truncate">{u.phone || "—"}</div>
                      </td>

                      {/* Channel Name */}
                      <td className="p-4">
                        {u.channelName ? (
                          <Link
                            to={`/admin/users/${u._id}`}
                            className="font-semibold text-ink text-xs truncate hover:text-brand hover:underline block"
                            title="Open user profile & stats"
                          >
                            @{u.channelName}
                          </Link>
                        ) : (
                          <div className="font-semibold text-muted text-xs truncate">—</div>
                        )}
                      </td>

                      {/* Wallet Balance & Earnings */}
                      <td className="p-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <span className="font-extrabold text-ink text-sm">
                            ₹{Number(u.walletBalance || 0).toLocaleString("en-IN", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 border border-emerald-200">
                            Balance
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-amber-700 font-bold mt-0.5">
                          <span>🪙 {Number(u.coins || 0).toLocaleString()} Coins</span>
                        </div>
                        <div className="text-[11px] text-muted mt-0.5">
                          Lifetime: ₹
                          {Number(u.totalEarnings || 0).toLocaleString("en-IN", {
                            minimumFractionDigits: 2,
                          })}
                        </div>
                      </td>

                      {/* Status / Role */}
                      <td className="p-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${
                              u.role === "admin"
                                ? "bg-brand-50 text-brand border border-brand/20"
                                : "bg-surface text-muted border border-line"
                            }`}
                          >
                            {u.role}
                          </span>
                          {u.isBlocked ? (
                            <span className="rounded-full bg-rose-100 border border-rose-300 px-2 py-0.5 text-[10px] font-bold text-rose-800">
                              🚫 Blocked
                            </span>
                          ) : null}
                          {u.isMonetized ? (
                            <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              💰 Monetized
                            </span>
                          ) : null}
                          {isRecoveryRequested ? (
                            <span className="rounded-full bg-amber-100 border border-amber-300 px-2.5 py-0.5 text-[10px] font-bold text-amber-900">
                              Recovery Requested
                            </span>
                          ) : isScheduled ? (
                            <span className="rounded-full bg-red-100 border border-red-200 px-2.5 py-0.5 text-[10px] font-bold text-red-700">
                              Deletion: {calculateDaysRemaining(u.scheduledDeletionDate)}
                            </span>
                          ) : null}
                        </div>
                      </td>

                      {/* Verified Badge Toggle Column */}
                      <td className="p-4 text-center whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => promptToggleVerify(u)}
                          title={
                            u.isVerified
                              ? "Verified Creator — click to remove badge"
                              : "Click to grant Verified Creator Badge"
                          }
                          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all shadow-xs cursor-pointer ${
                            u.isVerified
                              ? "bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 hover:border-blue-300"
                              : "bg-surface text-muted border border-line hover:bg-surface/90 hover:text-ink"
                          }`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              u.isVerified ? "bg-blue-600 animate-pulse" : "bg-muted/40"
                            }`}
                          />
                          <span>{u.isVerified ? "✓ Verified" : "Unverified"}</span>
                        </button>
                      </td>

                      {/* Dates */}
                      <td className="p-4 text-muted whitespace-nowrap text-xs">
                        <div>Joined: {formatJoinedDate(u.createdAt)}</div>
                        {isScheduled && (
                          <div className="text-[11px] text-red-600 font-semibold mt-0.5">
                            Delete At: {formatJoinedDate(u.scheduledDeletionDate)}
                          </div>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4">
                        <div className="flex justify-end gap-1.5 flex-wrap">
                          {isScheduled ? (
                            isRecoveryRequested ? (
                              <>
                                <button
                                  onClick={() => handleApproveRecovery(u)}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectRecovery(u)}
                                  className="rounded-lg bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200"
                                >
                                  Reject
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStopDeletionSchedule(u)}
                                  className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm"
                                >
                                  Restore
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  className="rounded-lg bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-200"
                                >
                                  Delete
                                </button>
                              </>
                            )
                          ) : (
                            <>
                              <Link
                                to={`/admin/users/${u._id}`}
                                className="rounded-lg bg-brand-50 border border-brand/20 px-2.5 py-1 text-xs font-semibold text-brand hover:bg-brand hover:text-white transition-colors shadow-2xs"
                                title="Open full user profile & stats"
                              >
                                📊 Stats
                              </Link>
                              <button
                                type="button"
                                onClick={() => promptToggleMonetize(u)}
                                className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                                  u.isMonetized
                                    ? "bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                                    : "bg-emerald-600 border border-emerald-600 text-white hover:bg-emerald-700 shadow-xs"
                                }`}
                                title={
                                  u.isMonetized
                                    ? "Channel is monetized — click to revoke"
                                    : "Click to directly monetize channel and enable earnings from day 1"
                                }
                              >
                                {u.isMonetized ? "✓ Monetized" : "+ Monetize"}
                              </button>

                              {u.role !== "admin" && (
                                <button
                                  onClick={() => promptToggleBlock(u)}
                                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                                    u.isBlocked
                                      ? "bg-emerald-50 border border-emerald-300 text-emerald-700 hover:bg-emerald-100"
                                      : "bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-100"
                                  }`}
                                  title={u.isBlocked ? "Unblock user and restore content visibility" : "Block user and hide all their videos/shorts"}
                                >
                                  {u.isBlocked ? "Unblock" : "Block"}
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => {
                                  setAssignCoinsUser(u);
                                  setCoinsAmount("");
                                  setCoinsNote("");
                                  setCoinsError(null);
                                }}
                                className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-xs font-semibold text-amber-800 hover:bg-amber-500/20 transition-colors"
                                title={`Assign coins to ${u.name || "this user"}`}
                              >
                                🪙 Assign Coins
                              </button>
                              <button
                                onClick={() => {
                                  setEditUser(u);
                                  setShowEdit(true);
                                }}
                                className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                              >
                                Delete
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-muted">
                      No matching users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Bottom Pagination */}
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

      {/* Add User Modal */}
      {showAdd && (
        <Modal title="Add User" maxWidth="max-w-3xl" onClose={() => setShowAdd(false)}>
          <UserForm onSubmit={handleCreate} onCancel={() => setShowAdd(false)} />
        </Modal>
      )}

      {/* Edit User Modal */}
      {showEdit && editUser && (
        <Modal
          title="Edit User"
          maxWidth="max-w-3xl"
          onClose={() => {
            setShowEdit(false);
            setEditUser(null);
          }}
        >
          <UserForm
            initial={editUser}
            onSubmit={(payload) => handleUpdate(editUser._id, payload)}
            onCancel={() => {
              setShowEdit(false);
              setEditUser(null);
            }}
          />
        </Modal>
      )}

      {/* Assign Coins Modal */}
      {assignCoinsUser && (
        <Modal
          title={`Assign Coins — ${assignCoinsUser.name || assignCoinsUser.channelName || "User"}`}
          maxWidth="max-w-md"
          onClose={() => {
            setAssignCoinsUser(null);
            setCoinsAmount("");
            setCoinsNote("");
            setCoinsError(null);
          }}
        >
          <form onSubmit={handleAssignCoins} className="space-y-4">
            <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-3.5 text-xs text-amber-900">
              <div className="font-bold flex items-center gap-1.5">
                <span>🪙 Current Coins:</span>
                <span className="text-sm font-extrabold text-amber-950">
                  {Number(assignCoinsUser.coins || 0).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 text-amber-800">
                Coins will be credited immediately to the user's account without sending any notification.
              </p>
            </div>

            {coinsError && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {coinsError}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Coins to Credit <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                step="any"
                value={coinsAmount}
                onChange={(e) => {
                  setCoinsAmount(e.target.value);
                  setCoinsError(null);
                }}
                placeholder="e.g. 50, 100, 500"
                className="w-full rounded-xl border border-line bg-surface/50 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:bg-white focus:outline-none"
                autoFocus
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-ink mb-1">
                Optional Admin Note / Reason
              </label>
              <input
                type="text"
                value={coinsNote}
                onChange={(e) => setCoinsNote(e.target.value)}
                placeholder="e.g. Promotional credit, contest reward"
                className="w-full rounded-xl border border-line bg-surface/50 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:bg-white focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setAssignCoinsUser(null);
                  setCoinsAmount("");
                  setCoinsNote("");
                  setCoinsError(null);
                }}
                disabled={assigningCoins}
                className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-muted hover:bg-surface cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={assigningCoins}
                className="rounded-xl bg-brand px-5 py-2 text-xs font-bold text-white shadow-brand hover:bg-brand-dark disabled:opacity-50 cursor-pointer"
              >
                {assigningCoins ? "Crediting..." : "Credit Coins"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Custom Confirmation Modal */}
      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmText={confirmDialog.confirmText}
          confirmClass={confirmDialog.confirmClass}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
        />
      )}
    </div>
  );
};

export default Users;
