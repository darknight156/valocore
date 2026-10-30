import React, { useState } from 'react';
import {
  Database,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Shield,
  Sliders,
  User,
  BrainCircuit,
  RefreshCw,
  Trash2,
} from 'lucide-react';
import { useValocore } from '../../context/ValocoreContext';
import { validateAndParseImportMatches } from '../../utils/analytics';
import { ALL_AGENTS, ALL_MAPS, ALL_WEAPONS, LIVE_VERSION } from '../../utils/seedData';

const SAMPLE_CSV = `map,agent,result,kills,deaths,assists,acs,adr,hspercent,date
Corrode,Waylay,WIN,26,11,5,302,188,35.4,2026-10-30T03:30:00.000Z
Abyss,Tejo,WIN,22,14,7,264,169,28.1,2026-10-30T01:10:00.000Z`;

const SAMPLE_JSON = JSON.stringify(
  [
    {
      map: 'Sunset',
      agent: 'Clove',
      role: 'Controller',
      result: 'WIN',
      scoreFor: 13,
      scoreAgainst: 7,
      kills: 20,
      deaths: 10,
      assists: 14,
      acs: 256,
      adr: 164,
      hsPercent: 31.2,
      date: '2026-10-30T04:00:00.000Z',
    },
  ],
  null,
  2
);

