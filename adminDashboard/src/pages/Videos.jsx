import { useEffect, useState } from "react";
import Modal from "../components/Modal";
import ConfirmModal from "../components/ConfirmModal";
import { API_URL } from "../config";

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

  const API = API_URL;

  const fetchVideos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(API + "/api/videos", { credentials: "include" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setVideos(data.data || []);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch(API + "/api/categories", {
        credentials: "include",
      });
      const data = await res.json();
      if (res.ok) setCategories(data.data || []);
    } catch (e) {
      /* ignore */
    }
  };

  useEffect(() => {
    fetchVideos();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpload = async (formData) => {
    try {
      const res = await fetch(API + "/api/videos/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      setShowAdd(false);
      fetchVideos();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdate = async (id, payload) => {
    try {
      const res = await fetch(API + "/api/videos/" + id, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Update failed");
      setShowEdit(false);
      setEditVideo(null);
      fetchVideos();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(API + "/api/videos/" + id, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Delete failed");
      setShowDelete(false);
      setDeleteVideo(null);
      fetchVideos();
    } catch (err) {
      alert(err.message);
    }
  };

  const visibilityBadge = (v) => {
    const map = {
      public: "bg-emerald-50 text-emerald-600",
      unlisted: "bg-amber-50 text-amber-600",
      private: "bg-red-50 text-red-600",
    };
    return map[v] || "bg-surface text-muted";
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-ink">Videos</h2>
          <p className="mt-1 text-sm text-muted">{videos.length} videos on the platform</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-dark">+ Upload Video</button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted shadow-card">Loading videos...</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : (
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wider text-muted">
              <th className="p-4 font-semibold">Video</th>
              <th className="p-4 font-semibold">Owner</th>
              <th className="p-4 font-semibold">Category</th>
              <th className="p-4 font-semibold">Views</th>
              <th className="p-4 font-semibold">Visibility</th>
              <th className="p-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {videos.map((v) => (
              <tr key={v._id} className="border-t border-line align-middle hover:bg-surface/50">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <img src={v.thumbnail} alt="thumb" className="h-14 w-24 shrink-0 rounded-lg bg-surface object-cover" onError={(e)=>{e.currentTarget.style.visibility='hidden';}} />
                    <div className="min-w-0 max-w-xs">
                      <div className="truncate font-semibold text-ink">{v.title}</div>
                      <div className="truncate text-xs text-muted">{v.description ? v.description.slice(0, 80) + (v.description.length>80? '...':'') : ''}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-muted">{v.owner?.name || 'Unknown'}</td>
                <td className="p-4 text-muted">{v.category?.name || v.category || '-'}</td>
                <td className="p-4 text-muted">{v.views || 0}</td>
                <td className="p-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${visibilityBadge(v.visibility || 'public')}`}>{v.visibility || 'public'}</span>
                </td>
                <td className="p-4">
                  <div className="flex justify-end gap-2">
                    <button onClick={() => { setEditVideo(v); setShowEdit(true); }} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200">Edit</button>
                    <button onClick={() => { setDeleteVideo(v); setShowDelete(true); }} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {videos.length === 0 && (
              <tr><td colSpan="6" className="p-8 text-center text-muted">No videos found.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      )}

      {showAdd && (
        <Modal title="Upload Video" onClose={() => setShowAdd(false)}>
          <UploadForm categories={categories} onSubmit={handleUpload} onCancel={() => setShowAdd(false)} />
        </Modal>
      )}

      {showEdit && editVideo && (
        <Modal title="Edit Video" onClose={() => { setShowEdit(false); setEditVideo(null); }}>
          <EditForm initial={editVideo} categories={categories} onSubmit={(payload) => handleUpdate(editVideo._id, payload)} onCancel={() => { setShowEdit(false); setEditVideo(null); }} />
        </Modal>
      )}

      {showDelete && deleteVideo && (
        <ConfirmModal title="Confirm delete" message={`Delete video ${deleteVideo.title}?`} onConfirm={() => handleDelete(deleteVideo._id)} onCancel={() => { setShowDelete(false); setDeleteVideo(null); }} />
      )}
    </div>
  );
};

const inputClass = "mt-1.5 w-full rounded-lg border border-line p-2.5 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20";

const UploadForm = ({ categories = [], onSubmit, onCancel }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [visibility, setVisibility] = useState("public");
  const [videoFile, setVideoFile] = useState(null);
  const [thumbnailFile, setThumbnailFile] = useState(null);

  const submit = (e) => {
    e.preventDefault();
    if (!videoFile || !thumbnailFile)
      return alert("Please select video and thumbnail");
    const fd = new FormData();
    fd.append("video", videoFile);
    fd.append("thumbnail", thumbnailFile);
    fd.append("title", title);
    fd.append("description", description);
    fd.append("category", category);
    fd.append("visibility", visibility);
    onSubmit(fd);
  };

  return (
    <form onSubmit={submit}>
      <label className="block text-sm font-medium text-ink">Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" className={inputClass} />

      <label className="mt-4 block text-sm font-medium text-ink">Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this video about?" className={inputClass} rows={3} />

      <label className="mt-4 block text-sm font-medium text-ink">Category</label>
      <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
        <option value="">Select</option>
        {categories.map((c) => (
          <option key={c._id} value={c._id}>{c.name}</option>
        ))}
      </select>

      <label className="mt-4 block text-sm font-medium text-ink">Video File</label>
      <input type="file" accept="video/*" onChange={(e) => setVideoFile(e.target.files[0])} className="mt-1.5 w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand" />

      <label className="mt-4 block text-sm font-medium text-ink">Thumbnail</label>
      <input type="file" accept="image/*" onChange={(e) => setThumbnailFile(e.target.files[0])} className="mt-1.5 w-full text-sm text-muted file:mr-3 file:rounded-full file:border-0 file:bg-brand-50 file:px-3 file:py-1.5 file:text-sm file:font-semibold file:text-brand" />

      <label className="mt-4 block text-sm font-medium text-ink">Visibility</label>
      <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className={inputClass}>
        <option value="public">Public</option>
        <option value="unlisted">Unlisted</option>
        <option value="private">Private</option>
      </select>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line">Cancel</button>
        <button type="submit" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-brand-dark">Upload</button>
      </div>
    </form>
  );
};

const EditForm = ({ initial = {}, categories = [], onSubmit, onCancel }) => {
  const [title, setTitle] = useState(initial.title || "");
  const [description, setDescription] = useState(initial.description || "");
  const [category, setCategory] = useState(initial.category || "");
  const [visibility, setVisibility] = useState(initial.visibility || "public");

  const submit = (e) => {
    e.preventDefault();
    onSubmit({ title, description, category, visibility });
  };

  return (
    <form onSubmit={submit}>
      <label className="block text-sm font-medium text-ink">Title</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Video title" className={inputClass} />

      <label className="mt-4 block text-sm font-medium text-ink">Description</label>
      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this video about?" className={inputClass} rows={3} />

      <label className="mt-4 block text-sm font-medium text-ink">Category</label>
      <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
        <option value="">Select</option>
        {categories.map((c) => (
          <option key={c._id} value={c._id}>{c.name}</option>
        ))}
      </select>

      <label className="mt-4 block text-sm font-medium text-ink">Visibility</label>
      <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className={inputClass}>
        <option value="public">Public</option>
        <option value="unlisted">Unlisted</option>
        <option value="private">Private</option>
      </select>

      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line">Cancel</button>
        <button type="submit" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-brand-dark">Save</button>
      </div>
    </form>
  );
};

export default Videos;
