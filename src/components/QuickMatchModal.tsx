import React, { useState } from 'react';
import { X } from 'lucide-react';
import {
  MatchRecord,
  ValorantMapName,
  ValorantAgentName,
} from '../types/valocore';
import { useValocore } from '../context/ValocoreContext';
import { ALL_AGENTS, ALL_MAPS, getAgentCatalogItem } from '../utils/seedData';

export const QuickMatchModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
}> = ({ isOpen, onClose }) => {
  const { addMatch, settings } = useValocore();

  const [map, setMap] = useState<ValorantMapName>('Ascent');
  const [agent, setAgent] = useState<ValorantAgentName>('Jett');
  const [result, setResult] = useState<'WIN' | 'LOSS' | 'DRAW'>('WIN');
  const [scoreFor, setScoreFor] = useState(13);
  const [scoreAgainst, setScoreAgainst] = useState(8);
  const [kills, setKills] = useState(22);
  const [deaths, setDeaths] = useState(13);
  const [assists, setAssists] = useState(5);
  const [acs, setAcs] = useState(268);
  const [adr, setAdr] = useState(172);
  const [hsPercent, setHsPercent] = useState(31);
  const [firstBloods, setFirstBloods] = useState(4);
  const [firstDeaths, setFirstDeaths] = useState(1);
  const [rrChange, setRrChange] = useState(23);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const selectedAgentMeta = getAgentCatalogItem(agent) || ALL_AGENTS[0];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (acs <= 0 || adr <= 0 || kills < 0 || deaths < 0) {
      setError('Please enter valid positive numbers for ACS, ADR, Kills, and Deaths.');
      return;
    }

    const signedRr =
      result === 'LOSS' && rrChange > 0
        ? -Math.abs(rrChange)
        : result === 'WIN' && rrChange < 0
          ? Math.abs(rrChange)
          : Number(rrChange);

    const newMatch: MatchRecord = {
      id: `m-manual-${Date.now()}`,
      map,
      agent,
      role: selectedAgentMeta.role,
      result,
      scoreFor: Number(scoreFor),
      scoreAgainst: Number(scoreAgainst),
      kills: Number(kills),
      deaths: Number(deaths),
      assists: Number(assists),
      acs: Number(acs),
      adr: Number(adr),
      hsPercent: Number(hsPercent),
      firstBloods: Number(firstBloods),
      firstDeaths: Number(firstDeaths),
      clutchesWon: 1,
      clutchesAttempted: 2,
      attackRoundsWon: Math.ceil(Number(scoreFor) / 2),
      attackRoundsPlayed: 12,
      defenseRoundsWon: Math.floor(Number(scoreFor) / 2),
      defenseRoundsPlayed: Math.max(1, Number(scoreFor) + Number(scoreAgainst) - 12),
      durationMinutes: 36,
      gameMode: 'Competitive',
      rankAtMatch: settings.currentRank.split(' (')[0],
      rrChange: signedRr,
      performanceBonus: result === 'WIN' && Number(acs) >= 255 ? 3 : 0,
      date: new Date().toISOString(),
      source: 'MANUAL_ENTRY',
      riotId: settings.riotId,
      notes:
        notes.trim() ||
        `Logged manually for ${settings.riotId} (${signedRr >= 0 ? `+${signedRr}` : signedRr} RR · Patch 13.09).`,
    };

    addMatch(newMatch);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="log-match-modal-title"
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-xl rounded-xl bg-[#13151B] border border-[#262832] shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#262832] flex items-center justify-between">
          <div>
            <h2
              id="log-match-modal-title"
              className="text-base font-display font-bold text-[#F5F5F7]"
            >
              Log Competitive Match ({settings.riotId})
            </h2>
            <p className="text-xs text-[#9395A1]">
              Season V26 · Act VI (Patch 13.09) — All 30 Agents &amp; 13 Maps Supported
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded-lg text-[#9395A1] hover:text-[#F5F5F7] hover:bg-[#191B23]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-lg bg-[#FF4655]/15 border border-[#FF4655] text-xs text-[#FF4655]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-[#9395A1] mb-1">
                Map ({ALL_MAPS.length} Pool)
              </label>
              <select
                aria-label="Select Map"
                value={map}
                onChange={(e) => setMap(e.target.value as ValorantMapName)}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-xs text-[#F5F5F7]"
              >
                {ALL_MAPS.map((m) => (
                  <option key={m.uuid} value={m.name}>
                    {m.name} ({m.tacticalDescription})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#9395A1] mb-1">
                Agent ({ALL_AGENTS.length} Roster)
              </label>
              <select
                aria-label="Select Agent"
                value={agent}
                onChange={(e) => setAgent(e.target.value as ValorantAgentName)}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-xs text-[#F5F5F7]"
              >
                {ALL_AGENTS.map((a) => (
                  <option key={a.uuid} value={a.name}>
                    {a.name} — {a.role}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-[#9395A1] mb-1">Result</label>
              <select
                aria-label="Select Match Result"
                value={result}
                onChange={(e) => setResult(e.target.value as any)}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-xs text-[#F5F5F7]"
              >
                <option value="WIN">WIN</option>
                <option value="LOSS">LOSS</option>
                <option value="DRAW">DRAW</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-[#9395A1] mb-1">Rounds Won</label>
              <input
                type="number"
                value={scoreFor}
                onChange={(e) => setScoreFor(Number(e.target.value))}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F5F5F7]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9395A1] mb-1">Rounds Lost</label>
              <input
                type="number"
                value={scoreAgainst}
                onChange={(e) => setScoreAgainst(Number(e.target.value))}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F5F5F7]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9395A1] mb-1">Kills</label>
              <input
                type="number"
                aria-label="Kills"
                value={kills}
                onChange={(e) => setKills(Number(e.target.value))}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F5F5F7]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9395A1] mb-1">Deaths</label>
              <input
                type="number"
                aria-label="Deaths"
                value={deaths}
                onChange={(e) => setDeaths(Number(e.target.value))}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F5F5F7]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9395A1] mb-1">Assists</label>
              <input
                type="number"
                aria-label="Assists"
                value={assists}
                onChange={(e) => setAssists(Number(e.target.value))}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F5F5F7]"
              />
            </div>
          </div>

          <div className="grid grid-cols-5 gap-3">
            <div>
              <label className="block text-xs text-[#9395A1] mb-1">ACS</label>
              <input
                type="number"
                aria-label="Average Combat Score"
                value={acs}
                onChange={(e) => setAcs(Number(e.target.value))}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F5F5F7]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9395A1] mb-1">ADR</label>
              <input
                type="number"
                aria-label="Average Damage per Round"
                value={adr}
                onChange={(e) => setAdr(Number(e.target.value))}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F5F5F7]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9395A1] mb-1">HS %</label>
              <input
                type="number"
                step="0.1"
                aria-label="Headshot Percentage"
                value={hsPercent}
                onChange={(e) => setHsPercent(Number(e.target.value))}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F5F5F7]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9395A1] mb-1">First Bloods</label>
              <input
                type="number"
                value={firstBloods}
                onChange={(e) => setFirstBloods(Number(e.target.value))}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F5F5F7]"
              />
            </div>
            <div>
              <label className="block text-xs text-[#9395A1] mb-1">First Deaths</label>
              <input
                type="number"
                value={firstDeaths}
                onChange={(e) => setFirstDeaths(Number(e.target.value))}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs font-mono text-[#F5F5F7]"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-[#9395A1] mb-1">
                Competitive RR (+/-)
              </label>
              <input
                type="number"
                aria-label="Competitive RR Change"
                value={rrChange}
                onChange={(e) => setRrChange(Number(e.target.value))}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-xs font-mono font-bold text-[#36D399]"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs text-[#9395A1] mb-1">Tactical Notes</label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Held A Rafters on Defense; +24 RR with +3 performance star..."
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-xs text-[#F5F5F7]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-[#262832]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-[#262832] text-xs font-medium text-[#9395A1] hover:text-[#F5F5F7]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white"
            >
              Save Match Record
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
