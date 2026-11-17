import {useEffect, useState, type ChangeEvent, type FormEvent} from 'react';
import {CheckCircle2, Download, Save, Upload} from 'lucide-react';
import {apiFetch, getAuthToken} from '../api';
import type {AppSettings} from '../types';

export function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    scan_interval_seconds: '30',
    auto_scan_enabled: 'false',
    alerts_enabled: 'true',
    alert_on_unknown: 'false',
    demo_mode: 'false',
    preferred_interface: 'auto',
  });
  const [hostPlatform, setHostPlatform] = useState('linux');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{settings: AppSettings; host_platform: string}>('/api/settings')
      .then((res) => {
        setSettings(res.settings);
        setHostPlatform(res.host_platform);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load settings.'));
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const res = await apiFetch<{settings: AppSettings}>('/api/settings', {
        method: 'POST',
        body: JSON.stringify(settings),
      });
      setSettings(res.settings);
      setMessage('Settings saved persistently to SQLite.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  async function handleRestore(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setMessage(null);

    try {
      const buffer = await file.arrayBuffer();
      const bytes = new Uint8Array(buffer);
      let binary = '';
      for (let i = 0; i < bytes.byteLength; i += 1) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      await apiFetch('/api/settings/restore', {
        method: 'POST',
        body: JSON.stringify({data: base64}),
      });
      setMessage('SQLite database backup restored successfully.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to restore database backup.');
    } finally {
      e.target.value = '';
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 bg-[#131C31] border border-slate-800 rounded-xl p-6">
        <h2 className="text-base font-semibold text-slate-100 mb-1">
          Scanner &amp; Notification Preferences
        </h2>
        <p className="text-xs text-slate-400 mb-5">
          All preferences are persisted in SQLite (`application_settings`).
        </p>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-xs text-rose-300">
            {error}
          </div>
        )}
        {message && (
          <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span>{message}</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Automatic Scan Interval (seconds)
              </label>
              <input
                type="number"
                min={5}
                max={3600}
                value={settings.scan_interval_seconds}
                onChange={(e) =>
                  setSettings({...settings, scan_interval_seconds: e.target.value})
                }
                className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-sm font-mono-tabular text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Preferred Wireless Interface
              </label>
              <input
                type="text"
                value={settings.preferred_interface}
                onChange={(e) =>
                  setSettings({...settings, preferred_interface: e.target.value})
                }
                placeholder="auto"
                className="w-full px-3 py-2 rounded-lg bg-[#0B1120] border border-slate-700 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-slate-800">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.auto_scan_enabled === 'true'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    auto_scan_enabled: e.target.checked ? 'true' : 'false',
                  })
                }
                className="mt-1 rounded border-slate-600 bg-[#0B1120] text-cyan-500"
              />
              <div>
                <div className="text-sm font-medium text-slate-200">
                  Enable Automatic Periodic Scanning
                </div>
                <div className="text-xs text-slate-400">
                  Runs scheduled background refresh intervals inside the Live Scanner view.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.alerts_enabled === 'true'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    alerts_enabled: e.target.checked ? 'true' : 'false',
                  })
                }
                className="mt-1 rounded border-slate-600 bg-[#0B1120] text-cyan-500"
              />
              <div>
                <div className="text-sm font-medium text-slate-200">
                  Generate Security Alerts on Suspicious Detections
                </div>
                <div className="text-xs text-slate-400">
                  Automatically opens an alert record whenever Rule 2 or Rule 4 triggers.
                </div>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={settings.demo_mode === 'true'}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    demo_mode: e.target.checked ? 'true' : 'false',
                  })
                }
                className="mt-1 rounded border-slate-600 bg-[#0B1120] text-amber-500"
              />
              <div>
                <div className="text-sm font-medium text-amber-300">
                  Demo Mode (Isolated Synthetic Wireless Observations)
                </div>
                <div className="text-xs text-slate-400">
                  For testing in virtualized environments without a physical Wi-Fi adapter. Demo
                  records are explicitly tagged and never mixed with real adapter scans.
                </div>
              </div>
            </label>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-semibold text-xs inline-flex items-center gap-2 cursor-pointer whitespace-nowrap"
          >
            <Save className="w-4 h-4" aria-hidden="true" />
            <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
          </button>
        </form>
      </div>

      <div className="space-y-6">
        <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-100">Scanner Configuration</h3>
          <dl className="text-xs space-y-2">
            <div className="flex justify-between">
              <dt className="text-slate-400">Detected Host OS</dt>
              <dd className="font-mono-tabular text-slate-200">{hostPlatform}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Windows Backend</dt>
              <dd className="text-slate-200">netsh wlan (BSSID)</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Linux Backend</dt>
              <dd className="text-slate-200">nmcli dev wifi</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-400">Active Mode</dt>
              <dd className={settings.demo_mode === 'true' ? 'text-amber-400' : 'text-emerald-400'}>
                {settings.demo_mode === 'true' ? 'Demo Mode' : 'Live Adapter Mode'}
              </dd>
            </div>
          </dl>
        </div>

        <div className="bg-[#131C31] border border-slate-800 rounded-xl p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-100">Database Backup &amp; Restore</h3>
            <p className="text-xs text-slate-400 mt-1">
              Export or restore the SQLite database (`eviltwin_detector.db`).
            </p>
          </div>

          <a
            href={`/api/settings/backup?token=${encodeURIComponent(getAuthToken() || '')}`}
            className="w-full py-2 px-3.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-medium text-slate-100 inline-flex items-center justify-center gap-2 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />
            <span>Download SQLite Backup</span>
          </a>

          <label className="w-full py-2 px-3.5 rounded-lg bg-[#0B1120] hover:bg-slate-800/80 border border-dashed border-slate-600 text-xs font-medium text-slate-300 inline-flex items-center justify-center gap-2 cursor-pointer">
            <Upload className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
            <span>Restore from .db Backup</span>
            <input type="file" accept=".db,.sqlite,.sqlite3" onChange={handleRestore} className="hidden" />
          </label>
        </div>
      </div>
    </div>
  );
}