export const SystemViews: React.FC<{
  subView: 'data-import' | 'settings';
  onOpenQuickMatch: () => void;
}> = ({ subView, onOpenQuickMatch }) => {
  const {
    matches,
    importMatches,
    settings,
    updateSettings,
    syncRiotIdProfile,
    clearAllMatches,
    resetAllData,
    notify,
  } = useValocore();

  const [format, setFormat] = useState<'CSV' | 'JSON'>('CSV');
  const [rawText, setRawText] = useState<string>(SAMPLE_CSV);
  const [validationResult, setValidationResult] = useState<{
    validCount: number;
    duplicatesSkipped: number;
    errors: string[];
  } | null>(null);

  const [riotInput, setRiotInput] = useState(settings.riotId || 'TenZ#SEN');
  const [regionInput, setRegionInput] = useState(settings.region || 'NA');
  const [henrikKeyInput, setHenrikKeyInput] = useState(settings.henrikApiKey || '');
  const [syncingRiot, setSyncingRiot] = useState(false);

  React.useEffect(() => {
    setRiotInput(settings.riotId);
    setRegionInput(settings.region);
    setHenrikKeyInput(settings.henrikApiKey || '');
  }, [settings.riotId, settings.region, settings.henrikApiKey]);

  const [settingsTab, setSettingsTab] = useState<
    'GENERAL' | 'PROFILE' | 'DATA' | 'AI' | 'APPLICATION'
  >('PROFILE');

  const handleRunImport = () => {
    const res = validateAndParseImportMatches(rawText, format, matches);
    setValidationResult({
      validCount: res.validMatches.length,
      duplicatesSkipped: res.duplicatesSkipped,
      errors: res.errors,
    });
    if (res.validMatches.length > 0) {
      importMatches(res.validMatches);
    }
  };

  const handleSyncRiot = async (e: React.FormEvent) => {
    e.preventDefault();
    setSyncingRiot(true);
    try {
      await syncRiotIdProfile(riotInput, regionInput, henrikKeyInput);
    } finally {
      setSyncingRiot(false);
    }
  };

  const handleExportJson = () => {
    const blob = new Blob([JSON.stringify(matches, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `valocore_matches_export_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Exported match archive as JSON.');
  };

  if (subView === 'data-import') {
    const riotSyncCount = matches.filter(
      (m) => m.source === 'RIOT_ID_LIVE_SYNC' || m.source === 'DEMO_DATASET'
    ).length;
    const manualCount = matches.filter((m) => m.source === 'MANUAL_ENTRY').length;
    const importedCount = matches.filter(
      (m) => m.source === 'CSV_IMPORT' || m.source === 'JSON_IMPORT'
    ).length;

    return (
      <div className="space-y-6">
        {/* Riot Vanguard & Official API Compliance Notice */}
        <div className="rounded-xl bg-[#13151B] border border-[#262832] p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs font-mono text-[#36D399]">
              <Shield className="w-4 h-4" />
              RIOT VANGUARD SAFE · LIVE RIOT ID SYNC & LOCAL SQLITE TELEMETRY
            </div>
            <h2 className="text-base font-display font-bold text-[#F5F5F7]">
              Riot ID Account Sync, Batch Import & Clean-Slate Personal Tracker
            </h2>
            <p className="text-xs text-[#9395A1]">
              Sync any Riot ID (<span className="font-mono text-[#F5F5F7]">Name#Tag</span>), connect
              an optional HenrikDev Riot API v3 key, or wipe all pre-loaded matches to track 100%
              your own games across all {ALL_AGENTS.length} agents and {ALL_MAPS.length} maps.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={clearAllMatches}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#090A0D] hover:bg-[#191B23] border border-[#262832] text-xs font-semibold text-[#F5B942] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Start Clean Slate (0 Matches)
            </button>
            <button
              type="button"
              onClick={onOpenQuickMatch}
              className="px-3.5 py-2 rounded-lg bg-[#191B23] hover:bg-[#262832] border border-[#262832] text-xs font-semibold text-[#F5F5F7] whitespace-nowrap shrink-0 cursor-pointer"
            >
              Manual Match Entry
            </button>
            <button
              type="button"
              onClick={handleExportJson}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Export JSON Archive
            </button>
          </div>
        </div>

        {/* Source Provenance Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono text-xs">
          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="text-[#9395A1]">RIOT ID LIVE SYNC RECORDS</div>
            <div className="text-2xl font-bold text-[#F5B942] mt-1">{riotSyncCount} Records</div>
            <div className="text-[11px] text-[#60636F] mt-1">
              Source tag: RIOT_ID_LIVE_SYNC ({settings.riotId})
            </div>
          </div>
          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="text-[#9395A1]">MANUAL LOG ENTRIES</div>
            <div className="text-2xl font-bold text-[#36D399] mt-1">{manualCount} Records</div>
            <div className="text-[11px] text-[#60636F] mt-1">Source tag: MANUAL_ENTRY</div>
          </div>
          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="text-[#9395A1]">CSV / JSON IMPORTS</div>
            <div className="text-2xl font-bold text-[#F5F5F7] mt-1">{importedCount} Records</div>
            <div className="text-[11px] text-[#60636F] mt-1">
              Source tag: CSV_IMPORT / JSON_IMPORT
            </div>
          </div>
        </div>

        {/* Interactive CSV / JSON Importer with Duplicate Detection */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-xl bg-[#13151B] border border-[#262832] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-bold text-[#F5F5F7] flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#FF4655]" />
                BATCH MATCH IMPORTER (CSV / JSON)
              </h3>
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[#090A0D] border border-[#262832]">
                <button
                  type="button"
                  onClick={() => {
                    setFormat('CSV');
                    setRawText(SAMPLE_CSV);
                  }}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    format === 'CSV' ? 'bg-[#FF4655] text-white' : 'text-[#9395A1]'
                  }`}
                >
                  CSV Format
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormat('JSON');
                    setRawText(SAMPLE_JSON);
                  }}
                  className={`px-3 py-1 rounded text-xs font-medium ${
                    format === 'JSON' ? 'bg-[#FF4655] text-white' : 'text-[#9395A1]'
                  }`}
                >
                  JSON Format
                </button>
              </div>
            </div>

            <textarea
              aria-label="Import payload editor"
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              className="w-full rounded-lg bg-[#090A0D] border border-[#262832] p-3 font-mono text-xs text-[#F5F5F7]"
            />

            <div className="flex items-center justify-between">
              <span className="text-xs text-[#9395A1]">
                Supports all 30 agents (Waylay, Tejo, Vyse, Clove...) & 13 maps (Corrode, Abyss...)
              </span>
              <button
                type="button"
                onClick={handleRunImport}
                className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white cursor-pointer whitespace-nowrap shrink-0"
              >
                Validate & Import Payload
              </button>
            </div>
          </div>

          <div className="lg:col-span-5 rounded-xl bg-[#13151B] border border-[#262832] p-5 space-y-4">
            <h3 className="text-sm font-display font-bold text-[#F5F5F7]">
              VALIDATION & DUPLICATE REPORT
            </h3>
            {validationResult ? (
              <div className="space-y-3 text-xs font-mono">
                <div className="p-3 rounded-lg bg-[#090A0D] border border-[#262832] flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[#36D399]">
                    <CheckCircle2 className="w-4 h-4" />
                    Valid Records Imported
                  </span>
                  <span className="font-bold text-[#F5F5F7]">
                    {validationResult.validCount}
                  </span>
                </div>
                <div className="p-3 rounded-lg bg-[#090A0D] border border-[#262832] flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-[#F5B942]">
                    <AlertTriangle className="w-4 h-4" />
                    Duplicates Skipped
                  </span>
                  <span className="font-bold text-[#F5F5F7]">
                    {validationResult.duplicatesSkipped}
                  </span>
                </div>
                {validationResult.errors.length > 0 && (
                  <div className="p-3 rounded-lg bg-[#FF4655]/15 border border-[#FF4655] text-[#FF4655] space-y-1">
                    {validationResult.errors.map((err, i) => (
                      <div key={i}>{err}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#9395A1]">
                Click &ldquo;Validate &amp; Import Payload&rdquo; to parse the CSV or JSON records
                and commit them to SQLite.
              </p>
            )}

            <div className="pt-4 border-t border-[#262832] space-y-2">
              <button
                type="button"
                onClick={clearAllMatches}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#090A0D] hover:bg-[#191B23] border border-[#262832] text-xs font-medium text-[#F5B942] cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Wipe All Matches (0-Match Clean Slate)
              </button>
              <button
                type="button"
                onClick={resetAllData}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#191B23] hover:bg-[#262832] border border-[#262832] text-xs font-medium text-[#9395A1] hover:text-[#F5F5F7] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restore V26 Act VI Default Telemetry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Settings View (GENERAL, PROFILE, DATA, AI, APPLICATION)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-3 rounded-xl bg-[#13151B] border border-[#262832] p-3 space-y-1 h-fit">
        {(
          [
            { id: 'PROFILE', label: 'Profile & Riot ID Sync', icon: User },
            { id: 'GENERAL', label: 'General & Appearance', icon: Sliders },
            { id: 'DATA', label: 'Data & SQLite Storage', icon: Database },
            { id: 'AI', label: 'ClutchIQ AI Preferences', icon: BrainCircuit },
            { id: 'APPLICATION', label: 'Valorant Patch & Build', icon: Shield },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSettingsTab(tab.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-xs font-medium transition-colors ${
                settingsTab === tab.id
                  ? 'bg-[#FF4655]/15 text-[#F5F5F7]'
                  : 'text-[#9395A1] hover:text-[#F5F5F7] hover:bg-[#191B23]'
              }`}
            >
              <Icon
                className={`w-4 h-4 ${
                  settingsTab === tab.id ? 'text-[#FF4655]' : 'text-[#9395A1]'
                }`}
              />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="lg:col-span-9 rounded-xl bg-[#13151B] border border-[#262832] p-6 space-y-5">
        {settingsTab === 'PROFILE' && (
          <div className="space-y-5 max-w-2xl text-xs">
            <div>
              <h2 className="text-base font-display font-bold text-[#F5F5F7]">
                Player Identity & Live Riot ID Sync ({LIVE_VERSION.season})
              </h2>
              <p className="text-[#9395A1] mt-0.5">
                Sync any Riot ID (<span className="font-mono text-[#F5F5F7]">Name#Tag</span>) or
                provide an optional HenrikDev Riot API v3 key for direct live match lookup.
              </p>
            </div>

            <form
              onSubmit={handleSyncRiot}
              className="p-4 rounded-xl bg-[#090A0D] border border-[#262832] space-y-3"
            >
              <div className="text-[11px] font-mono text-[#36D399] uppercase">
                LIVE RIOT ID ACCOUNT SYNC
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#9395A1] mb-1">Riot ID (Name#Tag)</label>
                  <input
                    type="text"
                    aria-label="Riot ID"
                    value={riotInput}
                    onChange={(e) => setRiotInput(e.target.value)}
                    placeholder="TenZ#SEN"
                    className="w-full bg-[#13151B] border border-[#262832] rounded-lg px-3 py-2 font-mono text-[#F5F5F7]"
                  />
                </div>
                <div>
                  <label className="block text-[#9395A1] mb-1">Server Region</label>
                  <select
                    value={regionInput}
                    onChange={(e) => setRegionInput(e.target.value as any)}
                    className="w-full bg-[#13151B] border border-[#262832] rounded-lg px-3 py-2 text-[#F5F5F7]"
                  >
                    <option value="NA">NA (North America)</option>
                    <option value="EUW">EUW (Europe)</option>
                    <option value="APAC">APAC (Asia-Pacific)</option>
                    <option value="KR">KR (Korea)</option>
                    <option value="BR">BR (Brazil)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#9395A1] mb-1">
                    HenrikDev API Key (Optional)
                  </label>
                  <input
                    type="password"
                    value={henrikKeyInput}
                    onChange={(e) => setHenrikKeyInput(e.target.value)}
                    placeholder="HDEV-xxxx-xxxx..."
                    className="w-full bg-[#13151B] border border-[#262832] rounded-lg px-3 py-2 font-mono text-[#F5F5F7]"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between pt-1">
                <span className="text-[11px] text-[#9395A1]">
                  Active Account: <strong className="text-[#F5F5F7] font-mono">{settings.riotId}</strong> · Rank: <strong className="text-[#36D399] font-mono">{settings.currentRank}</strong>
                </span>
                <button
                  type="submit"
                  disabled={syncingRiot}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-white font-semibold whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${syncingRiot ? 'animate-spin' : ''}`} />
                  {syncingRiot ? 'Syncing Account...' : 'Sync Riot ID Now'}
                </button>
              </div>
            </form>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-[#9395A1] mb-1">Display Callsign</label>
                <input
                  type="text"
                  aria-label="Display Callsign"
                  value={settings.playerName}
                  onChange={(e) => updateSettings({ playerName: e.target.value })}
                  className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-[#F5F5F7]"
                />
              </div>
              <div>
                <label className="block text-[#9395A1] mb-1">Current Competitive Rank</label>
                <input
                  type="text"
                  value={settings.currentRank}
                  onChange={(e) => updateSettings({ currentRank: e.target.value })}
                  className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-[#F5F5F7]"
                />
              </div>
            </div>
          </div>
        )}

        {settingsTab === 'GENERAL' && (
          <div className="space-y-4 max-w-xl text-xs">
            <h2 className="text-base font-display font-bold text-[#F5F5F7]">
              Appearance & Startup Preferences
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[#9395A1] mb-1">Startup View</label>
                <select
                  value={settings.startupBehavior}
                  onChange={(e) => updateSettings({ startupBehavior: e.target.value as any })}
                  className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-[#F5F5F7]"
                >
                  <option value="command-center">Always Open Command Center</option>
                  <option value="last-visited">Resume Last Visited Module</option>
                </select>
              </div>
              <div>
                <label className="block text-[#9395A1] mb-1">Time Format</label>
                <select
                  value={settings.timeFormat}
                  onChange={(e) => updateSettings({ timeFormat: e.target.value as any })}
                  className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-[#F5F5F7]"
                >
                  <option value="24h">24-Hour Military Clock</option>
                  <option value="12h">12-Hour AM/PM</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {settingsTab === 'DATA' && (
          <div className="space-y-4 max-w-xl text-xs">
            <h2 className="text-base font-display font-bold text-[#F5F5F7]">
              SQLite Database & Backup Management
            </h2>
            <p className="text-[#9395A1]">
              Local database engine: <strong className="text-[#F5F5F7]">valocore.sqlite (WAL Mode)</strong>.
              Currently storing {matches.length} matches.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportJson}
                className="px-4 py-2 rounded-lg bg-[#FF4655] text-white font-semibold cursor-pointer"
              >
                Backup Database to JSON
              </button>
              <button
                type="button"
                onClick={clearAllMatches}
                className="px-4 py-2 rounded-lg bg-[#090A0D] border border-[#262832] text-[#F5B942] font-semibold cursor-pointer"
              >
                Start Clean Slate (0 Matches)
              </button>
              <button
                type="button"
                onClick={resetAllData}
                className="px-4 py-2 rounded-lg bg-[#191B23] border border-[#262832] text-[#F5F5F7] cursor-pointer"
              >
                Reset to V26 Act VI Seed
              </button>
            </div>
          </div>
        )}

        {settingsTab === 'AI' && (
          <div className="space-y-4 max-w-xl text-xs">
            <h2 className="text-base font-display font-bold text-[#F5F5F7]">
              ClutchIQ & Gemini Multimodal Preferences
            </h2>
            <p className="text-[#9395A1]">
              Server-side Gemini API integration is active via secure environment secrets.
              Sensitive credentials are never exposed to client code.
            </p>
            <div>
              <label className="block text-[#9395A1] mb-1">Coaching Depth</label>
              <select
                value={settings.aiCoachDetailLevel}
                onChange={(e) => updateSettings({ aiCoachDetailLevel: e.target.value as any })}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-[#F5F5F7]"
              >
                <option value="pro-analyst">VCT Pro Analyst (Detailed Metrics & Timings)</option>
                <option value="detailed">Standard Tactical Breakdown</option>
                <option value="concise">Concise Bullet Points</option>
              </select>
            </div>
          </div>
        )}

        {settingsTab === 'APPLICATION' && (
          <div className="space-y-3 max-w-xl text-xs font-mono">
            <h2 className="text-base font-sans font-display font-bold text-[#F5F5F7]">
              VALOCORE Desktop Build & Official Valorant Catalog Diagnostics
            </h2>
            <div className="p-4 rounded-lg bg-[#090A0D] border border-[#262832] space-y-1.5">
              <div>VERSION: VALOCORE v2.6.0-desktop (Windows 10/11 Tauri 2 Target)</div>
              <div>VALORANT PATCH: {LIVE_VERSION.season} ({LIVE_VERSION.riotClientBuild})</div>
              <div>OFFICIAL AGENTS INDEXED: {ALL_AGENTS.length} Playable Agents (incl. Waylay, Tejo, Vyse, Veto, Miks, Hush, Clove)</div>
              <div>OFFICIAL MAPS INDEXED: {ALL_MAPS.length} Tactical Maps (incl. Corrode, Summit, Abyss, Sunset, Lotus)</div>
              <div>OFFICIAL WEAPON ARSENAL: {ALL_WEAPONS.length} Weapons (incl. Bandit, Outlaw)</div>
              <div>DATABASE: SQLite 3 Persistent WAL (valocore.sqlite)</div>
              <div>AI ENGINE: Server-side @google/genai (gemini-3.8-flash)</div>
              <div className="text-[#36D399]">STATUS: All modules synchronized with valorant-api.com</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

