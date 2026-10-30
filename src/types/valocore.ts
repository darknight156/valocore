export type NavPageId =
  | 'command-center'
  | 'match-history'
  | 'performance-analytics'
  | 'agent-statistics'
  | 'map-statistics'
  | 'ai-coach'
  | 'round-analysis'
  | 'mistake-tracker'
  | 'aim-trainer'
  | 'reaction-tests'
  | 'training-history'
  | 'strategy-planner'
  | 'map-library'
  | 'agent-lineups'
  | 'data-import'
  | 'settings';

export type ValorantMapName =
  | 'Abyss'
  | 'Ascent'
  | 'Bind'
  | 'Breeze'
  | 'Corrode'
  | 'Fracture'
  | 'Haven'
  | 'Icebox'
  | 'Lotus'
  | 'Pearl'
  | 'Split'
  | 'Summit'
  | 'Sunset'
  | (string & {});

export type ValorantAgentName =
  | 'Astra'
  | 'Breach'
  | 'Brimstone'
  | 'Chamber'
  | 'Clove'
  | 'Cypher'
  | 'Deadlock'
  | 'Fade'
  | 'Gekko'
  | 'Harbor'
  | 'Hush'
  | 'Iso'
  | 'Jett'
  | 'KAY/O'
  | 'Killjoy'
  | 'Miks'
  | 'Neon'
  | 'Omen'
  | 'Phoenix'
  | 'Raze'
  | 'Reyna'
  | 'Sage'
  | 'Skye'
  | 'Sova'
  | 'Tejo'
  | 'Veto'
  | 'Viper'
  | 'Vyse'
  | 'Waylay'
  | 'Yoru'
  | (string & {});

export type AgentRole = 'Duelist' | 'Controller' | 'Initiator' | 'Sentinel';

export interface LiveAgentCatalogItem {
  uuid: string;
  name: ValorantAgentName;
  description: string;
  role: AgentRole;
  roleIcon: string;
  displayIcon: string;
  bustPortrait: string;
  abilities: {
    slot: string;
    name: string;
    description: string;
    icon: string | null;
  }[];
}

export interface LiveMapCatalogItem {
  uuid: string;
  name: ValorantMapName;
  coordinates: string;
  tacticalDescription: string;
  displayIcon: string;
  listViewIcon: string;
  splash: string;
  sites: string[];
  callouts: {
    name: string;
    regionName: string;
    superRegionName: string;
    x: number;
    y: number;
    type: 'site' | 'spawn' | 'callout';
  }[];
}

export interface LiveWeaponCatalogItem {
  uuid: string;
  name: string;
  category: string;
  cost: number;
  displayIcon: string;
  fireRate: number | null;
  magazineSize: number | null;
  headDamage: number | null;
  bodyDamage: number | null;
}

export interface LiveTierCatalogItem {
  tier: number;
  name: string;
  division: string;
  icon: string;
}

export interface LiveValorantCatalog {
  version: {
    patch: string;
    season: string;
    buildDate: string;
    riotClientVersion: string;
    riotClientBuild: string;
  };
  agents: LiveAgentCatalogItem[];
  maps: LiveMapCatalogItem[];
  weapons: LiveWeaponCatalogItem[];
  competitiveTiers: LiveTierCatalogItem[];
}

export interface MatchRecord {
  id: string;
  map: ValorantMapName;
  agent: ValorantAgentName;
  role: AgentRole;
  result: 'WIN' | 'LOSS' | 'DRAW';
  scoreFor: number;
  scoreAgainst: number;
  kills: number;
  deaths: number;
  assists: number;
  acs: number;
  adr: number;
  hsPercent: number;
  firstBloods: number;
  firstDeaths: number;
  clutchesWon: number;
  clutchesAttempted: number;
  attackRoundsWon: number;
  attackRoundsPlayed: number;
  defenseRoundsWon: number;
  defenseRoundsPlayed: number;
  durationMinutes: number;
  gameMode: 'Competitive' | 'Premier' | 'Scrim' | 'Unrated';
  rankAtMatch: string;
  rrChange?: number; // e.g. +24 or -15
  performanceBonus?: number; // e.g. +5 star bonus
  date: string; // ISO string
  source:
    | 'RIOT_ID_LIVE_SYNC'
    | 'DEMO_DATASET'
    | 'MANUAL_ENTRY'
    | 'CSV_IMPORT'
    | 'JSON_IMPORT';
  riotId?: string;
  notes?: string;
}

