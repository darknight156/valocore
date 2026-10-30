import React, { useMemo, useState, useEffect } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  Search,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  BrainCircuit,
  Compass,
  RefreshCw,
  Trash2,
  ShieldCheck,
  Award,
  KeyRound,
  ShoppingBag,
  AlertCircle,
} from 'lucide-react';
import { useValocore } from '../../context/ValocoreContext';
import {
  computeOverviewMetrics,
  computeAgentAnalytics,
  computeMapAnalytics,
  filterMatchesByPeriod,
  generateCalculatedInsights,
  calculateKD,
  computeMatchRrDelta,
} from '../../utils/analytics';
import {
  getAgentCatalogItem,
  getMapCatalogItem,
  getRankTierIcon,
  ALL_AGENTS,
  ALL_MAPS,
  LIVE_VERSION,
} from '../../utils/seedData';
import { UserSettings } from '../../types/valocore';
import { RiotAuthStoreModal } from '../../components/RiotAuthStoreModal';

export const CommandCenterView: React.FC = () => {
  const {
    matches,
    mistakes,
    trainingSessions,
    settings,
    lastUpdated,
    analysisPeriod,
    setAnalysisPeriod,
    setActivePage,
    setSelectedMatchId,
    globalSearch,
    syncRiotIdProfile,
    clearAllMatches,
  } = useValocore();

  const [ignInput, setIgnInput] = useState(() =>
    settings.riotId && settings.riotId !== 'Not Connected'
      ? settings.riotId.split('#')[0]
      : 'DarkNighT'
  );
  const [tagInput, setTagInput] = useState(() =>
    settings.riotId && settings.riotId.includes('#') ? settings.riotId.split('#')[1] : 'slug'
  );
  const [regionInput, setRegionInput] = useState<UserSettings['region']>(settings.region);
  const [henrikKeyInput, setHenrikKeyInput] = useState<string>(settings.henrikApiKey || '');
  const [isSyncingRiotId, setIsSyncingRiotId] = useState(false);
  const [riotModalOpen, setRiotModalOpen] = useState(false);
  const [riotModalTab, setRiotModalTab] = useState<'auth' | 'store' | 'nightmarket' | 'skins'>(
    'auth'
  );

  // Keep form inputs in sync whenever settings.riotId updates from SQLite or TopBar
  useEffect(() => {
    if (settings.riotId && settings.riotId !== 'Not Connected') {
      const [n, t] = settings.riotId.includes('#')
        ? settings.riotId.split('#')
        : [settings.playerName || settings.riotId, 'slug'];
      setIgnInput(n);
      setTagInput(t);
    }
    setRegionInput(settings.region);
    if (settings.henrikApiKey) setHenrikKeyInput(settings.henrikApiKey);
  }, [settings.riotId, settings.playerName, settings.region, settings.henrikApiKey]);

  const [chartSeries, setChartSeries] = useState<'acs' | 'kd' | 'hs' | 'winRate'>('acs');
  const [tableFilterResult, setTableFilterResult] = useState<'ALL' | 'WIN' | 'LOSS'>('ALL');
  const [tableSearch, setTableSearch] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'acs' | 'adr' | 'hsPercent'>('date');
  const [page, setPage] = useState(1);
  const pageSize = 6;

  const periodMatches = useMemo(
    () => filterMatchesByPeriod(matches, analysisPeriod),
    [matches, analysisPeriod]
  );

  const metrics = useMemo(() => computeOverviewMetrics(periodMatches), [periodMatches]);
  const agentStats = useMemo(() => computeAgentAnalytics(periodMatches), [periodMatches]);
  const mapStats = useMemo(() => computeMapAnalytics(periodMatches), [periodMatches]);
  const insights = useMemo(
    () => generateCalculatedInsights(periodMatches, mistakes),
    [periodMatches, mistakes]
  );

  const netRrTotal = useMemo(
    () => periodMatches.reduce((sum, m) => sum + computeMatchRrDelta(m).rrChange, 0),
    [periodMatches]
  );

  const handleRiotIdSync = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ignInput.trim() || isSyncingRiotId) return;
    setIsSyncingRiotId(true);
    const cleanTag = (tagInput || 'slug').replace(/^#/, '').trim();
    const effectiveKey = (henrikKeyInput.trim() || settings.henrikApiKey || '').trim();
    const ok = await syncRiotIdProfile(
      ignInput.trim(),
      regionInput,
      effectiveKey,
      cleanTag
    );
    setPage(1);
    setIsSyncingRiotId(false);
    if (!ok && !effectiveKey) {
      setRiotModalTab('auth');
      setRiotModalOpen(true);
    }
  };

  // Main performance chart chronological series
  const chartData = useMemo(() => {
    const chronological = [...periodMatches].sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );
    let runningWins = 0;
    return chronological.map((m, idx) => {
      if (m.result === 'WIN') runningWins++;
      return {
        label: `${m.map.slice(0, 3)} #${idx + 1}`,
        fullDate: new Date(m.date).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
        }),
        map: m.map,
        agent: m.agent,
        acs: m.acs,
        kd: calculateKD(m.kills, m.deaths),
        hs: m.hsPercent,
        winRate: Number(((runningWins / (idx + 1)) * 100).toFixed(1)),
      };
    });
  }, [periodMatches]);

  // Filtered and sorted recent matches table
  const filteredMatches = useMemo(() => {
    const q = (tableSearch || globalSearch).trim().toLowerCase();
    return periodMatches
      .filter((m) => (tableFilterResult === 'ALL' ? true : m.result === tableFilterResult))
      .filter((m) =>
        q
          ? m.map.toLowerCase().includes(q) ||
            m.agent.toLowerCase().includes(q) ||
            m.role.toLowerCase().includes(q)
          : true
      )
      .sort((a, b) => {
        if (sortBy === 'acs') return b.acs - a.acs;
        if (sortBy === 'adr') return b.adr - a.adr;
        if (sortBy === 'hsPercent') return b.hsPercent - a.hsPercent;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });
  }, [periodMatches, tableFilterResult, tableSearch, globalSearch, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filteredMatches.length / pageSize));
  const paginatedMatches = filteredMatches.slice((page - 1) * pageSize, page * pageSize);

  const bestAgent = agentStats[0];
  const weakestMap = mapStats.length > 0 ? mapStats[mapStats.length - 1] : null;
  const unresolvedMistakes = mistakes.filter((m) => !m.resolved);
  const topMistake = unresolvedMistakes[0] || mistakes[0];

  const isConnected =
    settings.riotId &&
    settings.riotId !== 'Not Connected' &&
    (matches.length > 0 || settings.accountLevel > 0);

  const [activeIgn, activeTag] =
    settings.riotId && settings.riotId.includes('#')
      ? settings.riotId.split('#')
      : [settings.playerName || settings.riotId || 'Not Connected', '---'];

  const currentRankIcon = getRankTierIcon(settings.currentRank);
  const peakRankIcon = getRankTierIcon(settings.peakRank);
  const heroAgentIcon =
    getAgentCatalogItem(bestAgent?.agent || 'Jett')?.displayIcon || ALL_AGENTS[0]?.displayIcon;
  const heroMapSplash =
    getMapCatalogItem(mapStats[0]?.map || 'Ascent')?.splash || ALL_MAPS[0]?.splash;

  // Compute Valorant Tracker TRN Score (0 - 1000) strictly from real matches
  const trnScore = useMemo(() => {
    if (periodMatches.length === 0) return 0;
    const raw =
      metrics.avgAcs * 1.45 +
      metrics.kdRatio * 185 +
      metrics.winRate * 2.1 +
      metrics.hsPercent * 3.2;
    return Math.min(999, Math.max(100, Math.round(raw)));
  }, [periodMatches.length, metrics]);

  const trnTier =
    periodMatches.length === 0
      ? '--'
      : trnScore >= 850
        ? 'S+'
        : trnScore >= 760
          ? 'S'
          : trnScore >= 650
            ? 'A'
            : 'B';

  const renderSparkline = (values: number[], positive: boolean) => {
    if (values.length < 2) return null;
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const pts = values
      .map((v, i) => {
        const x = (i / (values.length - 1)) * 72;
        const y = 22 - ((v - min) / range) * 18;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
    return (
      <svg width="76" height="26" className="overflow-visible shrink-0" aria-hidden="true">
        <polyline
          fill="none"
          stroke={positive ? '#36D399' : '#FF4655'}
          strokeWidth="1.75"
          points={pts}
        />
      </svg>
    );
  };

  const kpiCards = [
    {
      title: 'WIN RATE',
      value: `${metrics.winRate}%`,
      delta: `${metrics.winRateDelta >= 0 ? '+' : ''}${metrics.winRateDelta}%`,
      positive: metrics.winRateDelta >= 0,
      sub: 'vs prior period',
      spark: chartData.map((d) => d.winRate),
    },
    {
      title: 'K/D RATIO',
      value: metrics.kdRatio.toFixed(2),
      delta: `${metrics.kdDelta >= 0 ? '+' : ''}${metrics.kdDelta}`,
      positive: metrics.kdDelta >= 0,
      sub: 'kills per death',
      spark: chartData.map((d) => d.kd),
    },
    {
      title: 'HEADSHOT %',
      value: `${metrics.hsPercent}%`,
      delta: `${metrics.hsDelta >= 0 ? '+' : ''}${metrics.hsDelta}%`,
      positive: metrics.hsDelta >= 0,
      sub: 'first-bullet precision',
      spark: chartData.map((d) => d.hs),
    },
    {
      title: 'AVERAGE ACS',
      value: `${metrics.avgAcs}`,
      delta: `${metrics.acsDelta >= 0 ? '+' : ''}${metrics.acsDelta}`,
      positive: metrics.acsDelta >= 0,
      sub: 'combat score / round',
      spark: chartData.map((d) => d.acs),
    },
    {
      title: 'AVERAGE ADR',
      value: `${metrics.avgAdr}`,
      delta: `${metrics.adrDelta >= 0 ? '+' : ''}${metrics.adrDelta}`,
      positive: metrics.adrDelta >= 0,
      sub: 'damage / round',
      spark: periodMatches.map((m) => m.adr).reverse(),
    },
    {
      title: 'TOTAL MATCHES',
      value: `${metrics.totalMatches}`,
      delta: `${periodMatches.filter((m) => m.result === 'WIN').length}W - ${
        periodMatches.filter((m) => m.result === 'LOSS').length
      }L`,
      positive: true,
      sub: 'recorded in window',
      spark: chartData.map((d) => d.acs),
    },
  ];

  return (
    <div className="space-y-6">
      {/* LIVE RIOT API SYNC BAR & PLAYER PROFILE HEADER */}
      <section className="rounded-xl bg-[#13151B] border border-[#262832] overflow-hidden">
        <form
          onSubmit={handleRiotIdSync}
          className="px-5 py-3.5 bg-[#0C0D11] border-b border-[#262832] flex flex-col xl:flex-row xl:items-center justify-between gap-3"
        >
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <span className="text-[11px] font-mono font-bold text-[#FF4655] uppercase tracking-wider whitespace-nowrap">
              LIVE RIOT SYNC:
            </span>

            {/* Split IGN + #TAG Input Box */}
            <div className="inline-flex items-center rounded-lg bg-[#090A0D] border border-[#262832] focus-within:border-[#FF4655] overflow-hidden">
              <input
                type="text"
                aria-label="Enter Valorant IGN"
                value={ignInput}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.includes('#')) {
                    const [n, t] = val.split('#');
                    setIgnInput(n);
                    setTagInput(t);
                  } else {
                    setIgnInput(val);
                  }
                }}
                placeholder="IGN (e.g. DarkNighT)"
                className="bg-transparent px-3 py-1.5 text-xs font-mono font-semibold text-[#F5F5F7] w-36 outline-none"
              />
              <span className="text-xs font-mono text-[#60636F] select-none px-1">#</span>
              <input
                type="text"
                aria-label="Enter Riot Tagline"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value.replace(/^#/, ''))}
                placeholder="slug"
                className="bg-[#13151B] border-l border-[#262832] px-2.5 py-1.5 text-xs font-mono text-[#FF4655] font-semibold w-18 outline-none"
              />
            </div>

            <select
              aria-label="Select Riot Region"
              value={regionInput}
              onChange={(e) => setRegionInput(e.target.value as UserSettings['region'])}
              className="bg-[#090A0D] border border-[#262832] rounded-lg px-2 py-1.5 text-xs font-mono text-[#F5F5F7]"
            >
              <option value="APAC">APAC</option>
              <option value="NA">NA</option>
              <option value="EUW">EUW</option>
              <option value="KR">KR</option>
              <option value="BR">BR</option>
            </select>

            <div className="relative flex items-center">
              <input
                type="password"
                aria-label="HenrikDev API Key for Username Search"
                value={henrikKeyInput}
                onChange={(e) => setHenrikKeyInput(e.target.value)}
                placeholder="HenrikDev Key (HDEV-...) for Username Search"
                className="bg-[#090A0D] border border-[#262832] focus:border-[#FF4655] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F5F5F7] placeholder-[#60636F] w-64 outline-none"
              />
              {(henrikKeyInput.trim() || settings.henrikApiKey) && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-[#36D399]/15 border border-[#36D399]/30 text-[10px] font-mono font-semibold text-[#36D399] whitespace-nowrap">
                  HDEV ACTIVE
                </span>
              )}
            </div>

            <button
              type="submit"
              disabled={isSyncingRiotId}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white whitespace-nowrap cursor-pointer shadow-sm"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncingRiotId ? 'animate-spin' : ''}`} />
              {isSyncingRiotId ? 'Searching Henrik API...' : 'Search Username / Sync'}
            </button>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                setRiotModalTab('auth');
                setRiotModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#191B23] hover:bg-[#262832] border border-[#FF4655]/50 text-xs font-mono font-semibold text-[#F5F5F7] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <KeyRound className="w-3.5 h-3.5 text-[#FF4655]" />
              Riot RSO Login (#access_token)
            </button>

            <button
              type="button"
              onClick={() => {
                setRiotModalTab('store');
                setRiotModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#191B23] hover:bg-[#262832] border border-[#262832] text-xs font-mono font-semibold text-[#36D399] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5 text-[#36D399]" />
              Store &amp; Wallet
            </button>

            {matches.length > 0 && (
              <button
                type="button"
                onClick={clearAllMatches}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#191B23] hover:bg-[#262832] border border-[#262832] text-xs font-medium text-[#9395A1] hover:text-[#F5F5F7] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-[#FF4655]" />
                Clear Matches
              </button>
            )}
          </div>
        </form>

        {/* Valorant Tracker Hero Profile Banner */}
        <div className="relative p-6">
          {heroMapSplash && (
            <img
              src={heroMapSplash}
              alt=""
              referrerPolicy="no-referrer"
              className="absolute inset-0 w-full h-full object-cover opacity-15 pointer-events-none select-none"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-r from-[#090A0D] via-[#13151B]/95 to-[#13151B]/85 pointer-events-none" />

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
            {/* Left: Player Avatar + Giant IGN #Tag + Level & Season Badges */}
            <div className="flex items-center gap-4">
              <div className="relative shrink-0">
                {heroAgentIcon && (
                  <img
                    src={heroAgentIcon}
                    alt={activeIgn}
                    referrerPolicy="no-referrer"
                    className="w-20 h-20 rounded-2xl bg-[#090A0D] border-2 border-[#FF4655] object-cover shadow-lg"
                  />
                )}
                <span className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-[#090A0D] border border-[#262832] text-[10px] font-mono font-bold text-[#F5B942] whitespace-nowrap">
                  LVL {settings.accountLevel || 0}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${
                      isConnected
                        ? 'text-[#36D399] bg-[#36D399]/10 border-[#36D399]/30'
                        : 'text-[#F5B942] bg-[#F5B942]/10 border-[#F5B942]/30'
                    }`}
                  >
                    <ShieldCheck className="w-3 h-3" />
                    {isConnected ? 'LIVE RIOT TELEMETRY CONNECTED' : 'AWAITING RIOT AUTHENTICATION'}
                  </span>
                  <span className="text-[11px] font-mono text-[#9395A1]">
                    {LIVE_VERSION.season.toUpperCase()} · PATCH {LIVE_VERSION.patch}
                  </span>
                </div>

                <div className="flex flex-wrap items-baseline gap-2.5">
                  <h1 className="text-3xl font-display font-bold text-[#F5F5F7] tracking-tight">
                    {activeIgn}
                  </h1>
                  {activeTag !== '---' && (
                    <span className="px-2.5 py-0.5 rounded-md bg-[#090A0D] border border-[#262832] font-mono text-base font-bold text-[#FF4655]">
                      #{activeTag}
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-[#191B23] border border-[#262832] font-mono text-xs text-[#F5F5F7]">
                    {settings.region}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-[#9395A1] font-mono">
                  <span>Last Synced: {lastUpdated}</span>
                  <span>·</span>
                  <span>{matches.length} Live Matches</span>
                  <span>·</span>
                  <span
                    className={
                      netRrTotal >= 0
                        ? 'text-[#36D399] font-semibold'
                        : 'text-[#FF4655] font-semibold'
                    }
                  >
                    Net Rating: {netRrTotal >= 0 ? `+${netRrTotal}` : netRrTotal} RR
                  </span>
                </div>
              </div>
            </div>

            {/* Center/Right: Official Rank Crest, Peak Rank Crest, TRN Score */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#090A0D]/90 border border-[#262832]">
                {currentRankIcon && (
                  <img
                    src={currentRankIcon}
                    alt={settings.currentRank}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 object-contain shrink-0"
                  />
                )}
                <div>
                  <div className="text-[10px] font-mono text-[#9395A1] uppercase">
                    CURRENT RATING
                  </div>
                  <div className="text-sm font-display font-bold text-[#36D399]">
                    {settings.currentRank || 'Unranked'}
                  </div>
                  <div className="text-[10px] font-mono text-[#60636F]">
                    Net Window: {netRrTotal >= 0 ? `+${netRrTotal}` : netRrTotal} RR
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#090A0D]/90 border border-[#262832]">
                {peakRankIcon && (
                  <img
                    src={peakRankIcon}
                    alt={settings.peakRank}
                    referrerPolicy="no-referrer"
                    className="w-11 h-11 object-contain shrink-0"
                  />
                )}
                <div>
                  <div className="text-[10px] font-mono text-[#9395A1] uppercase">PEAK RATING</div>
                  <div className="text-sm font-display font-bold text-[#F5F5F7]">
                    {settings.peakRank || 'Unranked'}
                  </div>
                  <div className="text-[10px] font-mono text-[#60636F]">Career Best Crest</div>
                </div>
              </div>

              <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-[#090A0D]/90 border border-[#262832]">
                <div className="w-10 h-10 rounded-lg bg-[#FF4655]/15 border border-[#FF4655] flex items-center justify-center font-display font-bold text-base text-[#FF4655]">
                  {trnTier}
                </div>
                <div>
                  <div className="text-[10px] font-mono text-[#9395A1] uppercase flex items-center gap-1">
                    <Award className="w-3 h-3 text-[#F5B942]" />
                    VALOCORE TRN SCORE
                  </div>
                  <div className="text-sm font-mono font-bold text-[#F5F5F7]">
                    {trnScore} <span className="text-xs text-[#9395A1]">/ 1,000</span>
                  </div>
                  <div className="text-[10px] font-mono text-[#9395A1]">
                    {periodMatches.length > 0 ? 'Computed from live matches' : 'No matches loaded'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Connect Account Callout when 0 matches are loaded */}
          {matches.length === 0 && (
            <div className="relative z-10 mt-5 p-4 rounded-xl bg-[#090A0D]/95 border border-[#FF4655]/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-[#FF4655] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-display font-bold text-[#F5F5F7]">
                    ZERO FAKE DATA — CONNECT YOUR RIOT GAMES ACCOUNT TO LOAD REAL VALORANT STATS
                  </div>
                  <p className="text-xs text-[#9395A1] mt-0.5">
                    All manual/fake sample data has been removed. Click{' '}
                    <strong>Riot RSO Login (#access_token)</strong> to sign in via Riot Games and
                    fetch your real PUUID, real Rank/RR, real Match History (`pd.a.pvp.net`), Daily
                    Storefront, and Wallet—or enter a valid <strong>HenrikDev API Key</strong> above.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setRiotModalTab('auth');
                  setRiotModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
              >
                <KeyRound className="w-3.5 h-3.5" />
                Connect Riot RSO Now
              </button>
            </div>
          )}

          {/* Bottom Strip of Hero Card: Top Agents + Recent Form Strip + Period Switcher */}
          <div className="relative z-10 mt-5 pt-4 border-t border-[#262832] flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[10px] font-mono text-[#9395A1] uppercase">TOP AGENTS:</span>
              {agentStats.length === 0 ? (
                <span className="text-xs font-mono text-[#60636F]">No matches synced yet</span>
              ) : (
                agentStats.slice(0, 3).map((ag) => {
                  const icon = getAgentCatalogItem(ag.agent)?.displayIcon;
                  return (
                    <div
                      key={ag.agent}
                      className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#090A0D] border border-[#262832] text-xs"
                    >
                      {icon && (
                        <img
                          src={icon}
                          alt={ag.agent}
                          referrerPolicy="no-referrer"
                          className="w-5 h-5 rounded-full object-cover"
                        />
                      )}
                      <span className="font-semibold text-[#F5F5F7]">{ag.agent}</span>
                      <span className="font-mono text-[11px] text-[#36D399]">{ag.winRate}% WR</span>
                      <span className="font-mono text-[11px] text-[#9395A1]">{ag.avgKd} KD</span>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[#9395A1] uppercase mr-1">
                  RECENT FORM:
                </span>
                {periodMatches.length === 0 ? (
                  <span className="text-xs font-mono text-[#60636F]">—</span>
                ) : (
                  periodMatches.slice(0, 10).map((m) => (
                    <span
                      key={m.id}
                      title={`${m.result} on ${m.map} (${m.agent}) · ${m.scoreFor}-${m.scoreAgainst}`}
                      className={`w-5 h-5 rounded text-[10px] font-mono font-bold flex items-center justify-center ${
                        m.result === 'WIN'
                          ? 'bg-[#36D399]/20 text-[#36D399] border border-[#36D399]/40'
                          : 'bg-[#FF4655]/20 text-[#FF4655] border border-[#FF4655]/40'
                      }`}
                    >
                      {m.result === 'WIN' ? 'W' : 'L'}
                    </span>
                  ))
                )}
              </div>

              <div
                role="group"
                aria-label="Analysis time period"
                className="flex items-center p-1 rounded-lg bg-[#090A0D] border border-[#262832]"
              >
                {(
                  [
                    { id: '7d', label: '7 Days' },
                    { id: '30d', label: '30 Days' },
                    { id: '90d', label: '90 Days' },
                    { id: 'all', label: 'All Time' },
                  ] as const
                ).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setAnalysisPeriod(p.id);
                      setPage(1);
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                      analysisPeriod === p.id
                        ? 'bg-[#FF4655] text-white'
                        : 'text-[#9395A1] hover:text-[#F5F5F7]'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6 Performance Overview Cards */}
      <section
        aria-label="Performance Overview Metrics"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4"
      >
        {kpiCards.map((card) => (
          <div
            key={card.title}
            className="rounded-xl bg-[#13151B] border border-[#262832] p-4 flex flex-col justify-between hover:border-[#383B4A] transition-colors"
          >
            <div className="flex items-center justify-between gap-1.5 whitespace-nowrap">
              <span className="text-[10.5px] font-mono font-semibold text-[#9395A1] tracking-tight">
                {card.title}
              </span>
              <span
                className={`inline-flex items-center gap-0.5 text-[10.5px] font-mono shrink-0 ${
                  card.positive ? 'text-[#36D399]' : 'text-[#FF4655]'
                }`}
              >
                {card.positive ? (
                  <TrendingUp className="w-3 h-3" />
                ) : (
                  <TrendingDown className="w-3 h-3" />
                )}
                {card.delta}
              </span>
            </div>

            <div className="mt-3 flex items-end justify-between gap-2">
              <div>
                <div className="text-2xl font-mono font-bold text-[#F5F5F7] leading-none">
                  {card.value}
                </div>
                <div className="text-[11px] text-[#60636F] mt-1.5">{card.sub}</div>
              </div>
              {renderSparkline(card.spark, card.positive)}
            </div>
          </div>
        ))}
      </section>

      {/* Main Performance Chart + Tactical Intelligence Column */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-8 rounded-xl bg-[#13151B] border border-[#262832] p-5 flex flex-col justify-between">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#262832]">
            <div>
              <h2 className="text-base font-display font-bold text-[#F5F5F7]">
                PERFORMANCE OVERVIEW ({settings.riotId})
              </h2>
              <p className="text-xs text-[#9395A1]">
                Match-by-match trajectory across {periodMatches.length} recorded matches
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#090A0D] border border-[#262832]">
              {(
                [
                  { id: 'acs', label: 'ACS' },
                  { id: 'kd', label: 'K/D Ratio' },
                  { id: 'hs', label: 'Headshot %' },
                  { id: 'winRate', label: 'Win Rate %' },
                ] as const
              ).map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setChartSeries(s.id)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap ${
                    chartSeries === s.id
                      ? 'bg-[#FF4655] text-white'
                      : 'text-[#9395A1] hover:text-[#F5F5F7]'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="h-[290px] w-full pt-4">
            {chartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs font-mono text-[#60636F]">
                No match telemetry loaded yet. Authenticate via Riot RSO or HenrikDev API to plot
                performance.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 14, left: -12, bottom: 0 }}>
                  <defs>
                    <linearGradient id="valocoreCrimson" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#FF4655" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#FF4655" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262832" vertical={false} />
                  <XAxis
                    dataKey="label"
                    stroke="#60636F"
                    tick={{ fill: '#9395A1', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  />
                  <YAxis
                    stroke="#60636F"
                    tick={{ fill: '#9395A1', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#191B23',
                      borderColor: '#262832',
                      borderRadius: '8px',
                      fontSize: '12px',
                      color: '#F5F5F7',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey={chartSeries}
                    stroke="#FF4655"
                    strokeWidth={2.25}
                    fillOpacity={1}
                    fill="url(#valocoreCrimson)"
                    name={chartSeries.toUpperCase()}
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          <div className="pt-3 border-t border-[#262832] flex flex-wrap items-center justify-between gap-4 text-xs text-[#9395A1] font-mono">
            <div>
              Primary Series:{' '}
              <span className="text-[#FF4655] font-semibold">{chartSeries.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-4">
              <span>First Blood Rate: {metrics.firstBloodRate}%</span>
              <span>·</span>
              <span>First Death Rate: {metrics.firstDeathRate}%</span>
              <span>·</span>
              <span>Clutch Conversion: {metrics.clutchSuccessRate}%</span>
            </div>
          </div>
        </div>

        {/* Right Column: Best Agent, Weakest Map, Most Frequent Mistake */}
        <div className="lg:col-span-4 flex flex-col justify-between gap-4">
          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#9395A1] uppercase">
                Best Performing Agent
              </span>
              <button
                type="button"
                onClick={() => setActivePage('agent-statistics')}
                className="text-xs text-[#FF4655] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
              >
                All 30 Agents <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            {bestAgent ? (
              <div className="mt-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getAgentCatalogItem(bestAgent.agent)?.displayIcon && (
                    <img
                      src={getAgentCatalogItem(bestAgent.agent)!.displayIcon}
                      alt={bestAgent.agent}
                      referrerPolicy="no-referrer"
                      className="w-10 h-10 rounded-lg bg-[#090A0D] border border-[#262832] object-cover"
                    />
                  )}
                  <div>
                    <div className="text-lg font-display font-bold text-[#F5F5F7]">
                      {bestAgent.agent}
                    </div>
                    <div className="text-xs text-[#9395A1]">
                      {bestAgent.role} · {bestAgent.matches} Matches
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-base font-bold text-[#36D399]">{bestAgent.winRate}% WR</div>
                  <div className="text-xs text-[#9395A1]">
                    {bestAgent.avgAcs} ACS · {bestAgent.avgKd} K/D
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-[#9395A1]">
                Connect your Riot account to compute top agent stats.
              </div>
            )}
          </div>

          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-[#9395A1] uppercase">
                Priority Map Focus
              </span>
              <button
                type="button"
                onClick={() => setActivePage('map-statistics')}
                className="text-xs text-[#FF4655] hover:underline inline-flex items-center gap-1 whitespace-nowrap"
              >
                All 13 Maps <ArrowUpRight className="w-3 h-3" />
              </button>
            </div>
            {weakestMap ? (
              <div className="mt-2.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {getMapCatalogItem(weakestMap.map)?.listViewIcon && (
                    <img
                      src={getMapCatalogItem(weakestMap.map)!.listViewIcon}
                      alt={weakestMap.map}
                      referrerPolicy="no-referrer"
                      className="w-12 h-9 rounded-lg bg-[#090A0D] border border-[#262832] object-cover"
                    />
                  )}
                  <div>
                    <div className="text-lg font-display font-bold text-[#F5F5F7]">
                      {weakestMap.map}
                    </div>
                    <div className="text-xs text-[#9395A1]">
                      ATK {weakestMap.attackWinRate}% · DEF {weakestMap.defenseWinRate}%
                    </div>
                  </div>
                </div>
                <div className="text-right font-mono">
                  <div className="text-base font-bold text-[#F5B942]">
                    {weakestMap.winRate}% WR
                  </div>
                  <div className="text-xs text-[#9395A1]">{weakestMap.avgAcs} Avg ACS</div>
                </div>
              </div>
            ) : (
              <div className="mt-2 text-xs text-[#9395A1]">
                Connect your Riot account to analyze map win rates.
              </div>
            )}
          </div>

          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-mono text-[#9395A1] uppercase truncate">
                  Mistake Tracker &amp; AI Insight
                </span>
                <button
                  type="button"
                  onClick={() => setActivePage('ai-coach')}
                  className="text-xs text-[#FF4655] hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                >
                  Open ClutchIQ <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
              {topMistake ? (
                <div className="mt-2">
                  <div className="text-xs font-semibold text-[#F5F5F7]">
                    {topMistake.category}: {topMistake.title}
                  </div>
                  <p className="text-xs text-[#9395A1] mt-1 line-clamp-2">
                    {topMistake.aiSuggestion || topMistake.description}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[#9395A1] mt-2">
                  No mistakes logged yet. Record gameplay notes in the Mistake Tracker.
                </p>
              )}
            </div>

            <div className="pt-3 mt-3 border-t border-[#262832] space-y-1">
              {insights.slice(0, 2).map((ins, i) => (
                <p key={i} className="text-[11px] text-[#9395A1]">
                  · {ins}
                </p>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Recent Matches Table + Training & Weekly Summary */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 rounded-xl bg-[#13151B] border border-[#262832] overflow-hidden">
          <div className="p-5 border-b border-[#262832] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-base font-display font-bold text-[#F5F5F7]">
                RECENT MATCHES ({settings.riotId})
              </h2>
              <p className="text-xs text-[#9395A1]">
                Real Valorant Match History · Click any match row to inspect telemetry
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-[#60636F] absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  aria-label="Filter recent matches by map or agent"
                  value={tableSearch}
                  onChange={(e) => {
                    setTableSearch(e.target.value);
                    setPage(1);
                  }}
                  placeholder="Map or agent..."
                  className="bg-[#090A0D] border border-[#262832] rounded-lg pl-8 pr-2.5 py-1 text-xs text-[#F5F5F7] placeholder-[#60636F] w-36"
                />
              </div>

              <select
                aria-label="Filter match result"
                value={tableFilterResult}
                onChange={(e) => {
                  setTableFilterResult(e.target.value as any);
                  setPage(1);
                }}
                className="bg-[#090A0D] border border-[#262832] rounded-lg px-2.5 py-1 text-xs text-[#F5F5F7]"
              >
                <option value="ALL">All Results</option>
                <option value="WIN">Wins Only</option>
                <option value="LOSS">Losses Only</option>
              </select>

              <select
                aria-label="Sort matches by"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="bg-[#090A0D] border border-[#262832] rounded-lg px-2.5 py-1 text-xs text-[#F5F5F7]"
              >
                <option value="date">Sort: Date</option>
                <option value="acs">Sort: ACS</option>
                <option value="adr">Sort: ADR</option>
                <option value="hsPercent">Sort: HS%</option>
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#262832] text-[11px] font-mono text-[#60636F] bg-[#0C0D11]">
                  <th className="py-2.5 px-4">MAP</th>
                  <th className="py-2.5 px-3">AGENT</th>
                  <th className="py-2.5 px-3">RESULT</th>
                  <th className="py-2.5 px-3">RANK &amp; RR +/-</th>
                  <th className="py-2.5 px-3 text-right">K / D / A</th>
                  <th className="py-2.5 px-3 text-right">ACS</th>
                  <th className="py-2.5 px-3 text-right">ADR</th>
                  <th className="py-2.5 px-3 text-right">HS%</th>
                  <th className="py-2.5 px-4 text-right">DATE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262832] text-xs">
                {paginatedMatches.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[#9395A1]">
                      No matches loaded. Authenticate via &ldquo;Riot RSO Login&rdquo; or provide a
                      HenrikDev API Key above to fetch your real Valorant match history.
                    </td>
                  </tr>
                ) : (
                  paginatedMatches.map((m) => {
                    const agentMeta = getAgentCatalogItem(m.agent);
                    const mapMeta = getMapCatalogItem(m.map);
                    const { rrChange, performanceBonus } = computeMatchRrDelta(m);
                    const rankCrest = getRankTierIcon(m.rankAtMatch || settings.currentRank);
                    return (
                      <tr
                        key={m.id}
                        onClick={() => {
                          setSelectedMatchId(m.id);
                          setActivePage('match-history');
                        }}
                        className="hover:bg-[#191B23] transition-colors cursor-pointer"
                      >
                        <td className="py-2.5 px-4 font-semibold text-[#F5F5F7]">
                          <div className="flex items-center gap-2.5">
                            {mapMeta?.listViewIcon && (
                              <img
                                src={mapMeta.listViewIcon}
                                alt={m.map}
                                referrerPolicy="no-referrer"
                                className="w-9 h-6 rounded object-cover border border-[#262832] shrink-0"
                              />
                            )}
                            <span>{m.map}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            {agentMeta?.displayIcon && (
                              <img
                                src={agentMeta.displayIcon}
                                alt={m.agent}
                                referrerPolicy="no-referrer"
                                className="w-6 h-6 rounded-full bg-[#090A0D] border border-[#262832] shrink-0"
                              />
                            )}
                            <div>
                              <span className="text-[#F5F5F7] font-medium">{m.agent}</span>
                              <span className="text-[#60636F] ml-1.5 text-[11px]">· {m.role}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span
                            className={
                              m.result === 'WIN'
                                ? 'text-[#36D399] font-semibold'
                                : 'text-[#FF4655] font-semibold'
                            }
                          >
                            {m.result}
                          </span>
                          <span className="text-[#9395A1] ml-1.5">
                            {m.scoreFor}-{m.scoreAgainst}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <div className="inline-flex items-center gap-1.5">
                            {rankCrest && (
                              <img
                                src={rankCrest}
                                alt={m.rankAtMatch}
                                referrerPolicy="no-referrer"
                                className="w-5 h-5 object-contain shrink-0"
                              />
                            )}
                            <span
                              className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                                rrChange >= 0
                                  ? 'bg-[#36D399]/15 text-[#36D399] border border-[#36D399]/30'
                                  : 'bg-[#FF4655]/15 text-[#FF4655] border border-[#FF4655]/30'
                              }`}
                            >
                              {rrChange >= 0 ? `+${rrChange} RR` : `${rrChange} RR`}
                              {performanceBonus > 0 ? ' ★' : ''}
                            </span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#F5F5F7]">
                          {m.kills} / {m.deaths} / {m.assists}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-[#F5F5F7]">
                          {m.acs}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#9395A1]">
                          {m.adr}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#9395A1]">
                          {m.hsPercent}%
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-[#9395A1]">
                          {new Date(m.date).toLocaleDateString([], {
                            month: 'short',
                            day: 'numeric',
                          })}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="px-4 py-3 border-t border-[#262832] flex items-center justify-between text-xs text-[#9395A1]">
            <span className="font-mono">
              Showing {paginatedMatches.length} of {filteredMatches.length} matches
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                aria-label="Previous match page"
                className="p-1 rounded border border-[#262832] disabled:opacity-40 hover:bg-[#191B23]"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="font-mono">
                Page {page} / {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                aria-label="Next match page"
                className="p-1 rounded border border-[#262832] disabled:opacity-40 hover:bg-[#191B23]"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Recent Training Activity & Quick Modules */}
        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-display font-bold text-[#F5F5F7]">
                RECENT TRAINING ACTIVITY
              </h2>
              <button
                type="button"
                onClick={() => setActivePage('aim-trainer')}
                className="text-xs text-[#FF4655] hover:underline"
              >
                Launch Trainer
              </button>
            </div>
            <div className="space-y-2.5">
              {trainingSessions.length === 0 ? (
                <div className="text-xs text-[#9395A1]">
                  No training sessions recorded yet. Run a drill in the Aim Trainer.
                </div>
              ) : (
                trainingSessions.slice(0, 3).map((tr) => (
                  <div
                    key={tr.id}
                    className="flex items-center justify-between py-2 border-b border-[#262832] last:border-b-0 text-xs"
                  >
                    <div>
                      <div className="font-medium text-[#F5F5F7]">{tr.mode}</div>
                      <div className="text-[11px] text-[#9395A1]">
                        {tr.difficulty} · {tr.avgReactionMs}ms reaction
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="font-bold text-[#F5F5F7]">{tr.score} pts</div>
                      <div className="text-[11px] text-[#36D399]">{tr.accuracyPercent}% ACC</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-5 space-y-3">
            <h2 className="text-sm font-display font-bold text-[#F5F5F7]">
              WEEKLY TACTICAL WORKFLOW
            </h2>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => setActivePage('strategy-planner')}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-[#191B23] hover:bg-[#262832] text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Compass className="w-4 h-4 text-[#FF4655]" />
                  <div>
                    <div className="text-xs font-semibold text-[#F5F5F7]">Strata Strategy Board</div>
                    <div className="text-[11px] text-[#9395A1]">
                      Official radar minimaps for all 13 maps
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#9395A1]" />
              </button>

              <button
                type="button"
                onClick={() => setActivePage('ai-coach')}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-[#191B23] hover:bg-[#262832] text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <BrainCircuit className="w-4 h-4 text-[#FF4655]" />
                  <div>
                    <div className="text-xs font-semibold text-[#F5F5F7]">
                      ClutchIQ Video &amp; Round Coach
                    </div>
                    <div className="text-[11px] text-[#9395A1]">
                      Inspect VOD frames &amp; resolve mistakes
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#9395A1]" />
              </button>

              <button
                type="button"
                onClick={() => setActivePage('aim-trainer')}
                className="w-full flex items-center justify-between p-3 rounded-lg bg-[#191B23] hover:bg-[#262832] text-left transition-colors"
              >
                <div className="flex items-center gap-2.5">
                  <Crosshair className="w-4 h-4 text-[#FF4655]" />
                  <div>
                    <div className="text-xs font-semibold text-[#F5F5F7]">
                      Precision Aim &amp; Reaction Lab
                    </div>
                    <div className="text-[11px] text-[#9395A1]">
                      Warm up flicks and micro-adjustments
                    </div>
                  </div>
                </div>
                <ArrowUpRight className="w-4 h-4 text-[#9395A1]" />
              </button>
            </div>
          </div>
        </div>
      </section>

      <RiotAuthStoreModal
        isOpen={riotModalOpen}
        onClose={() => setRiotModalOpen(false)}
        initialTab={riotModalTab}
      />
    </div>
  );
};
