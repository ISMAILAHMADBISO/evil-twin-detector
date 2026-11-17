import {useEffect, useMemo, useState} from 'react';
import {Search} from 'lucide-react';
import {apiFetch, formatTimestamp} from '../api';
import {ClassificationLabel} from '../components/StatusTag';
import type {ScanSession, WirelessObservation} from '../types';

export function DetectedNetworksPage() {
  const [observations, setObservations] = useState<WirelessObservation[]>([]);
  const [latestSession, setLatestSession] = useState<ScanSession | null>(null);
  const [search, setSearch] = useState('');
  const [filterClass, setFilterClass] = useState<'ALL' | 'AUTHORISED' | 'SUSPICIOUS' | 'UNKNOWN'>(
    'ALL'
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch<{latest_session: ScanSession | null; observations: WirelessObservation[]}>(
      '/api/networks'
    )
      .then((res) => {
        setObservations(res.observations || []);
        setLatestSession(res.latest_session || null);
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return observations.filter((obs) => {
      if (filterClass !== 'ALL' && obs.classification !== filterClass) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        return (
          obs.ssid.toLowerCase().includes(q) ||
          obs.bssid.toLowerCase().includes(q) ||
          obs.security.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [observations, filterClass, search]);

  return (
    <div className="space-y-5">
      <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Latest Detected Wireless Networks
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {latestSession
              ? `Scan Session #${latestSession.id} · ${formatTimestamp(latestSession.started_at)} · ${
                  latestSession.is_demo ? 'Demo Mode' : 'Live Scan'
                }`
              : 'No completed wireless scan sessions recorded yet.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative">
            <Search
              className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SSID or BSSID..."
              className="pl-9 pr-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-lg">
            {(['ALL', 'AUTHORISED', 'SUSPICIOUS', 'UNKNOWN'] as const).map((cls) => (
              <button
                key={cls}
                type="button"
                onClick={() => setFilterClass(cls)}
                className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                  filterClass === cls
                    ? 'bg-cyan-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-slate-100'
                }`}
              >
                {cls === 'ALL'
                  ? 'All'
                  : cls.charAt(0) + cls.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="bg-[#131C31] border border-slate-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 bg-[#0F172A]/60">
                <th className="py-3 px-4 font-medium">SSID</th>
                <th className="py-3 px-4 font-medium">BSSID</th>
                <th className="py-3 px-4 font-medium text-right">Signal</th>
                <th className="py-3 px-4 font-medium text-right">Channel</th>
                <th className="py-3 px-4 font-medium">Security</th>
                <th className="py-3 px-4 font-medium">Classification</th>
                <th className="py-3 px-4 font-medium">Rule &amp; Explanation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-8 px-4 text-center text-slate-400">
                    Loading detected networks...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center text-slate-400">
                    No matching detected networks found.
                  </td>
                </tr>
              ) : (
                filtered.map((obs) => (
                  <tr key={obs.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-medium text-slate-100">{obs.ssid}</td>
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
                    <td className="py-3 px-4 text-xs text-slate-400">
                      <div className="text-slate-200 font-medium">{obs.triggered_rule}</div>
                      <div>{obs.detection_reason}</div>
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
