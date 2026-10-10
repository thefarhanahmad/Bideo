import { useEffect, useState, useMemo } from "react";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import DataTableToolbar from "../components/DataTableToolbar";
import Pagination from "../components/Pagination";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useTableParams } from "../hooks/useTableParams";
import { API_URL } from "../config";

const Announcements = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);

  // URL-synced search, filter, and pagination
  const { search, setSearch, filter, setFilter, page, setPage, limit, setLimit } =
    useTableParams({ defaultFilter: "all", defaultLimit: 10 });

  const fetchAnnouncements = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/announcements", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch announcements");
      setAnnouncements(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

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

  const handleCreate = async (formData) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/announcements", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Create failed");
      setShowAdd(false);
      fetchAnnouncements();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdate = async (id, formData) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/announcements/" + id, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Update failed");
      setShowEdit(false);
      setEditItem(null);
      fetchAnnouncements();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/announcements/" + id, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Delete failed");
      setShowDelete(false);
      setDeleteItem(null);
      fetchAnnouncements();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (item) => {
    try {
      const token = localStorage.getItem("admin_token");
      const formData = new FormData();
      formData.append("activeStatus", !item.activeStatus);

      const res = await fetch(API_URL + "/api/announcements/" + item._id, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Status toggle failed");
      fetchAnnouncements();
    } catch (err) {
      alert(err.message);
    }
  };

  // Search & Filter Logic
  const { filteredList, filterCounts } = useMemo(() => {
    const counts = {
      all: announcements.length,
      active: 0,
      inactive: 0,
    };

    announcements.forEach((a) => {
      if (a.activeStatus) counts.active += 1;
      else counts.inactive += 1;
    });

    const searchTrimmed = (search || "").trim().toLowerCase();
    const searchTerms = searchTrimmed ? searchTrimmed.split(/\s+/).filter(Boolean) : [];

    const filtered = announcements.filter((a) => {
      if (filter === "active" && !a.activeStatus) return false;
      if (filter === "inactive" && a.activeStatus) return false;

      if (searchTerms.length === 0) return true;
      const title = (a.title || "").toLowerCase();
      const link = (a.link || "").toLowerCase();
      const id = (a._id || a.id || "").toLowerCase();

      const fullText = `${title} ${link} ${id}`;
      return searchTerms.every((term) => fullText.includes(term));
    });

    return { filteredList: filtered, filterCounts: counts };
  }, [announcements, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / limit));
  const paginatedList = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredList.slice(startIndex, startIndex + limit);
  }, [filteredList, page, limit]);

  const filterOptions = [
    { label: "All Announcements", value: "all", count: filterCounts.all },
    { label: "Active", value: "active", count: filterCounts.active },
    { label: "Inactive", value: "inactive", count: filterCounts.inactive },
  ];

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">Announcements</h2>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted">
            Manage custom announcements, special updates, and promotional popups shown to users when opening the app.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by title or destination link..."
        filter={filter}
        onFilterChange={setFilter}
        filters={filterOptions}
        totalCount={announcements.length}
        filteredCount={filteredList.length}
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
          >
            <span>+ Add Announcement</span>
          </button>
        }
      />

      {loading ? (
        <LoadingSkeleton type="table" rows={6} cols={5} />
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm text-left">
              <thead>
                <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-muted bg-surface/60">
                  <th className="p-4">Creative / Image</th>
                  <th className="p-4">Title & Details</th>
                  <th className="p-4">Target Link</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paginatedList.map((item) => (
                  <tr key={item._id} className="hover:bg-surface/30 transition-colors">
                    <td className="p-4">
                      <img
                        src={item.image}
                        alt={item.title}
                        className="h-12 w-20 rounded-lg object-cover border border-line bg-surface"
                      />
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-ink text-sm">{item.title}</div>
                      <div className="text-xs text-muted mt-0.5">
                        Created {new Date(item.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                      {item.originalImageSize > 0 && (
                        <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1 whitespace-nowrap">
                          <span>🖼️ Size:</span>
                          <span>{getCompressionText(item.originalImageSize, item.compressedImageSize)}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4">
                      {item.link ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-brand hover:underline truncate max-w-xs block"
                        >
                          {item.link}
                        </a>
                      ) : (
                        <span className="text-xs text-muted">-</span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(item)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                          item.activeStatus
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${item.activeStatus ? "bg-emerald-600 animate-pulse" : "bg-gray-400"}`} />
                        {item.activeStatus ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setEditItem(item);
                            setShowEdit(true);
                          }}
                          className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setDeleteItem(item);
                            setShowDelete(true);
                          }}
                          className="rounded-lg bg-red-50 border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {paginatedList.length === 0 && (
                  <tr>
                    <td colSpan="5" className="p-8 text-center text-muted">
                      No announcements found. Click &quot;+ Add Announcement&quot; to create one.
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
            totalItems={filteredList.length}
            pageSize={limit}
            onPageChange={setPage}
            onPageSizeChange={setLimit}
          />
        </div>
      )}

      {showAdd && (
        <Modal title="Add Announcement" onClose={() => setShowAdd(false)}>
          <AnnouncementForm onSubmit={handleCreate} onCancel={() => setShowAdd(false)} />
        </Modal>
      )}

      {showEdit && editItem && (
        <Modal
          title="Edit Announcement"
          onClose={() => {
            setShowEdit(false);
            setEditItem(null);
          }}
        >
          <AnnouncementForm
            initial={editItem}
            onSubmit={(formData) => handleUpdate(editItem._id, formData)}
            onCancel={() => {
              setShowEdit(false);
              setEditItem(null);
            }}
          />
        </Modal>
      )}

      {showDelete && deleteItem && (
        <ConfirmModal
          title="Confirm Delete"
          message={`Are you sure you want to delete announcement "${deleteItem.title}"?`}
          onConfirm={() => handleDelete(deleteItem._id)}
          onCancel={() => {
            setShowDelete(false);
            setDeleteItem(null);
          }}
        />
      )}
    </div>
  );
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-line p-2.5 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 text-sm";

const AnnouncementForm = ({ initial = {}, onSubmit, onCancel }) => {
  const [title, setTitle] = useState(initial.title || "");
  const [link, setLink] = useState(initial.link || "");
  const [activeStatus, setActiveStatus] = useState(initial.activeStatus !== undefined ? initial.activeStatus : true);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(initial.image || "");
  const [submitting, setSubmitting] = useState(false);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!initial._id && !imageFile) {
      alert("Please upload an image for the announcement.");
      return;
    }
    setSubmitting(true);
    const formData = new FormData();
    formData.append("title", title);
    formData.append("link", link);
    formData.append("type", "full");
    formData.append("activeStatus", activeStatus);
    if (imageFile) {
      formData.append("image", imageFile);
    }
    await onSubmit(formData);
    setSubmitting(false);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink">Announcement Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Special App Update Live! or Mega Creator Contest"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Destination URL (Optional)</label>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://example.com/details or https://bideo.in"
          className={inputClass}
        />
        <p className="mt-1 text-xs text-muted">Users can tap &quot;Learn More&quot; in the popup to visit this URL.</p>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Status</label>
        <select
          value={activeStatus ? "true" : "false"}
          onChange={(e) => setActiveStatus(e.target.value === "true")}
          className={inputClass}
        >
          <option value="true">Active (Publish)</option>
          <option value="false">Inactive (Draft)</option>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Announcement Image / Poster</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="mt-1.5 block w-full text-xs text-muted file:mr-4 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-brand hover:file:bg-brand-100"
        />
        {imagePreview && (
          <div className="mt-3 relative h-32 w-full max-w-sm rounded-xl overflow-hidden border border-line bg-surface">
            <img src={imagePreview} alt="preview" className="h-full w-full object-contain bg-black/5" />
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2 pt-2 border-t border-line">
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-brand px-5 py-2 text-sm font-semibold text-white shadow-brand hover:bg-brand-dark disabled:opacity-50"
        >
          {submitting ? "Saving..." : "Save Announcement"}
        </button>
      </div>
    </form>
  );
};

export default Announcements;
