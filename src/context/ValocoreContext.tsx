import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  NavPageId,
  MatchRecord,
  MistakeRecord,
  RoundRecord,
  StrategyRecord,
  LineupRecord,
  TrainingSession,
  GameplayVideoRecord,
  UserSettings,
  ValorantAgentName,
  ValorantMapName,
} from '../types/valocore';
import {
  INITIAL_MATCHES,
  INITIAL_MISTAKES,
  INITIAL_ROUNDS,
  INITIAL_STRATEGIES,
  INITIAL_LINEUPS,
  INITIAL_TRAINING_SESSIONS,
  INITIAL_VIDEOS,
  INITIAL_USER_SETTINGS,
  ALL_AGENTS,
  ALL_MAPS,
  ALL_TIERS,
  normalizeRiotIdInput,
} from '../utils/seedData';

interface ValocoreContextValue {
  activePage: NavPageId;
  setActivePage: (page: NavPageId) => void;
  selectedMatchId: string | null;
  setSelectedMatchId: (id: string | null) => void;
  analysisPeriod: '7d' | '30d' | '90d' | 'all';
  setAnalysisPeriod: (p: '7d' | '30d' | '90d' | 'all') => void;
  globalSearch: string;
  setGlobalSearch: (s: string) => void;
  matches: MatchRecord[];
  mistakes: MistakeRecord[];
  rounds: RoundRecord[];
  strategies: StrategyRecord[];
  lineups: LineupRecord[];
  trainingSessions: TrainingSession[];
  videos: GameplayVideoRecord[];
  settings: UserSettings;
  syncStatus: 'SYNCED' | 'SYNCING' | 'LOCAL';
  lastUpdated: string;
  toastMessage: string | null;
  notify: (msg: string) => void;
  addMatch: (m: MatchRecord) => void;
  importMatches: (list: MatchRecord[]) => void;
  deleteMatch: (id: string) => void;
  addMistake: (mk: MistakeRecord) => void;
  updateMistake: (mk: MistakeRecord) => void;
  deleteMistake: (id: string) => void;
  toggleMistakeResolved: (id: string) => void;
  addRound: (rd: RoundRecord) => void;
  saveStrategy: (st: StrategyRecord) => void;
  deleteStrategy: (id: string) => void;
  addLineup: (ln: LineupRecord) => void;
  addTrainingSession: (tr: TrainingSession) => void;
  addVideo: (vid: GameplayVideoRecord) => void;
  updateVideo: (vid: GameplayVideoRecord) => void;
  updateSettings: (s: Partial<UserSettings>) => void;
  syncRiotIdProfile: (
    riotId: string,
    region: UserSettings['region'],
    henrikApiKey?: string,
    tag?: string,
    customRank?: string,
    customLevel?: number
  ) => Promise<boolean>;
  authenticateRiotRedirectUrl: (redirectUrl: string) => Promise<{
    ok: boolean;
    error?: string;
    data?: any;
  }>;
  syncLocalRiotClient: () => Promise<{
    ok: boolean;
    error?: string;
    data?: any;
  }>;
  clearAllMatches: () => Promise<void>;
  resetAllData: () => Promise<void>;
}

const ValocoreContext = createContext<ValocoreContextValue | null>(null);

/**
 * Safe JSON fetch wrapper that prevents `Unexpected token 'T', "The page c"... is not valid JSON`
 * when a static host returns a plain-text 404 or HTML error page.
 */
export async function safeFetchJson(
  url: string,
  options?: RequestInit
): Promise<{
  ok: boolean;
  status: number;
  data: any;
  isStatic404: boolean;
  rawText: string;
}> {
  try {
    const res = await fetch(url, options);
    const rawText = await res.text();
    let data: any = null;
    try {
      data = rawText ? JSON.parse(rawText) : null;
    } catch {
      data = null;
    }
    const isStatic404 =
      !data &&
      (res.status === 404 ||
        rawText.startsWith('The page c') ||
        rawText.trim().startsWith('<!DOCTYPE') ||
        rawText.trim().startsWith('<html'));
    return {
      ok: res.ok && data !== null,
      status: res.status,
      data,
      isStatic404,
      rawText,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      isStatic404: false,
      rawText: err?.message || 'Network error',
    };
  }
}

function getHenrikAffinityClient(region: string): string {
  const r = String(region || 'ap').toLowerCase();
  if (r === 'na' || r === 'latam') return 'na';
  if (r === 'br') return 'br';
  if (r === 'eu' || r === 'euw') return 'eu';
  if (r === 'kr') return 'kr';
  return 'ap';
}

function shardToRegionClient(shardOrRegion: string): UserSettings['region'] {
  const r = String(shardOrRegion || 'ap').toLowerCase();
  if (r === 'eu' || r === 'euw') return 'EUW';
  if (r === 'kr') return 'KR';
  if (r === 'br') return 'BR';
  if (r === 'na' || r === 'latam') return 'NA';
  return 'APAC';
}

