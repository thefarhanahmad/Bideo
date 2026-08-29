import { useEffect, useState, useMemo } from "react";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import DataTableToolbar from "../components/DataTableToolbar";
import Pagination from "../components/Pagination";
import { useTableParams } from "../hooks/useTableParams";
import { API_URL } from "../config";

const resolveMediaUrl = (url) => {
  if (!url) return "https://via.placeholder.com/640x360.png?text=No+Thumbnail";
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
};

const formatDuration = (seconds) => {
  let totalSecs = Math.round(Number(seconds) || 0);
  if (totalSecs > 1000) {
    totalSecs = Math.round(totalSecs / 1000);
  }
  const mins = Math.floor(totalSecs / 60);
  const secs = Math.floor(totalSecs % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
};

const getVideoMetadata = (file) => {
  return new Promise((resolve) => {
    if (!file) return resolve({ duration: 0, width: 0, height: 0 });
    const v = document.createElement("video");
    v.preload = "metadata";
    const objectUrl = URL.createObjectURL(file);
    v.src = objectUrl;
    v.onloadedmetadata = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        duration: Math.round(v.duration || 0),
        width: v.videoWidth || 0,
        height: v.videoHeight || 0,
      });
    };
    v.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({ duration: 0, width: 0, height: 0 });
    };
  });
};

