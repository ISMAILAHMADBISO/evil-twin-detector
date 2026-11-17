import {useEffect, useState} from 'react';
import {Check, Eye, ShieldAlert, X} from 'lucide-react';
import {apiFetch, formatTimestamp} from '../api';
import {AlertStatusLabel} from '../components/StatusTag';
import type {SecurityAlert} from '../types';

export function AlertsPage() {
  const [alerts, setAlerts] = useState<SecurityAlert[]>([]);
  const [severityFilter, setSeverityFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedAlert, setSelectedAlert] = useState<SecurityAlert | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadAlerts() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (severityFilter) params.set('severity', severityFilter);
      if (statusFilter) params.set('status', statusFilter);
      const res = await apiFetch<{alerts: SecurityAlert[]}>(`/api/alerts?${params.toString()}`);
      setAlerts(res.alerts);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAlerts();
  }, [severityFilter, statusFilter]);

  async function handleAction(id: number, action: 'review' | 'resolve') {
    await apiFetch(`/api/alerts/${id}/${action}`, {method: 'POST'});
    await loadAlerts();
    if (selectedAlert?.id === id) {
      setSelectedAlert((prev) =>
        prev
          ? {
              ...prev,
              status: action === 'review' ? 'Reviewed' : 'Resolved',
              reviewed_at: new Date().toISOString(),
            }
          : null
      );
    }
  }

  return (
    <div className="space-y-5">
      <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Security Alert Management</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Suspicious observations flag potential impersonation or configuration anomalies for
            investigation; confirm independently before attributing an Evil Twin attack.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            aria-label="Filter by severity"
            className="px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">All Severities</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by review status"
            className="px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">All Statuses</option>
            <option value="Open">Open</option>
            <option value="Reviewed">Reviewed</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>
      </div>

      <div className="bg-[#131C31] border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 bg-[#0F172A]/60">
                <th className="py-3 px-4 font-medium">Alert</th>
                <th className="py-3 px-4 font-medium">SSID / BSSID</th>
                <th className="py-3 px-4 font-medium">Severity</th>
                <th className="py-3 px-4 font-medium">Rule Triggered</th>
                <th className="py-3 px-4 font-medium">Status</th>
                <th className="py-3 px-4 font-medium">Detected At</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-slate-400">
                    Loading security alerts...
                  </td>
                </tr>
              ) : alerts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center text-slate-400">
                    No security alerts match the current filter.
                  </td>
                </tr>
              ) : (
                alerts.map((alert) => (
                  <tr key={alert.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-medium text-slate-100 max-w-xs">
                      <div className="truncate">{alert.title}</div>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      <div className="text-slate-200 font-medium">{alert.ssid}</div>
                      <div className="font-mono-tabular text-slate-400">{alert.bssid}</div>
                    </td>
                    <td className="py-3 px-4 text-xs font-semibold text-rose-400">
                      {alert.severity}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300">{alert.triggered_rule}</td>
                    <td className="py-3 px-4">
                      <AlertStatusLabel status={alert.status} />
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-slate-400">
                      {formatTimestamp(alert.created_at)}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => setSelectedAlert(alert)}
                        className="px-2.5 py-1 rounded text-xs text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" aria-hidden="true" />
                        <span>Details</span>
                      </button>
                      {alert.status === 'Open' && (
                        <button
                          type="button"
                          onClick={() => handleAction(alert.id, 'review')}
                          className="px-2.5 py-1 rounded text-xs text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/25"
                        >
                          Mark Reviewed
                        </button>
                      )}
                      {alert.status !== 'Resolved' && (
                        <button
                          type="button"
                          onClick={() => handleAction(alert.id, 'resolve')}
                          className="px-2.5 py-1 rounded text-xs text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 inline-flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" aria-hidden="true" />
                          <span>Resolve</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedAlert && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#131C31] border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-2.5">
                <ShieldAlert className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <h3 className="text-base font-bold text-slate-100">{selectedAlert.title}</h3>
                  <div className="text-xs text-slate-400 mt-0.5 font-mono-tabular">
                    {selectedAlert.severity} Severity · {selectedAlert.status}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedAlert(null)}
                className="p-1 text-slate-400 hover:text-white"
                aria-label="Close alert details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs border-t border-slate-800 pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <span className="text-slate-400 block">SSID</span>
                  <span className="text-slate-100 font-medium">{selectedAlert.ssid}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">BSSID</span>
                  <span className="text-slate-100 font-mono-tabular">{selectedAlert.bssid}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Triggered Rule</span>
                  <span className="text-slate-100">{selectedAlert.triggered_rule}</span>
                </div>
                <div>
                  <span className="text-slate-400 block">Timestamp</span>
                  <span className="text-slate-100 font-mono-tabular">
                    {formatTimestamp(selectedAlert.created_at)}
                  </span>
                </div>
              </div>

              <div>
                <span className="text-slate-400 block mb-1">Detection Reason</span>
                <div className="bg-[#0B1120] border border-slate-800 rounded-lg p-3 text-slate-200 leading-relaxed">
                  {selectedAlert.detection_reason}
                </div>
              </div>

              {selectedAlert.reviewed_at && (
                <div className="text-slate-400">
                  Reviewed at:{' '}
                  <span className="font-mono-tabular text-slate-200">
                    {formatTimestamp(selectedAlert.reviewed_at)}
                  </span>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              {selectedAlert.status === 'Open' && (
                <button
                  type="button"
                  onClick={() => handleAction(selectedAlert.id, 'review')}
                  className="px-3.5 py-2 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-200 hover:bg-amber-500/30"
                >
                  Mark Reviewed
                </button>
              )}
              {selectedAlert.status !== 'Resolved' && (
                <button
                  type="button"
                  onClick={() => handleAction(selectedAlert.id, 'resolve')}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                >
                  Resolve Alert
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
