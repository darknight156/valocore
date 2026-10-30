import liveValorantDataRaw from './liveValorantData.json';
import {
  LiveValorantCatalog,
  LiveAgentCatalogItem,
  LiveMapCatalogItem,
  MatchRecord,
  MistakeRecord,
  RoundRecord,
  StrategyRecord,
  LineupRecord,
  TrainingSession,
  GameplayVideoRecord,
  UserSettings,
  AgentRole,
} from '../types/valocore';

export const LIVE_VALORANT_CATALOG = liveValorantDataRaw as unknown as LiveValorantCatalog;

export const ALL_AGENTS: LiveAgentCatalogItem[] = LIVE_VALORANT_CATALOG.agents;
export const ALL_MAPS: LiveMapCatalogItem[] = LIVE_VALORANT_CATALOG.maps;
export const ALL_WEAPONS = LIVE_VALORANT_CATALOG.weapons;
export const ALL_TIERS = LIVE_VALORANT_CATALOG.competitiveTiers;
export const LIVE_VERSION = LIVE_VALORANT_CATALOG.version;

export function getAgentCatalogItem(name: string): LiveAgentCatalogItem | undefined {
  return ALL_AGENTS.find((a) => a.name.toLowerCase() === name.toLowerCase());
}

export function getAgentByUuid(uuid: string): LiveAgentCatalogItem | undefined {
  if (!uuid) return undefined;
  return ALL_AGENTS.find((a) => a.uuid.toLowerCase() === uuid.toLowerCase());
}

export function getMapCatalogItem(name: string): LiveMapCatalogItem | undefined {
  return ALL_MAPS.find((m) => m.name.toLowerCase() === name.toLowerCase());
}

export function getAgentRole(name: string): AgentRole {
  return getAgentCatalogItem(name)?.role || 'Duelist';
}

export const MAP_METADATA: Record<
  string,
  {
    name: string;
    region: string;
    coordinates: string;
    tacticalSummary: string;
    displayIcon: string;
    splash: string;
    listViewIcon: string;
    callouts: {
      name: string;
      x: number;
      y: number;
      type: 'site' | 'choke' | 'mid' | 'spawn';
    }[];
    svgPaths: {
      outline: string;
      siteBoxes: { label: string; x: number; y: number; w: number; h: number }[];
    };
  }
> = Object.fromEntries(
  ALL_MAPS.map((m) => {
    const callouts = (m.callouts || []).map((c, idx) => {
      const fullName = c.superRegionName ? `${c.superRegionName} ${c.regionName}` : c.regionName;
      const isSite = c.regionName === 'Site' || fullName.includes('Site');
      const isSpawn = fullName.includes('Spawn');
      const isMid = fullName.includes('Mid');
      return {
        name: fullName,
        x: Math.min(88, Math.max(12, 18 + ((idx * 17) % 68))),
        y: Math.min(88, Math.max(12, 16 + ((idx * 23) % 68))),
        type: (isSite ? 'site' : isSpawn ? 'spawn' : isMid ? 'mid' : 'choke') as
          | 'site'
          | 'choke'
          | 'mid'
          | 'spawn',
      };
    });

    const hasCSite = (m.sites || '').includes('C');
    const siteBoxes = hasCSite
      ? [
          { label: 'A', x: 70, y: 18, w: 13, h: 13 },
          { label: 'B', x: 44, y: 24, w: 13, h: 13 },
          { label: 'C', x: 16, y: 20, w: 13, h: 13 },
        ]
      : [
          { label: 'A', x: 68, y: 18, w: 14, h: 14 },
          { label: 'B', x: 18, y: 22, w: 14, h: 14 },
        ];

    return [
      m.name,
      {
        name: m.name,
        region: `${m.sites || 'A/B'} Tactical Arena`,
        coordinates: m.coordinates || 'LIVE ROTATION',
        tacticalSummary: m.tacticalDescription || `${m.name} official Valorant tactical layout.`,
        displayIcon: m.displayIcon,
        splash: m.splash,
        listViewIcon: m.listViewIcon,
        callouts,
        svgPaths: {
          outline: 'M12,12 L88,12 L88,88 L12,88 Z',
          siteBoxes,
        },
      },
    ];
  })
);

