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
  clearAllMatches: () => Promise<void>;
  resetAllData: () => Promise<void>;
}

const ValocoreContext = createContext<ValocoreContextValue | null>(null);

export const ValocoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [activePage, setActivePageState] = useState<NavPageId>(() => {
    const saved = localStorage.getItem('valocore_active_page') as NavPageId | null;
    return saved || 'command-center';
  });
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [analysisPeriod, setAnalysisPeriod] = useState<'7d' | '30d' | '90d' | 'all'>('all');
  const [globalSearch, setGlobalSearch] = useState('');

  const [matches, setMatches] = useState<MatchRecord[]>(INITIAL_MATCHES);
  const [mistakes, setMistakes] = useState<MistakeRecord[]>(INITIAL_MISTAKES);
  const [rounds, setRounds] = useState<RoundRecord[]>(INITIAL_ROUNDS);
  const [strategies, setStrategies] = useState<StrategyRecord[]>(INITIAL_STRATEGIES);
  const [lineups, setLineups] = useState<LineupRecord[]>(INITIAL_LINEUPS);
  const [trainingSessions, setTrainingSessions] = useState<TrainingSession[]>(
    INITIAL_TRAINING_SESSIONS
  );
  const [videos, setVideos] = useState<GameplayVideoRecord[]>(INITIAL_VIDEOS);
  const [settings, setSettings] = useState<UserSettings>(INITIAL_USER_SETTINGS);

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

  // Load initial state from SQLite backend
  useEffect(() => {
    let mounted = true;
    fetch('/api/state')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (!mounted || !data) return;
        if (Array.isArray(data.matches)) setMatches(data.matches);
        if (Array.isArray(data.mistakes)) setMistakes(data.mistakes);
        if (Array.isArray(data.strategies)) setStrategies(data.strategies);
        if (Array.isArray(data.trainingSessions)) setTrainingSessions(data.trainingSessions);
        if (Array.isArray(data.rounds)) setRounds(data.rounds);
        if (Array.isArray(data.lineups)) setLineups(data.lineups);
        if (Array.isArray(data.videos)) setVideos(data.videos);
        if (data.settings) setSettings(data.settings);
        setSyncStatus('SYNCED');
        setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
      })
      .catch(() => {
        if (mounted) setSyncStatus('LOCAL');
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
        const res = await fetch('/api/state/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (res.ok) {
          setSyncStatus('SYNCED');
          setLastUpdated(
            new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          );
        } else {
          setSyncStatus('LOCAL');
        }
      } catch {
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
      notify(`Imported ${list.length} match record(s) to SQLite database.`);
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
        // Keep playerName and riotId synchronized if one of them is edited manually
        if (partial.playerName && !partial.riotId) {
          const existingTag = prev.riotId.includes('#') ? prev.riotId.split('#')[1] : `${next.region}1`;
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
      try {
        const res = await fetch('/api/riot/sync-profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            riotId,
            tag,
            region,
            henrikApiKey,
            customRank,
            customLevel,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          notify(data.error || 'Failed to sync Riot ID.');
          setSyncStatus('LOCAL');
          return false;
        }
        if (Array.isArray(data.matches)) {
          setMatches(data.matches);
        }
        const resolvedRiotId = data.riotId || riotId;
        const resolvedPlayerName =
          data.playerName || resolvedRiotId.split('#')[0] || riotId;

        setSettings((prev) => {
          const nextSettings: UserSettings = {
            ...prev,
            riotId: resolvedRiotId,
            playerName: resolvedPlayerName,
            region,
            accountLevel: data.accountLevel || prev.accountLevel || 45,
            currentRank: data.currentRank || prev.currentRank,
            peakRank: data.peakRank || prev.peakRank,
            primaryRole: data.primaryRole || prev.primaryRole || 'Duelist',
            henrikApiKey: henrikApiKey ?? prev.henrikApiKey,
            riotSyncMode: 'LIVE_RIOT_ID',
            showDemoDataBanner: false,
          };
          return nextSettings;
        });

        try {
          const savedList = JSON.parse(
            localStorage.getItem('valocore_recent_riot_ids') || '[]'
          ) as string[];
          const deduped = [
            resolvedRiotId,
            ...savedList.filter((id) => id.toLowerCase() !== resolvedRiotId.toLowerCase()),
          ].slice(0, 6);
          localStorage.setItem('valocore_recent_riot_ids', JSON.stringify(deduped));
        } catch {
          // ignore storage quota errors
        }

        setSyncStatus('SYNCED');
        setLastUpdated(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        );
        notify(
          `Synced ${resolvedRiotId} (${region}) · LVL ${data.accountLevel || 45} · ${data.currentRank || 'Bronze 2'}`
        );
        return true;
      } catch {
        setSyncStatus('LOCAL');
        notify('Network error while syncing Riot ID.');
        return false;
      }
    },
    [notify]
  );

  const authenticateRiotRedirectUrl = useCallback(
    async (redirectUrl: string) => {
      setSyncStatus('SYNCING');
      try {
        const res = await fetch('/api/riot/auth-redirect', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            redirectUrl,
            henrikApiKey: settings.henrikApiKey,
          }),
        });
        const data = await res.json();
        if (!res.ok || data.error) {
          setSyncStatus('LOCAL');
          notify(data.error || 'Riot RSO authentication failed.');
          return { ok: false, error: data.error || 'Riot RSO authentication failed.' };
        }

        if (Array.isArray(data.matches)) {
          setMatches(data.matches);
        }

        setSettings((prev) => ({
          ...prev,
          riotId: data.riotId || prev.riotId,
          playerName: data.playerName || prev.playerName,
          region: data.region || prev.region,
          accountLevel: data.accountLevel || prev.accountLevel,
          currentRank: data.currentRank || prev.currentRank,
          peakRank: data.peakRank || prev.peakRank,
          riotSyncMode: 'LIVE_RIOT_ID',
          showDemoDataBanner: false,
        }));

        setSyncStatus('SYNCED');
        setLastUpdated(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        );
        notify(
          `Riot RSO Authenticated: ${data.riotId} (${data.region}) · LVL ${data.accountLevel} · ${data.currentRank}`
        );
        return { ok: true, data };
      } catch (err: any) {
        setSyncStatus('LOCAL');
        return { ok: false, error: err?.message || 'Network error during Riot RSO login.' };
      }
    },
    [settings.henrikApiKey, notify]
  );

  const clearAllMatches = useCallback(async () => {
    await fetch('/api/state/clear-matches', { method: 'POST' });
    setMatches([]);
    const nextSettings: UserSettings = {
      ...settings,
      riotSyncMode: 'CLEAN_SLATE',
      showDemoDataBanner: false,
    };
    setSettings(nextSettings);
    persistToBackend({ matches: [], settings: nextSettings });
    notify('Cleared all pre-populated matches. Tracker is now 100% clean slate.');
  }, [settings, persistToBackend, notify]);

  const resetAllData = useCallback(async () => {
    await fetch('/api/state/reset', { method: 'POST' });
    setMatches(INITIAL_MATCHES);
    setMistakes(INITIAL_MISTAKES);
    setRounds(INITIAL_ROUNDS);
    setStrategies(INITIAL_STRATEGIES);
    setLineups(INITIAL_LINEUPS);
    setTrainingSessions(INITIAL_TRAINING_SESSIONS);
    setVideos(INITIAL_VIDEOS);
    setSettings(INITIAL_USER_SETTINGS);
    notify('Database restored to V26 Act VI Patch 13.09 dataset.');
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
