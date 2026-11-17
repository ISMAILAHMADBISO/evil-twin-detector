import {useState, type FormEvent} from 'react';
import {Activity, Lock, ShieldAlert} from 'lucide-react';
import {apiFetch, setAuthToken} from '../api';
import type {UserInfo} from '../types';

interface LoginPageProps {
  needsSetup: boolean;
  onAuthenticated: (user: UserInfo) => void;
}

export function LoginPage({needsSetup, onAuthenticated}: LoginPageProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (needsSetup) {
        const res = await apiFetch<{user: UserInfo; token?: string}>('/api/auth/setup', {
          method: 'POST',
          body: JSON.stringify({username, password, confirmPassword}),
        });
        if (res.token) setAuthToken(res.token);
        onAuthenticated(res.user);
      } else {
        const res = await apiFetch<{user: UserInfo; token?: string}>('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({username, password}),
        });
        if (res.token) setAuthToken(res.token);
        onAuthenticated(res.user);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#0B1120] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-[#131C31] border border-slate-800 rounded-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Activity className="w-6 h-6" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-slate-100">
              EvilTwin Detector
            </h1>
            <p className="text-xs text-slate-400">Wi-Fi Security Monitoring System</p>
          </div>
        </div>

        {needsSetup ? (
          <div className="mb-6 pb-5 border-b border-slate-800">
            <h2 className="text-base font-semibold text-slate-100 mb-1.5">
              First-Run Administrator Setup
            </h2>
            <p className="text-sm text-slate-400">
              Create the initial local administrator account to protect access point baselines, scan
              logs, and security alerts.
            </p>
          </div>
        ) : (
          <div className="mb-6 pb-5 border-b border-slate-800">
            <h2 className="text-base font-semibold text-slate-100 mb-1.5">
              Administrator Sign In
            </h2>
            <p className="text-sm text-slate-400">
              Sign in with your administrator credentials to manage Wi-Fi baselines, scanning, and
              alerts.
            </p>
          </div>
        )}

        {error && (
          <div
            role="alert"
            className="mb-5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-start gap-2.5"
          >
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="auth-username" className="block text-xs font-medium text-slate-300 mb-1.5">
              Administrator Name / Username
            </label>
            <input
              id="auth-username"
              type="text"
              required
              minLength={3}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Zainab Bashir Mainasara"
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          <div>
            <label htmlFor="auth-password" className="block text-xs font-medium text-slate-300 mb-1.5">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={needsSetup ? 8 : 1}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={needsSetup ? 'Minimum 8 characters' : 'Enter password'}
              className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>

          {needsSetup && (
            <div>
              <label
                htmlFor="auth-confirm-password"
                className="block text-xs font-medium text-slate-300 mb-1.5"
              >
                Confirm Password
              </label>
              <input
                id="auth-confirm-password"
                type="password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter password"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#0B1120] border border-slate-700 text-slate-100 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-60 text-slate-950 font-semibold text-sm transition-colors cursor-pointer whitespace-nowrap"
          >
            <Lock className="w-4 h-4" aria-hidden="true" />
            <span>
              {submitting
                ? 'Authenticating...'
                : needsSetup
                ? 'Create Administrator Account'
                : 'Sign In to Console'}
            </span>
          </button>
        </form>
      </div>
    </div>
  );
}
