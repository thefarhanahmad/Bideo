import { useState, useRef, useEffect, useMemo } from "react";
import { API_URL } from "../config";
import { UsersIcon, CloseIcon } from "./Icons";

const resolveMediaUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

export default function ChannelSelect({
  users = [],
  value = "",
  onChange,
  disabled = false,
  placeholder = "Default (Admin Account)",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Find currently selected user
  const selectedUser = useMemo(() => {
    if (!value) return null;
    return users.find((u) => u._id === value || u.id === value) || null;
  }, [users, value]);

  // Close dropdown on click outside or escape key
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("keydown", handleKeyDown);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  // Filtered users list based on search term
  const filteredUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase().replace(/^@/, "");
    if (!term) return users;

    const tokens = term.split(/\s+/).filter(Boolean);
    return users.filter((u) => {
      const channel = (u.channelName || "").toLowerCase();
      const name = (u.name || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const phone = (u.phone || "").toLowerCase();
      const id = (u._id || u.id || "").toLowerCase();
      const combined = `${channel} ${name} ${email} ${phone} ${id}`;

      return tokens.every((tok) => combined.includes(tok));
    });
  }, [users, searchTerm]);

  const handleSelect = (userId) => {
    onChange(userId);
    setIsOpen(false);
    setSearchTerm("");
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2.5 rounded-xl border p-2.5 text-left transition-all outline-none ${
          isOpen
            ? "border-brand ring-2 ring-brand/20 bg-white"
            : "border-line bg-surface/30 hover:bg-surface/70 hover:border-line-strong"
        } ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {selectedUser ? (
            <>
              <div className="h-8 w-8 shrink-0 rounded-full overflow-hidden bg-brand/10 border border-brand/20 flex items-center justify-center text-xs font-bold text-brand">
                {selectedUser.avatar ? (
                  <img
                    src={resolveMediaUrl(selectedUser.avatar)}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  (selectedUser.channelName || selectedUser.name || "U")[0].toUpperCase()
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 leading-tight">
                  <span className="font-semibold text-xs text-ink truncate">
                    {selectedUser.channelName ? `@${selectedUser.channelName}` : selectedUser.name}
                  </span>
                  {selectedUser.isVerified && (
                    <span className="text-blue-500 text-[11px] font-bold" title="Verified Creator">
                      ✓
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted truncate mt-0.5">
                  {selectedUser.name}
                  {selectedUser.phone ? ` • ${selectedUser.phone}` : selectedUser.email ? ` • ${selectedUser.email}` : ""}
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="h-8 w-8 shrink-0 rounded-full bg-surface border border-line flex items-center justify-center text-muted">
                <UsersIcon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <span className="font-medium text-xs text-ink/80 block truncate">
                  {placeholder}
                </span>
                <span className="text-[10px] text-muted block truncate">
                  Will use the primary administrator account
                </span>
              </div>
            </>
          )}
        </div>

        {/* Chevron Icon */}
        <div className="shrink-0 text-muted ml-1">
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${isOpen ? "rotate-180 text-brand" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-line bg-white shadow-2xl overflow-hidden animate-fade-in flex flex-col">
          {/* Search Box Header */}
          <div className="p-2.5 border-b border-line bg-surface/40">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search channel handle, name, phone, email..."
                className="w-full rounded-xl border border-line bg-white py-1.5 pl-8 pr-7 text-xs text-ink placeholder-muted outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-muted font-medium">
              <span>
                {filteredUsers.length} channel{filteredUsers.length === 1 ? "" : "s"} available
              </span>
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="text-brand hover:underline font-semibold"
                >
                  Reset search
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Channel List */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 divide-y divide-line/40">
            {/* Default Admin Option */}
            <button
              type="button"
              onClick={() => handleSelect("")}
              className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors ${
                !value
                  ? "bg-brand/10 text-brand font-semibold"
                  : "hover:bg-surface/80 text-ink"
              }`}
            >
              <div className="h-7 w-7 shrink-0 rounded-full bg-surface border border-line flex items-center justify-center text-muted">
                <UsersIcon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold leading-tight">
                  Default (Admin Account)
                </div>
                <div className="text-[10px] text-muted leading-tight mt-0.5">
                  Post directly as system administrator
                </div>
              </div>
              {!value && (
                <span className="text-brand text-xs font-bold shrink-0">✓</span>
              )}
            </button>

            {/* User Options */}
            <div className="pt-1 space-y-1">
              {filteredUsers.map((u) => {
                const isSelected = (u._id || u.id) === value;
                return (
                  <button
                    key={u._id || u.id}
                    type="button"
                    onClick={() => handleSelect(u._id || u.id)}
                    className={`w-full flex items-center gap-2.5 p-2 rounded-xl text-left transition-colors ${
                      isSelected
                        ? "bg-brand-50 border border-brand-200 text-brand"
                        : "hover:bg-surface/80 text-ink border border-transparent"
                    }`}
                  >
                    <div className="h-7 w-7 shrink-0 rounded-full overflow-hidden bg-brand/10 border border-brand/20 flex items-center justify-center text-[11px] font-bold text-brand">
                      {u.avatar ? (
                        <img
                          src={resolveMediaUrl(u.avatar)}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        (u.channelName || u.name || "U")[0].toUpperCase()
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1 leading-tight">
                        <span className="font-semibold text-xs truncate">
                          {u.channelName ? `@${u.channelName}` : u.name}
                        </span>
                        {u.isVerified && (
                          <span className="text-blue-500 text-[10px] font-bold" title="Verified Creator">
                            ✓
                          </span>
                        )}
                        {u.role === "admin" && (
                          <span className="rounded-full bg-purple-100 text-purple-700 px-1.5 py-0.2 text-[8px] font-bold">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-muted truncate mt-0.5 leading-tight">
                        {u.name}
                        {u.phone ? ` • ${u.phone}` : u.email ? ` • ${u.email}` : ""}
                      </div>
                    </div>

                    {isSelected && (
                      <span className="text-brand text-xs font-bold shrink-0">✓</span>
                    )}
                  </button>
                );
              })}

              {filteredUsers.length === 0 && (
                <div className="py-6 text-center text-xs text-muted">
                  No channels match "{searchTerm}"
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
