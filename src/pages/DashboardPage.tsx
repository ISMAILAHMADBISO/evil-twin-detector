import {useEffect, useState} from 'react';
import {
  ArcElement,
  BarElement,
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import {Bar, Doughnut, Line} from 'react-chartjs-2';
import {Radio, RefreshCw} from 'lucide-react';
import {apiFetch, formatTimestamp} from '../api';
import {AlertStatusLabel, ClassificationLabel} from '../components/StatusTag';
import type {DashboardSummary, NavPage} from '../types';

ChartJS.register(
  ArcElement,
  BarElement,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend
);

interface DashboardPageProps {
  onNavigate: (page: NavPage) => void;
}

export function DashboardPage({onNavigate}: DashboardPageProps) {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSummary() {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch<DashboardSummary>('/api/dashboard/summary');
      setData(res);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard summary.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSummary();
  }, []);

  if (loading && !data) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {Array.from({length: 5}).map((_, i) => (
            <div key={i} className="h-24 rounded-xl bg-[#131C31] border border-slate-800 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="h-72 rounded-xl bg-[#131C31] border border-slate-800 animate-pulse" />
          <div className="h-72 rounded-xl bg-[#131C31] border border-slate-800 animate-pulse" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-[#131C31] border border-rose-500/30 rounded-xl p-6 text-rose-300">
        {error || 'Unable to load dashboard telemetry.'}
      </div>
    );
  }

  const {summary, scanner_status, charts, recent_observations, recent_alerts, recent_sessions} = data;

  const hasObservations = summary.total_discovered > 0;
  const hasAlerts = summary.total_alerts > 0;

  const commonScaleOptions = {
    x: {
      grid: {color: 'rgba(148, 163, 184, 0.1)'},
      ticks: {color: '#94A3B8', font: {family: 'JetBrains Mono', size: 11}},
    },
    y: {
      beginAtZero: true,
      grid: {color: 'rgba(148, 163, 184, 0.1)'},
      ticks: {color: '#94A3B8', precision: 0, font: {family: 'JetBrains Mono', size: 11}},
    },
  };

  return (
    <div className="space-y-6">
      {/* Scanner Status & Monitoring Summary Strip */}
      <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
            <span>Host Platform: {scanner_status.host_platform}</span>
            <span aria-hidden="true">·</span>
            <span>
              Mode:{' '}
              <strong className={scanner_status.demo_mode ? 'text-amber-400' : 'text-cyan-300'}>
                {scanner_status.demo_mode ? 'Demo Mode (Isolated Synthetic Dataset)' : 'Live Wireless Adapter'}
              </strong>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Monitoring: {scanner_status.auto_scan_enabled ? `Scheduled (${scanner_status.scan_interval_seconds}s)` : 'Manual On-Demand'}
            </span>
          </div>
          <div className="text-sm text-slate-200">
            Last Scan:{' '}
            <span className="font-mono-tabular">
              {scanner_status.last_scan
                ? `${formatTimestamp(scanner_status.last_scan.started_at)} (${scanner_status.last_scan.status})`
                : 'No scans executed yet'}
            </span>
            <span className="text-slate-500 mx-2">·</span>
            <span>
              Approved Baseline APs: <span className="font-mono-tabular text-slate-100">{summary.approved_count}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={loadSummary}
            className="px-3.5 py-2 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('scanner')}
            className="px-4 py-2 rounded-lg text-xs font-semibold text-slate-950 bg-cyan-500 hover:bg-cyan-400 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap"
          >
            <Radio className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Open Live Scanner</span>
          </button>
        </div>
      </div>

      {/* 5 Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <div className="bg-[#131C31] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Total Discovered</div>
          <div className="text-2xl font-bold font-mono-tabular text-slate-100">
            {summary.total_discovered}
          </div>
          <div className="text-xs text-slate-500 mt-1">All recorded observations</div>
        </div>
        <div className="bg-[#131C31] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Authorised Networks</div>
          <div className="text-2xl font-bold font-mono-tabular text-emerald-400">
            {summary.authorised}
          </div>
          <div className="text-xs text-slate-500 mt-1">Verified BSSID &amp; security</div>
        </div>
        <div className="bg-[#131C31] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Suspicious Networks</div>
          <div className="text-2xl font-bold font-mono-tabular text-rose-400">
            {summary.suspicious}
          </div>
          <div className="text-xs text-slate-500 mt-1">Rule violations flagged</div>
        </div>
        <div className="bg-[#131C31] border border-slate-800 rounded-xl p-4">
          <div className="text-xs text-slate-400 mb-1">Unknown Networks</div>
          <div className="text-2xl font-bold font-mono-tabular text-amber-400">
            {summary.unknown}
          </div>
          <div className="text-xs text-slate-500 mt-1">Unregistered external APs</div>
        </div>
        <div className="bg-[#131C31] border border-slate-800 rounded-xl p-4 col-span-2 md:col-span-1">
          <div className="text-xs text-slate-400 mb-1">Security Alerts</div>
          <div className="text-2xl font-bold font-mono-tabular text-cyan-400">
            {summary.total_alerts}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            <span className="font-mono-tabular">{summary.open_alerts}</span> open for review
          </div>
        </div>
      </div>

      {/* 4 Chart.js Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-100 mb-4">
            Network Classification Distribution
          </h2>
          {hasObservations ? (
            <div className="h-60 flex items-center justify-center">
              <Doughnut
                data={{
                  labels: ['Authorised', 'Suspicious', 'Unknown'],
                  datasets: [
                    {
                      data: [
                        charts.distribution.Authorised,
                        charts.distribution.Suspicious,
                        charts.distribution.Unknown,
                      ],
                      backgroundColor: ['#10B981', '#EF4444', '#F59E0B'],
                      borderWidth: 0,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      position: 'bottom',
                      labels: {color: '#CBD5E1', boxWidth: 12, padding: 16},
                    },
                  },
                }}
              />
            </div>
          ) : (
            <div className="h-60 flex items-center justify-center text-sm text-slate-400 text-center px-6">
              No wireless observations recorded yet. Run a scan to view classification breakdown.
            </div>
          )}
        </div>

        <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-100 mb-4">
            Network Discoveries Over Time
          </h2>
          {charts.timeline.labels.length > 0 ? (
            <div className="h-60">
              <Line
                data={{
                  labels: charts.timeline.labels,
                  datasets: [
                    {
                      label: 'Authorised',
                      data: charts.timeline.authorised,
                      borderColor: '#10B981',
                      backgroundColor: 'rgba(16, 185, 129, 0.2)',
                      tension: 0.25,
                    },
                    {
                      label: 'Suspicious',
                      data: charts.timeline.suspicious,
                      borderColor: '#EF4444',
                      backgroundColor: 'rgba(239, 68, 68, 0.2)',
                      tension: 0.25,
                    },
                    {
                      label: 'Unknown',
                      data: charts.timeline.unknown,
                      borderColor: '#F59E0B',
                      backgroundColor: 'rgba(245, 158, 11, 0.2)',
                      tension: 0.25,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: commonScaleOptions,
                  plugins: {legend: {labels: {color: '#CBD5E1', boxWidth: 12}}},
                }}
              />
            </div>
          ) : (
            <div className="h-60 flex items-center justify-center text-sm text-slate-400 text-center px-6">
              Scan timeline will populate after scan sessions are executed.
            </div>
          )}
        </div>

        <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-100 mb-4">Security Alert Trends</h2>
          {hasAlerts ? (
            <div className="h-60">
              <Bar
                data={{
                  labels: charts.alert_trends.labels,
                  datasets: [
                    {
                      label: 'Alerts Raised',
                      data: charts.alert_trends.counts,
                      backgroundColor: '#EF4444',
                      borderRadius: 4,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: commonScaleOptions,
                  plugins: {legend: {labels: {color: '#CBD5E1'}}},
                }}
              />
            </div>
          ) : (
            <div className="h-60 flex items-center justify-center text-sm text-slate-400 text-center px-6">
              No security alerts have been generated yet.
            </div>
          )}
        </div>

        <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5">
          <h2 className="text-sm font-semibold text-slate-100 mb-4">
            Authorised vs Suspicious Comparison
          </h2>
          {hasObservations ? (
            <div className="h-60">
              <Bar
                data={{
                  labels: ['Authorised', 'Suspicious'],
                  datasets: [
                    {
                      label: 'Observations',
                      data: [charts.distribution.Authorised, charts.distribution.Suspicious],
                      backgroundColor: ['#10B981', '#EF4444'],
                      borderRadius: 4,
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: commonScaleOptions,
                  plugins: {legend: {display: false}},
                }}
              />
            </div>
          ) : (
            <div className="h-60 flex items-center justify-center text-sm text-slate-400 text-center px-6">
              Comparison chart populates once network observations exist.
            </div>
          )}
        </div>
      </div>

      {/* Recent Network Discoveries & Alerts */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 bg-[#131C31] border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-100">Recent Network Discoveries</h2>
            <button
              type="button"
              onClick={() => onNavigate('history')}
              className="text-xs text-cyan-400 hover:underline whitespace-nowrap"
            >
              View full history
            </button>
          </div>
          {recent_observations.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs text-slate-400">
                    <th className="py-2 pr-3 font-medium">SSID</th>
                    <th className="py-2 pr-3 font-medium">BSSID</th>
                    <th className="py-2 pr-3 font-medium">Security</th>
                    <th className="py-2 pr-3 font-medium">Classification</th>
                    <th className="py-2 font-medium text-right">Signal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-sm">
                  {recent_observations.map((obs) => (
                    <tr key={obs.id} className="hover:bg-slate-800/30">
                      <td className="py-2.5 pr-3 font-medium text-slate-100">{obs.ssid}</td>
                      <td className="py-2.5 pr-3 font-mono-tabular text-xs text-slate-300">
                        {obs.bssid}
                      </td>
                      <td className="py-2.5 pr-3 text-xs text-slate-300">{obs.security}</td>
                      <td className="py-2.5 pr-3">
                        <ClassificationLabel classification={obs.classification} />
                      </td>
                      <td className="py-2.5 text-right font-mono-tabular text-xs text-slate-300">
                        {obs.signal_strength !== null ? `${obs.signal_strength} dBm` : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-sm text-slate-400 py-6 text-center">
              No wireless observations stored yet.
            </p>
          )}
        </div>

        <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5 flex flex-col justify-between gap-6">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-100">Recent Security Alerts</h2>
              <button
                type="button"
                onClick={() => onNavigate('alerts')}
                className="text-xs text-cyan-400 hover:underline whitespace-nowrap"
              >
                Manage alerts
              </button>
            </div>
            {recent_alerts.length > 0 ? (
              <div className="space-y-3">
                {recent_alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="pb-3 border-b border-slate-800/80 last:border-b-0 last:pb-0"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-rose-400 truncate">
                        {alert.ssid} ({alert.bssid})
                      </span>
                      <AlertStatusLabel status={alert.status} />
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">{alert.detection_reason}</p>
                    <div className="text-[11px] text-slate-500 mt-1 font-mono-tabular">
                      {alert.severity} · {formatTimestamp(alert.created_at)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 py-4">No security alerts triggered yet.</p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-800">
            <h3 className="text-xs font-semibold text-slate-300 mb-2.5">
              Recent Scan Activity
            </h3>
            {recent_sessions.length > 0 ? (
              <ul className="space-y-2 text-xs">
                {recent_sessions.slice(0, 4).map((sess) => (
                  <li key={sess.id} className="flex items-center justify-between text-slate-400">
                    <span className="truncate">
                      Scan #{sess.id} ({sess.is_demo ? 'Demo' : 'Live'}) · {sess.status}
                    </span>
                    <span className="font-mono-tabular text-slate-300 shrink-0 ml-2">
                      {sess.networks_found} APs
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-500">No scan activity recorded yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