export const COMPETITIVE_RANK_OPTIONS = [
  'Unranked',
  'Iron 1',
  'Iron 2',
  'Iron 3',
  'Bronze 1',
  'Bronze 2',
  'Bronze 3',
  'Silver 1',
  'Silver 2',
  'Silver 3',
  'Gold 1',
  'Gold 2',
  'Gold 3',
  'Platinum 1',
  'Platinum 2',
  'Platinum 3',
  'Diamond 1',
  'Diamond 2',
  'Diamond 3',
  'Ascendant 1',
  'Ascendant 2',
  'Ascendant 3',
  'Immortal 1',
  'Immortal 2',
  'Immortal 3',
  'Radiant',
];

export function getRankTierIcon(rankText: string): string {
  if (!rankText) {
    return ALL_TIERS.find((t) => t.name === 'UNRANKED')?.icon || ALL_TIERS[0]?.icon || '';
  }
  const upper = rankText.toUpperCase().trim();
  const shorthandMap: Record<string, string> = {
    I1: 'IRON 1',
    I2: 'IRON 2',
    I3: 'IRON 3',
    B1: 'BRONZE 1',
    B2: 'BRONZE 2',
    B3: 'BRONZE 3',
    S1: 'SILVER 1',
    S2: 'SILVER 2',
    S3: 'SILVER 3',
    G1: 'GOLD 1',
    G2: 'GOLD 2',
    G3: 'GOLD 3',
    P1: 'PLATINUM 1',
    P2: 'PLATINUM 2',
    P3: 'PLATINUM 3',
    D1: 'DIAMOND 1',
    D2: 'DIAMOND 2',
    D3: 'DIAMOND 3',
    A1: 'ASCENDANT 1',
    A2: 'ASCENDANT 2',
    A3: 'ASCENDANT 3',
    IMM1: 'IMMORTAL 1',
    IMM2: 'IMMORTAL 2',
    IMM3: 'IMMORTAL 3',
  };
  const mappedUpper = shorthandMap[upper] || upper;
  const exact = ALL_TIERS.find((t) => mappedUpper.includes(t.name));
  if (exact?.icon) return exact.icon;
  const byDiv = ALL_TIERS.find((t) => mappedUpper.includes(t.division));
  if (byDiv?.icon) return byDiv.icon;
  return ALL_TIERS.find((t) => t.name === 'UNRANKED')?.icon || ALL_TIERS[0]?.icon || '';
}

export function normalizeRiotIdInput(
  rawInput: string,
  tagInput?: string,
  _region: string = 'APAC'
): { playerName: string; tag: string; fullRiotId: string } {
  const cleaned = (rawInput || '').trim();
  const explicitTag = (tagInput || '').replace(/^#/, '').trim();

  if (cleaned.includes('#')) {
    const [n, t] = cleaned.split('#');
    const playerName = n.trim();
    const tag = (explicitTag || t || '').trim();
    return { playerName, tag, fullRiotId: tag ? `${playerName}#${tag}` : playerName };
  }

  const playerName = cleaned;
  const tag = explicitTag;
  return { playerName, tag, fullRiotId: tag ? `${playerName}#${tag}` : playerName };
}

// ZERO fake matches, mistakes, rounds, training sessions, or videos.
// All match and account telemetry is fetched live from Riot Games (RSO PD / HenrikDev API) or logged by the player.
export const INITIAL_MATCHES: MatchRecord[] = [];
export const INITIAL_MISTAKES: MistakeRecord[] = [];
export const INITIAL_ROUNDS: RoundRecord[] = [];
export const INITIAL_STRATEGIES: StrategyRecord[] = [];
export const INITIAL_LINEUPS: LineupRecord[] = [];
export const INITIAL_TRAINING_SESSIONS: TrainingSession[] = [];
export const INITIAL_VIDEOS: GameplayVideoRecord[] = [];

export const INITIAL_USER_SETTINGS: UserSettings = {
  playerName: 'Not Connected',
  riotId: 'Not Connected',
  region: 'APAC',
  currentRank: 'Unranked',
  peakRank: 'Unranked',
  accountLevel: 0,
  primaryRole: 'Duelist',
  mouseDpi: 800,
  inGameSens: 0.32,
  crosshairCode: '0;P;c;5;h;0;m;1;0l;4;0o;2;0a;1;0f;0;1b;0',
  targetFps: 240,
  themeAccent: '#FF4655',
  compactTables: false,
  showDemoDataBanner: false,
  henrikApiKey: '',
  riotSyncMode: 'CLEAN_SLATE',
};
