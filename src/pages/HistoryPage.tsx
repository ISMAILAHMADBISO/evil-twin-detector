import {useEffect, useState} from 'react';
import {Eye, Search, X} from 'lucide-react';
import {apiFetch, formatTimestamp} from '../api';
import {ClassificationLabel} from '../components/StatusTag';
import type {WirelessObservation} from '../types';

export function HistoryPage() {
  const [observations, setObservations] = useState<WirelessObservation[]>([]);
  const [search, setSearch] = useState('');
  const [classification, setClassification] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<WirelessObservation | null>(null);

  async function loadHistory() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (classification) params.set('classification', classification);
      if (startDate) params.set('start_date', startDate);
      if (endDate) params.set('end_date', endDate);
      const res = await apiFetch<{observations: WirelessObservation[]}>(
        `/api/history?${params.toString()}`
      );
      setObservations(res.observations);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [search, classification, startDate, endDate]);

  return (
    <div className="space-y-5">
      <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5 space-y-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">Detection History</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Audit trail of all historical wireless access point observations and classifications.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SSID, BSSID, reason..."
              className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <select
            value={classification}
            onChange={(e) => setClassification(e.target.value)}
            aria-label="Filter by classification"
            className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          >
            <option value="">All Classifications</option>
            <option value="AUTHORISED">Authorised</option>
            <option value="SUSPICIOUS">Suspicious</option>
            <option value="UNKNOWN">Unknown</option>
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Start date"
            className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="End date"
            className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
        </div>
      </div>

      <div className="bg-[#131C31] border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 bg-[#0F172A]/60">
                <th className="py-3 px-4 font-medium">Timestamp</th>
                <th className="py-3 px-4 font-medium">SSID</th>
                <th className="py-3 px-4 font-medium">BSSID</th>
                <th className="py-3 px-4 font-medium text-right">Signal</th>
                <th className="py-3 px-4 font-medium text-right">Channel</th>
                <th className="py-3 px-4 font-medium">Security</th>
                <th className="py-3 px-4 font-medium">Classification</th>
                <th className="py-3 px-4 font-medium text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-8 px-4 text-center text-slate-400">
                    Loading detection history...
                  </td>
                </tr>
              ) : observations.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 px-4 text-center text-slate-400">
                    No historical observations match your search filters.
                  </td>
                </tr>
              ) : (
                observations.map((obs) => (
                  <tr key={obs.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-mono-tabular text-xs text-slate-400 whitespace-nowrap">
                      {formatTimestamp(obs.created_at)}
                    </td>
                    <td className="py-3 px-4 font-medium text-slate-100">
                      {obs.ssid}
                      {obs.is_demo === 1 && (
                        <span className="ml-1.5 text-[11px] text-amber-400">[Demo]</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-slate-300">
                      {obs.bssid}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-right text-slate-300">
                      {obs.signal_strength !== null ? `${obs.signal_strength} dBm` : 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-right text-slate-300">
                      {obs.channel ?? 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-200">{obs.security}</td>
                    <td className="py-3 px-4">
                      <ClassificationLabel classification={obs.classification} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => setSelected(obs)}
                        className="px-2.5 py-1 rounded text-xs text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25 inline-flex items-center gap-1"
                      >
                        <Eye className="w-3 h-3" aria-hidden="true" />
                        <span>View</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#131C31] border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-100">{selected.ssid}</h3>
                <div className="text-xs font-mono-tabular text-slate-400 mt-0.5">
                  {selected.bssid} · {formatTimestamp(selected.created_at)}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="p-1 text-slate-400 hover:text-white"
                aria-label="Close observation details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-xs border-t border-slate-800 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Classification</span>
                <ClassificationLabel classification={selected.classification} />
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Triggered Rule</span>
                <span className="text-slate-100 font-medium">
                  {selected.triggered_rule || 'Rule Evaluated'}
                </span>
              </div>
              <div>
                <span className="text-slate-400 block mb-1">Detection Reason</span>
                <div className="bg-[#0B1120] border border-slate-800 rounded-lg p-3 text-slate-200 leading-relaxed">
                  {selected.detection_reason}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