function decodeJwtPayload(token: string): any | null {
  try {
    const parts = token.split('.');
    if (parts.length < 2) return null;
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

function parseClientHenrikMatches(
  matchesData: any[],
  mmrHistory: any[],
  name: string,
  tag: string,
  fallbackRank = 'Unranked',
  lifetimeMatches: any[] = [],
  puuid?: string
): MatchRecord[] {
  const mmrByMatchId = new Map<string, any>();
  for (const h of mmrHistory) {
    if (h?.match_id) mmrByMatchId.set(String(h.match_id), h);
  }
  const results: MatchRecord[] = [];
  const seenIds = new Set<string>();

  for (let idx = 0; idx < matchesData.length; idx++) {
    const m = matchesData[idx];
    if (!m?.metadata || !Array.isArray(m?.players?.all_players)) continue;
    const me =
      m.players.all_players.find(
        (p: any) =>
          (puuid && String(p.puuid || '').toLowerCase() === puuid.toLowerCase()) ||
          (p.name?.toLowerCase() === name.toLowerCase() &&
            p.tag?.toLowerCase() === tag.toLowerCase())
      ) || null;
    if (!me) continue;

    const matchId = String(m.metadata.matchid || `henrik-v3-${idx}`);
    seenIds.add(matchId);

    const teamKey = String(me.team || 'Blue').toLowerCase();
    const teamObj = m.teams?.[teamKey] || { has_won: false, rounds_won: 0, rounds_lost: 0 };
    const scoreFor = Number(teamObj.rounds_won ?? 0);
    const scoreAgainst = Number(teamObj.rounds_lost ?? 0);
    const totalRounds = Math.max(1, scoreFor + scoreAgainst);

    const headshots = Number(me.stats?.headshots ?? 0);
    const bodyshots = Number(me.stats?.bodyshots ?? 0);
    const legshots = Number(me.stats?.legshots ?? 0);
    const shotsTotal = headshots + bodyshots + legshots;
    const hsPercent = shotsTotal > 0 ? Number(((headshots / shotsTotal) * 100).toFixed(1)) : 0;

    const acs = Math.round(Number(me.stats?.score || 0) / totalRounds);
    const adr = Math.round(Number(me.damage_made || 0) / totalRounds);
    const isWin = Boolean(teamObj.has_won);

    const mmrEntry = mmrByMatchId.get(matchId);
    const rrChange =
      typeof mmrEntry?.mmr_change_to_last_game === 'number'
        ? mmrEntry.mmr_change_to_last_game
        : 0;

    const resolvedAgentName =
      ALL_AGENTS.find(
        (a) => a.name.toLowerCase() === String(me.character || 'Jett').toLowerCase()
      )?.name || ('Jett' as ValorantAgentName);
    const resolvedAgentRole =
      ALL_AGENTS.find((a) => a.name === resolvedAgentName)?.role || 'Duelist';
    const resolvedMapName =
      ALL_MAPS.find(
        (mp) => mp.name.toLowerCase() === String(m.metadata.map || 'Ascent').toLowerCase()
      )?.name || ('Ascent' as ValorantMapName);
    const rankAtMatch = mmrEntry?.currenttierpatched || me.currenttier_patched || fallbackRank;

    results.push({
      id: matchId,
      map: resolvedMapName,
      agent: resolvedAgentName,
      role: resolvedAgentRole,
      result: scoreFor === scoreAgainst ? 'DRAW' : isWin ? 'WIN' : 'LOSS',
      scoreFor,
      scoreAgainst,
      kills: Number(me.stats?.kills ?? 0),
      deaths: Number(me.stats?.deaths ?? 0),
      assists: Number(me.stats?.assists ?? 0),
      acs,
      adr,
      hsPercent,
      firstBloods: 0,
      firstDeaths: 0,
      clutchesWon: 0,
      clutchesAttempted: 0,
      attackRoundsWon: Math.min(12, Math.ceil(scoreFor / 2)),
      attackRoundsPlayed: Math.min(12, totalRounds),
      defenseRoundsWon: Math.max(0, scoreFor - Math.min(12, Math.ceil(scoreFor / 2))),
      defenseRoundsPlayed: Math.max(0, totalRounds - 12),
      durationMinutes: Math.max(1, Math.round(Number(m.metadata.game_length || 1800) / 60)),
      gameMode: (m.metadata.mode === 'Premier' ? 'Premier' : 'Competitive') as any,
      rankAtMatch,
      rrChange,
      performanceBonus: 0,
      date: m.metadata.game_start
        ? new Date(Number(m.metadata.game_start) * 1000).toISOString()
        : new Date().toISOString(),
      source: 'RIOT_ID_LIVE_SYNC',
      riotId: `${name}#${tag}`,
      notes: `HenrikDev Live Match (${rankAtMatch})${rrChange !== 0 ? ` · ${rrChange > 0 ? `+${rrChange}` : rrChange} RR` : ''}`,
    });
  }

  for (let idx = 0; idx < lifetimeMatches.length; idx++) {
    const lm = lifetimeMatches[idx];
    const meta = lm?.meta;
    const stats = lm?.stats;
    if (!meta || !stats) continue;

    const matchId = String(meta.id || `henrik-lt-${idx}`);
    if (seenIds.has(matchId)) continue;
    seenIds.add(matchId);

    const myTeam = String(stats.team || 'Blue').toLowerCase();
    const myRounds = Number(lm.teams?.[myTeam] ?? 0);
    const enemyRounds = Number(lm.teams?.[myTeam === 'blue' ? 'red' : 'blue'] ?? 0);
    const totalRounds = Math.max(1, myRounds + enemyRounds);
    const isWin = myRounds > enemyRounds;

    const head = Number(stats.shots?.head ?? 0);
    const body = Number(stats.shots?.body ?? 0);
    const leg = Number(stats.shots?.leg ?? 0);
    const totalShots = head + body + leg;
    const hsPercent = totalShots > 0 ? Number(((head / totalShots) * 100).toFixed(1)) : 0;

    const acs = Math.round(Number(stats.score || 0) / totalRounds);
    const adr = Math.round(Number(stats.damage?.made || 0) / totalRounds);

    const mmrEntry = mmrByMatchId.get(matchId);
    const rrChange =
      typeof mmrEntry?.mmr_change_to_last_game === 'number'
        ? mmrEntry.mmr_change_to_last_game
        : 0;

    const tierNum = Number(stats.tier || 0);
    const tierObj = ALL_TIERS.find((t) => t.tier === tierNum);
    const tierPatched =
      tierObj && tierNum > 0
        ? tierObj.name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
        : '';
    const rankAtMatch = mmrEntry?.currenttierpatched || tierPatched || fallbackRank;

    const resolvedAgentName =
      ALL_AGENTS.find(
        (a) => a.name.toLowerCase() === String(stats.character?.name || 'Jett').toLowerCase()
      )?.name || ('Jett' as ValorantAgentName);
    const resolvedAgentRole =
      ALL_AGENTS.find((a) => a.name === resolvedAgentName)?.role || 'Duelist';
    const resolvedMapName =
      ALL_MAPS.find(
        (mp) => mp.name.toLowerCase() === String(meta.map?.name || 'Ascent').toLowerCase()
      )?.name || ('Ascent' as ValorantMapName);

    results.push({
      id: matchId,
      map: resolvedMapName,
      agent: resolvedAgentName,
      role: resolvedAgentRole,
      result: myRounds === enemyRounds ? 'DRAW' : isWin ? 'WIN' : 'LOSS',
      scoreFor: myRounds,
      scoreAgainst: enemyRounds,
      kills: Number(stats.kills ?? 0),
      deaths: Number(stats.deaths ?? 0),
      assists: Number(stats.assists ?? 0),
      acs,
      adr,
      hsPercent,
      firstBloods: 0,
      firstDeaths: 0,
      clutchesWon: 0,
      clutchesAttempted: 0,
      attackRoundsWon: Math.min(12, Math.ceil(myRounds / 2)),
      attackRoundsPlayed: Math.min(12, totalRounds),
      defenseRoundsWon: Math.max(0, myRounds - Math.min(12, Math.ceil(myRounds / 2))),
      defenseRoundsPlayed: Math.max(0, totalRounds - 12),
      durationMinutes: 32,
      gameMode: (meta.mode === 'Premier' ? 'Premier' : 'Competitive') as any,
      rankAtMatch,
      rrChange,
      performanceBonus: 0,
      date: meta.started_at ? new Date(meta.started_at).toISOString() : new Date().toISOString(),
      source: 'RIOT_ID_LIVE_SYNC',
      riotId: `${name}#${tag}`,
      notes: `HenrikDev Lifetime Match (${meta.mode || 'Competitive'} · ${rankAtMatch})`,
    });
  }

  return results;
}

async function syncViaHenrikClientDirect(
  name: string,
  tag: string,
  region: UserSettings['region'],
  apiKey?: string,
  knownPuuid?: string
) {
  const key = (
    apiKey ||
    (import.meta as any).env?.VITE_HENRIK_API_KEY ||
    localStorage.getItem('valocore_henrik_api_key') ||
    ''
  ).trim();

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (key && key.length > 5) {
    headers.Authorization = key;
  }

  const encName = encodeURIComponent(name.trim());
  const encTag = encodeURIComponent(tag.trim());

  let acctData: any = null;
  if (knownPuuid) {
    const r = await safeFetchJson(
      `https://api.henrikdev.xyz/valorant/v1/by-puuid/account/${knownPuuid}`,
      { headers }
    );
    if (r.ok && r.data?.data) acctData = r.data.data;
  }
  if (!acctData) {
    const r = await safeFetchJson(
      `https://api.henrikdev.xyz/valorant/v1/account/${encName}/${encTag}`,
      { headers }
    );
    if (r.ok && r.data?.data) {
      acctData = r.data.data;
    } else if (r.status === 404) {
      return {
        ok: false,
        error: `Valorant player "${name}#${tag}" was not found on Riot servers.`,
      };
    } else if (r.status === 401 || r.status === 403) {
      return {
        ok: false,
        error:
          'HenrikDev API requires an HDEV-... key. Paste your HenrikDev key in the HDEV-... input box above and click Search Username / Sync.',
      };
    }
  }

  const affinity = getHenrikAffinityClient(acctData?.region || region);
  const puuid = acctData?.puuid || knownPuuid;
  const resolvedName = acctData?.name || name;
  const resolvedTag = acctData?.tag || tag;

  const [mmrRes, mmrHistRes, matchesRes, ltRes] = await Promise.all([
    safeFetchJson(
      puuid
        ? `https://api.henrikdev.xyz/valorant/v2/by-puuid/mmr/${affinity}/${puuid}`
        : `https://api.henrikdev.xyz/valorant/v2/mmr/${affinity}/${encodeURIComponent(resolvedName)}/${encodeURIComponent(resolvedTag)}`,
      { headers }
    ),
    safeFetchJson(
      puuid
        ? `https://api.henrikdev.xyz/valorant/v1/by-puuid/mmr-history/${affinity}/${puuid}`
        : `https://api.henrikdev.xyz/valorant/v1/mmr-history/${affinity}/${encodeURIComponent(resolvedName)}/${encodeURIComponent(resolvedTag)}`,
      { headers }
    ),
    safeFetchJson(
      puuid
        ? `https://api.henrikdev.xyz/valorant/v3/by-puuid/matches/${affinity}/${puuid}?size=10`
        : `https://api.henrikdev.xyz/valorant/v3/matches/${affinity}/${encodeURIComponent(resolvedName)}/${encodeURIComponent(resolvedTag)}?size=10`,
      { headers }
    ),
    safeFetchJson(
      puuid
        ? `https://api.henrikdev.xyz/valorant/v1/by-puuid/lifetime/matches/${affinity}/${puuid}?size=15`
        : `https://api.henrikdev.xyz/valorant/v1/lifetime/matches/${affinity}/${encodeURIComponent(resolvedName)}/${encodeURIComponent(resolvedTag)}?size=15`,
      { headers }
    ),
  ]);

  const mmrData = mmrRes.data?.data || null;
  const mmrHistory = Array.isArray(mmrHistRes.data?.data) ? mmrHistRes.data.data : [];
  const matchesData = Array.isArray(matchesRes.data?.data) ? matchesRes.data.data : [];
  const lifetimeMatches = Array.isArray(ltRes.data?.data) ? ltRes.data.data : [];

  if (!acctData && matchesData.length === 0 && lifetimeMatches.length === 0) {
    return {
      ok: false,
      error:
        'Could not fetch player stats. Please enter your HenrikDev API key (HDEV-...) in the sync bar or run the Desktop App.',
    };
  }

  const currentTierPatched =
    mmrData?.current_data?.currenttierpatched || mmrData?.currenttierpatched || 'Unranked';
  const rankingInTier = mmrData?.current_data?.ranking_in_tier ?? mmrData?.ranking_in_tier ?? 0;
  const liveCurrentRank =
    currentTierPatched === 'Unranked'
      ? 'Unranked'
      : currentTierPatched.includes('RR')
        ? currentTierPatched
        : `${currentTierPatched} (${rankingInTier} RR)`;
  const livePeakRank = mmrData?.highest_rank?.patched_tier || liveCurrentRank || 'Unranked';

  const parsedMatches = parseClientHenrikMatches(
    matchesData,
    mmrHistory,
    resolvedName,
    resolvedTag,
    currentTierPatched,
    lifetimeMatches,
    puuid
  );

  return {
    ok: true,
    data: {
      riotId: `${resolvedName}#${resolvedTag}`,
      playerName: resolvedName,
      puuid: puuid || '',
      region: acctData?.region ? shardToRegionClient(acctData.region) : region,
      shard: affinity,
      accountLevel: Number(acctData?.account_level || 0),
      currentRank: liveCurrentRank,
      peakRank: livePeakRank,
      matches: parsedMatches,
    },
  };
}

export const ValocoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePage, setActivePageState] = useState<NavPageId>(() => {
    const saved = localStorage.getItem('valocore_active_page') as NavPageId | null;
    return saved || 'command-center';
  });
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [analysisPeriod, setAnalysisPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('all');
  const [globalSearch, setGlobalSearch] = useState('');

  const [matches, setMatches] = useState<MatchRecord[]>(() => {
    try {
      const cached = localStorage.getItem('valocore_cached_matches');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // ignore
    }
    return INITIAL_MATCHES;
  });
  const [mistakes, setMistakes] = useState<MistakeRecord[]>(INITIAL_MISTAKES);
  const [rounds, setRounds] = useState<RoundRecord[]>(INITIAL_ROUNDS);
  const [strategies, setStrategies] = useState<StrategyRecord[]>(INITIAL_STRATEGIES);
  const [lineups, setLineups] = useState<LineupRecord[]>(INITIAL_LINEUPS);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(
    INITIAL_TRAINING_SESSIONS
  );
  const [videos, setVideos] = useState<GameplayVideoRecord[]>(INITIAL_VIDEOS);
  const [settings, setSettings] = useState<UserSettings>(() => {
    try {
      const cached = localStorage.getItem('valocore_cached_settings');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && typeof parsed === 'object') {
          return { ...INITIAL_USER_SETTINGS, ...parsed };
        }
      }
    } catch {
      // ignore
    }
    return INITIAL_USER_SETTINGS;
  });

  const [syncStatus, setSyncStatus] = useState<'SYNCED' | 'SYNCING' | 'LOCAL'>('SYNCED');
  const [lastUpdated, setLastUpdated] = useState<string>('Just now');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const notify = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 3500);
  }, []);

  const setActivePage = useCallback((page: NavPageId) => {
    setActivePageState(page);
    localStorage.setItem('valocore_active_page', page);
  }, []);

  // Load initial state from SQLite / Serverless backend
  useEffect(() => {
    let mounted = true;
    safeFetchJson('/api/state').then(({ ok, data }) => {
      if (!mounted || !ok || !data) {
        if (mounted) setSyncStatus('LOCAL');
        return;
      }
      if (Array.isArray(data.matches) && data.matches.length > 0) {
        setMatches(data.matches);
        try {
          localStorage.setItem('valocore_cached_matches', JSON.stringify(data.matches));
        } catch {
          // ignore
        }
      }
      if (Array.isArray(data.mistakes)) setMistakes(data.mistakes);
      if (Array.isArray(data.strategies)) setStrategies(data.strategies);
      if (Array.isArray(data.trainingSessions)) setTrainingSessions(data.trainingSessions);
      if (Array.isArray(data.rounds)) setRounds(data.rounds);
      if (Array.isArray(data.lineups)) setLineups(data.lineups);
      if (Array.isArray(data.videos)) setVideos(data.videos);
      if (data.settings && data.settings.riotId && data.settings.riotId !== 'Not Connected') {
        setSettings(data.settings);
        try {
          localStorage.setItem('valocore_cached_settings', JSON.stringify(data.settings));
        } catch {
          // ignore
        }
      }
      setSyncStatus('SYNCED');
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    });
    return () => {
      mounted = false;
    };
  }, []);

  const persistToBackend = useCallback(
    async (payload: Partial<{
      matches: MatchRecord[];
      mistakes: MistakeRecord[];
      strategies: StrategyRecord[];
      trainingSessions: TrainingSession[];
      rounds: RoundRecord[];
      lineups: LineupRecord[];
      videos: GameplayVideoRecord[];
      settings: UserSettings;
    }>) => {
      setSyncStatus('SYNCING');
      try {
        if (payload.matches) {
          localStorage.setItem('valocore_cached_matches', JSON.stringify(payload.matches));
        }
        if (payload.settings) {
          localStorage.setItem('valocore_cached_settings', JSON.stringify(payload.settings));
          if (payload.settings.henrikApiKey) {
            localStorage.setItem('valocore_henrik_api_key', payload.settings.henrikApiKey);
          }
        }
      } catch {
        // ignore
      }
      const { ok } = await safeFetchJson('/api/state/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (ok) {
        setSyncStatus('SYNCED');
        setLastUpdated(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        );
      } else {
        setSyncStatus('LOCAL');
      }
    },
    []
  );

  const addMatch = useCallback(
    (m: MatchRecord) => {
      setMatches((prev) => {
        const next = [m, ...prev];
        persistToBackend({ matches: next });
        return next;
      });
      notify(`Recorded ${m.result} on ${m.map} (${m.agent})`);
    },
    [persistToBackend, notify]
  );

  const importMatches = useCallback(
    (list: MatchRecord[]) => {
      setMatches((prev) => {
        const next = [...list, ...prev];
        persistToBackend({ matches: next });
        return next;
      });
      notify(`Imported ${list.length} match record(s) to database.`);
    },
    [persistToBackend, notify]
  );

  const deleteMatch = useCallback(
    (id: string) => {
      setMatches((prev) => {
        const next = prev.filter((m) => m.id !== id);
        persistToBackend({ matches: next });
        return next;
      });
      notify('Match deleted from database.');
    },
    [persistToBackend, notify]
  );

  const addMistake = useCallback(
    (mk: MistakeRecord) => {
      setMistakes((prev) => {
        const next = [mk, ...prev];
        persistToBackend({ mistakes: next });
        return next;
      });
      notify(`Logged mistake: ${mk.title}`);
    },
    [persistToBackend, notify]
  );

  const updateMistake = useCallback(
    (mk: MistakeRecord) => {
      setMistakes((prev) => {
        const next = prev.map((item) => (item.id === mk.id ? mk : item));
        persistToBackend({ mistakes: next });
        return next;
      });
      notify('Mistake entry updated.');
    },
    [persistToBackend, notify]
  );

  const deleteMistake = useCallback(
    (id: string) => {
      setMistakes((prev) => {
        const next = prev.filter((item) => item.id !== id);
        persistToBackend({ mistakes: next });
        return next;
      });
      notify('Mistake removed.');
    },
    [persistToBackend, notify]
  );

  const toggleMistakeResolved = useCallback(
    (id: string) => {
      setMistakes((prev) => {
        const next = prev.map((item) =>
          item.id === id ? { ...item, resolved: !item.resolved } : item
        );
        persistToBackend({ mistakes: next });
        return next;
      });
    },
    [persistToBackend]
  );

  const addRound = useCallback(
    (rd: RoundRecord) => {
      setRounds((prev) => {
        const next = [rd, ...prev];
        persistToBackend({ rounds: next });
        return next;
      });
      notify(`Round ${rd.roundNumber} (${rd.map}) review saved.`);
    },
    [persistToBackend, notify]
  );

  const saveStrategy = useCallback(
    (st: StrategyRecord) => {
      setStrategies((prev) => {
        const exists = prev.some((item) => item.id === st.id);
        const next = exists
          ? prev.map((item) => (item.id === st.id ? st : item))
          : [st, ...prev];
        persistToBackend({ strategies: next });
        return next;
      });
      notify(`Strategy "${st.name}" saved to Strata library.`);
    },
    [persistToBackend, notify]
  );

  const deleteStrategy = useCallback(
    (id: string) => {
      setStrategies((prev) => {
        const next = prev.filter((item) => item.id !== id);
        persistToBackend({ strategies: next });
        return next;
      });
      notify('Strategy removed.');
    },
    [persistToBackend, notify]
  );

  const addLineup = useCallback(
    (ln: LineupRecord) => {
      setLineups((prev) => {
        const next = [ln, ...prev];
        persistToBackend({ lineups: next });
        return next;
      });
      notify(`Lineup "${ln.title}" added.`);
    },
    [persistToBackend, notify]
  );

  const addTrainingSession = useCallback(
    (tr: TrainingSession) => {
      setTrainingSessions((prev) => {
        const next = [tr, ...prev];
        persistToBackend({ trainingSessions: next });
        return next;
      });
      notify(`Training session recorded: ${tr.score} pts (${tr.accuracyPercent}% accuracy)`);
    },
    [persistToBackend, notify]
  );

  const addVideo = useCallback(
    (vid: GameplayVideoRecord) => {
      setVideos((prev) => {
        const next = [vid, ...prev];
        persistToBackend({ videos: next });
        return next;
      });
      notify(`Video "${vid.title}" processed and indexed.`);
    },
    [persistToBackend, notify]
  );

  const updateVideo = useCallback(
    (vid: GameplayVideoRecord) => {
      setVideos((prev) => {
        const next = prev.map((v) => (v.id === vid.id ? vid : v));
        persistToBackend({ videos: next });
        return next;
      });
    },
    [persistToBackend]
  );

  const updateSettings = useCallback(
    (partial: Partial<UserSettings>) => {
      setSettings((prev) => {
        const next = { ...prev, ...partial };
        if (partial.playerName && !partial.riotId) {
          const existingTag = prev.riotId.includes('#')
            ? prev.riotId.split('#')[1]
            : `${next.region}1`;
          next.riotId = `${partial.playerName.trim()}#${existingTag}`;
        } else if (partial.riotId && !partial.playerName) {
          next.playerName = partial.riotId.split('#')[0].trim();
        }
        persistToBackend({ settings: next });
        return next;
      });
      notify('Profile & settings saved.');
    },
    [persistToBackend, notify]
  );

  const applySyncedPayload = useCallback(
    (
      data: any,
      fallbackRiotId: string,
      region: UserSettings['region'],
      henrikApiKey?: string
    ) => {
      const nextMatches = Array.isArray(data.matches) ? data.matches : [];
      setMatches(nextMatches);
      try {
        localStorage.setItem('valocore_cached_matches', JSON.stringify(nextMatches));
      } catch {
        // ignore
      }

      const resolvedRiotId = data.riotId || fallbackRiotId;
      const resolvedPlayerName =
        data.playerName || resolvedRiotId.split('#')[0] || fallbackRiotId;

      setSettings((prev) => {
        const nextSettings: UserSettings = {
          ...prev,
          riotId: resolvedRiotId,
          playerName: resolvedPlayerName,
          region: data.region || region,
          accountLevel: data.accountLevel ?? prev.accountLevel ?? 0,
          currentRank: data.currentRank || prev.currentRank || 'Unranked',
          peakRank: data.peakRank || prev.peakRank || 'Unranked',
          primaryRole: data.primaryRole || prev.primaryRole || 'Duelist',
          henrikApiKey: henrikApiKey || prev.henrikApiKey,
          riotSyncMode: 'LIVE_RIOT_ID',
          showDemoDataBanner: false,
        };
        try {
          localStorage.setItem('valocore_cached_settings', JSON.stringify(nextSettings));
          if (nextSettings.henrikApiKey) {
            localStorage.setItem('valocore_henrik_api_key', nextSettings.henrikApiKey);
          }
        } catch {
          // ignore
        }
        return nextSettings;
      });

      setSyncStatus('SYNCED');
      setLastUpdated(
        new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      );
      notify(
        `Synced ${resolvedRiotId} (${data.region || region}) · LVL ${data.accountLevel ?? 0} · ${data.currentRank || 'Unranked'}`
      );
    },
    [notify]
  );

  const syncRiotIdProfile = useCallback(
    async (
      riotId: string,
      region: UserSettings['region'],
      henrikApiKey?: string,
      tag?: string,
      customRank?: string,
      customLevel?: number
    ): Promise<boolean> => {
      setSyncStatus('SYNCING');
      const effectiveKey = (henrikApiKey || settings.henrikApiKey || '').trim();
      if (effectiveKey) {
        try {
          localStorage.setItem('valocore_henrik_api_key', effectiveKey);
        } catch {
          // ignore
        }
      }

      const { playerName, tag: cleanTag } = normalizeRiotIdInput(riotId, tag, region);

      const apiRes = await safeFetchJson('/api/riot/sync-profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          riotId: playerName,
          tag: cleanTag,
          region,
          henrikApiKey: effectiveKey,
          customRank,
          customLevel,
        }),
      });

      if (apiRes.ok && apiRes.data && !apiRes.data.error) {
        applySyncedPayload(apiRes.data, `${playerName}#${cleanTag}`, region, effectiveKey);
        return true;
      }

      // Direct browser fallback to HenrikDev API if backend returned 404 or failed
      const directRes = await syncViaHenrikClientDirect(
        playerName,
        cleanTag,
        region,
        effectiveKey
      );
      if (directRes.ok && directRes.data) {
        applySyncedPayload(directRes.data, `${playerName}#${cleanTag}`, region, effectiveKey);
        return true;
      }

      const errMsg =
        apiRes.data?.error ||
        directRes.error ||
        'Failed to sync Riot ID. Enter your HenrikDev API Key (HDEV-...) in the sync bar or run the Desktop App.';
      notify(errMsg);
      setSyncStatus('LOCAL');
      return false;
    },
    [settings.henrikApiKey, applySyncedPayload, notify]
  );

  const authenticateRiotRedirectUrl = useCallback(
    async (redirectUrl: string) => {
      setSyncStatus('SYNCING');
      const effectiveKey = (settings.henrikApiKey || '').trim();
      const apiRes = await safeFetchJson('/api/riot/auth-redirect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          redirectUrl,
          henrikApiKey: effectiveKey,
        }),
      });

      if (apiRes.ok && apiRes.data && !apiRes.data.error) {
        applySyncedPayload(
          apiRes.data,
          apiRes.data.riotId || settings.riotId,
          apiRes.data.region || settings.region,
          effectiveKey
        );
        return { ok: true, data: apiRes.data };
      }

      // Client-side JWT PUUID fallback if running on a static/serverless host where Riot TLS is blocked
      try {
        const raw = redirectUrl.trim();
        let accessToken = '';
        let idToken = '';
        if (raw.includes('#')) {
          const fragment = raw.split('#')[1];
          for (const part of fragment.split('&')) {
            const [k, v] = part.split('=');
            if (k === 'access_token') accessToken = decodeURIComponent(v || '');
            if (k === 'id_token') idToken = decodeURIComponent(v || '');
          }
        }
        const decodedId = idToken ? decodeJwtPayload(idToken) : null;
        const decodedAccess = accessToken ? decodeJwtPayload(accessToken) : null;
        const puuid = decodedId?.sub || decodedAccess?.sub || '';
        const gameName = decodedId?.acct?.game_name || settings.playerName || 'DarkNighT';
        const tagLine = decodedId?.acct?.tag_line || 'slug';

        if (puuid) {
          const directRes = await syncViaHenrikClientDirect(
            gameName,
            tagLine,
            settings.region,
            effectiveKey,
            puuid
          );
          if (directRes.ok && directRes.data) {
            applySyncedPayload(
              directRes.data,
              directRes.data.riotId,
              directRes.data.region,
              effectiveKey
            );
            return { ok: true, data: directRes.data };
          }
        }
      } catch {
        // ignore
      }

      setSyncStatus('LOCAL');
      const errorMsg =
        apiRes.data?.error ||
        (apiRes.isStatic404
          ? 'Vercel API route was not found. Redeploy with the new /api/index.ts & vercel.json, or launch VALOCORE Desktop (`npm run desktop`).'
          : 'Riot RSO authentication failed. Verify your Redirect URL (#access_token=...) or use VALOCORE Desktop.');
      notify(errorMsg);
      return { ok: false, error: errorMsg };
    },
    [settings.henrikApiKey, settings.riotId, settings.playerName, settings.region, applySyncedPayload, notify]
  );

  const syncLocalRiotClient = useCallback(async () => {
    setSyncStatus('SYNCING');
    const effectiveKey = (settings.henrikApiKey || '').trim();
    const apiRes = await safeFetchJson('/api/riot/local-client', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ henrikApiKey: effectiveKey }),
    });

    if (apiRes.ok && apiRes.data && !apiRes.data.error) {
      applySyncedPayload(
        apiRes.data,
        apiRes.data.riotId || settings.riotId,
        apiRes.data.region || settings.region,
        effectiveKey
      );
      return { ok: true, data: apiRes.data };
    }

    setSyncStatus('LOCAL');
    const errMsg =
      apiRes.data?.error ||
      'Local Riot Client lockfile not found. Run `npm run desktop` on your Windows PC while VALORANT is open.';
    notify(errMsg);
    return { ok: false, error: errMsg };
  }, [settings.henrikApiKey, settings.riotId, settings.region, applySyncedPayload, notify]);

  const clearAllMatches = useCallback(async () => {
    await safeFetchJson('/api/state/clear-matches', { method: 'POST' });
    setMatches([]);
    const nextSettings: UserSettings = {
      ...settings,
      riotSyncMode: 'CLEAN_SLATE',
      showDemoDataBanner: false,
    };
    setSettings(nextSettings);
    persistToBackend({ matches: [], settings: nextSettings });
    notify('Cleared all matches. Tracker is now 100% clean slate.');
  }, [settings, persistToBackend, notify]);

  const resetAllData = useCallback(async () => {
    await safeFetchJson('/api/state/reset', { method: 'POST' });
    localStorage.removeItem('valocore_cached_matches');
    localStorage.removeItem('valocore_cached_settings');
    setMatches(INITIAL_MATCHES);
    setMistakes(INITIAL_MISTAKES);
    setRounds(INITIAL_ROUNDS);
    setStrategies(INITIAL_STRATEGIES);
    setLineups(INITIAL_LINEUPS);
    setTrainingSessions(INITIAL_TRAINING_SESSIONS);
    setVideos(INITIAL_VIDEOS);
    setSettings(INITIAL_USER_SETTINGS);
    notify('Database reset to clean unauthenticated state.');
  }, [notify]);

  return (
    <ValocoreContext.Provider
      value={{
        activePage,
        setActivePage,
        selectedMatchId,
        setSelectedMatchId,
        analysisPeriod,
        setAnalysisPeriod,
        globalSearch,
        setGlobalSearch,
        matches,
        mistakes,
        rounds,
        strategies,
        lineups,
        trainingSessions,
        videos,
        settings,
        syncStatus,
        lastUpdated,
        toastMessage,
        notify,
        addMatch,
        importMatches,
        deleteMatch,
        addMistake,
        updateMistake,
        deleteMistake,
        toggleMistakeResolved,
        addRound,
        saveStrategy,
        deleteStrategy,
        addLineup,
        addTrainingSession,
        addVideo,
        updateVideo,
        updateSettings,
        syncRiotIdProfile,
        authenticateRiotRedirectUrl,
        syncLocalRiotClient,
        clearAllMatches,
        resetAllData,
      }}
    >
      {children}
    </ValocoreContext.Provider>
  );
};

export function useValocore() {
  const ctx = useContext(ValocoreContext);
  if (!ctx) throw new Error('useValocore must be used inside ValocoreProvider');
  return ctx;
}
