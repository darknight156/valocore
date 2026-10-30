import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { Trash2, Plus, ArrowLeftRight } from 'lucide-react';
import { useValocore } from '../../context/ValocoreContext';
import {
  computeOverviewMetrics,
  computeAgentAnalytics,
  computeMapAnalytics,
  generateCalculatedInsights,
  calculateKD,
  computeMatchRrDelta,
} from '../../utils/analytics';
import {
  ALL_AGENTS,
  ALL_MAPS,
  ALL_WEAPONS,
  getAgentCatalogItem,
  getMapCatalogItem,
  getRankTierIcon,
  LIVE_VERSION,
} from '../../utils/seedData';
import { ValorantAgentName } from '../../types/valocore';

export const ValoSenseViews: React.FC<{
  subView: 'match-history' | 'performance-analytics' | 'agent-statistics' | 'map-statistics';
  onOpenQuickMatch: () => void;
}> = ({ subView, onOpenQuickMatch }) => {
  const {
    matches,
    mistakes,
    settings,
    selectedMatchId,
    setSelectedMatchId,
    deleteMatch,
    globalSearch,
  } = useValocore();

  const [filterAgent, setFilterAgent] = useState<string>('ALL');
  const [filterMap, setFilterMap] = useState<string>('ALL');
  const [filterMode, setFilterMode] = useState<string>('ALL');
  const [filterResult, setFilterResult] = useState<string>('ALL');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');

  const [compareAgentA, setCompareAgentA] = useState<ValorantAgentName>('Jett');
  const [compareAgentB, setCompareAgentB] = useState<ValorantAgentName>('Waylay');

  const filteredMatches = useMemo(() => {
    const q = globalSearch.trim().toLowerCase();
    return matches.filter((m) => {
      if (filterAgent !== 'ALL' && m.agent !== filterAgent) return false;
      if (filterMap !== 'ALL' && m.map !== filterMap) return false;
      if (filterMode !== 'ALL' && m.gameMode !== filterMode) return false;
      if (filterResult !== 'ALL' && m.result !== filterResult) return false;
      if (
        q &&
        !m.map.toLowerCase().includes(q) &&
        !m.agent.toLowerCase().includes(q) &&
        !(m.notes || '').toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [matches, filterAgent, filterMap, filterMode, filterResult, globalSearch]);

  const metrics = useMemo(() => computeOverviewMetrics(filteredMatches), [filteredMatches]);
  const agentStats = useMemo(() => computeAgentAnalytics(matches), [matches]);
  const mapStats = useMemo(() => computeMapAnalytics(matches), [matches]);
  const insights = useMemo(
    () => generateCalculatedInsights(filteredMatches, mistakes),
    [filteredMatches, mistakes]
  );

  // Competitive RR Progression Summary for Match History
  const rrSummary = useMemo(() => {
    let netRr = 0;
    let winRrSum = 0;
    let winCount = 0;
    let lossRrSum = 0;
    let lossCount = 0;
    let starCount = 0;

    for (const m of filteredMatches) {
      const { rrChange, performanceBonus } = computeMatchRrDelta(m);
      netRr += rrChange;
      if (performanceBonus > 0) starCount++;
      if (m.result === 'WIN') {
        winRrSum += rrChange;
        winCount++;
      } else if (m.result === 'LOSS') {
        lossRrSum += rrChange;
        lossCount++;
      }
    }

    return {
      netRr,
      avgWinRr: winCount > 0 ? Math.round(winRrSum / winCount) : 0,
      avgLossRr: lossCount > 0 ? Math.round(lossRrSum / lossCount) : 0,
      starCount,
    };
  }, [filteredMatches]);

  // Merge all 30 official agents with player telemetry
  const full30AgentRoster = useMemo(() => {
    return ALL_AGENTS.map((catalogAgent) => {
      const existing = agentStats.find(
        (s) => s.agent.toLowerCase() === catalogAgent.name.toLowerCase()
      );
      return {
        catalog: catalogAgent,
        matches: existing?.matches || 0,
        wins: existing?.wins || 0,
        winRate: existing?.winRate || 0,
        avgKd: existing?.avgKd || 0,
        avgAcs: existing?.avgAcs || 0,
        avgAdr: existing?.avgAdr || 0,
        hsPercent: existing?.hsPercent || 0,
      };
    }).sort((a, b) => b.matches - a.matches || a.catalog.name.localeCompare(b.catalog.name));
  }, [agentStats]);

  // Merge all 13 official maps with player telemetry
  const full13MapPool = useMemo(() => {
    return ALL_MAPS.map((catalogMap) => {
      const existing = mapStats.find(
        (s) => s.map.toLowerCase() === catalogMap.name.toLowerCase()
      );
      return {
        catalog: catalogMap,
        matches: existing?.matches || 0,
        wins: existing?.wins || 0,
        winRate: existing?.winRate || 0,
        avgAcs: existing?.avgAcs || 0,
        avgAdr: existing?.avgAdr || 0,
        attackWinRate: existing?.attackWinRate || 0,
        defenseWinRate: existing?.defenseWinRate || 0,
      };
    }).sort((a, b) => b.matches - a.matches || a.catalog.name.localeCompare(b.catalog.name));
  }, [mapStats]);

  const selectedMatch = useMemo(
    () => matches.find((m) => m.id === selectedMatchId) || filteredMatches[0] || null,
    [matches, selectedMatchId, filteredMatches]
  );

  const renderFilterBar = () => (
    <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <label className="block text-[10px] font-mono text-[#9395A1] mb-1">
            MAP ({ALL_MAPS.length})
          </label>
          <select
            aria-label="Filter by Map"
            value={filterMap}
            onChange={(e) => setFilterMap(e.target.value)}
            className="bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F7]"
          >
            <option value="ALL">All 13 Maps</option>
            {ALL_MAPS.map((m) => (
              <option key={m.uuid} value={m.name}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-[#9395A1] mb-1">
            AGENT ({ALL_AGENTS.length})
          </label>
          <select
            aria-label="Filter by Agent"
            value={filterAgent}
            onChange={(e) => setFilterAgent(e.target.value)}
            className="bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F7]"
          >
            <option value="ALL">All 30 Agents</option>
            {ALL_AGENTS.map((a) => (
              <option key={a.uuid} value={a.name}>
                {a.name} ({a.role})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-[#9395A1] mb-1">GAME MODE</label>
          <select
            aria-label="Filter by Game Mode"
            value={filterMode}
            onChange={(e) => setFilterMode(e.target.value)}
            className="bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F7]"
          >
            <option value="ALL">All Modes</option>
            <option value="Competitive">Competitive</option>
            <option value="Premier">Premier</option>
            <option value="Scrim">Scrim</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-mono text-[#9395A1] mb-1">RESULT</label>
          <select
            aria-label="Filter by Match Result"
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value)}
            className="bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F7]"
          >
            <option value="ALL">All Results</option>
            <option value="WIN">Wins</option>
            <option value="LOSS">Losses</option>
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={onOpenQuickMatch}
        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white cursor-pointer"
      >
        <Plus className="w-3.5 h-3.5" />
        Add Match Entry
      </button>
    </div>
  );

  if (subView === 'match-history') {
    const selectedMatchRr = selectedMatch ? computeMatchRrDelta(selectedMatch) : null;
    return (
      <div className="space-y-6">
        {renderFilterBar()}

        {/* Competitive RR Progression Summary Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 font-mono">
          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] text-[#9395A1] uppercase">
                NET RATING CHANGE ({settings.riotId})
              </div>
              <div
                className={`text-2xl font-bold mt-1 ${
                  rrSummary.netRr >= 0 ? 'text-[#36D399]' : 'text-[#FF4655]'
                }`}
              >
                {rrSummary.netRr >= 0 ? `+${rrSummary.netRr} RR` : `${rrSummary.netRr} RR`}
              </div>
              <div className="text-[11px] text-[#60636F] mt-0.5">
                Current: {settings.currentRank} · LVL {settings.accountLevel}
              </div>
            </div>
            {getRankTierIcon(settings.currentRank) && (
              <img
                src={getRankTierIcon(settings.currentRank)}
                alt={settings.currentRank}
                referrerPolicy="no-referrer"
                className="w-11 h-11 object-contain"
              />
            )}
          </div>

          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="text-[10px] text-[#9395A1] uppercase">AVG RR GAIN ON WIN</div>
            <div className="text-2xl font-bold text-[#36D399] mt-1">
              +{rrSummary.avgWinRr} RR
            </div>
            <div className="text-[11px] text-[#60636F] mt-0.5">
              Competitive victory rating gain
            </div>
          </div>

          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="text-[10px] text-[#9395A1] uppercase">AVG RR LOSS ON DEFEAT</div>
            <div className="text-2xl font-bold text-[#FF4655] mt-1">
              {rrSummary.avgLossRr} RR
            </div>
            <div className="text-[11px] text-[#60636F] mt-0.5">
              Mitigated by high personal ACS
            </div>
          </div>

          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="text-[10px] text-[#9395A1] uppercase">PERFORMANCE BONUSES ★</div>
            <div className="text-2xl font-bold text-[#F5B942] mt-1">
              {rrSummary.starCount} Matches
            </div>
            <div className="text-[11px] text-[#60636F] mt-0.5">
              Extra +RR star awarded for MVP/ACS
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Full Match List */}
          <div className="lg:col-span-8 rounded-xl bg-[#13151B] border border-[#262832] overflow-hidden">
            <div className="p-4 border-b border-[#262832] flex items-center justify-between">
              <h2 className="text-sm font-display font-bold text-[#F5F5F7]">
                RECORDED MATCH ARCHIVE ({filteredMatches.length})
              </h2>
              <span className="text-xs font-mono text-[#9395A1]">
                {settings.riotId} · LVL {settings.accountLevel} · {settings.currentRank}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#262832] text-[11px] font-mono text-[#60636F] bg-[#0C0D11]">
                    <th className="py-2.5 px-4">MAP</th>
                    <th className="py-2.5 px-3">AGENT</th>
                    <th className="py-2.5 px-3">SCORE</th>
                    <th className="py-2.5 px-3">RANK &amp; RR +/-</th>
                    <th className="py-2.5 px-3 text-right">K/D/A</th>
                    <th className="py-2.5 px-3 text-right">ACS</th>
                    <th className="py-2.5 px-3 text-right">ADR</th>
                    <th className="py-2.5 px-3 text-right">HS%</th>
                    <th className="py-2.5 px-4 text-right">ACTION</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262832] text-xs">
                  {filteredMatches.map((m) => {
                    const active = selectedMatch?.id === m.id;
                    const agentMeta = getAgentCatalogItem(m.agent);
                    const mapMeta = getMapCatalogItem(m.map);
                    const { rrChange, performanceBonus } = computeMatchRrDelta(m);
                    const rankCrest = getRankTierIcon(m.rankAtMatch || settings.currentRank);
                    return (
                      <tr
                        key={m.id}
                        onClick={() => setSelectedMatchId(m.id)}
                        className={`cursor-pointer transition-colors ${
                          active ? 'bg-[#191B23]' : 'hover:bg-[#191B23]/60'
                        }`}
                      >
                        <td className="py-2.5 px-4 font-semibold text-[#F5F5F7]">
                          <div className="flex items-center gap-2">
                            {mapMeta?.listViewIcon && (
                              <img
                                src={mapMeta.listViewIcon}
                                alt={m.map}
                                referrerPolicy="no-referrer"
                                className="w-8 h-5 rounded object-cover border border-[#262832]"
                              />
                            )}
                            <span>{m.map}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-[#F5F5F7]">
                          <div className="flex items-center gap-2">
                            {agentMeta?.displayIcon && (
                              <img
                                src={agentMeta.displayIcon}
                                alt={m.agent}
                                referrerPolicy="no-referrer"
                                className="w-5 h-5 rounded-full bg-[#090A0D] border border-[#262832]"
                              />
                            )}
                            <span>{m.agent}</span>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 font-mono">
                          <span
                            className={
                              m.result === 'WIN'
                                ? 'text-[#36D399] font-bold'
                                : 'text-[#FF4655] font-bold'
                            }
                          >
                            {m.result}
                          </span>{' '}
                          {m.scoreFor}-{m.scoreAgainst}
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
                        <td className="py-2.5 px-3 text-right font-mono">
                          {m.kills}/{m.deaths}/{m.assists}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold">{m.acs}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#9395A1]">{m.adr}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-[#9395A1]">
                          {m.hsPercent}%
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteMatch(m.id);
                            }}
                            aria-label={`Delete match ${m.id}`}
                            className="p-1 text-[#60636F] hover:text-[#FF4655]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Match Detail Inspector */}
          <div className="lg:col-span-4 rounded-xl bg-[#13151B] border border-[#262832] p-5 space-y-4">
            <h2 className="text-sm font-display font-bold text-[#F5F5F7]">
              MATCH TELEMETRY INSPECTOR
            </h2>
            {selectedMatch && selectedMatchRr ? (
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-[#090A0D] border border-[#262832]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getAgentCatalogItem(selectedMatch.agent)?.displayIcon && (
                        <img
                          src={getAgentCatalogItem(selectedMatch.agent)!.displayIcon}
                          alt={selectedMatch.agent}
                          referrerPolicy="no-referrer"
                          className="w-10 h-10 rounded-lg border border-[#262832]"
                        />
                      )}
                      <div className="min-w-0">
                        <div className="text-base font-display font-bold text-[#F5F5F7] truncate">
                          {selectedMatch.map} — {selectedMatch.agent}
                        </div>
                        <div className="text-xs text-[#9395A1] flex items-center gap-1.5 whitespace-nowrap">
                          {getRankTierIcon(selectedMatch.rankAtMatch) && (
                            <img
                              src={getRankTierIcon(selectedMatch.rankAtMatch)}
                              alt={selectedMatch.rankAtMatch}
                              referrerPolicy="no-referrer"
                              className="w-4 h-4 object-contain shrink-0"
                            />
                          )}
                          <span>
                            {selectedMatch.gameMode} · {selectedMatch.rankAtMatch}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono shrink-0 whitespace-nowrap">
                      <div
                        className={`text-sm font-bold ${
                          selectedMatch.result === 'WIN' ? 'text-[#36D399]' : 'text-[#FF4655]'
                        }`}
                      >
                        {selectedMatch.result} {selectedMatch.scoreFor}-{selectedMatch.scoreAgainst}
                      </div>
                      <div
                        className={`text-xs font-bold ${
                          selectedMatchRr.rrChange >= 0 ? 'text-[#36D399]' : 'text-[#FF4655]'
                        }`}
                      >
                        {selectedMatchRr.rrChange >= 0
                          ? `+${selectedMatchRr.rrChange} RR`
                          : `${selectedMatchRr.rrChange} RR`}
                        {selectedMatchRr.performanceBonus > 0
                          ? ` (+${selectedMatchRr.performanceBonus} ★)`
                          : ''}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 font-mono text-xs">
                  <div className="p-3 rounded-lg bg-[#191B23]">
                    <div className="text-[#9395A1] text-[10px]">RATING CHANGE (RR)</div>
                    <div
                      className={`text-base font-bold mt-0.5 ${
                        selectedMatchRr.rrChange >= 0 ? 'text-[#36D399]' : 'text-[#FF4655]'
                      }`}
                    >
                      {selectedMatchRr.rrChange >= 0
                        ? `+${selectedMatchRr.rrChange} RR`
                        : `${selectedMatchRr.rrChange} RR`}
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#191B23]">
                    <div className="text-[#9395A1] text-[10px]">COMBAT SCORE</div>
                    <div className="text-base font-bold text-[#F5F5F7] mt-0.5">
                      {selectedMatch.acs} ACS
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#191B23]">
                    <div className="text-[#9395A1] text-[10px]">OPENING DUELS</div>
                    <div className="text-base font-bold text-[#36D399] mt-0.5">
                      {selectedMatch.firstBloods} FB / {selectedMatch.firstDeaths} FD
                    </div>
                  </div>
                  <div className="p-3 rounded-lg bg-[#191B23]">
                    <div className="text-[#9395A1] text-[10px]">K/D RATIO</div>
                    <div className="text-base font-bold text-[#F5F5F7] mt-0.5">
                      {calculateKD(selectedMatch.kills, selectedMatch.deaths)}
                    </div>
                  </div>
                </div>

                <div className="p-3.5 rounded-lg bg-[#090A0D] border border-[#262832] text-xs space-y-1">
                  <div className="font-mono text-[10px] text-[#9395A1]">SIDE BREAKDOWN</div>
                  <div className="flex justify-between font-mono">
                    <span>Attack Rounds Won:</span>
                    <span className="text-[#F5F5F7]">
                      {selectedMatch.attackRoundsWon} / {selectedMatch.attackRoundsPlayed}
                    </span>
                  </div>
                  <div className="flex justify-between font-mono">
                    <span>Defense Rounds Won:</span>
                    <span className="text-[#F5F5F7]">
                      {selectedMatch.defenseRoundsWon} / {selectedMatch.defenseRoundsPlayed}
                    </span>
                  </div>
                </div>

                {selectedMatch.notes && (
                  <div className="p-3.5 rounded-lg bg-[#191B23] text-xs">
                    <div className="font-mono text-[10px] text-[#9395A1] mb-1">MATCH NOTES</div>
                    <p className="text-[#F5F5F7]">{selectedMatch.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#9395A1]">No match selected.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (subView === 'performance-analytics') {
    const combatTrend = [...filteredMatches]
      .reverse()
      .map((m, idx) => ({
        name: `#${idx + 1} ${m.map.slice(0, 3)}`,
        acs: m.acs,
        adr: m.adr,
        hs: m.hsPercent,
        fb: m.firstBloods,
        fd: m.firstDeaths,
      }));

    return (
      <div className="space-y-6">
        {renderFilterBar()}

        {/* Calculated Performance Insights */}
        <div className="rounded-xl bg-[#13151B] border border-[#262832] p-5">
          <h2 className="text-sm font-display font-bold text-[#F5F5F7] mb-3">
            VALOSENSE CALCULATED PERFORMANCE INSIGHTS ({LIVE_VERSION.season})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {insights.map((text, idx) => (
              <div
                key={idx}
                className="p-3.5 rounded-lg bg-[#090A0D] border border-[#262832] text-xs text-[#F5F5F7]"
              >
                {text}
              </div>
            ))}
          </div>
        </div>

        {/* Detailed Combat & Impact Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 font-mono">
          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="text-[11px] text-[#9395A1]">FIRST BLOOD RATE</div>
            <div className="text-2xl font-bold text-[#36D399] mt-1">{metrics.firstBloodRate}%</div>
            <div className="text-[11px] text-[#60636F] mt-1">Opening duel conversion</div>
          </div>
          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="text-[11px] text-[#9395A1]">FIRST DEATH RATE</div>
            <div className="text-2xl font-bold text-[#FF4655] mt-1">{metrics.firstDeathRate}%</div>
            <div className="text-[11px] text-[#60636F] mt-1">Early round untraded deaths</div>
          </div>
          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="text-[11px] text-[#9395A1]">CLUTCH SUCCESS %</div>
            <div className="text-2xl font-bold text-[#F5F5F7] mt-1">
              {metrics.clutchSuccessRate}%
            </div>
            <div className="text-[11px] text-[#60636F] mt-1">1vX post-plant conversion</div>
          </div>
          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="text-[11px] text-[#9395A1]">DAMAGE DELTA (ADR)</div>
            <div className="text-2xl font-bold text-[#F5F5F7] mt-1">{metrics.avgAdr}</div>
            <div className="text-[11px] text-[#60636F] mt-1">
              {metrics.adrDelta >= 0 ? `+${metrics.adrDelta}` : metrics.adrDelta} vs older window
            </div>
          </div>
        </div>

        {/* Dual Charts: ACS vs ADR & Opening Duels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-5">
            <h3 className="text-sm font-display font-bold text-[#F5F5F7] mb-4">
              ACS & ADR PROGRESSION
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={combatTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262832" vertical={false} />
                  <XAxis dataKey="name" stroke="#60636F" tick={{ fill: '#9395A1', fontSize: 11 }} />
                  <YAxis stroke="#60636F" tick={{ fill: '#9395A1', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#191B23',
                      borderColor: '#262832',
                      fontSize: '12px',
                    }}
                  />
                  <Line type="monotone" dataKey="acs" stroke="#FF4655" strokeWidth={2} name="ACS" />
                  <Line type="monotone" dataKey="adr" stroke="#36D399" strokeWidth={2} name="ADR" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-5">
            <h3 className="text-sm font-display font-bold text-[#F5F5F7] mb-4">
              FIRST BLOODS VS FIRST DEATHS PER MATCH
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={combatTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262832" vertical={false} />
                  <XAxis dataKey="name" stroke="#60636F" tick={{ fill: '#9395A1', fontSize: 11 }} />
                  <YAxis stroke="#60636F" tick={{ fill: '#9395A1', fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#191B23',
                      borderColor: '#262832',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="fb" fill="#36D399" name="First Bloods" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="fd" fill="#FF4655" name="First Deaths" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Official Season V26 Patch 13.09 Arsenal Telemetry Matrix (including Bandit, Outlaw, Vandal, Phantom) */}
        <div className="rounded-xl bg-[#13151B] border border-[#262832] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-display font-bold text-[#F5F5F7]">
                PATCH {LIVE_VERSION.patch} WEAPON ARSENAL &amp; DAMAGE TELEMETRY ({ALL_WEAPONS.length} WEAPONS)
              </h3>
              <p className="text-xs text-[#9395A1]">
                Includes latest Valorant weapons (Bandit, Outlaw, Vandal, Phantom, Operator, Sheriff)
                with official shop cost and 0–30m damage stats
              </p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {ALL_WEAPONS.filter((w) => w.name !== 'Melee').map((w) => (
              <div
                key={w.uuid}
                className="p-3 rounded-lg bg-[#090A0D] border border-[#262832] flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#F5F5F7]">{w.name}</span>
                  <span className="font-mono text-[11px] text-[#36D399]">{w.cost} Creds</span>
                </div>
                {w.displayIcon && (
                  <img
                    src={w.displayIcon}
                    alt={w.name}
                    referrerPolicy="no-referrer"
                    className="h-7 object-contain mx-auto my-1 opacity-90"
                  />
                )}
                <div className="flex items-center justify-between text-[10px] font-mono text-[#9395A1] pt-1 border-t border-[#262832]">
                  <span>{w.category}</span>
                  {w.headDamage ? (
                    <span>
                      HD: <strong className="text-[#FF4655]">{w.headDamage}</strong> · BD:{' '}
                      {w.bodyDamage}
                    </span>
                  ) : (
                    <span>Tactical Sidearm</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (subView === 'agent-statistics') {
    const statA =
      full30AgentRoster.find((a) => a.catalog.name === compareAgentA) || full30AgentRoster[0];
    const statB =
      full30AgentRoster.find((a) => a.catalog.name === compareAgentB) ||
      full30AgentRoster[1] ||
      full30AgentRoster[0];

    const filteredRoster = full30AgentRoster.filter((item) =>
      roleFilter === 'ALL' ? true : item.catalog.role === roleFilter
    );

    return (
      <div className="space-y-6">
        {/* Side-by-Side Agent Comparison across all 30 Agents */}
        <div className="rounded-xl bg-[#13151B] border border-[#262832] p-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-[#262832]">
            <div>
              <h2 className="text-base font-display font-bold text-[#F5F5F7] flex items-center gap-2">
                <ArrowLeftRight className="w-4 h-4 text-[#FF4655]" />
                SIDE-BY-SIDE AGENT COMPARISON (ALL {ALL_AGENTS.length} PLAYABLE AGENTS)
              </h2>
              <p className="text-xs text-[#9395A1]">
                Compare official abilities, role kits, and your recorded combat efficiency across the
                entire Patch {LIVE_VERSION.patch} roster
              </p>
            </div>

            <div className="flex items-center gap-3">
              <select
                aria-label="First Agent to Compare"
                value={compareAgentA}
                onChange={(e) => setCompareAgentA(e.target.value as ValorantAgentName)}
                className="bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F7]"
              >
                {ALL_AGENTS.map((a) => (
                  <option key={a.uuid} value={a.name}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
              <span className="text-xs font-mono text-[#60636F]">VS</span>
              <select
                aria-label="Second Agent to Compare"
                value={compareAgentB}
                onChange={(e) => setCompareAgentB(e.target.value as ValorantAgentName)}
                className="bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F7]"
              >
                {ALL_AGENTS.map((a) => (
                  <option key={a.uuid} value={a.name}>
                    {a.name} ({a.role})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {statA && statB && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
              {[statA, statB].map((st, idx) => (
                <div
                  key={`${st.catalog.name}-${idx}`}
                  className="p-4 rounded-lg bg-[#090A0D] border border-[#262832] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <img
                        src={st.catalog.displayIcon}
                        alt={st.catalog.name}
                        referrerPolicy="no-referrer"
                        className="w-12 h-12 rounded-xl border border-[#262832] bg-[#13151B]"
                      />
                      <div>
                        <div className="text-lg font-display font-bold text-[#F5F5F7]">
                          {st.catalog.name}
                        </div>
                        <div className="text-xs text-[#9395A1]">
                          {st.catalog.role} · {st.matches} Matches Played
                        </div>
                      </div>
                    </div>
                    <div className="text-right font-mono">
                      <div className="text-lg font-bold text-[#36D399]">
                        {st.matches > 0 ? `${st.winRate}% WR` : 'Unplayed'}
                      </div>
                    </div>
                  </div>

                  {/* Official Abilities Bar */}
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {st.catalog.abilities.map((ab) => (
                      <span
                        key={ab.slot}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[#13151B] border border-[#262832] text-[11px] text-[#9395A1]"
                      >
                        {ab.icon && (
                          <img
                            src={ab.icon}
                            alt={ab.name}
                            referrerPolicy="no-referrer"
                            className="w-3.5 h-3.5 opacity-80"
                          />
                        )}
                        {ab.name}
                      </span>
                    ))}
                  </div>

                  <div className="grid grid-cols-4 gap-2 pt-2 border-t border-[#262832] font-mono text-xs">
                    <div>
                      <div className="text-[10px] text-[#60636F]">AVG K/D</div>
                      <div className="font-bold text-[#F5F5F7]">{st.avgKd || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#60636F]">AVG ACS</div>
                      <div className="font-bold text-[#F5F5F7]">{st.avgAcs || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#60636F]">AVG ADR</div>
                      <div className="font-bold text-[#F5F5F7]">{st.avgAdr || '—'}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-[#60636F]">HS %</div>
                      <div className="font-bold text-[#F5F5F7]">
                        {st.hsPercent ? `${st.hsPercent}%` : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Complete 30-Agent Roster Table */}
        <div className="rounded-xl bg-[#13151B] border border-[#262832] overflow-hidden">
          <div className="p-4 border-b border-[#262832] flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-display font-bold text-[#F5F5F7]">
                COMPLETE VALORANT AGENT ROSTER ({filteredRoster.length} / {ALL_AGENTS.length} AGENTS)
              </h3>
              <p className="text-xs text-[#9395A1]">
                Includes Waylay, Tejo, Vyse, Veto, Miks, Hush, Clove, Iso, Gekko, Deadlock, and all
                core agents
              </p>
            </div>

            <div className="flex items-center gap-1 p-1 rounded-lg bg-[#090A0D] border border-[#262832]">
              {['ALL', 'Duelist', 'Initiator', 'Controller', 'Sentinel'].map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRoleFilter(r)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    roleFilter === r
                      ? 'bg-[#FF4655] text-white'
                      : 'text-[#9395A1] hover:text-[#F5F5F7]'
                  }`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[#262832] text-[11px] font-mono text-[#60636F] bg-[#0C0D11]">
                  <th className="py-2.5 px-4">AGENT</th>
                  <th className="py-2.5 px-3">ROLE</th>
                  <th className="py-2.5 px-3">SIGNATURE ABILITIES</th>
                  <th className="py-2.5 px-3 text-right">MATCHES</th>
                  <th className="py-2.5 px-3 text-right">WIN RATE</th>
                  <th className="py-2.5 px-3 text-right">AVG K/D</th>
                  <th className="py-2.5 px-3 text-right">AVG ACS</th>
                  <th className="py-2.5 px-4 text-right">HEADSHOT %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#262832] font-mono">
                {filteredRoster.map((item) => (
                  <tr key={item.catalog.uuid} className="hover:bg-[#191B23]">
                    <td className="py-2.5 px-4 font-sans font-semibold text-[#F5F5F7]">
                      <div className="flex items-center gap-2.5">
                        <img
                          src={item.catalog.displayIcon}
                          alt={item.catalog.name}
                          referrerPolicy="no-referrer"
                          className="w-7 h-7 rounded-full bg-[#090A0D] border border-[#262832]"
                        />
                        <span>{item.catalog.name}</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-3 font-sans text-[#9395A1]">{item.catalog.role}</td>
                    <td className="py-2.5 px-3 font-sans text-[11px] text-[#9395A1]">
                      {item.catalog.abilities.map((a) => a.name).join(' · ')}
                    </td>
                    <td className="py-2.5 px-3 text-right">{item.matches}</td>
                    <td className="py-2.5 px-3 text-right text-[#36D399] font-bold">
                      {item.matches > 0 ? `${item.winRate}%` : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right text-[#F5F5F7]">
                      {item.matches > 0 ? item.avgKd : '—'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-[#F5F5F7]">
                      {item.matches > 0 ? item.avgAcs : '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right text-[#9395A1]">
                      {item.matches > 0 ? `${item.hsPercent}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Map Statistics view showing all 13 official Valorant maps with splash banners
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {full13MapPool.map((mp) => (
          <div
            key={mp.catalog.uuid}
            className="rounded-xl bg-[#13151B] border border-[#262832] overflow-hidden flex flex-col justify-between"
          >
            <div className="relative h-28 bg-[#090A0D]">
              {mp.catalog.splash && (
                <img
                  src={mp.catalog.splash}
                  alt={mp.catalog.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-55"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-[#13151B] via-[#13151B]/40 to-transparent" />
              <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
                <div>
                  <div className="text-[10px] font-mono text-[#9395A1]">
                    {mp.catalog.tacticalDescription} · {mp.catalog.callouts.length} Callouts
                  </div>
                  <h3 className="text-lg font-display font-bold text-[#F5F5F7]">
                    {mp.catalog.name}
                  </h3>
                </div>
                <div className="text-right font-mono">
                  <div
                    className={`text-lg font-bold ${
                      mp.matches === 0
                        ? 'text-[#9395A1]'
                        : mp.winRate >= 50
                        ? 'text-[#36D399]'
                        : 'text-[#FF4655]'
                    }`}
                  >
                    {mp.matches > 0 ? `${mp.winRate}% WR` : '0 Played'}
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 grid grid-cols-4 gap-2 font-mono text-xs">
              <div>
                <div className="text-[10px] text-[#60636F]">MATCHES</div>
                <div className="font-bold text-[#F5F5F7]">{mp.matches}</div>
              </div>
              <div>
                <div className="text-[10px] text-[#60636F]">ATTACK WR</div>
                <div className="font-bold text-[#F5F5F7]">
                  {mp.matches > 0 ? `${mp.attackWinRate}%` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#60636F]">DEFENSE WR</div>
                <div className="font-bold text-[#F5F5F7]">
                  {mp.matches > 0 ? `${mp.defenseWinRate}%` : '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-[#60636F]">AVG ACS</div>
                <div className="font-bold text-[#F5F5F7]">{mp.avgAcs || '—'}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
