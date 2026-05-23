import React, { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import ConfirmModal from '../components/ConfirmModal';

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
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/users', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed');
      setUsers(data.data || []);
    }catch(err){ setError(err.message); }
    setLoading(false);
  };

  useEffect(()=>{ fetchUsers(); },[]);

  const handleCreate = async (payload) => {
    try{
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/users', {
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
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/users/' + id, {
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
      const res = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:5000') + '/api/users/' + id, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Delete failed');
      setShowDelete(false); setDeleteUser(null);
      fetchUsers();
    }catch(err){ alert(err.message); }
  };

  if (loading) return <div>Loading users...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">Users</h2>
        <button onClick={()=>setShowAdd(true)} className="px-3 py-1 bg-blue-600 text-white rounded">Add User</button>
      </div>

      <div className="bg-white rounded shadow p-4">
        <table className="w-full table-auto">
          <thead>
            <tr className="text-left">
              <th className="p-2">Name</th>
              <th className="p-2">Email</th>
              <th className="p-2">Channel</th>
              <th className="p-2">Role</th>
              <th className="p-2">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u=> (
              <tr key={u._id} className="border-t">
                <td className="p-2">{u.name}</td>
                <td className="p-2">{u.email}</td>
                <td className="p-2">{u.channelName || '-'}</td>
                <td className="p-2">{u.role}</td>
                <td className="p-2">
                  <button onClick={()=>{ setEditUser(u); setShowEdit(true); }} className="px-2 py-1 bg-yellow-400 rounded mr-2">Edit</button>
                  <button onClick={()=>{ setDeleteUser(u); setShowDelete(true); }} className="px-2 py-1 bg-red-500 text-white rounded">Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
      <label className="block mb-2">Name</label>
      <input value={name} onChange={e=>setName(e.target.value)} className="w-full p-2 border rounded mb-3" />
      <label className="block mb-2">Email</label>
      <input value={email} onChange={e=>setEmail(e.target.value)} className="w-full p-2 border rounded mb-3" />
      <label className="block mb-2">Channel Name</label>
      <input value={channelName} onChange={e=>setChannelName(e.target.value)} className="w-full p-2 border rounded mb-3" />
      <label className="block mb-2">Role</label>
      <select value={role} onChange={e=>setRole(e.target.value)} className="w-full p-2 border rounded mb-4">
        <option value="user">User</option>
        <option value="admin">Admin</option>
      </select>
      <div className="flex justify-end space-x-2">
        <button type="button" onClick={onCancel} className="px-3 py-1 bg-gray-200 rounded">Cancel</button>
        <button type="submit" className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
      </div>
    </form>
  );
};

export default Users;