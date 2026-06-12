import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';
import { API_URL } from '../config';

const Users = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [showDelete, setShowDelete] = useState(false);
  const [deleteUser, setDeleteUser] = useState(null);

  const fetchUsers = async ()=>{
    setLoading(true);
    setError(null);
    try{
      const res = await fetch(API_URL + '/api/users', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      setUsers(data.data || []);
    }catch(err){ setError(err.message); }
    setLoading(false);
  };

  useEffect(()=>{ fetchUsers(); },[]);

  const handleCreate = async (payload) => {
    try{
      const res = await fetch(API_URL + '/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Create failed');
      setShowAdd(false);
      fetchUsers();
    }catch(err){ alert(err.message); }
  };

  const handleUpdate = async (id, payload) => {
    try{
      const res = await fetch(API_URL + '/api/users/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        credentials: 'include'
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Update failed');
      setShowEdit(false); setEditUser(null);
      fetchUsers();
    }catch(err){ alert(err.message); }
  };

  const handleDelete = async (id) => {
    try{
      const res = await fetch(API_URL + '/api/users/' + id, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      setShowDelete(false); setDeleteUser(null);
      fetchUsers();
    }catch(err){ alert(err.message); }
  };

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="font-display text-2xl font-extrabold text-ink">Users</h2>
          <p className="mt-1 text-sm text-muted">{users.length} registered users</p>
        </div>
        <button onClick={()=>setShowAdd(true)} className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand transition-all hover:-translate-y-0.5 hover:bg-brand-dark">+ Add User</button>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center text-muted shadow-card">Loading users...</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-6 text-red-700">{error}</div>
      ) : (
      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-card">
        <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-line bg-surface/60 text-left text-xs uppercase tracking-wider text-muted">
              <th className="p-4 font-semibold">Name</th>
              <th className="p-4 font-semibold">Email</th>
              <th className="p-4 font-semibold">Channel</th>
              <th className="p-4 font-semibold">Role</th>
              <th className="p-4 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u=> (
              <tr key={u._id} className="border-t border-line hover:bg-surface/50">
                <td className="p-4 font-medium text-ink">{u.name}</td>
                <td className="p-4 text-muted">{u.email || '-'}</td>
                <td className="p-4 text-muted">{u.channelName || '-'}</td>
                <td className="p-4">
                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium capitalize ${u.role === 'admin' ? 'bg-brand-50 text-brand' : 'bg-surface text-muted'}`}>{u.role}</span>
                </td>
                <td className="p-4">
                  <div className="flex justify-end gap-2">
                    <button onClick={()=>{ setEditUser(u); setShowEdit(true); }} className="rounded-lg bg-amber-100 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200">Edit</button>
                    <button onClick={()=>{ setDeleteUser(u); setShowDelete(true); }} className="rounded-lg bg-red-100 px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-200">Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan="5" className="p-8 text-center text-muted">No users found.</td></tr>
            )}
          </tbody>
        </table>
        </div>
      </div>
      )}

      {showAdd && (
        <Modal title="Add User" onClose={()=>setShowAdd(false)}>
          <UserForm onSubmit={handleCreate} onCancel={()=>setShowAdd(false)} />
        </Modal>
      )}

      {showEdit && editUser && (
        <Modal title="Edit User" onClose={()=>{ setShowEdit(false); setEditUser(null); }}>
          <UserForm initial={editUser} onSubmit={(payload)=>handleUpdate(editUser._id, payload)} onCancel={()=>{ setShowEdit(false); setEditUser(null); }} />
        </Modal>
      )}

      {showDelete && deleteUser && (
        <ConfirmModal title="Confirm delete" message={`Delete user ${deleteUser.name}?`} onConfirm={()=>handleDelete(deleteUser._id)} onCancel={()=>{ setShowDelete(false); setDeleteUser(null); }} />
      )}
    </div>
  );
};

const inputClass = "mt-1.5 w-full rounded-lg border border-line p-2.5 outline-none transition-colors focus:border-brand focus:ring-2 focus:ring-brand/20";

const UserForm = ({ initial = {}, onSubmit, onCancel }) => {
  const [name, setName] = useState(initial.name || '');
  const [email, setEmail] = useState(initial.email || '');
  const [channelName, setChannelName] = useState(initial.channelName || '');
  const [role, setRole] = useState(initial.role || 'user');

  const submit = (e) => {
    e.preventDefault();
    onSubmit({ name, email, channelName, role });
  };

  return (
    <form onSubmit={submit}>
      <label className="block text-sm font-medium text-ink">Name</label>
      <input value={name} onChange={e=>setName(e.target.value)} placeholder="Full name" className={inputClass} />
      <label className="mt-4 block text-sm font-medium text-ink">Email</label>
      <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="name@example.com" className={inputClass} />
      <label className="mt-4 block text-sm font-medium text-ink">Channel Name</label>
      <input value={channelName} onChange={e=>setChannelName(e.target.value)} placeholder="Channel name" className={inputClass} />
      <label className="mt-4 block text-sm font-medium text-ink">Role</label>
      <select value={role} onChange={e=>setRole(e.target.value)} className={inputClass}>
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-full bg-surface px-4 py-2 text-sm font-semibold text-ink hover:bg-line">Cancel</button>
        <button type="submit" className="rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white shadow-brand hover:bg-brand-dark">Save</button>
      </div>
    </form>
  );
};

export default Users;
