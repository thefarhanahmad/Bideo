import { useState } from "react";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import UserForm from "../components/UserForm";
import AssignCoinsModal from "../components/AssignCoinsModal";
import { adminFetch } from "../lib/adminApi";

const BRAND_BTN = "bg-brand hover:bg-brand-dark text-white";

/**
 * Admin actions on a single user (same requests and confirmation copy as the Users list).
 * Returns action handlers plus the `dialogs` element that must be rendered once.
 *
 * @param {{ onChanged: () => void, onDeleted?: () => void }} options
 */
export function useUserActions({ onChanged, onDeleted }) {
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [coinsUser, setCoinsUser] = useState(null);

  const showError = (message) =>
    setConfirmDialog({
      title: "Error",
      message,
      confirmText: "OK",
      confirmClass: BRAND_BTN,
      onConfirm: () => setConfirmDialog(null),
    });

  const run = async (request, after = onChanged) => {
    setConfirmDialog(null);
    try {
      await request();
      after();
    } catch (err) {
      showError(err.message);
    }
  };

  const confirm = (dialog, request, after) =>
    setConfirmDialog({ ...dialog, onConfirm: () => run(request, after) });

  const nameOf = (u) => u.name || "this user";
  const handleOf = (u) => u.channelName || u.name || "user";

  const actions = {
    edit: (u) => setEditUser(u),
    assignCoins: (u) => setCoinsUser(u),

    toggleVerify: (u) => {
      const granting = !u.isVerified;
      confirm(
        {
          title: granting ? "Grant Verified Creator Badge" : "Remove Verified Badge",
          message: granting
            ? `Are you sure you want to grant the official blue Verified Creator badge to "${nameOf(u)}" (@${handleOf(u)})? This will display the blue checkmark badge next to their profile, channel, videos, shorts, and comments across the app.`
            : `Are you sure you want to remove the Verified Creator badge from "${nameOf(u)}"? The blue checkmark badge will be removed from all their content and profile across the app.`,
          confirmText: granting ? "Grant Verification" : "Remove Badge",
          confirmClass: granting ? "bg-blue-600 hover:bg-blue-700 text-white" : "bg-red-600 hover:bg-red-700 text-white",
        },
        () => adminFetch(`/api/users/${u._id}/verify`, { method: "PUT" })
      );
    },

    toggleBlock: (u) => {
      const blocking = !u.isBlocked;
      confirm(
        {
          title: blocking ? "Block User Account & Hide Content" : "Unblock User Account",
          message: blocking
            ? `Are you sure you want to block user "${nameOf(u)}" (@${handleOf(u)})? When blocked, all their videos, reels/shorts, posts, and channel profile will immediately be hidden from the app feed, search results, and public views.`
            : `Are you sure you want to unblock user "${nameOf(u)}"? Their account, channel, and videos will become visible again on the app.`,
          confirmText: blocking ? "Block User" : "Unblock User",
          confirmClass: blocking ? "bg-rose-600 hover:bg-rose-700 text-white" : "bg-emerald-600 hover:bg-emerald-700 text-white",
        },
        () =>
          adminFetch(`/api/users/${u._id}/block`, {
            method: "PUT",
            body: { reason: blocking ? "Blocked by administrator" : null },
          })
      );
    },

    toggleMonetize: (u) => {
      const monetizing = !u.isMonetized;
      confirm(
        {
          title: monetizing ? "Directly Monetize Channel" : "Revoke Channel Monetization",
          message: monetizing
            ? `Are you sure you want to directly approve monetization for "${nameOf(u)}" (@${u.channelName || u.name || "channel"})? This will immediately enable monetization and video view earnings without requiring 3 video audits or verification documents. They can start earning from day 1!`
            : `Are you sure you want to revoke monetization for "${nameOf(u)}"? They will stop earning from video views until re-enabled.`,
          confirmText: monetizing ? "Approve Monetization" : "Revoke Monetization",
          confirmClass: monetizing ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white",
        },
        () => adminFetch(`/api/users/${u._id}/monetize`, { method: "PUT" })
      );
    },

    remove: (u) =>
      confirm(
        {
          title: "Confirm Permanent Deletion",
          message: `Are you sure you want to permanently delete user "${u.name}"? This action cannot be undone.`,
          confirmText: "Delete User",
          confirmClass: "bg-red-600 hover:bg-red-700 text-white",
        },
        () => adminFetch(`/api/users/${u._id}`, { method: "DELETE" }),
        onDeleted || onChanged
      ),

    approveRecovery: (u) =>
      confirm(
        {
          title: "Approve & Restore Account",
          message: `Are you sure you want to approve the recovery request for "${u.name}" and restore full profile access?`,
          confirmText: "Approve & Restore",
          confirmClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
        },
        () => adminFetch(`/api/users/${u._id}/cancel-deletion`, { method: "POST" })
      ),

    stopDeletion: (u) =>
      confirm(
        {
          title: "Stop Deletion Schedule",
          message: `Are you sure you want to cancel the deletion schedule for "${u.name}" and restore profile?`,
          confirmText: "Stop Deletion",
          confirmClass: "bg-emerald-600 hover:bg-emerald-700 text-white",
        },
        () => adminFetch(`/api/users/${u._id}/cancel-deletion`, { method: "POST" })
      ),

    rejectRecovery: (u) =>
      confirm(
        {
          title: "Reject Recovery Request",
          message: `Are you sure you want to reject the recovery request for "${u.name}"? The account will remain scheduled for deletion.`,
          confirmText: "Reject Request",
          confirmClass: "bg-amber-600 hover:bg-amber-700 text-white",
        },
        () => adminFetch(`/api/users/${u._id}/reject-recovery`, { method: "POST" })
      ),
  };

  const saveEdit = async (payload) => {
    try {
      await adminFetch(`/api/users/${editUser._id}`, { method: "PUT", body: payload });
      setEditUser(null);
      onChanged();
    } catch (err) {
      showError(err.message || "Update failed");
    }
  };

  const dialogs = (
    <>
      {editUser && (
        <Modal title="Edit User" maxWidth="max-w-3xl" onClose={() => setEditUser(null)}>
          <UserForm initial={editUser} onSubmit={saveEdit} onCancel={() => setEditUser(null)} />
        </Modal>
      )}
      {coinsUser && (
        <AssignCoinsModal
          user={coinsUser}
          onClose={() => setCoinsUser(null)}
          onDone={() => {
            setCoinsUser(null);
            onChanged();
          }}
        />
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
    </>
  );

  return { actions, dialogs };
}