const Videos = () => {
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editVideo, setEditVideo] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteVideo, setDeleteVideo] = useState(null);

  const [categories, setCategories] = useState([]);
  const [users, setUsers] = useState([]);

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

  const API = API_URL;

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + "/api/videos?sort=latest", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch videos");
      setVideos(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + "/api/categories", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) setCategories(data.data || []);
    } catch (e) {
      /* ignore */
    }
  };

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + "/api/users", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) setUsers(data.data || []);
    } catch (e) {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchVideos();
    fetchCategories();
    fetchUsers();
  }, []);

  const handleUpload = async (formData) => {
    const token = localStorage.getItem("admin_token");
    const res = await fetch(API + "/api/videos/upload", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
      credentials: "include",
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Upload failed");
    setShowAdd(false);
    await fetchVideos();
  };

  const handleUpdate = async (id, payload) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + "/api/videos/" + id, {
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
      setEditVideo(null);
      await fetchVideos();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API + "/api/videos/" + id, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Delete failed");
      setShowDelete(false);
      setDeleteVideo(null);
      await fetchVideos();
    } catch (err) {
      alert(err.message);
    }
  };

  const visibilityBadge = (v) => {
    const map = {
      public: "bg-emerald-50 text-emerald-600 border border-emerald-200",
      unlisted: "bg-amber-50 text-amber-600 border border-amber-200",
      private: "bg-red-50 text-red-600 border border-red-200",
    };
    return map[v] || "bg-surface text-muted border border-line";
  };

  const formatCreatedDate = (date) => {
    if (!date) return "-";
    return new Intl.DateTimeFormat("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(date));
  };

  const formatSize = (bytes) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getCompressionText = (orig, comp) => {
    if (!orig || !comp) return null;
    const pct = Math.round((1 - comp / orig) * 100);
    return `${formatSize(orig)} → ${formatSize(comp)} (${pct}% saved)`;
  };

  // Search & Filter Logic
  const { filteredVideos, filterCounts } = useMemo(() => {
    const counts = {
      all: videos.length,
      long: 0,
      shorts: 0,
      public: 0,
      private: 0,
      pinned: 0,
    };

    videos.forEach((v) => {
      if (v.isShort) counts.shorts += 1;
      else counts.long += 1;
      if (v.visibility === "public" || !v.visibility) counts.public += 1;
      if (v.visibility === "private" || v.visibility === "unlisted") counts.private += 1;
      if (v.isPinned) counts.pinned += 1;
    });

    const searchLower = (search || "").trim().toLowerCase();

    const filtered = videos.filter((v) => {
      // 1. Filter condition
      if (filter === "long" && v.isShort) return false;
      if (filter === "shorts" && !v.isShort) return false;
      if (filter === "public" && v.visibility !== "public" && v.visibility) return false;
      if (filter === "private" && v.visibility !== "private" && v.visibility !== "unlisted") return false;
      if (filter === "pinned" && !v.isPinned) return false;

      // 2. Search condition
      if (!searchLower) return true;
      const title = (v.title || "").toLowerCase();
      const desc = (v.description || "").toLowerCase();
      const ownerName = (v.owner?.name || "").toLowerCase();
      const channel = (v.owner?.channelName || "").toLowerCase();
      const catName = (v.category?.name || v.category || "").toLowerCase();

      return (
        title.includes(searchLower) ||
        desc.includes(searchLower) ||
        ownerName.includes(searchLower) ||
        channel.includes(searchLower) ||
        catName.includes(searchLower)
      );
    });

    return { filteredVideos: filtered, filterCounts: counts };
  }, [videos, filter, search]);

  // Paginate filtered results
  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / limit));
  const paginatedVideos = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredVideos.slice(startIndex, startIndex + limit);
  }, [filteredVideos, page, limit]);

  const filterOptions = [
    { label: "All Videos", value: "all", count: filterCounts.all },
    { label: "Long Form", value: "long", count: filterCounts.long },
    { label: "Shorts", value: "shorts", count: filterCounts.shorts },
    { label: "Public", value: "public", count: filterCounts.public },
    { label: "Private / Unlisted", value: "private", count: filterCounts.private },
    { label: "📌 Pinned", value: "pinned", count: filterCounts.pinned },
  ];

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">Videos Management</h2>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted">
            Manage uploaded videos, reels, compression pipelines, and homepage pin statuses.
          </p>
        </div>
      </div>

      {/* Toolbar: Search, Filters, Upload Button */}
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by title, owner, channel, or category..."
        filter={filter}
        onFilterChange={setFilter}
        filters={filterOptions}
        totalCount={videos.length}
        filteredCount={filteredVideos.length}
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
          >
            <span>+ Upload Video</span>
          </button>
        }
      />

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted shadow-card">
          Loading videos...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="p-4 font-semibold">Video Details</th>
                  <th className="p-4 font-semibold">Owner & Channel</th>
                  <th className="p-4 font-semibold">Duration</th>
                  <th className="p-4 font-semibold">Category</th>
                  <th className="p-4 font-semibold">Views</th>
                  <th className="p-4 font-semibold">Visibility</th>
                  <th className="p-4 font-semibold">Created</th>
                  <th className="p-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedVideos.map((v) => (
                  <tr key={v._id} className="border-t border-line align-middle hover:bg-surface/50 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative shrink-0 w-24 h-14 bg-surface rounded-lg overflow-hidden border border-line">
                          <img
                            src={resolveMediaUrl(v.thumbnail)}
                            alt="thumb"
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              e.currentTarget.src = "https://via.placeholder.com/640x360.png?text=Thumbnail";
                            }}
                          />
                          <span className="absolute bottom-1 right-1 bg-black/75 text-white text-[9px] px-1 rounded font-semibold">
                            {formatDuration(v.duration)}
                          </span>
                        </div>
                        <div className="min-w-0 max-w-xs">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="truncate font-semibold text-ink text-sm">{v.title}</span>
                            {v.isPinned && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 border border-amber-300">
                                📌 Pinned
                              </span>
                            )}
                            {v.isShort && (
                              <span className="inline-flex items-center gap-0.5 rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700 border border-blue-200">
                                ⚡ Short
                              </span>
                            )}
                          </div>
                          <div className="truncate text-xs text-muted mt-0.5">
                            {v.description
                              ? v.description.slice(0, 80) + (v.description.length > 80 ? "..." : "")
                              : ""}
                          </div>
                          {v.originalVideoSize > 0 && (
                            <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1 whitespace-nowrap">
                              <span>📹 Video:</span>
                              <span>{getCompressionText(v.originalVideoSize, v.compressedVideoSize)}</span>
                            </div>
                          )}
                          {v.originalThumbnailSize > 0 && (
                            <div className="text-[11px] font-semibold text-indigo-500 mt-0.5 flex items-center gap-1 whitespace-nowrap">
                              <span>🖼️ Thumb:</span>
                              <span>{getCompressionText(v.originalThumbnailSize, v.compressedThumbnailSize)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="p-4 text-muted">
                      <div className="font-semibold text-ink text-xs">{v.owner?.name || "Unknown"}</div>
                      {v.owner?.channelName && (
                        <div className="text-xs text-brand mt-0.5">@{v.owner.channelName}</div>
                      )}
                    </td>
                    <td className="p-4 font-semibold text-ink whitespace-nowrap text-xs">
                      {formatDuration(v.duration)}
                    </td>
                    <td className="p-4 text-muted text-xs">{v.category?.name || v.category || "-"}</td>
                    <td className="p-4 text-ink font-semibold text-xs">{Number(v.views || 0).toLocaleString("en-IN")}</td>
                    <td className="p-4">
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize ${visibilityBadge(
                          v.visibility || "public"
                        )}`}
                      >
                        {v.visibility || "public"}
                      </span>
                    </td>
                    <td className="p-4 text-muted whitespace-nowrap text-xs">{formatCreatedDate(v.createdAt)}</td>
                    <td className="p-4">
                      <div className="flex justify-end gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleUpdate(v._id, { isPinned: !v.isPinned })}
                          className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                            v.isPinned
                              ? "bg-amber-100 text-amber-800 hover:bg-amber-200 border border-amber-300"
                              : "bg-surface border border-line text-muted hover:text-ink hover:bg-line"
                          }`}
                          title={v.isPinned ? "Unpin video from top of home feed" : "Pin video to top of home feed"}
                        >
                          {v.isPinned ? "📌 Pinned" : "📌 Pin"}
                        </button>
                        <button
                          onClick={() => {
                            setEditVideo(v);
                            setShowEdit(true);
                          }}
                          className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setDeleteVideo(v);
                            setShowDelete(true);
                          }}
                          className="rounded-lg bg-red-50 border border-red-200 px-2.5 py-1 text-xs font-semibold text-red-600 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedVideos.length === 0 && (
                  <tr>
                    <td colSpan="8" className="p-8 text-center text-muted">
                      No matching videos found.
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
            totalItems={filteredVideos.length}
            pageSize={limit}
            onPageChange={setPage}
            onPageSizeChange={setLimit}
          />
        </div>
      )}

      {showAdd && (
        <Modal title="Upload Video" maxWidth="max-w-lg" onClose={() => setShowAdd(false)}>
          <UploadForm
            categories={categories}
            users={users}
            onSubmit={handleUpload}
            onCancel={() => setShowAdd(false)}
          />
        </Modal>
      )}

      {showEdit && editVideo && (
        <Modal
          title="Edit Video"
          maxWidth="max-w-lg"
          onClose={() => {
            setShowEdit(false);
            setEditVideo(null);
          }}
        >
          <EditForm
            initial={editVideo}
            categories={categories}
            users={users}
            onSubmit={(payload) => handleUpdate(editVideo._id, payload)}
            onCancel={() => {
              setShowEdit(false);
              setEditVideo(null);
            }}
          />
        </Modal>
      )}

      {showDelete && deleteVideo && (
        <ConfirmModal
          title="Confirm delete"
          message={`Delete video "${deleteVideo.title}"?`}
          onConfirm={() => handleDelete(deleteVideo._id)}
          onCancel={() => {
            setShowDelete(false);
            setDeleteVideo(null);
          }}
        />
      )}
    </div>
  );
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-line p-2.5 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 text-sm";

