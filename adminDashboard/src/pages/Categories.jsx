import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { API_URL } from '../config';

const Categories = () => {
  const [cats, setCats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editCat, setEditCat] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteCat, setDeleteCat] = useState(null);

  const fetchCats = async ()=>{
    setLoading(true);
    setError(null);
    try{
      const res = await fetch(API_URL + '/api/categories', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      setCats(data.data || []);
    }catch(err){ setError(err.message); }
    setLoading(false);
  };

  useEffect(()=>{ fetchCats(); },[]);

  const handleCreate = async (payload) => {
    try{
      const res = await fetch(API_URL + '/api/categories', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Create failed');
      setShowAdd(false); fetchCats();
    }catch(err){ alert(err.message); }
  };

  const handleUpdate = async (id, payload) => {
    try{
      const res = await fetch(API_URL + '/api/categories/' + id, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');
      setShowEdit(false); setEditCat(null); fetchCats();
    }catch(err){ alert(err.message); }
  };

  const handleDelete = async (id) => {
    try{
      const res = await fetch(API_URL + '/api/categories/' + id, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      setShowDelete(false); setDeleteCat(null); fetchCats();
    }catch(err){ alert(err.message); }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-ink">Categories</h2>
          <p className="mt-1 text-sm text-muted">{cats.length} content categories</p>
        </div>
        <button onClick={()=>setShowAdd(true)} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-dark">+ Add Category</button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted shadow-card">Loading categories...</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : (
      <div className="rounded-2xl border border-line bg-white p-2 shadow-card">
        {cats.length === 0 && <p className="p-6 text-center text-muted">No categories yet.</p>}
        <ul className="divide-y divide-line">
          {cats.map(c=> (
            <li key={c._id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="flex items-center gap-3 font-medium text-ink">
                <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-50 text-xs font-bold uppercase text-brand">{(c.name||'?').charAt(0)}</span>
                {c.name}
              </span>
              <span className="flex gap-2">
                <button onClick={()=>{ setEditCat(c); setShowEdit(true); }} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200">Edit</button>
                <button onClick={()=>{ setDeleteCat(c); setShowDelete(true); }} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200">Delete</button>
              </span>
            </li>
          ))}
        </ul>
      </div>
      )}

      {showAdd && (
        <Modal title="Add Category" onClose={()=>setShowAdd(false)}>
          <CategoryForm onSubmit={handleCreate} onCancel={()=>setShowAdd(false)} />
        </Modal>
      )}

      {showEdit && editCat && (
        <Modal title="Edit Category" onClose={()=>{ setShowEdit(false); setEditCat(null); }}>
          <CategoryForm initial={editCat} onSubmit={(payload)=>handleUpdate(editCat._id, payload)} onCancel={()=>{ setShowEdit(false); setEditCat(null); }} />
        </Modal>
      )}

      {showDelete && deleteCat && (
        <ConfirmModal title="Confirm delete" message={`Delete category ${deleteCat.name}?`} onConfirm={()=>handleDelete(deleteCat._id)} onCancel={()=>{ setShowDelete(false); setDeleteCat(null); }} />
      )}
    </div>
  );
};

const CategoryForm = ({ initial = {}, onSubmit, onCancel }) => {
  const [name, setName] = useState(initial.name || '');
  const submit = (e) => { e.preventDefault(); onSubmit({ name }); };
  return (
    <form onSubmit={submit}>
      <label className="block text-sm font-medium text-ink">Name</label>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Category name" className="mt-1.5 w-full rounded-lg border border-line p-2.5 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20" />
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line">Cancel</button>
        <button type="submit" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-brand-dark">Save</button>
      </div>
    </form>
  );
};

export default Categories;
