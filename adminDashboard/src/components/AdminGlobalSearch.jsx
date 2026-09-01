import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "../config";
import {
  PlayIcon,
  UsersIcon,
  TagIcon,
  FlagIcon,
  WalletIcon,
  CashIcon,
  TvIcon,
  AlertOctagonIcon,
  GridIcon,
  CloseIcon,
  ArrowRightIcon,
} from "./Icons";

const resolveMediaUrl = (url) => {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const formatDuration = (seconds) => {
  let totalSecs = Math.round(Number(seconds) || 0);
  if (totalSecs > 1000) totalSecs = Math.round(totalSecs / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = Math.floor(totalSecs % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

const highlightMatch = (text, query) => {
  if (!text) return "";
  if (!query || !query.trim()) return text;

  const rawTerms = query
    .split(/[\s,+#|/]+/)
    .map((t) => t.replace(/^[#@]+/, "").trim())
    .filter(Boolean);
  if (rawTerms.length === 0) return text;

  const escapedTerms = rawTerms.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const regex = new RegExp(`(${escapedTerms.join("|")})`, "gi");

  const parts = String(text).split(regex);
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-brand/20 text-brand font-bold px-0.5 rounded">
        {part}
      </mark>
    ) : (
      part
    )
  );
};

const quickPages = [
  { label: "Videos Management", path: "/admin/videos", icon: PlayIcon, category: "Videos" },
  { label: "Users & Channels", path: "/admin/users", icon: UsersIcon, category: "Users" },
  { label: "Content Categories", path: "/admin/categories", icon: TagIcon, category: "Categories" },
  { label: "Reported Content", path: "/admin/reports", icon: FlagIcon, category: "Reports" },
  { label: "Monetization Audits", path: "/admin/monetization", icon: WalletIcon, category: "Monetization" },
  { label: "Creator Payouts", path: "/admin/payouts", icon: CashIcon, category: "Payouts" },
  { label: "Ads Management", path: "/admin/ads", icon: TvIcon, category: "Ads" },
  { label: "System Error Logs", path: "/admin/error-logs", icon: AlertOctagonIcon, category: "Logs" },
  { label: "Dashboard Overview", path: "/admin", icon: GridIcon, category: "Overview" },
];

const AdminGlobalSearch = () => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState({
    videos: [],
    users: [],
    categories: [],
    reports: [],
    monetization: [],
    payouts: [],
    ads: [],
  });
  const [counts, setCounts] = useState({
    videos: 0,
    users: 0,
    categories: 0,
    reports: 0,
    monetization: 0,
    payouts: 0,
    ads: 0,
    total: 0,
  });

  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const debounceTimerRef = useRef(null);

  // Global keyboard shortcut Ctrl+K or / to open/focus search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === "/" && !["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        setIsOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      } else if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  // Click outside listener to dismiss dropdown
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch search results from server
  const fetchSearchResults = useCallback(async (searchTerm) => {
    if (!searchTerm || !searchTerm.trim()) {
      setResults({
        videos: [],
        users: [],
        categories: [],
        reports: [],
        monetization: [],
        payouts: [],
        ads: [],
      });
      setCounts({
        videos: 0,
        users: 0,
        categories: 0,
        reports: 0,
        monetization: 0,
        payouts: 0,
        ads: 0,
        total: 0,
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(
        `${API_URL}/api/admin/search?q=${encodeURIComponent(searchTerm.trim())}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
          credentials: "include",
        }
      );
      const data = await res.json();
      if (res.ok && data.success) {
        setResults(data.data || {});
        setCounts(data.counts || {});
      }
    } catch (err) {
      console.error("Global search error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleInputChange = (e) => {
    const val = e.target.value;
    setQuery(val);
    setIsOpen(true);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      fetchSearchResults(val);
    }, 200);
  };

  const handleClear = () => {
    setQuery("");
    setResults({
      videos: [],
      users: [],
      categories: [],
      reports: [],
      monetization: [],
      payouts: [],
      ads: [],
    });
    setCounts({
      videos: 0,
      users: 0,
      categories: 0,
      reports: 0,
      monetization: 0,
      payouts: 0,
      ads: 0,
      total: 0,
    });
    inputRef.current?.focus();
  };

  const handleNavigate = (path, searchParam = "") => {
    setIsOpen(false);
    if (searchParam) {
      navigate(`${path}?search=${encodeURIComponent(searchParam)}`);
    } else {
      navigate(path);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Search Input Bar */}
      <div className="relative flex items-center w-full">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-muted">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>

        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder="Search videos, channels, creators, categories, reports, payouts... (Ctrl+K)"
          className="w-full rounded-xl border border-line bg-surface/70 hover:bg-white focus:bg-white pl-9 pr-20 py-2 text-xs sm:text-sm text-ink placeholder:text-muted/80 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all shadow-xs"
        />

        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1.5">
          {query ? (
            <button
              onClick={handleClear}
              className="p-1 rounded-md text-muted hover:text-ink hover:bg-surface transition-colors"
              title="Clear search"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          ) : (
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] font-semibold text-muted shadow-2xs">
              <span className="text-xs">⌘</span>K
            </kbd>
          )}
        </div>
      </div>

      {/* Dropdown Modal Results */}
      {isOpen && (
        <div className="absolute left-0 right-0 top-full mt-2 z-50 rounded-2xl border border-line bg-white shadow-2xl overflow-hidden animate-fade-in max-h-[85vh] sm:max-h-[600px] flex flex-col">
          {/* Header tabs when there is a search query */}
          {query.trim() && (
            <div className="border-b border-line bg-surface/50 px-3 py-2 flex items-center justify-between gap-2 overflow-x-auto shrink-0">
              <div className="flex items-center gap-1 min-w-max">
                <button
                  onClick={() => setActiveTab("all")}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                    activeTab === "all"
                      ? "bg-brand text-white shadow-xs"
                      : "text-ink/70 hover:bg-white hover:text-ink"
                  }`}
                >
                  All ({counts.total})
                </button>
                {counts.videos > 0 && (
                  <button
                    onClick={() => setActiveTab("videos")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === "videos"
                        ? "bg-brand text-white shadow-xs"
                        : "text-ink/70 hover:bg-white hover:text-ink"
                    }`}
                  >
                    Videos ({counts.videos})
                  </button>
                )}
                {counts.users > 0 && (
                  <button
                    onClick={() => setActiveTab("users")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === "users"
                        ? "bg-brand text-white shadow-xs"
                        : "text-ink/70 hover:bg-white hover:text-ink"
                    }`}
                  >
                    Channels & Users ({counts.users})
                  </button>
                )}
                {counts.categories > 0 && (
                  <button
                    onClick={() => setActiveTab("categories")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === "categories"
                        ? "bg-brand text-white shadow-xs"
                        : "text-ink/70 hover:bg-white hover:text-ink"
                    }`}
                  >
                    Categories ({counts.categories})
                  </button>
                )}
                {counts.reports > 0 && (
                  <button
                    onClick={() => setActiveTab("reports")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === "reports"
                        ? "bg-brand text-white shadow-xs"
                        : "text-ink/70 hover:bg-white hover:text-ink"
                    }`}
                  >
                    Reports ({counts.reports})
                  </button>
                )}
                {counts.monetization > 0 && (
                  <button
                    onClick={() => setActiveTab("monetization")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === "monetization"
                        ? "bg-brand text-white shadow-xs"
                        : "text-ink/70 hover:bg-white hover:text-ink"
                    }`}
                  >
                    Monetization ({counts.monetization})
                  </button>
                )}
                {counts.payouts > 0 && (
                  <button
                    onClick={() => setActiveTab("payouts")}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      activeTab === "payouts"
                        ? "bg-brand text-white shadow-xs"
                        : "text-ink/70 hover:bg-white hover:text-ink"
                    }`}
                  >
                    Payouts ({counts.payouts})
                  </button>
                )}
              </div>

              {loading && (
                <div className="flex items-center gap-1.5 text-xs text-brand shrink-0 pr-1">
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand border-t-transparent" />
                  <span>Searching...</span>
                </div>
              )}
            </div>
          )}

          {/* Results Content Area */}
          <div className="overflow-y-auto p-3 space-y-4 flex-1">
            {/* 1. Quick Navigation Shortcuts when search query is empty */}
            {!query.trim() && (
              <div>
                <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                  Quick Navigation
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {quickPages.map((p) => {
                    const Icon = p.icon;
                    return (
                      <button
                        key={p.path}
                        onClick={() => handleNavigate(p.path)}
                        className="flex items-center gap-3 rounded-xl p-2.5 text-left text-xs font-medium text-ink hover:bg-brand-50 hover:text-brand transition-colors group"
                      >
                        <div className="grid h-8 w-8 place-items-center rounded-lg bg-surface text-ink/70 group-hover:bg-brand group-hover:text-white transition-colors shrink-0">
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-ink group-hover:text-brand truncate">
                            {p.label}
                          </div>
                          <div className="text-[10px] text-muted truncate">
                            {p.path}
                          </div>
                        </div>
                        <ArrowRightIcon className="h-3.5 w-3.5 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. When search query is entered and results are present */}
            {query.trim() && (
              <>
                {/* Videos Section */}
                {(activeTab === "all" || activeTab === "videos") && results.videos?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                      <span className="flex items-center gap-1.5">
                        <PlayIcon className="h-3.5 w-3.5 text-brand" /> Videos ({results.videos.length})
                      </span>
                      <button
                        onClick={() => handleNavigate("/admin/videos", query)}
                        className="text-brand hover:underline font-semibold"
                      >
                        View all in Videos →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      {results.videos.slice(0, activeTab === "videos" ? 20 : 5).map((v) => (
                        <button
                          key={v._id}
                          onClick={() => handleNavigate("/admin/videos", v.title || v._id)}
                          className="flex items-center gap-3 rounded-xl p-2 text-left hover:bg-brand-50/70 transition-colors group border border-transparent hover:border-brand-200"
                        >
                          {/* Thumbnail */}
                          <div className="relative h-12 w-20 shrink-0 rounded-lg overflow-hidden bg-surface border border-line">
                            {v.thumbnail ? (
                              <img
                                src={resolveMediaUrl(v.thumbnail)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center text-muted">
                                <PlayIcon className="h-4 w-4" />
                              </div>
                            )}
                            {v.duration > 0 && (
                              <span className="absolute bottom-0.5 right-0.5 rounded bg-black/75 px-1 py-0.2 text-[9px] font-bold text-white">
                                {formatDuration(v.duration)}
                              </span>
                            )}
                            {v.isShort && (
                              <span className="absolute top-0.5 left-0.5 rounded bg-brand px-1 py-0.2 text-[8px] font-extrabold text-white">
                                SHORT
                              </span>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <h4 className="font-semibold text-xs sm:text-sm text-ink group-hover:text-brand truncate">
                              {highlightMatch(v.title || "Untitled Video", query)}
                            </h4>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-muted">
                              <span className="font-medium text-ink/80 truncate max-w-[140px]">
                                {highlightMatch(v.owner?.channelName ? `@${v.owner.channelName}` : (v.owner?.name || "Unknown Creator"), query)}
                              </span>
                              <span>•</span>
                              <span>{(v.views || 0).toLocaleString()} views</span>
                              <span>•</span>
                              <span
                                className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                                  v.visibility === "public"
                                    ? "bg-green-100 text-green-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {v.visibility || "public"}
                              </span>
                              {v.category?.name && (
                                <span className="rounded bg-surface px-1.5 py-0.2 text-[9px] font-medium text-muted border border-line">
                                  {highlightMatch(v.category.name, query)}
                                </span>
                              )}
                            </div>
                            {Array.isArray(v.tags) && v.tags.length > 0 && (
                              <div className="flex flex-wrap items-center gap-1 mt-1">
                                {v.tags.slice(0, 4).map((tag, idx) => (
                                  <span
                                    key={idx}
                                    className="rounded bg-surface px-1.5 py-0.2 text-[9px] font-medium text-muted border border-line"
                                  >
                                    #{highlightMatch(tag, query)}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>

                          <ArrowRightIcon className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-1" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Users / Channels Section */}
                {(activeTab === "all" || activeTab === "users") && results.users?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                      <span className="flex items-center gap-1.5">
                        <UsersIcon className="h-3.5 w-3.5 text-blue-500" /> Channels & Users ({results.users.length})
                      </span>
                      <button
                        onClick={() => handleNavigate("/admin/users", query)}
                        className="text-brand hover:underline font-semibold"
                      >
                        View all in Users →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      {results.users.slice(0, activeTab === "users" ? 20 : 5).map((u) => (
                        <button
                          key={u._id}
                          onClick={() => handleNavigate("/admin/users", u.channelName || u.name || u._id)}
                          className="flex items-center gap-3 rounded-xl p-2 text-left hover:bg-blue-50/70 transition-colors group border border-transparent hover:border-blue-200"
                        >
                          {/* Avatar */}
                          <div className="h-10 w-10 shrink-0 rounded-full overflow-hidden bg-surface border border-line">
                            {u.avatar ? (
                              <img
                                src={resolveMediaUrl(u.avatar)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="grid h-full w-full place-items-center font-bold text-xs text-muted">
                                {(u.name || "U")[0].toUpperCase()}
                              </div>
                            )}
                          </div>

                          {/* Info */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5">
                              <h4 className="font-semibold text-xs sm:text-sm text-ink group-hover:text-blue-600 truncate">
                                {u.channelName ? (
                                  <span>@{highlightMatch(u.channelName, query)}</span>
                                ) : (
                                  highlightMatch(u.name || "User", query)
                                )}
                              </h4>
                              {u.isVerified && (
                                <span className="text-blue-500 text-xs font-bold" title="Verified Creator">
                                  ✓
                                </span>
                              )}
                              {u.isMonetized && (
                                <span className="rounded-full bg-emerald-100 text-emerald-700 px-1.5 py-0.2 text-[9px] font-bold">
                                  Monetized
                                </span>
                              )}
                              {u.role === "admin" && (
                                <span className="rounded-full bg-purple-100 text-purple-700 px-1.5 py-0.2 text-[9px] font-bold">
                                  Admin
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap items-center gap-2 mt-0.5 text-[11px] text-muted">
                              {u.name && <span className="truncate">{u.name}</span>}
                              {u.email && (
                                <>
                                  <span>•</span>
                                  <span className="truncate">{u.email}</span>
                                </>
                              )}
                              {u.phone && (
                                <>
                                  <span>•</span>
                                  <span>{u.phone}</span>
                                </>
                              )}
                              {u.followersCount !== undefined && (
                                <>
                                  <span>•</span>
                                  <span>{u.followersCount} followers</span>
                                </>
                              )}
                            </div>
                          </div>

                          <ArrowRightIcon className="h-4 w-4 text-muted opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mr-1" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Categories Section */}
                {(activeTab === "all" || activeTab === "categories") && results.categories?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                      <span className="flex items-center gap-1.5">
                        <TagIcon className="h-3.5 w-3.5 text-amber-500" /> Categories ({results.categories.length})
                      </span>
                      <button
                        onClick={() => handleNavigate("/admin/categories", query)}
                        className="text-brand hover:underline font-semibold"
                      >
                        View all in Categories →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {results.categories.map((c) => (
                        <button
                          key={c._id}
                          onClick={() => handleNavigate("/admin/categories", c.name)}
                          className="flex items-center gap-2.5 rounded-xl p-2 text-left hover:bg-amber-50/70 transition-colors group border border-transparent hover:border-amber-200"
                        >
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-amber-100 text-amber-700 shrink-0">
                            <TagIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs text-ink group-hover:text-amber-700 truncate">
                              {c.name}
                            </div>
                            <div className="text-[10px] text-muted truncate">
                              slug: {c.slug || c.name.toLowerCase()}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reports Section */}
                {(activeTab === "all" || activeTab === "reports") && results.reports?.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                      <span className="flex items-center gap-1.5">
                        <FlagIcon className="h-3.5 w-3.5 text-red-500" /> Reported Videos ({results.reports.length})
                      </span>
                      <button
                        onClick={() => handleNavigate("/admin/reports", query)}
                        className="text-brand hover:underline font-semibold"
                      >
                        View all in Reports →
                      </button>
                    </div>

                    <div className="grid grid-cols-1 gap-1.5">
                      {results.reports.map((r) => (
                        <button
                          key={r._id}
                          onClick={() => handleNavigate("/admin/reports", r.video?.title || r.reason || r._id)}
                          className="flex items-center gap-3 rounded-xl p-2 text-left hover:bg-red-50/70 transition-colors group border border-transparent hover:border-red-200"
                        >
                          <div className="grid h-8 w-8 place-items-center rounded-lg bg-red-100 text-red-600 shrink-0">
                            <FlagIcon className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-xs text-ink group-hover:text-red-600 truncate">
                                {r.video?.title || "Deleted Video"}
                              </h4>
                              <span
                                className={`rounded px-1.5 py-0.2 text-[9px] font-bold uppercase ${
                                  r.status === "open"
                                    ? "bg-red-100 text-red-700"
                                    : r.status === "reviewed"
                                    ? "bg-blue-100 text-blue-700"
                                    : "bg-surface text-muted"
                                }`}
                              >
                                {r.status}
                              </span>
                            </div>
                            <div className="text-[11px] text-muted truncate">
                              Reason: <span className="text-ink font-medium">{r.reason}</span> • Reported by:{" "}
                              {r.reporter?.name || "User"}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Monetization Applications & Payouts Section */}
                {(activeTab === "all" || activeTab === "monetization" || activeTab === "payouts") &&
                  (results.monetization?.length > 0 || results.payouts?.length > 0) && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-2 text-[11px] font-bold uppercase tracking-wider text-muted">
                        <span className="flex items-center gap-1.5">
                          <WalletIcon className="h-3.5 w-3.5 text-emerald-500" /> Monetization & Payouts
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                        {results.monetization?.map((m) => (
                          <button
                            key={m._id}
                            onClick={() => handleNavigate("/admin/monetization", m.name || m.user?.channelName)}
                            className="flex items-center gap-2.5 rounded-xl p-2 text-left hover:bg-emerald-50/70 transition-colors group border border-transparent hover:border-emerald-200"
                          >
                            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                              <WalletIcon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs text-ink group-hover:text-emerald-700 truncate">
                                {m.name || m.user?.name} ({m.user?.channelName || "Creator"})
                              </div>
                              <div className="text-[10px] text-muted truncate">
                                UPI: {m.upiId || "-"} • Status: {m.status}
                              </div>
                            </div>
                          </button>
                        ))}

                        {results.payouts?.map((p) => (
                          <button
                            key={p._id}
                            onClick={() => handleNavigate("/admin/payouts", p.transactionId || p.user?.name)}
                            className="flex items-center gap-2.5 rounded-xl p-2 text-left hover:bg-emerald-50/70 transition-colors group border border-transparent hover:border-emerald-200"
                          >
                            <div className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 shrink-0">
                              <CashIcon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-xs text-ink group-hover:text-emerald-700 truncate">
                                ₹{p.amount || 0} - {p.user?.name || "Creator"}
                              </div>
                              <div className="text-[10px] text-muted truncate">
                                TXN: {p.transactionId || "Pending"} • Status: {p.status}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                {/* Empty State when no results found across any collection */}
                {!loading && counts.total === 0 && (
                  <div className="p-8 text-center space-y-3">
                    <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-surface text-muted">
                      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm text-ink">No matching results found</h4>
                      <p className="mt-1 text-xs text-muted max-w-sm mx-auto">
                        No videos, channels, creators, categories, or reports matched &quot;{query}&quot;. Try searching with a different title, username, channel handle, phone number, or ID.
                      </p>
                    </div>
                    <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
                      <button
                        onClick={() => handleNavigate("/admin/videos", query)}
                        className="rounded-lg bg-surface border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brand hover:text-white transition-colors"
                      >
                        Search in Videos page
                      </button>
                      <button
                        onClick={() => handleNavigate("/admin/users", query)}
                        className="rounded-lg bg-surface border border-line px-3 py-1.5 text-xs font-semibold text-ink hover:bg-brand hover:text-white transition-colors"
                      >
                        Search in Users page
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Footer Bar */}
          <div className="border-t border-line bg-surface/50 px-3 py-2 flex items-center justify-between text-[11px] text-muted shrink-0">
            <div className="flex items-center gap-2">
              <span>Press <kbd className="rounded border border-line bg-white px-1 py-0.2 font-mono">ESC</kbd> to close</span>
              <span>•</span>
              <span><kbd className="rounded border border-line bg-white px-1 py-0.2 font-mono">↵</kbd> to navigate</span>
            </div>
            {query.trim() && (
              <div className="font-medium text-ink">
                Found {counts.total} result{counts.total === 1 ? "" : "s"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminGlobalSearch;