const UploadForm = ({ categories = [], users = [], onSubmit, onCancel }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [owner, setOwner] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [isPinned, setIsPinned] = useState(false);
  const [videoFile, setVideoFile] = useState(null);
  const [videoDuration, setVideoDuration] = useState(0);
  const [videoWidth, setVideoWidth] = useState(0);
  const [videoHeight, setVideoHeight] = useState(0);
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const handleVideoChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      setUploadError("");
      const meta = await getVideoMetadata(file);
      setVideoDuration(meta.duration);
      setVideoWidth(meta.width);
      setVideoHeight(meta.height);
    }
  };

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!videoFile) return alert("Please select a video file");
    if (!thumbnailFile) return alert("Please select a thumbnail image");

    setUploading(true);
    setUploadError("");

    try {
      let finalDuration = videoDuration;
      let finalWidth = videoWidth;
      let finalHeight = videoHeight;

      // Extract metadata internally if not already captured
      if (!finalDuration) {
        const meta = await getVideoMetadata(videoFile);
        finalDuration = meta.duration;
        finalWidth = meta.width;
        finalHeight = meta.height;
      }

      const fd = new FormData();
      fd.append("video", videoFile);
      fd.append("thumbnail", thumbnailFile);
      fd.append("title", title);
      fd.append("description", description);
      fd.append("category", category);
      fd.append("visibility", visibility);
      fd.append("isPinned", isPinned);
      fd.append("duration", Number(finalDuration) || 0);
      if (finalWidth && finalHeight) {
        fd.append("width", finalWidth);
        fd.append("height", finalHeight);
      }
      if (owner) {
        fd.append("owner", owner);
      }

      await onSubmit(fd);
    } catch (err) {
      setUploadError(err.message || "Failed to upload video");
      setUploading(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {uploadError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
          ⚠️ {uploadError}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-ink">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Video title"
          className={inputClass}
          required
          disabled={uploading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this video about?"
          className={inputClass}
          rows={3}
          disabled={uploading}
        />
      </div>

      {/* Target Channel / Creator Selector */}
      <div>
        <div className="flex justify-between items-center">
          <label className="block text-sm font-medium text-ink">Target Channel / Creator</label>
          <span className="text-[11px] text-muted">{users.length} channels available</span>
        </div>
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className={inputClass}
          disabled={uploading}
        >
          <option value="">Default (Admin Account)</option>
          {users.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name} {u.channelName ? `(@${u.channelName})` : ""} {u.phone ? `• ${u.phone}` : u.email ? `• ${u.email}` : ""}
            </option>
          ))}
        </select>
        <p className="mt-1 text-[11px] text-muted">
          Select which channel profile this video will appear under.
        </p>
      </div>

      {/* Pinned Video Toggle for Admin */}
      <div
        onClick={() => !uploading && setIsPinned(!isPinned)}
        className="flex items-start gap-3 p-3 rounded-xl border border-line bg-surface/40 hover:bg-surface/70 transition-colors cursor-pointer"
      >
        <input
          type="checkbox"
          id="pinVideoUpload"
          checked={isPinned}
          onChange={(e) => setIsPinned(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          disabled={uploading}
          className="mt-0.5 h-4 w-4 rounded border-line text-brand focus:ring-brand cursor-pointer"
        />
        <label htmlFor="pinVideoUpload" className="text-sm font-medium text-ink cursor-pointer flex-1">
          📌 Pin to Top of Home Feed
          <span className="block text-[11px] text-muted font-normal mt-0.5">
            This video will stay permanently locked on top of the home screen and won't shuffle on refresh.
          </span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
          disabled={uploading}
        >
          <option value="">Select Category</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Video File</label>
        <input
          type="file"
          accept="video/*"
          onChange={handleVideoChange}
          className="mt-1.5 w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand"
          required
          disabled={uploading}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Thumbnail Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleThumbnailChange}
          className="mt-1.5 w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand"
          required
          disabled={uploading}
        />
        {thumbnailPreview && (
          <div className="mt-2.5 flex items-center gap-3 p-2 rounded-xl border border-line bg-surface/30">
            <img
              src={thumbnailPreview}
              alt="preview"
              className="h-14 w-24 rounded-lg object-cover border border-line"
            />
            <span className="text-xs text-muted font-medium">Selected Thumbnail Preview</span>
          </div>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Visibility</label>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          className={inputClass}
          disabled={uploading}
        >
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private</option>
        </select>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2 pt-2 border-t border-line">
        <button
          type="button"
          onClick={onCancel}
          disabled={uploading}
          className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={uploading}
          className="rounded-full bg-brand px-6 py-2 text-sm font-semibold text-white shadow-brand hover:bg-brand-dark disabled:opacity-75 flex items-center gap-2"
        >
          {uploading ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Uploading Video...</span>
            </>
          ) : (
            "Upload Video"
          )}
        </button>
      </div>
    </form>
  );
};

const EditForm = ({ initial = {}, categories = [], users = [], onSubmit, onCancel }) => {
  const [title, setTitle] = useState(initial.title || "");
  const [description, setDescription] = useState(initial.description || "");
  const [category, setCategory] = useState(initial.category?._id || initial.category || "");
  const [owner, setOwner] = useState(initial.owner?._id || initial.owner || "");
  const [visibility, setVisibility] = useState(initial.visibility || "public");
  const [isPinned, setIsPinned] = useState(Boolean(initial.isPinned));
  const [thumbnailFile, setThumbnailFile] = useState(null);
  const [thumbnailPreview, setThumbnailPreview] = useState(
    initial.thumbnail ? resolveMediaUrl(initial.thumbnail) : ""
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const handleThumbnailChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setThumbnailFile(file);
      setThumbnailPreview(URL.createObjectURL(file));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaveError("");

    try {
      if (thumbnailFile) {
        const fd = new FormData();
        fd.append("thumbnail", thumbnailFile);
        fd.append("title", title);
        fd.append("description", description);
        fd.append("category", category);
        fd.append("visibility", visibility);
        fd.append("isPinned", isPinned);
        if (owner) fd.append("owner", owner);
        await onSubmit(fd);
      } else {
        await onSubmit({
          title,
          description,
          category,
          visibility,
          owner,
          isPinned,
        });
      }
    } catch (err) {
      setSaveError(err.message || "Failed to update video");
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      {saveError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-semibold text-red-600">
          ⚠️ {saveError}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-ink">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Video title"
          className={inputClass}
          required
          disabled={saving}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this video about?"
          className={inputClass}
          rows={3}
          disabled={saving}
        />
      </div>

      {/* Target Channel / Creator Selector on Edit */}
      <div>
        <label className="block text-sm font-medium text-ink">Channel / Creator</label>
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className={inputClass}
          disabled={saving}
        >
          <option value="">Default (Admin Account)</option>
          {users.map((u) => (
            <option key={u._id} value={u._id}>
              {u.name} {u.channelName ? `(@${u.channelName})` : ""} {u.phone ? `• ${u.phone}` : u.email ? `• ${u.email}` : ""}
            </option>
          ))}
        </select>
      </div>

      {/* Thumbnail edit / preview */}
      <div>
        <label className="block text-sm font-medium text-ink">Thumbnail Image</label>
        {thumbnailPreview && (
          <div className="my-2 flex items-center gap-3 p-2 rounded-xl border border-line bg-surface/30">
            <img
              src={thumbnailPreview}
              alt="thumb preview"
              className="h-14 w-24 rounded-lg object-cover border border-line"
              onError={(e) => {
                e.currentTarget.src = "https://via.placeholder.com/640x360.png?text=Thumbnail";
              }}
            />
            <span className="text-xs text-muted font-medium">
              {thumbnailFile ? "New Thumbnail (Pending Save)" : "Current Thumbnail"}
            </span>
          </div>
        )}
        <input
          type="file"
          accept="image/*"
          onChange={handleThumbnailChange}
          disabled={saving}
          className="mt-1.5 w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand"
        />
        <p className="mt-1 text-[11px] text-muted">Leave empty if you don't want to change the current thumbnail.</p>
      </div>

      {/* Pinned Video Toggle on Edit */}
      <div
        onClick={() => !saving && setIsPinned(!isPinned)}
        className="flex items-start gap-3 p-3 rounded-xl border border-line bg-surface/40 hover:bg-surface/70 transition-colors cursor-pointer"
      >
        <input
          type="checkbox"
          id="pinVideoEdit"
          checked={isPinned}
          onChange={(e) => setIsPinned(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          disabled={saving}
          className="mt-0.5 h-4 w-4 rounded border-line text-brand focus:ring-brand cursor-pointer"
        />
        <label htmlFor="pinVideoEdit" className="text-sm font-medium text-ink cursor-pointer flex-1">
          📌 Pin to Top of Home Feed
          <span className="block text-[11px] text-muted font-normal mt-0.5">
            This video will stay permanently locked on top of the home screen and won't shuffle on refresh.
          </span>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Category</label>
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={inputClass}
          disabled={saving}
        >
          <option value="">Select Category</option>
          {categories.map((c) => (
            <option key={c._id} value={c._id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Visibility</label>
        <select
          value={visibility}
          onChange={(e) => setVisibility(e.target.value)}
          className={inputClass}
          disabled={saving}
        >
          <option value="public">Public</option>
          <option value="unlisted">Unlisted</option>
          <option value="private">Private</option>
        </select>
      </div>

      <div className="mt-6 flex items-center justify-end gap-2 pt-2 border-t border-line">
        <button
          type="button"
          onClick={onCancel}
          disabled={saving}
          className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-brand px-6 py-2 text-sm font-semibold text-white shadow-brand hover:bg-brand-dark disabled:opacity-75 flex items-center gap-2"
        >
          {saving ? (
            <>
              <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Saving...</span>
            </>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>
    </form>
  );
};

export default Videos;
