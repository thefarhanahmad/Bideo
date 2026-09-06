import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { API_URL } from "../config";
import { UsersIcon, CloseIcon } from "./Icons";

const resolveMediaUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

export default function ChannelSelect({
  users: propUsers = [],
  value = "",
  onChange,
  disabled = false,
  placeholder = "Default (Admin Account)",
  initialUser = null,
  allowClear = true,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [fetchedUsers, setFetchedUsers] = useState([]);
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  // Persistent in-memory cache to retain user objects across searches
  const userCacheRef = useRef(new Map());

  // Helper to add user to cache
  const cacheUser = useCallback((u) => {
    if (!u) return;
    const id = String(u._id || u.id || "");
    if (id) {
      userCacheRef.current.set(id, u);
    }
  }, []);

  // Populate cache from propUsers and initialUser
  useEffect(() => {
    (propUsers || []).forEach(cacheUser);
    if (initialUser) cacheUser(initialUser);
  }, [propUsers, initialUser, cacheUser]);

  // Selected user state - initialized with initialUser if matching value
  const [selectedUser, setSelectedUser] = useState(() => {
    if (!value) return null;
    const strVal = String(value);
    if (initialUser && String(initialUser._id || initialUser.id) === strVal) {
      return initialUser;
    }
    const fromProps = (propUsers || []).find((u) => String(u._id || u.id) === strVal);
    if (fromProps) return fromProps;
    return null;
  });

  // Synchronize selectedUser whenever value, initialUser, or propUsers change
  useEffect(() => {
    if (!value) {
      setSelectedUser(null);
      return;
    }

    const strVal = String(value);

    // 1. Current selectedUser already matches
    if (selectedUser && String(selectedUser._id || selectedUser.id) === strVal) {
      return;
    }

    // 2. Check initialUser
    if (initialUser && String(initialUser._id || initialUser.id) === strVal) {
      setSelectedUser(initialUser);
      cacheUser(initialUser);
      return;
    }

    // 3. Check cache
    if (userCacheRef.current.has(strVal)) {
      setSelectedUser(userCacheRef.current.get(strVal));
      return;
    }

    // 4. Check propUsers
    const inProps = (propUsers || []).find((u) => String(u._id || u.id) === strVal);
    if (inProps) {
      setSelectedUser(inProps);
      cacheUser(inProps);
      return;
    }

    // 5. Fetch single user by ID if not found anywhere
    let isMounted = true;
    const resolveUser = async () => {
      try {
        const token = localStorage.getItem("admin_token");
        const res = await fetch(`${API_URL}/api/users/${strVal}`, {
          headers: { Authorization: `Bearer ${token}` },
          credentials: "include",
        });
        if (!res.ok) return;
        const data = await res.json();
        const userObj = data.data || data.user;
        if (userObj && isMounted) {
          cacheUser(userObj);
          setSelectedUser(userObj);
        }
      } catch (err) {
        // Ignore network failure on user lookup
      }
    };
    resolveUser();

    return () => {
      isMounted = false;
    };
  }, [value, initialUser, propUsers, selectedUser, cacheUser]);

  // Fetch initial users if propUsers is empty and dropdown opens
  useEffect(() => {
    if (isOpen && (!propUsers || propUsers.length === 0) && fetchedUsers.length === 0) {
      const fetchInitial = async () => {
        try {
          const token = localStorage.getItem("admin_token");
          const res = await fetch(`${API_URL}/api/users?simple=true&limit=100`, {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          });
          const data = await res.json();
          if (data.data && Array.isArray(data.data)) {
            setFetchedUsers(data.data);
            data.data.forEach(cacheUser);
          }
        } catch (e) {
          // ignore
        }
      };
      fetchInitial();
    }
  }, [isOpen, propUsers, fetchedUsers.length, cacheUser]);

  // Debounced server-side search across all users
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem("admin_token");
        const cleanQuery = term.replace(/^@+/, "");
        const res = await fetch(
          `${API_URL}/api/users?simple=true&search=${encodeURIComponent(cleanQuery || term)}&limit=50`,
          {
            headers: { Authorization: `Bearer ${token}` },
            credentials: "include",
          }
        );
        const data = await res.json();
        if (data.data && Array.isArray(data.data)) {
          setSearchResults(data.data);
          data.data.forEach(cacheUser);
        }
      } catch (err) {
        // silent fail
      } finally {
        setIsSearching(false);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchTerm, cacheUser]);

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

  // Compute displayed channels list
  const displayedUsers = useMemo(() => {
    const term = searchTerm.trim().toLowerCase().replace(/^@+/, "");
    const map = new Map();

    if (term) {
      // 1. Add server search results
      (searchResults || []).forEach((u) => {
        const id = String(u._id || u.id || "");
        if (id) map.set(id, u);
      });

      // 2. Also search all cached users locally for instant matches
      userCacheRef.current.forEach((u, id) => {
        const ch = (u.channelName || "").toLowerCase().replace(/^@+/, "");
        const nm = (u.name || "").toLowerCase();
        const em = (u.email || "").toLowerCase();
        const ph = (u.phone || "").toLowerCase();
        const combined = `${ch} ${nm} ${em} ${ph} ${id}`;
        if (combined.includes(term)) {
          map.set(id, u);
        }
      });

      return Array.from(map.values());
    }

    // When NOT searching:
    // Ensure selectedUser & initialUser are pinned at the top
    if (selectedUser) {
      const id = String(selectedUser._id || selectedUser.id || "");
      if (id) map.set(id, selectedUser);
    }
    if (initialUser) {
      const id = String(initialUser._id || initialUser.id || "");
      if (id) map.set(id, initialUser);
    }

    // Add propUsers or fetchedUsers
    const baseList = propUsers && propUsers.length > 0 ? propUsers : fetchedUsers;
    baseList.forEach((u) => {
      const id = String(u._id || u.id || "");
      if (id && !map.has(id)) {
        map.set(id, u);
      }
    });

    return Array.from(map.values());
  }, [searchTerm, searchResults, propUsers, fetchedUsers, selectedUser, initialUser]);

  const handleSelect = (u) => {
    if (!u) {
      setSelectedUser(null);
      if (onChange) onChange("", null);
    } else {
      cacheUser(u);
      setSelectedUser(u);
      const id = String(u._id || u.id || "");
      if (onChange) onChange(id, u);
    }
    setIsOpen(false);
    setSearchTerm("");
  };

  const handleClear = (e) => {
    e.stopPropagation();
    handleSelect(null);
  };

  const getCleanHandle = (u) => {
    if (!u) return "";
    if (u.channelName) {
      return `@${u.channelName.replace(/^@+/, "")}`;
    }
    return u.name || "User";
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
            ? "border-brand ring-2 ring-brand/20 bg-white shadow-xs"
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
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      if (e.currentTarget.nextSibling) {
                        e.currentTarget.nextSibling.style.display = "flex";
                      }
                    }}
                  />
                ) : null}
                <span style={{ display: selectedUser.avatar ? "none" : "flex" }}>
                  {(selectedUser.channelName || selectedUser.name || "U")[0].toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 leading-tight">
                  <span className="font-bold text-xs text-ink truncate">
                    {getCleanHandle(selectedUser)}
                  </span>
                  {selectedUser.isVerified && (
                    <span className="text-blue-500 text-[11px] font-bold" title="Verified Creator">
                      ✓
                    </span>
                  )}
                  {selectedUser.role === "admin" && (
                    <span className="rounded-full bg-purple-100 text-purple-700 px-1.5 py-0.2 text-[8px] font-bold">
                      Admin
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-muted truncate mt-0.5">
                  {selectedUser.name || "Creator"}
                  {selectedUser.phone ? ` • 📞 ${selectedUser.phone}` : selectedUser.email ? ` • ✉️ ${selectedUser.email}` : ""}
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

        {/* Action icons on right */}
        <div className="flex items-center gap-1 shrink-0 ml-1">
          {allowClear && selectedUser && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={handleClear}
              onKeyDown={(e) => e.key === "Enter" && handleClear(e)}
              title="Reset to Default Admin"
              className="p-1 rounded-lg text-muted hover:text-red-600 hover:bg-red-50 transition-colors"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </span>
          )}
          <svg
            className={`h-4 w-4 text-muted transition-transform duration-200 ${isOpen ? "rotate-180 text-brand" : ""}`}
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
        <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-2xl border border-line bg-white shadow-2xl overflow-hidden animate-fade-in flex flex-col min-w-[280px]">
          {/* Search Box Header */}
          <div className="p-2.5 border-b border-line bg-surface/40">
            <div className="relative">
              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search channel handle, name, phone, email, or ID..."
                className="w-full rounded-xl border border-line bg-white py-1.5 pl-8 pr-8 text-xs text-ink placeholder-muted outline-none focus:border-brand focus:ring-2 focus:ring-brand/20"
              />
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </span>

              {/* Spinner or Clear Icon */}
              {isSearching ? (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-brand animate-spin">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                </span>
              ) : searchTerm ? (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted hover:text-ink p-0.5"
                >
                  <CloseIcon className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex items-center justify-between mt-1.5 px-1 text-[10px] text-muted font-medium">
              <span>
                {isSearching
                  ? "Searching across all users..."
                  : `${displayedUsers.length} creator${displayedUsers.length === 1 ? "" : "s"} found`}
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
          <div className="max-h-64 overflow-y-auto p-1.5 space-y-1 divide-y divide-line/40">
            {/* Default Admin Option */}
            <button
              type="button"
              onClick={() => handleSelect(null)}
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

            {/* Creator / User Options */}
            <div className="pt-1 space-y-1">
              {displayedUsers.map((u) => {
                const uId = String(u._id || u.id || "");
                const isSelected = value && String(value) === uId;
                const cleanHandle = getCleanHandle(u);

                return (
                  <button
                    key={uId}
                    type="button"
                    onClick={() => handleSelect(u)}
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
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                            if (e.currentTarget.nextSibling) {
                              e.currentTarget.nextSibling.style.display = "flex";
                            }
                          }}
                        />
                      ) : null}
                      <span style={{ display: u.avatar ? "none" : "flex" }}>
                        {(u.channelName || u.name || "U")[0].toUpperCase()}
                      </span>
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 leading-tight">
                        <span className="font-bold text-xs text-ink truncate">
                          {cleanHandle}
                        </span>
                        {u.channelName && u.name && u.name.toLowerCase() !== u.channelName.toLowerCase() && (
                          <span className="text-[11px] text-muted truncate">
                            • {u.name}
                          </span>
                        )}
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
                      <div className="text-[10px] text-muted truncate mt-0.5 leading-tight flex items-center gap-2">
                        {u.phone ? (
                          <span>📞 {u.phone}</span>
                        ) : u.email ? (
                          <span>✉️ {u.email}</span>
                        ) : (
                          <span>Channel Profile</span>
                        )}
                        {u._id && (
                          <span className="text-[9px] text-muted/60 font-mono">
                            ID: {String(u._id).slice(-6)}
                          </span>
                        )}
                      </div>
                    </div>

                    {isSelected && (
                      <span className="text-brand text-xs font-bold shrink-0">✓</span>
                    )}
                  </button>
                );
              })}

              {displayedUsers.length === 0 && !isSearching && (
                <div className="py-6 text-center text-xs text-muted px-3">
                  <div className="font-semibold text-ink">No channels match "{searchTerm}"</div>
                  <div className="mt-1 text-[11px] text-muted">
                    Try searching by channel handle (@handle), creator name, phone, email, or user ID.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
