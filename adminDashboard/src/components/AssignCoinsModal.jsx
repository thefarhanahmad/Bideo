import { useState } from "react";
import Modal from "./Modal";
import { adminFetch } from "../lib/adminApi";

const inputClass =
  "w-full rounded-xl border border-line bg-surface/50 px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-brand focus:bg-white focus:outline-none";

/** Credit coins to a user (same request and copy as the Users list). */
const AssignCoinsModal = ({ user, onClose, onDone }) => {
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const amountNum = Number(amount);
    if (!amount || Number.isNaN(amountNum) || amountNum <= 0) {
      setError("Please enter a valid positive number of coins.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await adminFetch(`/api/users/${user._id}/assign-coins`, {
        method: "POST",
        body: { amount: amountNum, note: note.trim() || undefined },
      });
      onDone();
    } catch (err) {
      setError(err.message || "Failed to assign coins");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Assign Coins — ${user.name || user.channelName || "User"}`} maxWidth="max-w-md" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div className="rounded-xl bg-amber-50 border border-amber-200/80 p-3.5 text-xs text-amber-900">
          <div className="font-bold flex items-center gap-1.5">
            <span>🪙 Current Coins:</span>
            <span className="text-sm font-extrabold text-amber-950">{Number(user.coins || 0).toLocaleString()}</span>
          </div>
          <p className="mt-1 text-amber-800">
            Coins will be credited immediately to the user's account without sending any notification.
          </p>
        </div>

        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">{error}</div>}

        <div>
          <label className="block text-xs font-bold text-ink mb-1">
            Coins to Credit <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            step="any"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value);
              setError(null);
            }}
            placeholder="e.g. 50, 100, 500"
            className={inputClass}
            autoFocus
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-ink mb-1">Optional Admin Note / Reason</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Promotional credit, contest reward"
            className={inputClass}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-muted hover:bg-surface cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-brand px-5 py-2 text-xs font-bold text-white shadow-brand hover:bg-brand-dark disabled:opacity-50 cursor-pointer"
          >
            {saving ? "Crediting..." : "Credit Coins"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default AssignCoinsModal;
