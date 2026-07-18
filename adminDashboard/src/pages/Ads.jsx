import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { API_URL } from '../config';

const Ads = () => {
  const [ads, setAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editAd, setEditAd] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteAd, setDeleteAd] = useState(null);

  const fetchAds = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(API_URL + '/api/ads', {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to fetch ads');
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
      const token = localStorage.getItem('admin_token');
      const res = await fetch(API_URL + '/api/ads', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Create failed');
      setShowAdd(false);
      fetchAds();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleUpdate = async (id, formData) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(API_URL + '/api/ads/' + id, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');
      setShowEdit(false);
      setEditAd(null);
      fetchAds();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(API_URL + '/api/ads/' + id, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      setShowDelete(false);
      setDeleteAd(null);
      fetchAds();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleStatus = async (ad) => {
    try {
      const token = localStorage.getItem('admin_token');
      const formData = new FormData();
      formData.append('activeStatus', !ad.activeStatus);

      const res = await fetch(API_URL + '/api/ads/' + ad._id, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData,
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Status toggle failed');
      fetchAds();
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-ink">Advertisements</h2>
          <p className="mt-1 text-sm text-muted">{ads.length} active/inactive ads configured</p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-dark"
        >
          + Add Advertisement
        </button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted shadow-card">
          Loading advertisements...
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : (
        <div className="rounded-2xl border border-line bg-white p-2 shadow-card">
          {ads.length === 0 && <p className="p-6 text-center text-muted">No advertisements configured yet.</p>}
          {ads.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-line text-xs font-semibold uppercase text-muted bg-surface/50">
                    <th className="p-4">Image</th>
                    <th className="p-4">Title / Info</th>
                    <th className="p-4">Type</th>
                    <th className="p-4">Link</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {ads.map((ad) => (
                    <tr key={ad._id} className="hover:bg-surface/30 transition-colors">
                      <td className="p-4">
                        <img
                          src={ad.image}
                          alt={ad.title}
                          className="h-12 w-20 rounded-lg object-cover border border-line bg-surface"
                        />
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-ink">{ad.title}</div>
                        <div className="text-xs text-muted mt-0.5">Created on {new Date(ad.createdAt).toLocaleDateString()}</div>
                        {ad.originalImageSize > 0 && (
                          <div className="text-[11px] font-semibold text-emerald-600 mt-1 flex items-center gap-1 whitespace-nowrap">
                            <span>🖼️ Size:</span>
                            <span>{getCompressionText(ad.originalImageSize, ad.compressedImageSize)}</span>
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          ad.type === 'full' 
                            ? 'bg-purple-100 text-purple-700' 
                            : 'bg-blue-100 text-blue-700'
                        }`}>
                          {ad.type === 'full' ? 'Full Screen' : 'Banner'}
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
                      <td className="p-4">
                        <button
                          onClick={() => handleToggleStatus(ad)}
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors ${
                            ad.activeStatus
                              ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                              : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${ad.activeStatus ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                          {ad.activeStatus ? 'Active' : 'Inactive'}
                        </button>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => {
                              setEditAd(ad);
                              setShowEdit(true);
                            }}
                            className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => {
                              setDeleteAd(ad);
                              setShowDelete(true);
                            }}
                            className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
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
          message={`Are you sure you want to delete advertisement "${deleteAd.title}"?`}
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

const AdForm = ({ initial = {}, onSubmit, onCancel }) => {
  const [title, setTitle] = useState(initial.title || '');
  const [type, setType] = useState(initial.type || 'banner');
  const [activeStatus, setActiveStatus] = useState(
    initial.activeStatus !== undefined ? initial.activeStatus : true
  );
  const [link, setLink] = useState(initial.link || '');
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(initial.image || null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const submit = (e) => {
    e.preventDefault();

    if (!title.trim()) {
      alert('Title is required');
      return;
    }

    if (!initial._id && !imageFile) {
      alert('Image file is required');
      return;
    }

    const formData = new FormData();
    formData.append('title', title.trim());
    formData.append('type', type);
    formData.append('activeStatus', activeStatus);
    formData.append('link', link.trim());
    if (imageFile) {
      formData.append('image', imageFile);
    }

    onSubmit(formData);
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink">Ad Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Summer Clearance Sale"
          className="mt-1.5 w-full rounded-lg border border-line p-2.5 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-ink">Ad Type</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1.5 w-full rounded-lg border border-line p-2.5 bg-white outline-none transition-colors focus:border-brand"
          >
            <option value="banner">Banner (e.g. inline in lists)</option>
            <option value="full">Full Screen (e.g. interstitial popup)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink">Status</label>
          <select
            value={activeStatus ? 'true' : 'false'}
            onChange={(e) => setActiveStatus(e.target.value === 'true')}
            className="mt-1.5 w-full rounded-lg border border-line p-2.5 bg-white outline-none transition-colors focus:border-brand"
          >
            <option value="true">Active</option>
            <option value="false">Inactive</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Click URL / Link (Optional)</label>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          placeholder="e.g. https://example.com/promo"
          className="mt-1.5 w-full rounded-lg border border-line p-2.5 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-ink">Ad Image File</label>
        <input
          type="file"
          accept="image/*"
          onChange={handleImageChange}
          className="mt-1.5 w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-brand-50 file:text-brand hover:file:bg-brand-100"
          required={!initial._id}
        />
        {imagePreview && (
          <div className="mt-3">
            <span className="block text-xs text-muted mb-1.5">Preview:</span>
            <img
              src={imagePreview}
              alt="Ad preview"
              className="max-h-40 rounded-lg object-contain border border-line bg-surface"
            />
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-brand-dark transition-all"
        >
          {initial._id ? 'Save Changes' : 'Add Advertisement'}
        </button>
      </div>
    </form>
  );
};

export default Ads;
