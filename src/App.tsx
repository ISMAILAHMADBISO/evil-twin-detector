import {useEffect, useState} from 'react';
import {LogOut, Menu, Radio} from 'lucide-react';
import {apiFetch, clearAuthToken} from './api';
import {Sidebar} from './components/Sidebar';
import {AboutPage} from './pages/AboutPage';
import {AdminsPage} from './pages/AdminsPage';
import {AlertsPage} from './pages/AlertsPage';
import {AnalyticsPage} from './pages/AnalyticsPage';
import {ApprovedAPsPage} from './pages/ApprovedAPsPage';
import {DashboardPage} from './pages/DashboardPage';
import {DetectedNetworksPage} from './pages/DetectedNetworksPage';
import {HistoryPage} from './pages/HistoryPage';
import {LiveScannerPage} from './pages/LiveScannerPage';
import {LoginPage} from './pages/LoginPage';
import {SettingsPage} from './pages/SettingsPage';
import type {NavPage, UserInfo} from './types';

const PAGE_TITLES: Record<NavPage, string> = {
  dashboard: 'Dashboard',
  scanner: 'Live Network Scanner',
  networks: 'Detected Networks',
  approved: 'Approved Access Points',
  alerts: 'Security Alerts',
  history: 'Detection History',
  analytics: 'Performance Analytics',
  admins: 'Administrators',
  settings: 'Settings',
  about: 'About Project',
};

export default function App() {
  const [authLoading, setAuthLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [user, setUser] = useState<UserInfo | null>(null);
  const [activePage, setActivePage] = useState<NavPage>('dashboard');
  const [openAlertCount, setOpenAlertCount] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);

  async function checkAuth() {
    setAuthLoading(true);
    try {
      const status = await apiFetch<{
        needsSetup: boolean;
        authenticated: boolean;
        user: UserInfo | null;
      }>('/api/auth/status');
      setNeedsSetup(status.needsSetup);
      setUser(status.authenticated ? status.user : null);
    } finally {
      setAuthLoading(false);
    }
  }

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    apiFetch<{alerts: Array<{status: string}>}>('/api/alerts?status=Open')
      .then((res) => setOpenAlertCount(res.alerts.length))
      .catch(() => {});
  }, [user, activePage]);

  async function handleLogout() {
    try {
      await apiFetch('/api/auth/logout', {method: 'POST'});
    } finally {
      clearAuthToken();
      setUser(null);
      setNeedsSetup(false);
      setActivePage('dashboard');
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0B1120] flex items-center justify-center text-sm text-slate-400">
        Initializing EvilTwin Detector...
      </div>
    );
  }

  if (!user) {
    return (
      <LoginPage
        needsSetup={needsSetup}
        onAuthenticated={(loggedInUser) => {
          setUser(loggedInUser);
          setNeedsSetup(false);
          setActivePage('dashboard');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#0B1120] text-slate-100 flex">
      <Sidebar
        activePage={activePage}
        onNavigate={setActivePage}
        user={user}
        openAlertCount={openAlertCount}
        onLogout={handleLogout}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 px-4 sm:px-6 border-b border-slate-800/80 bg-[#0E1526] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-300 hover:bg-slate-800"
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="truncate">EvilTwin Detector</span>
                <span aria-hidden="true">/</span>
                <span className="text-cyan-300 font-medium truncate">{PAGE_TITLES[activePage]}</span>
              </div>
              <h1 className="text-base font-bold text-slate-100 truncate">
                {PAGE_TITLES[activePage]}
              </h1>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="hidden md:inline text-xs text-slate-400 truncate max-w-[180px]">
              {user.full_name || user.username}
            </span>
            {activePage !== 'scanner' && (
              <button
                type="button"
                onClick={() => setActivePage('scanner')}
                className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-cyan-500 hover:bg-cyan-400 text-slate-950 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Radio className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Scan Wi-Fi</span>
              </button>
            )}
            <button
              type="button"
              onClick={handleLogout}
              className="px-3 py-2 rounded-lg text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Logout</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {activePage === 'dashboard' && <DashboardPage onNavigate={setActivePage} />}
          {activePage === 'scanner' && <LiveScannerPage />}
          {activePage === 'networks' && <DetectedNetworksPage />}
          {activePage === 'approved' && <ApprovedAPsPage />}
          {activePage === 'alerts' && <AlertsPage />}
          {activePage === 'history' && <HistoryPage />}
          {activePage === 'analytics' && <AnalyticsPage />}
          {activePage === 'admins' && <AdminsPage currentUser={user} />}
          {activePage === 'settings' && <SettingsPage />}
          {activePage === 'about' && <AboutPage />}
        </main>
      </div>
    </div>
  );
}
