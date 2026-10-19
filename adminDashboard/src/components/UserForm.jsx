import { useState } from "react";

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

export default UserForm;