export type MistakeCategory =
  | 'Crosshair placement'
  | 'Positioning'
  | 'Utility usage'
  | 'Timing'
  | 'Trading'
  | 'Decision-making'
  | 'Economy management'
  | 'Communication';

export interface MistakeRecord {
  id: string;
  matchId?: string;
  roundNumber: number;
  map: ValorantMapName;
  agent: ValorantAgentName;
  category: MistakeCategory;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  timestamp: string;
  title: string;
  description: string;
  personalNotes: string;
  aiSuggestion?: string;
  resolved: boolean;
  createdAt: string;
}

export interface RoundRecord {
  id: string;
  matchId: string;
  roundNumber: number;
  map: ValorantMapName;
  agent: ValorantAgentName;
  side: 'Attack' | 'Defense';
  result: 'WIN' | 'LOSS';
  winCondition: 'Elimination' | 'Spike Detonation' | 'Spike Defuse' | 'Time Expired';
  loadoutValue: number;
  kills: number;
  deaths: number;
  damage: number;
  playerNotes: string;
  timestamps: {
    time: string;
    event: string;
    type: 'KILL' | 'DEATH' | 'UTILITY' | 'PLANT' | 'INFO';
  }[];
  aiObservations: string[];
}

export type MarkerType =
  | 'player'
  | 'defense'
  | 'smoke'
  | 'flash'
  | 'molly'
  | 'recon'
  | 'path'
  | 'arrow'
  | 'text';

export interface StrategyMarker {
  id: string;
  type: MarkerType;
  x: number;
  y: number;
  endX?: number;
  endY?: number;
  color: string;
  label?: string;
  radius?: number;
}

export interface StrategyStep {
  order: number;
  timing: string;
  ability: string;
  action: string;
}

export interface StrategyRecord {
  id: string;
  name: string;
  description: string;
  map: ValorantMapName;
  agent: ValorantAgentName;
  side: 'Attack' | 'Defense';
  site: 'A Site' | 'B Site' | 'C Site' | 'Mid';
  requiredAbilities: string[];
  markers: StrategyMarker[];
  steps: StrategyStep[];
  personalNotes: string;
  updatedAt: string;
}

export interface LineupRecord {
  id: string;
  title: string;
  map: ValorantMapName;
  agent: ValorantAgentName;
  side: 'Attack' | 'Defense';
  site: 'A Site' | 'B Site' | 'C Site' | 'Mid';
  ability: string;
  difficulty: 'Easy' | 'Medium' | 'Pro';
  standPosition: string;
  aimReference: string;
  landPosition: string;
  jumpThrow: boolean;
  description: string;
  standX: number;
  standY: number;
  landX: number;
  landY: number;
}

export type TrainingMode =
  | 'Flick Training'
  | 'Precision Micro'
  | 'Target Switching'
  | 'Reaction Time'
  | 'Strafe Tracking';

export interface TrainingSession {
  id: string;
  mode: TrainingMode;
  difficulty: 'Standard' | 'Hard' | 'Radiant';
  durationSeconds: number;
  score: number;
  accuracyPercent: number;
  avgReactionMs: number;
  targetsHit: number;
  targetsMissed: number;
  bestStreak: number;
  createdAt: string;
}

export interface GameplayVideoRecord {
  id: string;
  title: string;
  map: ValorantMapName;
  agent: ValorantAgentName;
  format: 'MP4' | 'MOV' | 'MKV';
  durationSeconds: number;
  resolution: string;
  fps: number;
  createdAt: string;
  segments: {
    id: string;
    roundNumber: number;
    startTime: number;
    endTime: number;
    label: string;
    notes: string;
    aiFrameObservation?: string;
  }[];
}

export interface UserSettings {
  playerName: string;
  riotId: string;
  region: 'NA' | 'EUW' | 'APAC' | 'KR' | 'BR';
  accountLevel: number;
  currentRank: string;
  peakRank: string;
  primaryRole: AgentRole;
  henrikApiKey?: string;
  riotSyncMode: 'LIVE_RIOT_ID' | 'CLEAN_SLATE' | 'DEMO_SEED';
  theme: 'dark' | 'high-contrast';
  startupBehavior: 'command-center' | 'last-visited';
  timeFormat: '12h' | '24h';
  language: string;
  aiCoachDetailLevel: 'concise' | 'detailed' | 'pro-analyst';
  autoAnalyzeFrames: boolean;
  onlyOfficialRiotData: boolean;
  showDemoDataBanner: boolean;
}
