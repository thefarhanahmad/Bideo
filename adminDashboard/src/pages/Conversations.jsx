import { useEffect, useState, useCallback } from "react";
import DataTableToolbar from "../components/DataTableToolbar";
import Pagination from "../components/Pagination";
import LoadingSkeleton from "../components/LoadingSkeleton";
import ConfirmModal from "../components/ConfirmModal";
import Modal from "../components/Modal";
import StatCard from "../components/StatCard";
import { MessageSquareIcon, UsersIcon, ShieldIcon, AlertOctagonIcon } from "../components/Icons";
import { useTableParams } from "../hooks/useTableParams";
import { API_URL } from "../config";

const resolveMediaUrl = (url) => {
  if (!url) return "https://via.placeholder.com/100x100.png?text=User";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const formatTimeAgo = (dateStr) => {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-IN", {
    month: "short",
    day: "numeric",
  });
};

const formatDuration = (seconds) => {
  let totalSecs = Math.round(Number(seconds) || 0);
  if (totalSecs > 1000) totalSecs = Math.round(totalSecs / 1000);
  const mins = Math.floor(totalSecs / 60);
  const secs = Math.floor(totalSecs % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

const Conversations = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    accepted: 0,
    pending: 0,
    blocked: 0,
  });

  // Selected conversation for viewing messages modal
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Deletion confirm modal
  const [deletingId, setDeletingId] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const API = API_URL;

  // URL-synced search, filter, and pagination
  const { search, setSearch, filter, setFilter, page, setPage, limit, setLimit } =
    useTableParams({ defaultFilter: "all", defaultLimit: 10 });

  const fetchConversations = useCallback(
    async (currentPage = page, currentLimit = limit, currentFilter = filter, currentSearch = search) => {
      setLoading(true);
      try {
        const token = localStorage.getItem("admin_token");
        const params = new URLSearchParams({
          page: currentPage,
          limit: currentLimit,
        });
        if (currentFilter && currentFilter !== "all") params.append("status", currentFilter);
        if (currentSearch && currentSearch.trim()) params.append("search", currentSearch.trim());

        const res = await fetch(`${API}/api/admin/conversations?${params.toString()}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || "Failed to load conversations");

        setConversations(data.data || []);
        setTotalItems(data.total || 0);
        setTotalPages(data.pages || 1);
        if (data.filterCounts) setFilterCounts(data.filterCounts);
      } catch (err) {
        alert(err.message);
      } finally {
        setLoading(false);
      }
    },
    [API, page, limit, filter, search]
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchConversations(page, limit, filter, search);
    }, 300);
    return () => clearTimeout(timer);
  }, [fetchConversations, page, limit, filter, search]);

  // Open transcript modal and load conversation messages
  const openChatModal = async (conv) => {
    setSelectedConv(conv);
    setLoadingMessages(true);
    setMessages([]);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${API}/api/admin/conversations/${conv._id}/messages`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to load messages");
      setMessages(data.data || []);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoadingMessages(false);
    }
  };

  // Delete conversation
  const handleDelete = async () => {
    if (!deletingId) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(`${API}/api/admin/conversations/${deletingId}`, {
        method: "DELETE",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to delete conversation");

      setDeletingId(null);
      fetchConversations(page, limit, filter, search);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsDeleting(false);
    }
  };

  const statusBadge = (status) => {
    switch (status) {
      case "accepted":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "pending":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "blocked":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-surface text-muted border-line";
    }
  };

  const statusLabel = (status) => {
    switch (status) {
      case "accepted":
        return "Active";
      case "pending":
        return "Pending Request";
      case "blocked":
        return "Blocked";
      default:
        return status;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="font-display text-2xl font-bold text-ink">User Conversations</h1>
        <p className="mt-1 text-sm text-muted">
          Monitor real-time 1-to-1 chats, inspect direct media sharing, and moderate conversations across the platform.
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard
          icon={MessageSquareIcon}
          label="Total Chats"
          value={filterCounts.all}
          tone="brand"
        />
        <StatCard
          icon={UsersIcon}
          label="Active Conversations"
          value={filterCounts.accepted}
          tone="green"
        />
        <StatCard
          icon={ShieldIcon}
          label="Pending Requests"
          value={filterCounts.pending}
          tone="amber"
        />
        <StatCard
          icon={AlertOctagonIcon}
          label="Blocked"
          value={filterCounts.blocked}
          tone="red"
        />
      </div>

      {/* Toolbar */}
      <DataTableToolbar
        search={search}
        onSearchChange={(v) => {
          setSearch(v);
          setPage(1);
        }}
        searchPlaceholder="Search by user name, handle, email, or message..."
        filter={filter}
        onFilterChange={(v) => {
          setFilter(v);
          setPage(1);
        }}
        filters={[
          { key: "all", label: "All Chats", count: filterCounts.all },
          { key: "accepted", label: "Active", count: filterCounts.accepted },
          { key: "pending", label: "Pending", count: filterCounts.pending },
          { key: "blocked", label: "Blocked", count: filterCounts.blocked },
        ]}
        totalCount={totalItems}
      />

      {/* Table */}
      {loading ? (
        <LoadingSkeleton type="table" rows={6} cols={5} />
      ) : conversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-line bg-white p-12 text-center shadow-card">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-50 text-brand">
            <MessageSquareIcon className="h-7 w-7" />
          </div>
          <h3 className="mt-4 font-display text-base font-semibold text-ink">No conversations found</h3>
          <p className="mt-1 max-w-sm text-sm text-muted">
            {search
              ? "No conversations match your search query. Try searching with different terms."
              : "No user conversations have been created yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[850px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="p-4 font-semibold">Participants</th>
                  <th className="p-4 font-semibold">Status</th>
                  <th className="p-4 font-semibold">Messages</th>
                  <th className="p-4 font-semibold">Latest Activity</th>
                  <th className="p-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {conversations.map((conv) => {
                  const p1 = conv.participants?.[0];
                  const p2 = conv.participants?.[1];
                  const initiatorId = conv.initiator?._id || conv.initiator;

                  return (
                    <tr
                      key={conv._id}
                      className="border-t border-line align-top hover:bg-surface/50 transition-colors"
                    >
                      {/* Participants */}
                      <td className="p-4">
                        <div className="flex flex-col gap-2.5">
                          {/* User 1 */}
                          {p1 && (
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={resolveMediaUrl(p1.avatar)}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-full bg-surface object-cover border border-line"
                                onError={(e) => {
                                  e.currentTarget.src = "https://via.placeholder.com/100x100.png?text=User";
                                }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-ink text-sm truncate">
                                    {p1.channelName || p1.name || "User"}
                                  </span>
                                  {p1.isVerified && (
                                    <span className="text-brand text-xs font-bold" title="Verified">✓</span>
                                  )}
                                  {String(p1._id) === String(initiatorId) && (
                                    <span className="rounded bg-brand-50 px-1.5 py-0.2 text-[10px] font-medium text-brand">
                                      Initiator
                                    </span>
                                  )}
                                </div>
                                <div className="truncate text-xs text-muted">
                                  {p1.email || p1.phone || `@${p1._id?.toString().slice(-6)}`}
                                </div>
                              </div>
                            </div>
                          )}

                          {/* User 2 */}
                          {p2 && (
                            <div className="flex items-center gap-2.5 min-w-0">
                              <img
                                src={resolveMediaUrl(p2.avatar)}
                                alt=""
                                className="h-9 w-9 shrink-0 rounded-full bg-surface object-cover border border-line"
                                onError={(e) => {
                                  e.currentTarget.src = "https://via.placeholder.com/100x100.png?text=User";
                                }}
                              />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-semibold text-ink text-sm truncate">
                                    {p2.channelName || p2.name || "User"}
                                  </span>
                                  {p2.isVerified && (
                                    <span className="text-brand text-xs font-bold" title="Verified">✓</span>
                                  )}
                                  {String(p2._id) === String(initiatorId) && (
                                    <span className="rounded bg-brand-50 px-1.5 py-0.2 text-[10px] font-medium text-brand">
                                      Initiator
                                    </span>
                                  )}
                                </div>
                                <div className="truncate text-xs text-muted">
                                  {p2.email || p2.phone || `@${p2._id?.toString().slice(-6)}`}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="p-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusBadge(
                            conv.status
                          )}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current" />
                          {statusLabel(conv.status)}
                        </span>
                        {conv.status === "blocked" && conv.blockedBy && (
                          <div className="mt-1 text-[11px] text-muted">
                            By: {conv.blockedBy.channelName || conv.blockedBy.name || "User"}
                          </div>
                        )}
                      </td>

                      {/* Messages Count */}
                      <td className="p-4 whitespace-nowrap">
                        <span className="rounded-xl bg-surface px-2.5 py-1 text-xs font-semibold text-ink border border-line">
                          {conv.totalMessages || 0} msgs
                        </span>
                      </td>

                      {/* Latest Activity */}
                      <td className="p-4 max-w-xs">
                        {conv.lastMessage?.text ? (
                          <div>
                            <p className="truncate text-xs text-ink font-medium">
                              {conv.lastMessage.text}
                            </p>
                            <span className="text-[11px] text-muted mt-0.5 block">
                              {formatTimeAgo(conv.lastMessage.createdAt || conv.updatedAt)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted italic">No messages yet</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="p-4 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => openChatModal(conv)}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand hover:text-white transition-colors"
                          >
                            <MessageSquareIcon className="h-3.5 w-3.5" />
                            View Chat
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingId(conv._id)}
                            className="rounded-xl border border-line p-1.5 text-muted hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors"
                            title="Delete Conversation"
                          >
                            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="border-t border-line p-4">
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={totalItems}
              limit={limit}
              onLimitChange={(l) => {
                setLimit(l);
                setPage(1);
              }}
            />
          </div>
        </div>
      )}

      {/* Conversation Messages Transcript Modal */}
      {selectedConv && (
        <Modal
          title={`Chat: ${selectedConv.participants?.map((p) => p.channelName || p.name).join(" & ")}`}
          onClose={() => setSelectedConv(null)}
          maxWidth="max-w-2xl"
        >
          <div className="flex flex-col h-[550px] -mx-6 -my-6">
            {/* Top Modal Subheader with Participants Info */}
            <div className="flex items-center justify-between border-b border-line bg-surface/50 px-6 py-3">
              <div className="flex items-center gap-4 text-xs">
                {selectedConv.participants?.map((p, idx) => (
                  <div key={p._id || idx} className="flex items-center gap-2">
                    <img
                      src={resolveMediaUrl(p.avatar)}
                      alt=""
                      className="h-7 w-7 rounded-full object-cover border border-line"
                    />
                    <div>
                      <span className="font-semibold text-ink">{p.channelName || p.name}</span>
                      <span className="text-muted ml-1.5 text-[11px]">{p.email || ""}</span>
                    </div>
                  </div>
                ))}
              </div>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadge(
                  selectedConv.status
                )}`}
              >
                {statusLabel(selectedConv.status)}
              </span>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-surface/30">
              {loadingMessages ? (
                <div className="flex items-center justify-center h-full text-muted text-sm">
                  Loading chat messages...
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center text-muted">
                  <MessageSquareIcon className="h-10 w-10 text-muted/50 mb-2" />
                  <p className="text-sm font-medium">No messages found in this conversation.</p>
                </div>
              ) : (
                messages.map((msg, index) => {
                  const isP1 = String(msg.sender?._id || msg.sender) === String(selectedConv.participants?.[0]?._id);
                  const senderName = msg.sender?.channelName || msg.sender?.name || (isP1 ? "User 1" : "User 2");
                  const senderAvatar = resolveMediaUrl(msg.sender?.avatar);

                  return (
                    <div
                      key={msg._id || index}
                      className={`flex gap-3 max-w-[85%] ${isP1 ? "mr-auto" : "ml-auto flex-row-reverse"}`}
                    >
                      <img
                        src={senderAvatar}
                        alt=""
                        className="h-8 w-8 shrink-0 rounded-full object-cover border border-line"
                        onError={(e) => {
                          e.currentTarget.src = "https://via.placeholder.com/100x100.png?text=User";
                        }}
                      />
                      <div
                        className={`rounded-2xl p-3.5 shadow-sm border ${
                          isP1
                            ? "bg-white border-line text-ink"
                            : "bg-brand text-white border-brand shadow-brand/10"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3 mb-1">
                          <span
                            className={`text-[11px] font-bold ${
                              isP1 ? "text-brand" : "text-white/90"
                            }`}
                          >
                            {senderName}
                          </span>
                          <span
                            className={`text-[10px] ${
                              isP1 ? "text-muted" : "text-white/70"
                            }`}
                          >
                            {formatTimeAgo(msg.createdAt)}
                          </span>
                        </div>

                        {/* Video Attachment Card */}
                        {msg.video && (
                          <div className={`mb-2.5 rounded-xl p-2 border ${isP1 ? "bg-surface border-line" : "bg-white/10 border-white/20"}`}>
                            <div className="flex gap-2.5 items-center">
                              {msg.video.thumbnail && (
                                <div className="relative shrink-0">
                                  <img
                                    src={resolveMediaUrl(msg.video.thumbnail)}
                                    alt=""
                                    className="h-12 w-20 rounded-lg object-cover bg-black/10"
                                  />
                                  {msg.video.duration > 0 && (
                                    <span className="absolute bottom-1 right-1 rounded bg-black/80 px-1 text-[9px] font-bold text-white">
                                      {formatDuration(msg.video.duration)}
                                    </span>
                                  )}
                                  {msg.video.isShort && (
                                    <span className="absolute top-1 left-1 rounded bg-brand px-1 text-[9px] font-bold text-white">
                                      Short
                                    </span>
                                  )}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className={`text-xs font-semibold line-clamp-1 ${isP1 ? "text-ink" : "text-white"}`}>
                                  {msg.video.title || "Shared Video"}
                                </p>
                                <p className={`text-[11px] mt-0.5 ${isP1 ? "text-muted" : "text-white/70"}`}>
                                  Creator: {msg.video.owner?.channelName || msg.video.owner?.name || "Creator"}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Post Attachment Card */}
                        {msg.post && (
                          <div className={`mb-2.5 rounded-xl p-2.5 border ${isP1 ? "bg-surface border-line" : "bg-white/10 border-white/20"}`}>
                            <p className={`text-xs font-semibold mb-1 ${isP1 ? "text-brand" : "text-white"}`}>
                              Shared Post • {msg.post.author?.channelName || msg.post.author?.name || "Creator"}
                            </p>
                            {msg.post.text && (
                              <p className={`text-xs line-clamp-2 ${isP1 ? "text-ink" : "text-white/90"}`}>
                                {msg.post.text}
                              </p>
                            )}
                            {(msg.post.image || msg.post.imageUrl) && (
                              <img
                                src={resolveMediaUrl(msg.post.image || msg.post.imageUrl)}
                                alt=""
                                className="mt-2 h-24 w-full rounded-lg object-cover"
                              />
                            )}
                          </div>
                        )}

                        {/* Message Text */}
                        {msg.text && (
                          <p className="text-xs leading-relaxed break-words whitespace-pre-wrap">
                            {msg.text}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Bottom Modal Footer */}
            <div className="flex items-center justify-between border-t border-line bg-white px-6 py-3">
              <span className="text-xs text-muted">
                Total {messages.length} messages in history
              </span>
              <button
                type="button"
                onClick={() => setSelectedConv(null)}
                className="rounded-xl bg-surface px-4 py-2 text-xs font-semibold text-ink hover:bg-line transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {deletingId && (
        <ConfirmModal
          title="Delete Conversation"
          message="Are you sure you want to permanently delete this conversation and all its messages? This action cannot be undone."
          confirmText={isDeleting ? "Deleting..." : "Delete Permanently"}
          confirmClass="bg-red-600 hover:bg-red-700 text-white"
          onConfirm={handleDelete}
          onCancel={() => setDeletingId(null)}
        />
      )}
    </div>
  );
};

export default Conversations;
