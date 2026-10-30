import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  History,
  BarChart3,
  Users,
  Map as MapIcon,
  BrainCircuit,
  Clock,
  AlertTriangle,
  Crosshair,
  Zap,
  Trophy,
  Compass,
  Library,
  Sparkles,
  Database,
  Settings,
  Search,
  Bell,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Plus,
  RefreshCw,
} from 'lucide-react';
import { useValocore } from '../context/ValocoreContext';
import { NavPageId, UserSettings } from '../types/valocore';
import { getRankTierIcon } from '../utils/seedData';

interface NavGroup {
  section: string;
  items: {
    id: NavPageId;
    label: string;
    icon: React.FC<{ className?: string }>;
  }[];
}

export const NAV_GROUPS: NavGroup[] = [
  {
    section: 'Overview',
    items: [{ id: 'command-center', label: 'Command Center', icon: LayoutDashboard }],
  },
  {
    section: 'Performance',
    items: [
      { id: 'match-history', label: 'Match History', icon: History },
      { id: 'performance-analytics', label: 'Performance Analytics', icon: BarChart3 },
      { id: 'agent-statistics', label: 'Agent Statistics', icon: Users },
      { id: 'map-statistics', label: 'Map Statistics', icon: MapIcon },
    ],
  },
  {
    section: 'Intelligence',
    items: [
      { id: 'ai-coach', label: 'AI Coach', icon: BrainCircuit },
      { id: 'round-analysis', label: 'Round Analysis', icon: Clock },
      { id: 'mistake-tracker', label: 'Mistake Tracker', icon: AlertTriangle },
    ],
  },
  {
    section: 'Training',
    items: [
      { id: 'aim-trainer', label: 'Aim Trainer', icon: Crosshair },
      { id: 'reaction-tests', label: 'Reaction Tests', icon: Zap },
      { id: 'training-history', label: 'Training History', icon: Trophy },
    ],
  },
  {
    section: 'Tactical',
    items: [
      { id: 'strategy-planner', label: 'Strategy Planner', icon: Compass },
      { id: 'map-library', label: 'Map Library', icon: Library },
      { id: 'agent-lineups', label: 'Agent Lineups', icon: Sparkles },
    ],
  },
  {
    section: 'System',
    items: [
      { id: 'data-import', label: 'Data Import', icon: Database },
      { id: 'settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const PAGE_METADATA: Record<NavPageId, { title: string; category: string }> = {
  'command-center': { title: 'Command Center', category: 'Overview' },
  'match-history': { title: 'Match History', category: 'Performance' },
  'performance-analytics': { title: 'Performance Analytics', category: 'Performance' },
  'agent-statistics': { title: 'Agent Statistics', category: 'Performance' },
  'map-statistics': { title: 'Map Statistics', category: 'Performance' },
  'ai-coach': { title: 'AI Coach', category: 'Intelligence' },
  'round-analysis': { title: 'Round Analysis', category: 'Intelligence' },
  'mistake-tracker': { title: 'Mistake Tracker', category: 'Intelligence' },
  'aim-trainer': { title: 'Aim Trainer', category: 'Training' },
  'reaction-tests': { title: 'Reaction Tests', category: 'Training' },
  'training-history': { title: 'Training History', category: 'Training' },
  'strategy-planner': { title: 'Strategy Planner', category: 'Tactical' },
  'map-library': { title: 'Map Library', category: 'Tactical' },
  'agent-lineups': { title: 'Agent Lineups', category: 'Tactical' },
  'data-import': { title: 'Data Import', category: 'System' },
  settings: { title: 'Settings', category: 'System' },
};

export const AppShell: React.FC<{
  children: React.ReactNode;
  onOpenQuickMatchModal: () => void;
}> = ({ children, onOpenQuickMatchModal }) => {
  const {
    activePage,
    setActivePage,
    globalSearch,
    setGlobalSearch,
    settings,
    syncStatus,
    mistakes,
    toastMessage,
    syncRiotIdProfile,
  } = useValocore();

  const [collapsed, setCollapsed] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [riotQuickOpen, setRiotQuickOpen] = useState(false);
  const [quickIgn, setQuickIgn] = useState('');
  const [quickTag, setQuickTag] = useState('');
  const [quickRegion, setQuickRegion] = useState<UserSettings['region']>(settings.region);
  const [quickHenrikKey, setQuickHenrikKey] = useState(settings.henrikApiKey || '');
  const [quickSyncing, setQuickSyncing] = useState(false);

  const [ignPart, tagPart] = settings.riotId.includes('#')
    ? settings.riotId.split('#')
    : [settings.playerName || settings.riotId, '---'];

  useEffect(() => {
    const [n, t] =
      settings.riotId && settings.riotId !== 'Not Connected' && settings.riotId.includes('#')
        ? settings.riotId.split('#')
        : ['DarkNighT', 'slug'];
    setQuickIgn(n);
    setQuickTag(t);
    setQuickRegion(settings.region);
    if (settings.henrikApiKey) setQuickHenrikKey(settings.henrikApiKey);
  }, [settings.riotId, settings.playerName, settings.region, settings.henrikApiKey]);

  const handleQuickSyncSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickIgn.trim() || quickSyncing) return;
    setQuickSyncing(true);
    await syncRiotIdProfile(
      quickIgn.trim(),
      quickRegion,
      (quickHenrikKey || settings.henrikApiKey || '').trim(),
      quickTag.trim()
    );
    setQuickSyncing(false);
    setRiotQuickOpen(false);
  };

  const unresolvedCount = mistakes.filter((m) => !m.resolved).length;
  const pageMeta = PAGE_METADATA[activePage];
  const rankIconUrl = getRankTierIcon(settings.currentRank);

  return (
    <div className="min-h-screen flex bg-[#090A0D] text-[#F5F5F7]">
      {/* Persistent Left Sidebar */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className={`flex flex-col border-r border-[#262832] bg-[#0C0D11] transition-all duration-150 shrink-0 select-none ${
          collapsed ? 'w-[72px]' : 'w-[252px]'
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 px-3.5 flex items-center justify-between border-b border-[#262832]">
          {!collapsed ? (
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#FF4655] flex items-center justify-center font-display font-bold text-white text-sm tracking-tighter shrink-0">
                VC
              </div>
              <div className="min-w-0">
                <div className="font-display font-bold text-base tracking-tight text-[#F5F5F7] leading-none">
                  VALOCORE
                </div>
                <div className="text-[9.5px] font-mono text-[#9395A1] tracking-normal mt-1 whitespace-nowrap">
                  PLAYER INTELLIGENCE SYSTEM
                </div>
              </div>
            </div>
          ) : (
            <div className="w-8 h-8 mx-auto rounded-lg bg-[#FF4655] flex items-center justify-center font-display font-bold text-white text-sm">
              VC
            </div>
          )}

          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="p-1.5 rounded-md text-[#9395A1] hover:text-[#F5F5F7] hover:bg-[#191B23] transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Navigation Sections */}
        <nav className="flex-1 overflow-y-auto py-3 px-2.5 space-y-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.section}>
              {!collapsed && (
                <div className="px-2.5 mb-1.5 text-[11px] font-semibold text-[#60636F] tracking-wider">
                  {group.section}
                </div>
              )}
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = activePage === item.id;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActivePage(item.id)}
                      title={collapsed ? item.label : undefined}
                      className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                        isActive
                          ? 'bg-[#FF4655]/15 text-[#F5F5F7]'
                          : 'text-[#9395A1] hover:text-[#F5F5F7] hover:bg-[#13151B]'
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? 'text-[#FF4655]' : 'text-[#9395A1]'
                        }`}
                      />
                      {!collapsed && <span className="truncate">{item.label}</span>}
                      {!collapsed && item.id === 'mistake-tracker' && unresolvedCount > 0 && (
                        <span className="ml-auto font-mono text-[11px] text-[#FF4655]">
                          {unresolvedCount}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom User Profile & Official Rank Crest */}
        <div className="p-3 border-t border-[#262832] bg-[#090A0D]/60">
          {!collapsed ? (
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {rankIconUrl ? (
                  <img
                    src={rankIconUrl}
                    alt={settings.currentRank}
                    referrerPolicy="no-referrer"
                    className="w-8 h-8 rounded-lg bg-[#191B23] border border-[#262832] p-1 object-contain shrink-0"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-lg bg-[#191B23] border border-[#262832] flex items-center justify-center font-mono text-xs font-semibold text-[#FF4655] shrink-0">
                    {ignPart.slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[#F5F5F7] truncate flex items-center gap-1">
                    <span className="truncate">{ignPart}</span>
                    <span className="text-[10px] font-mono text-[#FF4655] shrink-0">
                      #{tagPart}
                    </span>
                  </div>
                  <div className="text-[11px] text-[#9395A1] truncate">
                    {settings.currentRank} · {settings.region}
                  </div>
                </div>
              </div>
              <span className="font-mono text-[10px] text-[#60636F] shrink-0">v2.6</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-1">
              {rankIconUrl ? (
                <img
                  src={rankIconUrl}
                  alt={settings.currentRank}
                  referrerPolicy="no-referrer"
                  className="w-8 h-8 rounded-lg bg-[#191B23] border border-[#262832] p-1 object-contain"
                />
              ) : (
                <div className="w-8 h-8 rounded-lg bg-[#191B23] border border-[#262832] flex items-center justify-center font-mono text-xs font-semibold text-[#FF4655]">
                  {ignPart.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="font-mono text-[9px] text-[#60636F]">2.6</span>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar Contract */}
        <header className="h-16 px-6 border-b border-[#262832] bg-[#0C0D11]/90 backdrop-blur flex items-center justify-between gap-6 sticky top-0 z-30">
          {/* Zone 1: Breadcrumb & Current Page Title */}
          <div className="flex items-center gap-2 min-w-0 whitespace-nowrap shrink-0">
            <span className="text-xs text-[#9395A1]">{pageMeta.category}</span>
            <span className="text-xs text-[#60636F]" aria-hidden="true">
              /
            </span>
            <span className="text-sm font-display font-semibold text-[#F5F5F7]">
              {pageMeta.title}
            </span>
          </div>

          {/* Zone 2: Global Search + Direct Name#Tag Username Search via HenrikDev API */}
          <div className="flex items-center gap-4 flex-1 max-w-md">
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const q = globalSearch.trim();
                if (q.includes('#')) {
                  const [n, t] = q.split('#');
                  if (n && t) {
                    await syncRiotIdProfile(
                      n.trim(),
                      settings.region,
                      settings.henrikApiKey,
                      t.trim()
                    );
                  }
                }
              }}
              className="relative flex-1"
            >
              <Search className="w-3.5 h-3.5 text-[#60636F] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="search"
                aria-label="Global search matches, maps, agents, or enter Name#Tag to search player"
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
                placeholder="Search maps, agents, or type Name#Tag + Enter to search player..."
                className="w-full bg-[#13151B] border border-[#262832] focus:border-[#FF4655] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#F5F5F7] placeholder-[#60636F] outline-none transition-colors"
              />
            </form>
          </div>

          {/* Zone 3: Active Riot ID Tracker Pill, Sync status, Notifications, Quick Log Match CTA */}
          <div className="flex items-center gap-2.5 shrink-0">
            {/* Active Riot ID Pill + Quick Switch Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setRiotQuickOpen((v) => !v)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#13151B] hover:bg-[#191B23] border border-[#262832] text-xs transition-colors cursor-pointer whitespace-nowrap"
                title="Click to search or sync any Valorant IGN #Tag via HenrikDev API"
              >
                {rankIconUrl && (
                  <img
                    src={rankIconUrl}
                    alt={settings.currentRank}
                    referrerPolicy="no-referrer"
                    className="w-4 h-4 object-contain shrink-0"
                  />
                )}
                <span className="font-display font-bold text-[#F5F5F7]">{ignPart}</span>
                <span className="font-mono text-[11px] text-[#FF4655] font-semibold">
                  #{tagPart}
                </span>
                <span className="text-[10px] font-mono text-[#9395A1] px-1.5 py-0.5 rounded bg-[#090A0D] border border-[#262832]">
                  {settings.region}
                </span>
              </button>

              {riotQuickOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[#13151B] border border-[#262832] shadow-2xl p-4 z-50">
                  <div className="text-xs font-display font-bold text-[#F5F5F7] mb-1">
                    HenrikDev Username Search (Name#Tag)
                  </div>
                  <p className="text-[11px] text-[#9395A1] mb-3">
                    Search any Valorant player&apos;s live Rank, RR, and Match History using your
                    HenrikDev API key.
                  </p>
                  <form onSubmit={handleQuickSyncSubmit} className="space-y-2.5">
                    <div className="grid grid-cols-3 gap-1.5">
                      <div className="col-span-2">
                        <label className="block text-[10px] font-mono text-[#9395A1] mb-1">
                          IGN (PLAYER NAME)
                        </label>
                        <input
                          type="text"
                          value={quickIgn}
                          onChange={(e) => {
                            const val = e.target.value;
                            if (val.includes('#')) {
                              const [n, t] = val.split('#');
                              setQuickIgn(n);
                              setQuickTag(t);
                            } else {
                              setQuickIgn(val);
                            }
                          }}
                          placeholder="DarkNighT"
                          className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F5F5F7]"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-[#9395A1] mb-1">
                          #TAG
                        </label>
                        <input
                          type="text"
                          value={quickTag}
                          onChange={(e) => setQuickTag(e.target.value.replace(/^#/, ''))}
                          placeholder="slug"
                          className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F5F5F7]"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-[#9395A1] mb-1">
                        HENRIKDEV API KEY (HDEV-...)
                      </label>
                      <input
                        type="password"
                        value={quickHenrikKey}
                        onChange={(e) => setQuickHenrikKey(e.target.value)}
                        placeholder="HDEV-xxxx-xxxx..."
                        className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F5F5F7]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        value={quickRegion}
                        onChange={(e) => setQuickRegion(e.target.value as UserSettings['region'])}
                        className="bg-[#090A0D] border border-[#262832] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F5F5F7]"
                      >
                        <option value="APAC">APAC</option>
                        <option value="NA">NA</option>
                        <option value="EUW">EUW</option>
                        <option value="KR">KR</option>
                        <option value="BR">BR</option>
                      </select>
                      <button
                        type="submit"
                        disabled={quickSyncing}
                        className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${quickSyncing ? 'animate-spin' : ''}`} />
                        {quickSyncing ? 'Searching...' : 'Search Player'}
                      </button>
                    </div>
                  </form>
                </div>
              )}
            </div>

            <span className="hidden 2xl:inline-flex items-center gap-1.5 text-xs text-[#9395A1] font-mono whitespace-nowrap">
              <ShieldCheck className="w-3.5 h-3.5 text-[#36D399]" />
              SQLite {syncStatus}
            </span>

            {/* Notification Popover Button */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((o) => !o)}
                aria-label="Open notifications"
                className="p-2 rounded-lg bg-[#13151B] border border-[#262832] text-[#9395A1] hover:text-[#F5F5F7] transition-colors relative"
              >
                <Bell className="w-4 h-4" />
                {unresolvedCount > 0 && (
                  <span className="sr-only">{unresolvedCount} unresolved mistakes</span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-xl bg-[#13151B] border border-[#262832] shadow-2xl p-4 z-50">
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#262832]">
                    <span className="text-xs font-semibold text-[#F5F5F7]">
                      Player Intelligence Alerts
                    </span>
                    <span className="text-[11px] font-mono text-[#9395A1]">
                      {unresolvedCount} Active
                    </span>
                  </div>
                  <div className="space-y-2.5 max-h-60 overflow-y-auto">
                    {mistakes
                      .filter((m) => !m.resolved)
                      .slice(0, 3)
                      .map((mk) => (
                        <div
                          key={mk.id}
                          className="p-2.5 rounded-lg bg-[#191B23] border border-[#262832] text-xs"
                        >
                          <div className="font-medium text-[#F5F5F7]">{mk.title}</div>
                          <div className="text-[11px] text-[#9395A1] mt-0.5">
                            {mk.map} · {mk.agent} · {mk.category}
                          </div>
                        </div>
                      ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNotifOpen(false);
                      setActivePage('mistake-tracker');
                    }}
                    className="w-full mt-3 py-1.5 text-xs font-medium text-[#FF4655] hover:underline text-center"
                  >
                    Review All in Mistake Tracker
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setActivePage('settings')}
              aria-label="Open Settings"
              className="p-2 rounded-lg bg-[#13151B] border border-[#262832] text-[#9395A1] hover:text-[#F5F5F7] transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenQuickMatchModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Log Match
            </button>
          </div>
        </header>

        {/* Toast Notification Banner */}
        {toastMessage && (
          <div
            role="status"
            className="fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-lg bg-[#191B23] border border-[#FF4655] text-xs font-medium text-[#F5F5F7] shadow-xl flex items-center gap-2"
          >
            <span className="text-[#36D399] font-mono">OK</span>
            <span>·</span>
            <span>{toastMessage}</span>
          </div>
        )}

        {/* Active View Content */}
        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};

