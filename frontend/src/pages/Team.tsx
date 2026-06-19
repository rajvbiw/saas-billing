import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Users, Plus, Trash2, Mail, Check, ShieldCheck, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface User {
  id: number;
  name: string;
  email: string;
  role: 'owner' | 'admin' | 'member' | 'viewer';
  is_active: boolean;
  last_login: string | null;
}

export const Team: React.FC = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviting, setInviting] = useState(false);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err: any) {
      toast.error('Failed to load team members list.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail) return;

    setInviting(true);
    try {
      await api.post('/users/invite', {
        email: inviteEmail.trim(),
        role: inviteRole
      });
      toast.success('Invitation email dispatched!');
      setInviteEmail('');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to send invitation.');
    } finally {
      setInviting(false);
    }
  };

  const handleRemove = async (id: number) => {
    if (id === currentUser?.id) {
      toast.error('Cannot remove yourself from the workspace.');
      return;
    }

    if (!window.confirm('Are you sure you want to remove this user from your team?')) return;

    try {
      await api.delete(`/users/${id}`);
      toast.success('Member removed.');
      fetchUsers();
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to remove user.');
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 bg-gray-200 rounded-lg w-1/4"></div>
        <div className="h-64 bg-gray-200 rounded-3xl"></div>
      </div>
    );
  }

  const isAuthorizedToEdit = currentUser?.role === 'owner' || currentUser?.role === 'admin';

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-950">Team Directory</h1>
        <p className="text-sm text-gray-400 mt-1">Manage seat boundaries, invite developers, and audit workspace access.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        
        {/* Invitation Panel - Owners and Admins only */}
        <div>
          {isAuthorizedToEdit ? (
            <form onSubmit={handleInvite} className="bg-white border border-gray-200 rounded-3xl p-6 space-y-4 shadow-sm">
              <h3 className="font-bold text-lg text-gray-950">Invite Team Member</h3>
              
              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Email Address</label>
                <input 
                  type="email" 
                  required 
                  placeholder="name@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl py-2 px-3 focus:outline-none focus:border-indigo-500 bg-gray-50/50"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-gray-500 uppercase">Workspace Role</label>
                <select 
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full text-sm border border-gray-200 rounded-xl py-2 px-3 bg-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="admin">Administrator (Invite/Manage keys)</option>
                  <option value="member">Standard Member (Standard read/write)</option>
                  <option value="viewer">Viewer (Read-only data access)</option>
                </select>
              </div>

              <button 
                type="submit" 
                disabled={inviting}
                className="w-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-200 text-white py-2.5 rounded-xl transition flex items-center justify-center gap-1.5"
              >
                {inviting ? <Loader2 className="animate-spin" size={14} /> : <><Mail size={14} /> Send Invitation</>}
              </button>
            </form>
          ) : (
            <div className="bg-gray-100 border border-gray-200 rounded-3xl p-6 text-center text-xs text-gray-400">
              Only workspace Owners or Administrators can dispatch invitations.
            </div>
          )}
        </div>

        {/* Members Table */}
        <div className="md:col-span-2 bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-6 border-b border-gray-100">
            <h3 className="font-bold text-lg text-gray-950">Active seats</h3>
            <p className="text-xs text-gray-400 mt-1">Users authorized to interact with organizational tenant resources.</p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-gray-50 border-b border-gray-100 text-gray-400 uppercase">
                <tr>
                  <th className="py-3 px-6">Name</th>
                  <th className="py-3 px-6">Role</th>
                  <th className="py-3 px-6">Status</th>
                  <th className="py-3 px-6">Last Active</th>
                  {isAuthorizedToEdit && <th className="py-3 px-6 text-right">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-gray-600">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50/50">
                    <td className="py-3 px-6 flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-700 font-semibold flex items-center justify-center shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <span className="font-semibold text-gray-900 block">{u.name}</span>
                        <span className="text-gray-400 text-[10px]">{u.email}</span>
                      </div>
                    </td>
                    <td className="py-3 px-6">
                      <span className="capitalize font-semibold text-gray-700">{u.role}</span>
                    </td>
                    <td className="py-3 px-6">
                      <span className={`py-0.5 px-2 rounded-full text-[10px] font-semibold ${
                        u.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                      }`}>
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="py-3 px-6">{u.last_login ? new Date(u.last_login).toLocaleDateString() : 'Never'}</td>
                    {isAuthorizedToEdit && (
                      <td className="py-3 px-6 text-right">
                        {u.id !== currentUser?.id && u.role !== 'owner' ? (
                          <button 
                            onClick={() => handleRemove(u.id)}
                            className="p-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition inline-block"
                            title="Remove User"
                          >
                            <Trash2 size={14} />
                          </button>
                        ) : '-'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
