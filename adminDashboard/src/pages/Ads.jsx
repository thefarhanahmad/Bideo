import { useEffect, useState, useMemo } from "react";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import DataTableToolbar from "../components/DataTableToolbar";
import Pagination from "../components/Pagination";
import { useTableParams } from "../hooks/useTableParams";
import { API_URL } from "../config";

const Ads = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editAd, setEditAd] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteAd, setDeleteAd] = useState(null);

  // URL-synced search, filter, and pagination
  const { search, setSearch, filter, setFilter, page, setPage, limit, setLimit } =
    useTableParams({ defaultFilter: "all", defaultLimit: 10 });

  const fetchAds = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/ads", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to fetch ads");
      setAds(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchAds();
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
      const res = await fetch(API_URL + "/api/ads", {
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
      fetchAds();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdate = async (id, formData) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/ads/" + id, {
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
      setEditAd(null);
      fetchAds();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/ads/" + id, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Delete failed");
      setShowDelete(false);
      setDeleteAd(null);
      fetchAds();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (ad) => {
    try {
      const token = localStorage.getItem("admin_token");
      const formData = new FormData();
      formData.append("activeStatus", !ad.activeStatus);

      const res = await fetch(API_URL + "/api/ads/" + ad._id, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Status toggle failed");
      fetchAds();
    } catch (err) {
      alert(err.message);
    }
  };

  // Search & Filter Logic
  const { filteredAds, filterCounts } = useMemo(() => {
    const counts = {
      all: ads.length,
      active: 0,
      inactive: 0,
      banner: 0,
      full: 0,
    };

    ads.forEach((a) => {
      if (a.activeStatus) counts.active += 1;
      else counts.inactive += 1;
      if (a.type === "banner") counts.banner += 1;
      if (a.type === "full") counts.full += 1;
    });

    const searchLower = (search || "").trim().toLowerCase();

    const filtered = ads.filter((a) => {
      // 1. Filter condition
      if (filter === "active" && !a.activeStatus) return false;
      if (filter === "inactive" && a.activeStatus) return false;
      if (filter === "banner" && a.type !== "banner") return false;
      if (filter === "full" && a.type !== "full") return false;

      // 2. Search condition
      if (!searchLower) return true;
      const title = (a.title || "").toLowerCase();
      const link = (a.link || "").toLowerCase();
      const type = (a.type || "").toLowerCase();

      return title.includes(searchLower) || link.includes(searchLower) || type.includes(searchLower);
    });

    return { filteredAds: filtered, filterCounts: counts };
  }, [ads, filter, search]);

  const totalPages = Math.max(1, Math.ceil(filteredAds.length / limit));
  const paginatedAds = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredAds.slice(startIndex, startIndex + limit);
  }, [filteredAds, page, limit]);

  const filterOptions = [
    { label: "All Ads", value: "all", count: filterCounts.all },
    { label: "Active", value: "active", count: filterCounts.active },
    { label: "Inactive", value: "inactive", count: filterCounts.inactive },
    { label: "Banner", value: "banner", count: filterCounts.banner },
    { label: "Full Screen", value: "full", count: filterCounts.full },
  ];

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">Advertisements</h2>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted">
            Manage custom sponsored campaigns, in-app banners, and fullscreen interstitials.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by title, target link, or type..."
        filter={filter}
        onFilterChange={setFilter}
        filters={filterOptions}
        totalCount={ads.length}
        filteredCount={filteredAds.length}
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
          >
            <span>+ Add Advertisement</span>
          </button>
        }
      />

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted shadow-card">
          Loading advertisements...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm text-left">
              <thead>
                <tr className="border-b border-line text-xs font-semibold uppercase tracking-wider text-muted bg-surface/60">
                  <th className="p-4">Creative Preview</th>
                  <th className="p-4">Title & Details</th>
                  <th className="p-4">Ad Type</th>
                  <th className="p-4">Target Link</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paginatedAds.map((ad) => (
                  <tr key={ad._id} className="hover:bg-surface/30 transition-colors">
                    <td className="p-4">
                      <img
                        src={ad.image}
                        alt={ad.title}
                        className="h-12 w-20 rounded-lg object-cover border border-line bg-surface"
                      />
                    </td>
                    <td className="p-4">
                      <div className="font-semibold text-ink text-sm">{ad.title}</div>
                      <div className="text-xs text-muted mt-0.5">
                        Created {new Date(ad.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                      </div>
                      {ad.originalImageSize > 0 && (
                        <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1 whitespace-nowrap">
                          <span>🖼️ Size:</span>
                          <span>{getCompressionText(ad.originalImageSize, ad.compressedImageSize)}</span>
                        </div>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold border ${
                          ad.type === "full"
                            ? "bg-purple-50 text-purple-700 border-purple-200"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }`}
                      >
                        {ad.type === "full" ? "Full Screen" : "Banner"}
                      </span>
                    </td>
                    <td className="p-4">
                      {ad.link ? (
                        <a
                          href={ad.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs font-medium text-brand hover:underline truncate max-w-xs block"
                        >
                          {ad.link}
                        </a>
                      ) : (
                        <span className="text-xs text-muted">-</span>
                      )}
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleStatus(ad)}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold transition-all ${
                          ad.activeStatus
                            ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 border border-gray-300"
                        }`}
                      >
                        <span className={`h-2 w-2 rounded-full ${ad.activeStatus ? "bg-emerald-600 animate-pulse" : "bg-gray-400"}`} />
                        {ad.activeStatus ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-1.5 whitespace-nowrap">
                        <button
                          onClick={() => {
                            setEditAd(ad);
                            setShowEdit(true);
                          }}
                          className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setDeleteAd(ad);
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
                {paginatedAds.length === 0 && (
                  <tr>
                    <td colSpan="6" className="p-8 text-center text-muted">
                      No advertisements found.
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
            totalItems={filteredAds.length}
            pageSize={limit}
            onPageChange={setPage}
            onPageSizeChange={setLimit}
          />
        </div>
      )}

      {showAdd && (
        <Modal title="Add Advertisement" onClose={() => setShowAdd(false)}>
          <AdForm onSubmit={handleCreate} onCancel={() => setShowAdd(false)} />
        </Modal>
      )}

      {showEdit && editAd && (
        <Modal
          title="Edit Advertisement"
          onClose={() => {
            setShowEdit(false);
            setEditAd(null);
          }}
        >
          <AdForm
            initial={editAd}
            onSubmit={(formData) => handleUpdate(editAd._id, formData)}
            onCancel={() => {
              setShowEdit(false);
              setEditAd(null);
            }}
          />
        </Modal>
      )}

      {showDelete && deleteAd && (
        <ConfirmModal
          title="Confirm Delete"
          message={`Are you sure you want to delete ad "${deleteAd.title}"?`}
          onConfirm={() => handleDelete(deleteAd._id)}
          onCancel={() => {
            setShowDelete(false);
            setDeleteAd(null);
          }}
        />
      )}
    </div>
  );
};

const inputClass =
  "mt-1.5 w-full rounded-lg border border-line p-2.5 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 text-sm";

const AdForm = ({ initial = {}, onSubmit, onCancel }) => {
  const [title, setTitle] = useState(initial.title || "");
  const [link, setLink] = useState(initial.link || "");
  const [type, setType] = useState(initial.type || "banner");
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
      alert("Please upload an image for the advertisement.");
      return;
    }
    setSubmitting(true);
    const formData = new FormData();
    formData.append("title", title);
    formData.append("link", link);
    formData.append("type", type);
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
        <label className="block text-sm font-medium text-ink">Title</label>
        <input
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Summer Promo 2026"
          className={inputClass}
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Destination URL</label>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="https://example.com/offer"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-ink">Ad Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className={inputClass}>
            <option value="banner">Banner Ad</option>
            <option value="full">Full Screen Interstitial</option>
          </select>
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
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Ad Creative Image</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="mt-1.5 block w-full text-xs text-muted file:mr-4 file:rounded-full file:border-0 file:bg-brand-50 file:px-4 file:py-2 file:text-xs file:font-semibold file:text-brand hover:file:bg-brand-100"
        />
        {imagePreview && (
          <div className="mt-3 relative h-28 w-full max-w-sm rounded-xl overflow-hidden border border-line bg-surface">
            <img src={imagePreview} alt="preview" className="h-full w-full object-cover" />
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
          {submitting ? "Saving..." : "Save Advertisement"}
        </button>
      </div>
    </form>
  );
};

export default Ads;
