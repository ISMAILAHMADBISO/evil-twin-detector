import {useEffect, useState, type FormEvent} from 'react';
import {CheckCircle2, Edit2, Shield, Trash2, UserPlus, X} from 'lucide-react';
import {apiFetch, formatTimestamp} from '../api';
import type {UserInfo} from '../types';

interface AdminsPageProps {
  currentUser: UserInfo;
}

export function AdminsPage({currentUser}: AdminsPageProps) {
  const [admins, setAdmins] = useState<UserInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Add / Edit state
  const [editingAdmin, setEditingAdmin] = useState<UserInfo | null>(null);
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('Administrator');
  const [status, setStatus] = useState<'Active' | 'Disabled'>('Active');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function loadAdmins() {
    setLoading(true);
    try {
      const res = await apiFetch<{admins: UserInfo[]}>('/api/admins');
      setAdmins(res.admins);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load administrators.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAdmins();
  }, []);

  function resetForm() {
    setEditingAdmin(null);
    setUsername('');
    setFullName('');
    setRole('Administrator');
    setStatus('Active');
    setPassword('');
    setConfirmPassword('');
  }

  function startEdit(admin: UserInfo) {
    setEditingAdmin(admin);
    setUsername(admin.username);
    setFullName(admin.full_name || admin.username);
    setRole(admin.role || 'Administrator');
    setStatus(admin.status || 'Active');
    setPassword('');
    setConfirmPassword('');
    setError(null);
    setNotice(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (password && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      if (editingAdmin) {
        const res = await apiFetch<{admin: UserInfo}>(`/api/admins/${editingAdmin.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            full_name: fullName,
            role,
            status,
            ...(password ? {password} : {}),
          }),
        });
        setNotice(`Updated administrator account '${res.admin.username}'.`);
      } else {
        const res = await apiFetch<{admin: UserInfo}>('/api/admins', {
          method: 'POST',
          body: JSON.stringify({
            username,
            full_name: fullName || username,
            role,
            password,
            confirmPassword,
          }),
        });
        setNotice(`Registered new administrator '${res.admin.username}'.`);
      }
      resetForm();
      await loadAdmins();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save administrator.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(admin: UserInfo) {
    setError(null);
    setNotice(null);
    try {
      await apiFetch(`/api/admins/${admin.id}`, {method: 'DELETE'});
      setNotice(`Removed administrator '${admin.username}'.`);
      if (editingAdmin?.id === admin.id) resetForm();
      await loadAdmins();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete administrator.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              {editingAdmin
                ? `Manage Administrator: ${editingAdmin.username}`
                : 'Register New Administrator'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Add authorized administrators, assign roles, toggle account status, or reset
              passwords.
            </p>
          </div>
          {editingAdmin && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs text-slate-400 hover:text-white inline-flex items-center gap-1"
            >
              <X className="w-4 h-4" aria-hidden="true" />
              <span>Cancel Edit</span>
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}
        {notice && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{notice}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">Login Username</label>
            <input
              type="text"
              required
              minLength={3}
              disabled={Boolean(editingAdmin)}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g., Munir Iro"
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 disabled:opacity-60 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Full name"
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="Primary Administrator">Primary Administrator</option>
              <option value="Administrator">Administrator</option>
              <option value="Security Analyst">Security Analyst</option>
            </select>
          </div>

          {editingAdmin && (
            <div>
              <label className="block text-xs text-slate-400 mb-1">Account Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Active' | 'Disabled')}
                className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              >
                <option value="Active">Active</option>
                <option value="Disabled">Disabled</option>
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {editingAdmin ? 'New Password (optional)' : 'Password (min 8 chars)'}
            </label>
            <input
              type="password"
              required={!editingAdmin}
              minLength={editingAdmin ? undefined : 8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editingAdmin ? 'Leave blank to keep current' : 'Minimum 8 characters'}
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1">
              {editingAdmin ? 'Confirm New Password' : 'Confirm Password'}
            </label>
            <input
              type="password"
              required={!editingAdmin || Boolean(password)}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter password"
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-semibold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>
                {submitting
                  ? 'Saving...'
                  : editingAdmin
                  ? 'Save Changes'
                  : 'Register Administrator'}
              </span>
            </button>
          </div>
        </form>
      </div>

      {/* Administrators List */}
      <div className="bg-[#131C31] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-400" aria-hidden="true" />
            <h3 className="text-sm font-semibold text-slate-100">Registered Administrators</h3>
          </div>
          <span className="text-xs font-mono-tabular text-slate-400">
            {admins.length} account(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 bg-[#0F172A]/60">
                <th className="py-3 px-4 font-medium">Username</th>
                <th className="py-3 px-4 font-medium">Full Name</th>
                <th className="py-3 px-4 font-medium">Role</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Last Login</th>
                <th className="py-3 px-4 font-medium">Created</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-slate-400">
                    Loading administrators...
                  </td>
                </tr>
              ) : (
                admins.map((admin) => {
                  const isSelf = admin.id === currentUser.id;
                  return (
                    <tr key={admin.id} className="hover:bg-slate-800/30">
                      <td className="py-3 px-4 font-medium text-slate-100">
                        {admin.username}
                        {isSelf && (
                          <span className="ml-2 text-[11px] text-cyan-400">(Current Session)</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">
                        {admin.full_name || admin.username}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-300">{admin.role}</td>
                      <td className="py-3 px-4 text-xs">
                        <span
                          className={
                            admin.status === 'Active'
                              ? 'text-emerald-400 font-medium'
                              : 'text-rose-400 font-medium'
                          }
                        >
                          {admin.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-400">
                        {formatTimestamp(admin.last_login_at)}
                      </td>
                      <td className="py-3 px-4 font-mono-tabular text-xs text-slate-400">
                        {formatTimestamp(admin.created_at)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => startEdit(admin)}
                          className="p-1.5 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800"
                          aria-label={`Manage ${admin.username}`}
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {!isSelf && (
                          <button
                            type="button"
                            onClick={() => handleDelete(admin)}
                            className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                            aria-label={`Remove ${admin.username}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
