import {useEffect, useRef, useState} from 'react';
import {AlertCircle, CheckCircle2, Info, Play, Plus, Radio, RefreshCw, X} from 'lucide-react';
import {apiFetch, formatTimestamp} from '../api';
import {ClassificationLabel} from '../components/StatusTag';
import type {AppSettings, ScanSession, WirelessObservation} from '../types';

export function LiveScannerPage() {
  const [observations, setObservations] = useState<WirelessObservation[]>([]);
  const [latestSession, setLatestSession] = useState<ScanSession | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [capabilities, setCapabilities] = useState<{
    platform: string;
    has_live_adapter: boolean;
    detail: string;
  } | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [countdown, setCountdown] = useState<number>(30);
  const [selectedObs, setSelectedObs] = useState<WirelessObservation | null>(null);

  const intervalRef = useRef<number | null>(null);

  async function loadInitial() {
    try {
      const [netRes, setRes, capRes] = await Promise.all([
        apiFetch<{
          latest_session: ScanSession | null;
          last_any_session?: ScanSession | null;
          observations: WirelessObservation[];
        }>('/api/networks'),
        apiFetch<{settings: AppSettings}>('/api/settings'),
        apiFetch<{platform: string; has_live_adapter: boolean; detail: string}>(
          '/api/scanner/capabilities'
        ),
      ]);
      setObservations(netRes.observations || []);
      setLatestSession(netRes.last_any_session || netRes.latest_session || null);
      setSettings(setRes.settings);
      setCapabilities(capRes);
      const sec = Number.parseInt(setRes.settings.scan_interval_seconds || '30', 10);
      setCountdown(Number.isNaN(sec) ? 30 : sec);
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Unable to load scanner state.');
    }
  }

  useEffect(() => {
    loadInitial();
  }, []);

  async function setDemoModeSetting(enableDemo: boolean) {
    setScanError(null);
    const res = await apiFetch<{settings: AppSettings}>('/api/settings', {
      method: 'POST',
      body: JSON.stringify({demo_mode: enableDemo ? 'true' : 'false'}),
    });
    setSettings(res.settings);
    return res.settings;
  }

  async function runScan(demoOverride?: boolean) {
    setScanning(true);
    setScanError(null);
    setScanNotice(null);
    try {
      const bodyPayload =
        typeof demoOverride === 'boolean' ? {demo_mode: demoOverride} : {};
      const res = await apiFetch<{
        ok: boolean;
        scan_session: ScanSession;
        observations: WirelessObservation[];
        alerts_created: number;
        is_demo: boolean;
        platform: string;
      }>('/api/scan', {
        method: 'POST',
        body: JSON.stringify(bodyPayload),
      });
      setLatestSession(res.scan_session);
      setObservations(res.observations);
      setScanNotice(
        `Scan #${res.scan_session.id} completed (${res.observations.length} networks found, ${res.alerts_created} alert(s) raised)${
          res.is_demo ? ' — Demo Mode' : ''
        }.`
      );
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Wireless scan failed.');
      await loadInitial();
    } finally {
      setScanning(false);
    }
  }

  async function enableDemoModeAndScan() {
    try {
      await setDemoModeSetting(true);
      await runScan(true);
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Failed to enable Demo Mode.');
    }
  }

  async function registerAsApproved(obs: WirelessObservation) {
    try {
      await apiFetch('/api/access-points', {
        method: 'POST',
        body: JSON.stringify({
          ssid: obs.ssid,
          bssid: obs.bssid,
          expected_security: obs.security,
          description: 'Added from Live Scanner',
          status: 'Active',
        }),
      });
      setScanNotice(`Registered ${obs.ssid} (${obs.bssid}) to Approved Access Points.`);
    } catch (err: unknown) {
      setScanError(err instanceof Error ? err.message : 'Could not register access point.');
    }
  }

  const intervalSeconds = Number.parseInt(settings?.scan_interval_seconds || '30', 10) || 30;
  const isDemoMode = settings?.demo_mode === 'true';

  useEffect(() => {
    if (!autoRefresh) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      return;
    }

    setCountdown(intervalSeconds);
    intervalRef.current = window.setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          runScan();
          return intervalSeconds;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [autoRefresh, intervalSeconds, isDemoMode]);

  return (
    <div className="space-y-6">
      {/* Environment Capability Notice when no physical Wi-Fi adapter exists */}
      {capabilities && !capabilities.has_live_adapter && !isDemoMode && (
        <div className="bg-slate-900/90 border border-amber-500/35 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5 text-sm text-amber-200">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
            <div>
              <div className="font-semibold">No Physical Wi-Fi Adapter Detected in This Host</div>
              <div className="text-xs text-slate-300 mt-0.5">
                {capabilities.detail} Switch to <strong>Demo Mode</strong> to evaluate detection
                rules with an isolated synthetic Wi-Fi dataset, or run locally on Windows 10/11 or
                Linux hardware.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={enableDemoModeAndScan}
            className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Play className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Switch to Demo Mode &amp; Scan</span>
          </button>
        </div>
      )}

      {isDemoMode && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5 text-sm text-amber-200">
            <Info className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" aria-hidden="true" />
            <div>
              <strong>Demo Mode Active:</strong> Scanning uses an isolated synthetic Wi-Fi dataset
              labeled as Demo Mode. Real adapter scans remain completely separated.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setDemoModeSetting(false)}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 hover:bg-amber-500/30 text-amber-100 whitespace-nowrap shrink-0"
          >
            Switch to Live Mode
          </button>
        </div>
      )}

      {/* Control Header */}
      <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-base font-semibold text-slate-100">
            Wireless Spectrum Scanner
          </h2>
          <div className="text-xs text-slate-400 flex flex-wrap items-center gap-2">
            <span>
              Last Scan:{' '}
              <span className="font-mono-tabular text-slate-200">
                {latestSession ? formatTimestamp(latestSession.started_at) : 'Never'}
              </span>
            </span>
            <span aria-hidden="true">·</span>
            <span>
              Interval: <span className="font-mono-tabular">{intervalSeconds}s</span>
            </span>
            {autoRefresh && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-cyan-300 font-mono-tabular">
                  Next scan in {countdown}s
                </span>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-[#0B1120] border border-slate-800 rounded-lg">
            <button
              type="button"
              onClick={() => setDemoModeSetting(false)}
              className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                !isDemoMode
                  ? 'bg-cyan-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Live Adapter
            </button>
            <button
              type="button"
              onClick={() => setDemoModeSetting(true)}
              className={`px-2.5 py-1.5 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                isDemoMode
                  ? 'bg-amber-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-slate-100'
              }`}
            >
              Demo Mode
            </button>
          </div>

          <button
            type="button"
            onClick={() => setAutoRefresh((v) => !v)}
            className={`px-3.5 py-2 rounded-lg text-xs font-medium border transition-colors inline-flex items-center gap-1.5 whitespace-nowrap ${
              autoRefresh
                ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-300'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} aria-hidden="true" />
            <span>{autoRefresh ? 'Auto-Refresh: On' : 'Auto-Refresh: Off'}</span>
          </button>

          <button
            type="button"
            disabled={scanning}
            onClick={() => runScan()}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 transition-colors inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <Radio className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{scanning ? 'Scanning Nearby APs...' : 'Scan Now'}</span>
          </button>
        </div>
      </div>

      {scanError && (
        <div className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start gap-2.5 text-sm text-rose-200">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" aria-hidden="true" />
            <div>
              <div className="font-semibold">Live Wireless Adapter Unavailable</div>
              <div className="text-xs text-rose-300/90 mt-0.5">{scanError}</div>
            </div>
          </div>
          {!isDemoMode && (
            <button
              type="button"
              onClick={enableDemoModeAndScan}
              className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Run Isolated Demo Mode Scan</span>
            </button>
          )}
        </div>
      )}

      {scanNotice && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3.5 flex items-center gap-2.5 text-sm text-emerald-200">
          <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" aria-hidden="true" />
          <span>{scanNotice}</span>
        </div>
      )}

      {/* Results Table */}
      <div className="bg-[#131C31] border border-slate-800 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-100">
            Discovered Wireless Access Points
          </h3>
          <span className="text-xs text-slate-400 font-mono-tabular">
            {observations.length} network(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs text-slate-400 bg-[#0F172A]/60">
                <th className="py-3 px-4 font-medium">SSID</th>
                <th className="py-3 px-4 font-medium">BSSID</th>
                <th className="py-3 px-4 font-medium text-right">Signal</th>
                <th className="py-3 px-4 font-medium text-right">Channel</th>
                <th className="py-3 px-4 font-medium">Band</th>
                <th className="py-3 px-4 font-medium">Security</th>
                <th className="py-3 px-4 font-medium">Classification</th>
                <th className="py-3 px-4 font-medium">Triggered Rule &amp; Reason</th>
                <th className="py-3 px-4 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80 text-sm">
              {observations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-10 px-4 text-center text-slate-400">
                    No scan observations recorded yet. Click <strong>Scan Now</strong> to inspect
                    nearby wireless access points.
                  </td>
                </tr>
              ) : (
                observations.map((obs) => (
                  <tr key={obs.id} className="hover:bg-slate-800/30">
                    <td className="py-3 px-4 font-medium text-slate-100">
                      {obs.ssid}
                      {obs.is_demo === 1 && (
                        <span className="ml-2 text-[11px] text-amber-400">[Demo]</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-slate-300">
                      {obs.bssid}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-right text-slate-300">
                      {obs.signal_strength !== null ? `${obs.signal_strength} dBm` : 'N/A'}
                    </td>
                    <td className="py-3 px-4 font-mono-tabular text-xs text-right text-slate-300">
                      {obs.channel !== null ? obs.channel : 'N/A'}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-300">{obs.frequency || 'N/A'}</td>
                    <td className="py-3 px-4 text-xs text-slate-200">{obs.security}</td>
                    <td className="py-3 px-4">
                      <ClassificationLabel classification={obs.classification} />
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-400 max-w-xs">
                      <div className="text-slate-200 font-medium mb-0.5">
                        {obs.triggered_rule || 'Rule Evaluated'}
                      </div>
                      <div className="line-clamp-2">{obs.detection_reason}</div>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-2">
                      <button
                        type="button"
                        onClick={() => setSelectedObs(obs)}
                        className="px-2.5 py-1 rounded text-xs text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/25"
                      >
                        Explain
                      </button>
                      {obs.classification === 'UNKNOWN' && (
                        <button
                          type="button"
                          onClick={() => registerAsApproved(obs)}
                          className="px-2.5 py-1 rounded text-xs text-emerald-300 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 inline-flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" aria-hidden="true" />
                          <span>Approve</span>
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

      {/* Observation Explainability Modal */}
      {selectedObs && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4">
          <div className="bg-[#131C31] border border-slate-700 rounded-xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-100">{selectedObs.ssid}</h3>
                <div className="text-xs font-mono-tabular text-slate-400 mt-0.5">
                  BSSID: {selectedObs.bssid} · {selectedObs.security} · Channel{' '}
                  {selectedObs.channel ?? 'N/A'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedObs(null)}
                className="p-1 rounded text-slate-400 hover:text-white"
                aria-label="Close details"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="pt-2 border-t border-slate-800 space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Classification</span>
                <ClassificationLabel classification={selectedObs.classification} />
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Rule Triggered</div>
                <div className="text-slate-100 font-medium">
                  {selectedObs.triggered_rule || 'Rule-Based Evaluation'}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">Explanation</div>
                <div className="text-slate-200 bg-[#0B1120] border border-slate-800 rounded-lg p-3 text-xs leading-relaxed">
                  {selectedObs.detection_reason}
                </div>
              </div>
              <div>
                <div className="text-xs text-slate-400 mb-1">
                  Rule 5 Supporting Indicators (Advisory Only)
                </div>
                <ul className="text-xs text-slate-300 space-y-1 list-disc list-inside">
                  <li>
                    Signal Strength:{' '}
                    <span className="font-mono-tabular">
                      {selectedObs.signal_strength !== null
                        ? `${selectedObs.signal_strength} dBm`
                        : 'Unavailable'}
                    </span>
                  </li>
                  <li>
                    Channel / Frequency:{' '}
                    <span className="font-mono-tabular">
                      Ch {selectedObs.channel ?? 'N/A'} ({selectedObs.frequency || 'Unknown band'})
                    </span>
                  </li>
                  <li className="text-slate-400">
                    Note: Signal strength and channel shifts alone are never treated as sole proof of
                    an Evil Twin attack.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
