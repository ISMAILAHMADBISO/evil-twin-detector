import {useEffect, useState, type FormEvent} from 'react';
import {Edit2, Plus, Search, Trash2, X} from 'lucide-react';
import {apiFetch, formatTimestamp} from '../api';
import type {ApprovedAccessPoint} from '../types';

export function ApprovedAPsPage() {
  const [aps, setAps] = useState<ApprovedAccessPoint[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'Active' | 'Inactive'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add/Edit form state
  const [editingAp, setEditingAp] = useState<ApprovedAccessPoint | null>(null);
  const [ssid, setSsid] = useState('');
  const [bssid, setBssid] = useState('');
  const [expectedSecurity, setExpectedSecurity] = useState('WPA2');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<'Active' | 'Inactive'>('Active');
  const [submitting, setSubmitting] = useState(false);

  async function loadAps() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      const res = await apiFetch<{access_points: ApprovedAccessPoint[]}>(
        `/api/access-points?${params.toString()}`
      );
      setAps(res.access_points);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load approved access points.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAps();
  }, [search, statusFilter]);

  function resetForm() {
    setEditingAp(null);
    setSsid('');
    setBssid('');
    setExpectedSecurity('WPA2');
    setDescription('');
    setStatus('Active');
  }

  function startEdit(ap: ApprovedAccessPoint) {
    setEditingAp(ap);
    setSsid(ap.ssid);
    setBssid(ap.bssid);
    setExpectedSecurity(ap.expected_security);
    setDescription(ap.description);
    setStatus(ap.status);
    setError(null);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        ssid,
        bssid,
        expected_security: expectedSecurity,
        description,
        status,
      };
      if (editingAp) {
        await apiFetch(`/api/access-points/${editingAp.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch('/api/access-points', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }
      resetForm();
      await loadAps();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not save access point.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: number) {
    setError(null);
    try {
      await apiFetch(`/api/access-points/${id}`, {method: 'DELETE'});
      if (editingAp?.id === id) resetForm();
      await loadAps();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not delete access point.');
    }
  }

  return (
    <div className="space-y-6">
      {/* Registration / Edit Form */}
      <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              {editingAp ? `Edit Approved AP: ${editingAp.ssid}` : 'Register Approved Access Point'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Multiple BSSIDs can be registered for the same SSID in multi-AP enterprise deployments.
            </p>
          </div>
          {editingAp && (
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

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
          <div>
            <label className="block text-xs text-slate-400 mb-1">SSID</label>
            <input
              type="text"
              required
              value={ssid}
              onChange={(e) => setSsid(e.target.value)}
              placeholder="e.g., CCUK_Campus_WiFi"
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">BSSID (MAC Address)</label>
            <input
              type="text"
              required
              value={bssid}
              onChange={(e) => setBssid(e.target.value)}
              placeholder="A4:2B:8C:10:44:01"
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs font-mono-tabular text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Expected Security</label>
            <select
              value={expectedSecurity}
              onChange={(e) => setExpectedSecurity(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="WPA2">WPA2</option>
              <option value="WPA3">WPA3</option>
              <option value="WPA">WPA</option>
              <option value="WEP">WEP</option>
              <option value="Open">Open</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Location / Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g., Main Library Floor 1"
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-xs text-slate-400 mb-1">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as 'Active' | 'Inactive')}
              className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-semibold text-xs inline-flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{editingAp ? 'Update AP' : 'Add Approved AP'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Registry Table */}
      <div className="bg-[#131C31] border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by SSID, BSSID, or location..."
              className="pl-9 pr-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-lg self-start">
            {(['ALL', 'Active', 'Inactive'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  statusFilter === s
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {s === 'ALL' ? 'All' : s}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 bg-[#0F172A]/60">
                <th className="py-3 px-4 font-medium">SSID</th>
                <th className="py-3 px-4 font-medium">BSSID</th>
                <th className="py-3 px-4 font-medium">Expected Security</th>
                <th className="py-3 px-4 font-medium">Description / Location</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Registered</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-slate-400">
                    Loading approved access points...
                  </td>
                </tr>
              ) : aps.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center text-slate-400">
                    No approved access points registered yet. Add your legitimate Wi-Fi access
                    points above to establish a detection baseline.
                  </td>
                </tr>
              ) : (
                aps.map((ap) => (
                  <tr key={ap.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-medium text-slate-100">{ap.ssid}</td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-slate-300">
                      {ap.bssid}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-200">{ap.expected_security}</td>
                    <td className="py-3 px-4 text-xs text-slate-400">
                      {ap.description || '—'}
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <span
                        className={
                          ap.status === 'Active' ? 'text-emerald-400 font-medium' : 'text-slate-500'
                        }
                      >
                        {ap.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-slate-400">
                      {formatTimestamp(ap.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => startEdit(ap)}
                        className="p-1.5 rounded text-slate-400 hover:text-cyan-300 hover:bg-slate-800"
                        aria-label={`Edit ${ap.ssid}`}
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(ap.id)}
                        className="p-1.5 rounded text-slate-400 hover:text-rose-400 hover:bg-slate-800"
                        aria-label={`Delete ${ap.ssid}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
