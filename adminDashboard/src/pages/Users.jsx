import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { API_URL } from '../config';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [activeTab, setActiveTab] = useState('all');

  // Custom confirmation modal state for styled dialogs
  const [confirmDialog, setConfirmDialog] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(API_URL + '/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch users');
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
    if (!date) return '-';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  const handleCreate = async (payload) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(API_URL + '/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Create failed');
      setShowAdd(false);
      fetchUsers();
    } catch (err) {
      setConfirmDialog({
        title: 'Error',
        message: err.message,
        confirmText: 'OK',
        confirmClass: 'bg-brand hover:bg-brand-dark text-white',
        onConfirm: () => setConfirmDialog(null),
      });
    }
  };

  const handleUpdate = async (id, payload) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(API_URL + '/api/users/' + id, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');
      setShowEdit(false);
      setEditUser(null);
      fetchUsers();
    } catch (err) {
      setConfirmDialog({
        title: 'Error',
        message: err.message,
        confirmText: 'OK',
        confirmClass: 'bg-brand hover:bg-brand-dark text-white',
        onConfirm: () => setConfirmDialog(null),
      });
    }
  };

  const handleDeleteUser = (u) => {
    setConfirmDialog({
      title: 'Confirm Permanent Deletion',
      message: `Are you sure you want to permanently delete user "${u.name}"? This action cannot be undone.`,
      confirmText: 'Delete User',
      confirmClass: 'bg-red-600 hover:bg-red-700 text-white',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const token = localStorage.getItem('admin_token');
          const res = await fetch(API_URL + '/api/users/' + u._id, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Delete failed');
          fetchUsers();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  };

  const handleApproveRecovery = (u) => {
    setConfirmDialog({
      title: 'Approve & Restore Account',
      message: `Are you sure you want to approve the recovery request for "${u.name}" and restore full profile access?`,
      confirmText: 'Approve & Restore',
      confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const token = localStorage.getItem('admin_token');
          const res = await fetch(API_URL + '/api/users/' + u._id + '/cancel-deletion', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Failed to approve recovery');
          fetchUsers();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  };

  const handleStopDeletionSchedule = (u) => {
    setConfirmDialog({
      title: 'Stop Deletion Schedule',
      message: `Are you sure you want to cancel the deletion schedule for "${u.name}" and restore profile?`,
      confirmText: 'Stop Deletion',
      confirmClass: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const token = localStorage.getItem('admin_token');
          const res = await fetch(API_URL + '/api/users/' + u._id + '/cancel-deletion', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Failed to stop deletion');
          fetchUsers();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  };

  const handleRejectRecovery = (u) => {
    setConfirmDialog({
      title: 'Reject Recovery Request',
      message: `Are you sure you want to reject the recovery request for "${u.name}"? The account will remain scheduled for deletion.`,
      confirmText: 'Reject Request',
      confirmClass: 'bg-amber-600 hover:bg-amber-700 text-white',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          const token = localStorage.getItem('admin_token');
          const res = await fetch(API_URL + '/api/users/' + u._id + '/reject-recovery', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token}`,
            },
            credentials: 'include',
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.message || 'Failed to reject recovery request');
          fetchUsers();
        } catch (err) {
          setError(err.message);
        }
      },
    });
  };

  const calculateDaysRemaining = (scheduledDateStr) => {
    if (!scheduledDateStr) return 'Pending';
    const diff = new Date(scheduledDateStr).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days > 0 ? `${days} day(s) left` : 'Expiring soon';
  };

  const scheduledUsers = users.filter((u) => u.deletionScheduled);
  const recoveryRequestUsers = users.filter((u) => u.recoveryRequested || u.deletionStatus === 'recovery_requested');
  const displayedUsers = activeTab === 'scheduled' ? scheduledUsers : users;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-ink">Users</h2>
          <p className="mt-1 text-sm text-muted">
            {users.length} registered users ({scheduledUsers.length} scheduled for deletion, {recoveryRequestUsers.length} requesting recovery)
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
          >
            + Add User
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-2 border-b border-line pb-2">
        <button
          onClick={() => setActiveTab('all')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'all' ? 'bg-brand text-white' : 'bg-surface text-muted hover:text-ink'
          }`}
        >
          All Users ({users.length})
        </button>
        <button
          onClick={() => setActiveTab('scheduled')}
          className={`relative rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
            activeTab === 'scheduled' ? 'bg-red-600 text-white' : 'bg-red-50 text-red-700 hover:bg-red-100'
          }`}
        >
          Scheduled Deletions & Recovery Requests ({scheduledUsers.length})
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted shadow-card">Loading users...</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="p-4 font-semibold">Name & Details</th>
                  <th className="p-4 font-semibold">Phone / Email</th>
                  <th className="p-4 font-semibold">Channel</th>
                  <th className="p-4 font-semibold">Status / Role</th>
                  <th className="p-4 font-semibold">Joined / Deletion Date</th>
                  <th className="p-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {displayedUsers.map((u) => {
                  const isScheduled = u.deletionScheduled;
                  const isRecoveryRequested = u.recoveryRequested || u.deletionStatus === 'recovery_requested';

                  return (
                    <tr
                      key={u._id}
                      className={`border-t border-line hover:bg-surface/50 ${
                        isRecoveryRequested ? 'bg-amber-50/60' : isScheduled ? 'bg-red-50/40' : ''
                      }`}
                    >
                      <td className="p-4 font-medium text-ink">
                        <div className="font-semibold text-ink">{u.name}</div>
                        {u.deletionReason && (
                          <div className="mt-1 text-xs text-red-600 font-normal">Delete Reason: "{u.deletionReason}"</div>
                        )}
                        {(isRecoveryRequested || u.recoveryReason) && (
                          <div className="mt-1 text-xs text-amber-700 font-medium bg-amber-100/70 p-1.5 rounded-md">
                            <div>Recovery Reason: "{u.recoveryReason}"</div>
                            {u.recoveryNotes && <div className="text-[11px] text-amber-900 mt-0.5">Notes: "{u.recoveryNotes}"</div>}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-muted">{u.phone || u.email || '-'}</td>
                      <td className="p-4 text-muted">{u.channelName || '-'}</td>
                      <td className="p-4">
                        <div className="flex flex-col gap-1 items-start">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ${
                              u.role === 'admin' ? 'bg-brand-50 text-brand' : 'bg-surface text-muted'
                            }`}
                          >
                            {u.role}
                          </span>
                          {isRecoveryRequested ? (
                            <span className="rounded-full bg-amber-200 border border-amber-400 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                              Recovery Requested (Awaiting Admin)
                            </span>
                          ) : isScheduled ? (
                            <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                              Deletion Pending ({calculateDaysRemaining(u.scheduledDeletionDate)})
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="p-4 text-muted whitespace-nowrap">
                        <div>Joined: {formatJoinedDate(u.createdAt)}</div>
                        {isScheduled && (
                          <div className="text-xs text-red-600 font-semibold mt-0.5">
                            Delete At: {formatJoinedDate(u.scheduledDeletionDate)}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <div className="flex justify-end gap-2 flex-wrap">
                          {isScheduled ? (
                            // Action controls specifically for Scheduled Deletions & Recovery Requests
                            isRecoveryRequested ? (
                              <>
                                <button
                                  onClick={() => handleApproveRecovery(u)}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm"
                                >
                                  Approve & Restore Account
                                </button>
                                <button
                                  onClick={() => handleRejectRecovery(u)}
                                  className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-900 hover:bg-amber-200"
                                >
                                  Reject Recovery
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleStopDeletionSchedule(u)}
                                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 shadow-sm"
                                >
                                  Stop Deletion Schedule
                                </button>
                                <button
                                  onClick={() => handleDeleteUser(u)}
                                  className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200"
                                >
                                  Delete Immediately
                                </button>
                              </>
                            )
                          ) : (
                            // Standard controls for active non-deletion users
                            <>
                              <button
                                onClick={() => {
                                  setEditUser(u);
                                  setShowEdit(true);
                                }}
                                className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200"
                              >
                                Edit
                              </button>
                              <button
                                onClick={() => handleDeleteUser(u)}
                                className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200"
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
                {displayedUsers.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-muted">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showAdd && (
        <Modal title="Add User" onClose={() => setShowAdd(false)}>
          <UserForm onSubmit={handleCreate} onCancel={() => setShowAdd(false)} />
        </Modal>
      )}

      {showEdit && editUser && (
        <Modal
          title="Edit User"
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
  'mt-1.5 w-full rounded-lg border border-line p-2.5 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20';

const UserForm = ({ initial = {}, onSubmit, onCancel }) => {
  const [name, setName] = useState(initial.name || '');
  const [email, setEmail] = useState(initial.email || '');
  const [channelName, setChannelName] = useState(initial.channelName || '');
  const [role, setRole] = useState(initial.role || 'user');

  const submit = (e) => {
    e.preventDefault();
    onSubmit({ name, email, channelName, role });
  };

  return (
    <form onSubmit={submit}>
      <label className="block text-sm font-medium text-ink">Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Full name"
        className={inputClass}
      />
      <label className="mt-4 block text-sm font-medium text-ink">Email</label>
      <input
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="name@example.com"
        className={inputClass}
      />
      <label className="mt-4 block text-sm font-medium text-ink">Channel Name</label>
      <input
        value={channelName}
        onChange={(e) => setChannelName(e.target.value)}
        placeholder="Channel name"
        className={inputClass}
      />
      <label className="mt-4 block text-sm font-medium text-ink">Role</label>
      <select value={role} onChange={(e) => setRole(e.target.value)} className={inputClass}>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-brand-dark"
        >
          Save
        </button>
      </div>
    </form>
  );
};

export default Users;
