import { useEffect, useState, useMemo } from "react";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import DataTableToolbar from "../components/DataTableToolbar";
import Pagination from "../components/Pagination";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useTableParams } from "../hooks/useTableParams";
import { API_URL } from "../config";

const resolveMediaUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState(null);

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

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch users");
      setUsers(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

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

  const handleApproveRecovery = (u) => {
    setConfirmDialog({
      title: "Approve & Restore Account",
      message: `Are you sure you want to approve the recovery request for "${u.name}" and restore full profile access?`,
      confirmText: "Approve & Restore",
      confirmClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
      onConfirm: async () => {
        setConfirmDialog(null);
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
          if (!res.ok) throw new Error(data.message || "Failed to stop deletion");
          fetchUsers();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  };

  const handleRejectRecovery = (u) => {
    setConfirmDialog({
      title: "Reject Recovery Request",
      message: `Are you sure you want to reject the recovery request for "${u.name}"? The account will remain scheduled for deletion.`,
      confirmText: "Reject Request",
      confirmClass: "bg-amber-600 hover:bg-amber-700 text-white",
      onConfirm: async () => {
        setConfirmDialog(null);
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

  const calculateDaysRemaining = (scheduledDateStr) => {
    if (!scheduledDateStr) return "Pending";
    const diff = new Date(scheduledDateStr).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} day(s) left` : "Expiring soon";
  };

  // Filter and Search
  const { filteredUsers, filterCounts } = useMemo(() => {
    const counts = {
      all: users.length,
      admins: 0,
      monetized: 0,
      scheduled: 0,
      recovery: 0,
    };

    users.forEach((u) => {
      if (u.role === "admin") counts.admins += 1;
      if (u.isMonetized || u.monetizationApproved || (u.totalEarnings && u.totalEarnings > 0)) counts.monetized += 1;
      if (u.deletionScheduled) counts.scheduled += 1;
      if (u.recoveryRequested || u.deletionStatus === "recovery_requested") counts.recovery += 1;
    });

    const searchLower = (search || "").trim().toLowerCase();

    const filtered = users.filter((u) => {
      // 1. Filter condition
      if (filter === "admins" && u.role !== "admin") return false;
      if (filter === "monetized" && !(u.isMonetized || u.monetizationApproved || (u.totalEarnings && u.totalEarnings > 0))) return false;
      if (filter === "scheduled" && !u.deletionScheduled) return false;
      if (filter === "recovery" && !(u.recoveryRequested || u.deletionStatus === "recovery_requested")) return false;

      // 2. Search condition
      if (!searchLower) return true;
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const phone = (u.phone || "").toLowerCase();
      const channel = (u.channelName || "").toLowerCase();

      return (
        name.includes(searchLower) ||
        email.includes(searchLower) ||
        phone.includes(searchLower) ||
        channel.includes(searchLower)
      );
    });

    return { filteredUsers: filtered, filterCounts: counts };
  }, [users, filter, search]);

  // Paginate filtered results
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / limit));
  const paginatedUsers = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredUsers.slice(startIndex, startIndex + limit);
  }, [filteredUsers, page, limit]);

  const filterOptions = [
    { label: "All Users", value: "all", count: filterCounts.all },
    { label: "Admins", value: "admins", count: filterCounts.admins },
    { label: "Monetized", value: "monetized", count: filterCounts.monetized },
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
        totalCount={users.length}
        filteredCount={filteredUsers.length}
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
                {paginatedUsers.map((u) => {
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
                          {avatarUrl ? (
                            <img
                              src={avatarUrl}
                              alt={u.name || ""}
                              className="h-10 w-10 shrink-0 rounded-full object-cover border border-line bg-surface"
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
                            className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-sm font-bold text-brand border border-brand/20"
                          >
                            {(u.name || "?").charAt(0).toUpperCase()}
                          </span>

                          <div className="min-w-0 flex-1">
                            <div className="font-bold text-ink text-sm truncate">{u.name || "Unnamed"}</div>
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
                        <div className="font-semibold text-ink text-xs truncate">
                          {u.channelName || "—"}
                        </div>
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
                {paginatedUsers.length === 0 && (
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
            totalItems={filteredUsers.length}
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

const inputClass =
  "mt-1.5 w-full rounded-xl border border-line bg-white p-2.5 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 text-xs sm:text-sm font-semibold text-ink";

const UserForm = ({ initial = {}, onSubmit, onCancel }) => {
  const [name, setName] = useState(initial.name || "");
  const [email, setEmail] = useState(initial.email || "");
  const [phone, setPhone] = useState(initial.phone || "");
  const [channelName, setChannelName] = useState(initial.channelName || "");
  const [role, setRole] = useState(initial.role || "user");
  const [isVerified, setIsVerified] = useState(Boolean(initial.isVerified));
  const [walletBalance, setWalletBalance] = useState(
    initial.walletBalance !== undefined ? String(initial.walletBalance) : "0"
  );
  const [totalEarnings, setTotalEarnings] = useState(
    initial.totalEarnings !== undefined ? String(initial.totalEarnings) : "0"
  );
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleGeneratePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyz23456789";
    let gen = "";
    for (let i = 0; i < 6; i++) {
      gen += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setNewPassword(gen);
    setShowPassword(true);
  };

  const handleAddAmount = (addValue) => {
    const current = parseFloat(walletBalance) || 0;
    const newBal = Math.max(0, current + addValue);
    setWalletBalance(newBal.toFixed(2).replace(/\.00$/, ""));

    // Also update lifetime earnings if adding money
    if (addValue > 0) {
      const currentEarn = parseFloat(totalEarnings) || 0;
      setTotalEarnings((currentEarn + addValue).toFixed(2).replace(/\.00$/, ""));
    }
  };

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      name: name.trim(),
      role,
      isVerified,
      walletBalance: Math.max(0, parseFloat(walletBalance) || 0),
      totalEarnings: Math.max(0, parseFloat(totalEarnings) || 0),
    };
    if (email.trim()) payload.email = email.trim();
    if (phone.trim()) payload.phone = phone.trim();
    if (channelName.trim()) {
      if (channelName.trim().length > 25) {
        alert("Channel name cannot exceed 25 characters");
        return;
      }
      payload.channelName = channelName.trim();
    }
    if (newPassword.trim()) payload.password = newPassword.trim();

    onSubmit(payload);
  };

  return (
    <form onSubmit={submit} className="flex flex-col max-h-[78vh]">
      {/* Scrollable Form Body */}
      <div className="flex-1 overflow-y-auto pr-1 space-y-3.5 custom-scrollbar">
        {/* Row 1: 3 Columns (Name, Phone, Email) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Full name"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink">
              Phone Number
            </label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="e.g. 9876543210"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink">
              Email Address
            </label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className={inputClass}
            />
          </div>
        </div>

        {/* Row 2: 3 Columns (Channel Name, Role, Password Reset) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-ink">
                Channel Name
              </label>
              <span className={`text-[10px] font-semibold ${channelName.length >= 25 ? "text-red-500 font-bold" : "text-muted"}`}>
                {channelName.length}/25
              </span>
            </div>
            <input
              value={channelName}
              maxLength={25}
              onChange={(e) => setChannelName(e.target.value)}
              placeholder="@channel_name"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-ink">
              Account Role
            </label>
            <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
              <option value="user">User (Standard)</option>
              <option value="admin">Admin (Full Control)</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-amber-950">
                🔑 New Password
              </label>
              <button
                type="button"
                onClick={handleGeneratePassword}
                className="text-[10px] font-bold text-amber-800 hover:text-amber-950 underline"
              >
                🎲 Auto-Gen
              </button>
            </div>
            <div className="relative mt-1.5">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Leave empty if unchanged"
                className="w-full rounded-xl border border-amber-300 bg-amber-50/40 p-2.5 text-xs sm:text-sm font-semibold text-ink focus:border-amber-500 focus:ring-2 focus:ring-amber-200 outline-none pr-12"
              />
              {newPassword.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[10px] font-bold text-amber-800 hover:text-amber-950"
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Verified Badge Checkbox */}
        <div
          onClick={() => setIsVerified(!isVerified)}
          className={`flex items-center justify-between p-3 rounded-2xl border transition-all cursor-pointer ${
            isVerified
              ? "bg-blue-50/80 border-blue-300 shadow-xs"
              : "bg-surface/50 border-line hover:bg-surface"
          }`}
        >
          <div className="flex items-center gap-2.5">
            <input
              type="checkbox"
              id="isVerifiedCheckbox"
              checked={isVerified}
              onChange={(e) => setIsVerified(e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-blue-400 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
            <label htmlFor="isVerifiedCheckbox" className="text-xs font-bold text-ink cursor-pointer">
              🛡️ Verified Creator Badge (Instagram Blue Checkmark)
              <span className="block text-[11px] font-normal text-muted mt-0.5">
                Displays the official blue verified badge next to their name and channel across the app.
              </span>
            </label>
          </div>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold shrink-0 ${
              isVerified
                ? "bg-blue-600 text-white"
                : "bg-surface text-muted border border-line"
            }`}
          >
            {isVerified ? "✓ Verified" : "Not Verified"}
          </span>
        </div>

        {/* Row 3: Wallet Management Section */}
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-bold text-xs text-emerald-950">
              <span>💰</span>
              <span>Creator Wallet & Lifetime Earnings</span>
            </div>
            <span className="text-[10px] font-semibold text-emerald-800 bg-emerald-100/90 px-2 py-0.5 rounded-md">
              Instant App Balance Sync
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                Available Wallet Balance (₹)
              </label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-emerald-700 pointer-events-none">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={walletBalance}
                  onChange={(e) => setWalletBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-emerald-200 bg-white pl-6 pr-3 py-2 text-xs sm:text-sm font-bold text-ink focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-emerald-900">
                Lifetime Total Earnings (₹)
              </label>
              <div className="relative mt-1">
                <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-xs font-bold text-emerald-700 pointer-events-none">
                  ₹
                </span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={totalEarnings}
                  onChange={(e) => setTotalEarnings(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-emerald-200 bg-white pl-6 pr-3 py-2 text-xs sm:text-sm font-bold text-ink focus:border-emerald-500 focus:ring-2 focus:ring-emerald-200 outline-none"
                />
              </div>
            </div>
          </div>

          {/* Quick Assign Buttons */}
          <div className="pt-1 flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] font-bold text-emerald-900 mr-1">Quick Add:</span>
            {[50, 100, 250, 500, 1000].map((val) => (
              <button
                type="button"
                key={val}
                onClick={() => handleAddAmount(val)}
                className="rounded-lg bg-white border border-emerald-300 px-2.5 py-1 text-xs font-bold text-emerald-800 hover:bg-emerald-100 hover:border-emerald-400 transition-colors shadow-xs"
              >
                + ₹{val}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setWalletBalance("0")}
              className="rounded-lg bg-red-50 border border-red-200 px-2 py-1 text-xs font-bold text-red-600 hover:bg-red-100 transition-colors ml-auto"
            >
              Reset to ₹0
            </button>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Action Buttons */}
      <div className="mt-4 flex items-center justify-end gap-2 pt-3 border-t border-line shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-surface px-5 py-2 text-xs sm:text-sm font-semibold text-ink hover:bg-line transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-full bg-brand px-6 py-2 text-xs sm:text-sm font-semibold text-white shadow-brand hover:bg-brand-dark transition-all hover:-translate-y-0.5"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
};

export default Users;
