import { useEffect, useState, useMemo } from "react";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import DataTableToolbar from "../components/DataTableToolbar";
import Pagination from "../components/Pagination";
import LoadingSkeleton from "../components/LoadingSkeleton";
import { useTableParams } from "../hooks/useTableParams";
import { API_URL } from "../config";

const Categories = () => {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteCat, setDeleteCat] = useState(null);

  // URL-synced search and pagination
  const { search, setSearch, page, setPage, limit, setLimit } = useTableParams({
    defaultLimit: 10,
  });

  const fetchCats = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/categories", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setCats(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchCats();
  }, []);

  const handleCreate = async (payload) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/categories", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Create failed");
      setShowAdd(false);
      fetchCats();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdate = async (id, payload) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/categories/" + id, {
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
      setEditCat(null);
      fetchCats();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem("admin_token");
      const res = await fetch(API_URL + "/api/categories/" + id, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Delete failed");
      setShowDelete(false);
      setDeleteCat(null);
      fetchCats();
    } catch (err) {
      alert(err.message);
    }
  };

  // Filter & Search Logic
  const filteredCats = useMemo(() => {
    const searchLower = (search || "").trim().toLowerCase();
    if (!searchLower) return cats;
    return cats.filter((c) => (c.name || "").toLowerCase().includes(searchLower));
  }, [cats, search]);

  const totalPages = Math.max(1, Math.ceil(filteredCats.length / limit));
  const paginatedCats = useMemo(() => {
    const startIndex = (page - 1) * limit;
    return filteredCats.slice(startIndex, startIndex + limit);
  }, [filteredCats, page, limit]);

  return (
    <div className="space-y-5 min-w-0 max-w-full">
      {/* Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 min-w-0">
        <div className="min-w-0">
          <h2 className="font-display text-xl sm:text-2xl font-extrabold text-ink truncate">Categories</h2>
          <p className="mt-0.5 sm:mt-1 text-xs sm:text-sm text-muted">
            Manage video and post content discovery categories.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <DataTableToolbar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search categories..."
        totalCount={cats.length}
        filteredCount={filteredCats.length}
        actions={
          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2 text-xs sm:text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
          >
            <span>+ Add Category</span>
          </button>
        }
      />

      {loading ? (
        <LoadingSkeleton type="table" rows={6} cols={4} />
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card min-w-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[500px] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wider text-muted">
                  <th className="p-4 font-semibold">Category Name</th>
                  <th className="p-4 font-semibold">Videos Count</th>
                  <th className="p-4 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {paginatedCats.map((c) => (
                  <tr key={c._id} className="hover:bg-surface/50 transition-colors">
                    <td className="p-4 font-medium text-ink">
                      <div className="flex items-center gap-3">
                        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-xs font-bold uppercase text-brand border border-brand/20">
                          {(c.name || "?").charAt(0)}
                        </span>
                        <span className="font-bold text-ink text-sm">{c.name}</span>
                      </div>
                    </td>
                    <td className="p-4 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                        {(c.videosCount || 0).toLocaleString("en-IN")}{" "}
                        {c.videosCount === 1 ? "video" : "videos"}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex justify-end gap-1.5">
                        <button
                          onClick={() => {
                            setEditCat(c);
                            setShowEdit(true);
                          }}
                          className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => {
                            setDeleteCat(c);
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
                {paginatedCats.length === 0 && (
                  <tr>
                    <td colSpan="3" className="p-8 text-center text-muted">
                      No categories found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            totalItems={filteredCats.length}
            pageSize={limit}
            onPageChange={setPage}
            onPageSizeChange={setLimit}
          />
        </div>
      )}

      {showAdd && (
        <Modal title="Add Category" onClose={() => setShowAdd(false)}>
          <CategoryForm onSubmit={handleCreate} onCancel={() => setShowAdd(false)} />
        </Modal>
      )}

      {showEdit && editCat && (
        <Modal
          title="Edit Category"
          onClose={() => {
            setShowEdit(false);
            setEditCat(null);
          }}
        >
          <CategoryForm
            initial={editCat}
            onSubmit={(payload) => handleUpdate(editCat._id, payload)}
            onCancel={() => {
              setShowEdit(false);
              setEditCat(null);
            }}
          />
        </Modal>
      )}

      {showDelete && deleteCat && (
        <ConfirmModal
          title="Confirm delete"
          message={`Delete category "${deleteCat.name}"?`}
          onConfirm={() => handleDelete(deleteCat._id)}
          onCancel={() => {
            setShowDelete(false);
            setDeleteCat(null);
          }}
        />
      )}
    </div>
  );
};

const CategoryForm = ({ initial = {}, onSubmit, onCancel }) => {
  const [name, setName] = useState(initial.name || "");
  const submit = (e) => {
    e.preventDefault();
    onSubmit({ name });
  };
  return (
    <form onSubmit={submit}>
      <label className="block text-sm font-medium text-ink">Name</label>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Category name"
        className="mt-1.5 w-full rounded-lg border border-line p-2.5 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20 text-sm"
      />
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-brand-dark"
        >
          Save
        </button>
      </div>
    </form>
  );
};

export default Categories;
