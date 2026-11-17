import {
  Activity,
  AlertTriangle,
  BarChart3,
  History,
  Info,
  LayoutDashboard,
  LogOut,
  Network,
  Radio,
  Settings,
  Shield,
  Users,
  X,
} from 'lucide-react';
import type {NavPage, UserInfo} from '../types';

interface SidebarProps {
  activePage: NavPage;
  onNavigate: (page: NavPage) => void;
  user: UserInfo;
  openAlertCount: number;
  onLogout: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_ITEMS: Array<{id: NavPage; label: string; icon: typeof LayoutDashboard}> = [
  {id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard},
  {id: 'scanner', label: 'Live Scanner', icon: Radio},
  {id: 'networks', label: 'Detected Networks', icon: Network},
  {id: 'approved', label: 'Approved APs', icon: Shield},
  {id: 'alerts', label: 'Security Alerts', icon: AlertTriangle},
  {id: 'history', label: 'Detection History', icon: History},
  {id: 'analytics', label: 'Performance Analytics', icon: BarChart3},
  {id: 'admins', label: 'Administrators', icon: Users},
  {id: 'settings', label: 'Settings', icon: Settings},
  {id: 'about', label: 'About Project', icon: Info},
];

export function Sidebar({
  activePage,
  onNavigate,
  user,
  openAlertCount,
  onLogout,
  mobileOpen,
  onCloseMobile,
}: SidebarProps) {
  const navContent = (
    <div className="flex flex-col justify-between h-full bg-[#11192C] border-r border-slate-800/80 w-64 shrink-0">
      <div className="p-5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Activity className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <div className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap">
                EvilTwin Detector
              </div>
              <div className="text-[11px] text-slate-400 whitespace-nowrap">
                Wi-Fi Security Monitor
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onCloseMobile}
            className="lg:hidden p-1.5 rounded-md text-slate-400 hover:text-slate-100 hover:bg-slate-800"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="space-y-1" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onNavigate(item.id);
                  onCloseMobile();
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                  isActive
                    ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/25'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/60 border border-transparent'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </span>
                {item.id === 'alerts' && openAlertCount > 0 && (
                  <span className="text-xs font-mono-tabular text-rose-400 font-semibold">
                    {openAlertCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="p-4 border-t border-slate-800/80">
        <div className="mb-3 px-1">
          <div className="text-[11px] text-cyan-400 font-medium truncate">
            {user.role || 'Administrator'}
          </div>
          <div className="text-sm font-medium text-slate-100 truncate">
            {user.full_name || user.username}
          </div>
        </div>
        <button
          type="button"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 bg-slate-800/70 hover:bg-slate-800 hover:text-white border border-slate-700/70 transition-colors whitespace-nowrap shrink-0"
        >
          <LogOut className="w-4 h-4" aria-hidden="true" />
          <span>Logout</span>
        </button>
      </div>
    </div>
  );

  return (
    <>
      <aside className="hidden lg:block shrink-0">{navContent}</aside>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <aside className="relative z-10 h-full">{navContent}</aside>
        </div>
      )}
    </>
  );
}
