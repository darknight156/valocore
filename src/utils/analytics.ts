import {
  MatchRecord,
  ValorantAgentName,
  ValorantMapName,
  MistakeRecord,
} from '../types/valocore';

export interface OverviewMetrics {
  winRate: number;
  winRateDelta: number;
  kdRatio: number;
  kdDelta: number;
  hsPercent: number;
  hsDelta: number;
  avgAcs: number;
  acsDelta: number;
  avgAdr: number;
  adrDelta: number;
  totalMatches: number;
  firstBloodRate: number;
  firstDeathRate: number;
  clutchSuccessRate: number;
}

export interface AgentPerformanceStat {
  agent: ValorantAgentName;
  role: string;
  matches: number;
  wins: number;
  winRate: number;
  avgKd: number;
  avgAcs: number;
  avgAdr: number;
  hsPercent: number;
  firstBloods: number;
  firstDeaths: number;
}

export interface MapPerformanceStat {
  map: ValorantMapName;
  matches: number;
  wins: number;
  winRate: number;
  avgAcs: number;
  avgAdr: number;
  attackWinRate: number;
  defenseWinRate: number;
}

export function calculateKD(kills: number, deaths: number): number {
  if (deaths <= 0) return Number(kills.toFixed(2));
  return Number((kills / deaths).toFixed(2));
}

export function computeMatchRrDelta(m: MatchRecord): {
  rrChange: number;
  performanceBonus: number;
} {
  if (typeof m.rrChange === 'number') {
    return {
      rrChange: m.rrChange,
      performanceBonus: m.performanceBonus ?? (m.rrChange >= 24 ? 5 : 0),
    };
  }
  if (m.result === 'DRAW') {
    return { rrChange: 2, performanceBonus: 0 };
  }
  const roundDiff = Math.abs(m.scoreFor - m.scoreAgainst);
  const perfBonus = m.acs >= 285 ? 6 : m.acs >= 250 ? 4 : 0;
  if (m.result === 'WIN') {
    const baseGain = 15 + Math.min(9, roundDiff) + perfBonus;
    return { rrChange: baseGain, performanceBonus: perfBonus };
  }
  // LOSS: higher ACS softens RR penalty
  const lossReduction = m.acs >= 250 ? 5 : m.acs >= 210 ? 2 : 0;
  const baseLoss = -(12 + Math.min(9, roundDiff) - lossReduction);
  return { rrChange: Math.min(-8, baseLoss), performanceBonus: 0 };
}

export function filterMatchesByPeriod(
  matches: MatchRecord[],
  days: '7d' | '30d' | '90d' | 'all',
  referenceDate?: Date
): MatchRecord[] {
  if (days === 'all' || matches.length === 0) return [...matches];
  const latestTime = referenceDate
    ? referenceDate.getTime()
    : Math.max(...matches.map((m) => new Date(m.date).getTime()));
  const dayCount = days === '7d' ? 7 : days === '30d' ? 30 : 90;
  const cutoff = latestTime - dayCount * 24 * 60 * 60 * 1000;
  return matches.filter((m) => new Date(m.date).getTime() >= cutoff);
}

export function computeOverviewMetrics(matches: MatchRecord[]): OverviewMetrics {
  if (matches.length === 0) {
    return {
      winRate: 0,
      winRateDelta: 0,
      kdRatio: 0,
      kdDelta: 0,
      hsPercent: 0,
      hsDelta: 0,
      avgAcs: 0,
      acsDelta: 0,
      avgAdr: 0,
      adrDelta: 0,
      totalMatches: 0,
      firstBloodRate: 0,
      firstDeathRate: 0,
      clutchSuccessRate: 0,
    };
  }

  const sorted = [...matches].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const calcSlice = (slice: MatchRecord[]) => {
    if (slice.length === 0) {
      return { winRate: 0, kd: 0, hs: 0, acs: 0, adr: 0 };
    }
    const wins = slice.filter((m) => m.result === 'WIN').length;
    const totalKills = slice.reduce((acc, m) => acc + m.kills, 0);
    const totalDeaths = slice.reduce((acc, m) => acc + m.deaths, 0);
    const avgHs = slice.reduce((acc, m) => acc + m.hsPercent, 0) / slice.length;
    const avgAcs = slice.reduce((acc, m) => acc + m.acs, 0) / slice.length;
    const avgAdr = slice.reduce((acc, m) => acc + m.adr, 0) / slice.length;

    return {
      winRate: Number(((wins / slice.length) * 100).toFixed(1)),
      kd: calculateKD(totalKills, totalDeaths),
      hs: Number(avgHs.toFixed(1)),
      acs: Math.round(avgAcs),
      adr: Math.round(avgAdr),
    };
  };

  const full = calcSlice(sorted);
  const midPoint = Math.max(1, Math.floor(sorted.length / 2));
  const recentHalf = calcSlice(sorted.slice(0, midPoint));
  const olderHalf = calcSlice(sorted.slice(midPoint));

  const totalRounds = sorted.reduce(
    (acc, m) => acc + m.attackRoundsPlayed + m.defenseRoundsPlayed,
    0
  );
  const totalFB = sorted.reduce((acc, m) => acc + m.firstBloods, 0);
  const totalFD = sorted.reduce((acc, m) => acc + m.firstDeaths, 0);
  const totalClutchesWon = sorted.reduce((acc, m) => acc + m.clutchesWon, 0);
  const totalClutchesAttempted = sorted.reduce(
    (acc, m) => acc + m.clutchesAttempted,
    0
  );

  return {
    winRate: full.winRate,
    winRateDelta: Number((recentHalf.winRate - olderHalf.winRate).toFixed(1)),
    kdRatio: full.kd,
    kdDelta: Number((recentHalf.kd - olderHalf.kd).toFixed(2)),
    hsPercent: full.hs,
    hsDelta: Number((recentHalf.hs - olderHalf.hs).toFixed(1)),
    avgAcs: full.acs,
    acsDelta: Math.round(recentHalf.acs - olderHalf.acs),
    avgAdr: full.adr,
    adrDelta: Math.round(recentHalf.adr - olderHalf.adr),
    totalMatches: sorted.length,
    firstBloodRate:
      totalRounds > 0 ? Number(((totalFB / totalRounds) * 100).toFixed(1)) : 0,
    firstDeathRate:
      totalRounds > 0 ? Number(((totalFD / totalRounds) * 100).toFixed(1)) : 0,
    clutchSuccessRate:
      totalClutchesAttempted > 0
        ? Number(((totalClutchesWon / totalClutchesAttempted) * 100).toFixed(1))
        : 0,
  };
}

export function computeAgentAnalytics(matches: MatchRecord[]): AgentPerformanceStat[] {
  const map = new Map<ValorantAgentName, MatchRecord[]>();
  for (const m of matches) {
    const list = map.get(m.agent) || [];
    list.push(m);
    map.set(m.agent, list);
  }

  const stats: AgentPerformanceStat[] = [];
  for (const [agent, list] of map.entries()) {
    const wins = list.filter((m) => m.result === 'WIN').length;
    const kills = list.reduce((s, m) => s + m.kills, 0);
    const deaths = list.reduce((s, m) => s + m.deaths, 0);
    const acs = list.reduce((s, m) => s + m.acs, 0) / list.length;
    const adr = list.reduce((s, m) => s + m.adr, 0) / list.length;
    const hs = list.reduce((s, m) => s + m.hsPercent, 0) / list.length;
    const fb = list.reduce((s, m) => s + m.firstBloods, 0);
    const fd = list.reduce((s, m) => s + m.firstDeaths, 0);

    stats.push({
      agent,
      role: list[0].role,
      matches: list.length,
      wins,
      winRate: Number(((wins / list.length) * 100).toFixed(1)),
      avgKd: calculateKD(kills, deaths),
      avgAcs: Math.round(acs),
      avgAdr: Math.round(adr),
      hsPercent: Number(hs.toFixed(1)),
      firstBloods: fb,
      firstDeaths: fd,
    });
  }

  return stats.sort((a, b) => b.matches - a.matches || b.avgAcs - a.avgAcs);
}

export function computeMapAnalytics(matches: MatchRecord[]): MapPerformanceStat[] {
  const byMap = new Map<ValorantMapName, MatchRecord[]>();
  for (const m of matches) {
    const list = byMap.get(m.map) || [];
    list.push(m);
    byMap.set(m.map, list);
  }

  const stats: MapPerformanceStat[] = [];
  for (const [mapName, list] of byMap.entries()) {
    const wins = list.filter((m) => m.result === 'WIN').length;
    const acs = list.reduce((s, m) => s + m.acs, 0) / list.length;
    const adr = list.reduce((s, m) => s + m.adr, 0) / list.length;
    const atkWon = list.reduce((s, m) => s + m.attackRoundsWon, 0);
    const atkPlayed = list.reduce((s, m) => s + m.attackRoundsPlayed, 0);
    const defWon = list.reduce((s, m) => s + m.defenseRoundsWon, 0);
    const defPlayed = list.reduce((s, m) => s + m.defenseRoundsPlayed, 0);

    stats.push({
      map: mapName,
      matches: list.length,
      wins,
      winRate: Number(((wins / list.length) * 100).toFixed(1)),
      avgAcs: Math.round(acs),
      avgAdr: Math.round(adr),
      attackWinRate:
        atkPlayed > 0 ? Number(((atkWon / atkPlayed) * 100).toFixed(1)) : 0,
      defenseWinRate:
        defPlayed > 0 ? Number(((defWon / defPlayed) * 100).toFixed(1)) : 0,
    });
  }

  return stats.sort((a, b) => b.winRate - a.winRate);
}

export function generateCalculatedInsights(
  matches: MatchRecord[],
  mistakes: MistakeRecord[]
): string[] {
  if (matches.length === 0) {
    return ['Import or log matches to generate personalized ValoSense insights.'];
  }

  const insights: string[] = [];
  const mapStats = computeMapAnalytics(matches);
  if (mapStats.length >= 2) {
    const bestMap = mapStats[0];
    const worstMap = mapStats[mapStats.length - 1];
    insights.push(
      `You perform significantly better on ${bestMap.map} (${bestMap.winRate}% WR, ${bestMap.avgAcs} ACS) than ${worstMap.map} (${worstMap.winRate}% WR, ${worstMap.avgAcs} ACS).`
    );
  }

  const metrics = computeOverviewMetrics(matches);
  if (metrics.acsDelta > 0) {
    insights.push(
      `Your average ACS has increased by +${metrics.acsDelta} pts in your recent match window compared with earlier matches.`
    );
  } else if (metrics.acsDelta < 0) {
    insights.push(
      `Your average ACS dipped by ${metrics.acsDelta} pts recently—review entry pathing and early-round trades.`
    );
  }

  if (metrics.firstDeathRate > 12) {
    insights.push(
      `Your first-death rate (${metrics.firstDeathRate}% of rounds) is elevated; consider requesting initiator recon before dry-peeking main chokes.`
    );
  } else {
    insights.push(
      `Opening duel discipline is strong: ${metrics.firstBloodRate}% First Blood rate vs ${metrics.firstDeathRate}% First Death rate.`
    );
  }

  const unresolved = mistakes.filter((m) => !m.resolved);
  if (unresolved.length > 0) {
    const counts = new Map<string, number>();
    for (const m of unresolved) {
      counts.set(m.category, (counts.get(m.category) || 0) + 1);
    }
    const sortedCats = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    if (sortedCats[0]) {
      insights.push(
        `Most frequent active mistake category is "${sortedCats[0][0]}" (${sortedCats[0][1]} unresolved instances logged).`
      );
    }
  }

  return insights;
}

export function validateAndParseImportMatches(
  rawInput: string,
  format: 'CSV' | 'JSON',
  existingMatches: MatchRecord[]
): {
  validMatches: MatchRecord[];
  duplicatesSkipped: number;
  errors: string[];
} {
  const errors: string[] = [];
  const validMatches: MatchRecord[] = [];
  let duplicatesSkipped = 0;

  const existingSignatures = new Set(
    existingMatches.map(
      (m) => `${m.map}|${m.agent}|${m.kills}-${m.deaths}-${m.assists}|${m.acs}|${m.date.slice(0, 10)}`
    )
  );

  try {
    if (format === 'JSON') {
      const parsed = JSON.parse(rawInput);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      arr.forEach((item, idx) => {
        if (!item.map || !item.agent || typeof item.acs !== 'number') {
          errors.push(`Record #${idx + 1}: Missing required fields (map, agent, acs).`);
          return;
        }
        const dateStr = item.date || new Date().toISOString();
        const sig = `${item.map}|${item.agent}|${item.kills ?? 0}-${item.deaths ?? 0}-${item.assists ?? 0}|${item.acs}|${dateStr.slice(0, 10)}`;
        if (existingSignatures.has(sig)) {
          duplicatesSkipped++;
          return;
        }
        existingSignatures.add(sig);
        validMatches.push({
          id: item.id || `imp-json-${Date.now()}-${idx}`,
          map: item.map,
          agent: item.agent,
          role: item.role || 'Duelist',
          result: item.result || 'WIN',
          scoreFor: Number(item.scoreFor ?? 13),
          scoreAgainst: Number(item.scoreAgainst ?? 9),
          kills: Number(item.kills ?? 18),
          deaths: Number(item.deaths ?? 14),
          assists: Number(item.assists ?? 5),
          acs: Number(item.acs),
          adr: Number(item.adr ?? 145),
          hsPercent: Number(item.hsPercent ?? 26),
          firstBloods: Number(item.firstBloods ?? 2),
          firstDeaths: Number(item.firstDeaths ?? 1),
          clutchesWon: Number(item.clutchesWon ?? 1),
          clutchesAttempted: Number(item.clutchesAttempted ?? 2),
          attackRoundsWon: Number(item.attackRoundsWon ?? 7),
          attackRoundsPlayed: Number(item.attackRoundsPlayed ?? 12),
          defenseRoundsWon: Number(item.defenseRoundsWon ?? 6),
          defenseRoundsPlayed: Number(item.defenseRoundsPlayed ?? 10),
          durationMinutes: Number(item.durationMinutes ?? 36),
          gameMode: item.gameMode || 'Competitive',
          rankAtMatch: item.rankAtMatch || 'Ascendant 2',
          date: dateStr,
          source: 'JSON_IMPORT',
          notes: item.notes || 'Imported via JSON',
        });
      });
    } else {
      const lines = rawInput
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length < 2) {
        errors.push('CSV input must include a header row and at least one data row.');
        return { validMatches, duplicatesSkipped, errors };
      }
      const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim());
        const row: Record<string, string> = {};
        headers.forEach((h, idx) => {
          row[h] = cols[idx] || '';
        });

        if (!row.map || !row.agent || !row.acs) {
          errors.push(`Row ${i + 1}: Missing required columns (map, agent, acs).`);
          continue;
        }
        const kills = Number(row.kills || 0);
        const deaths = Number(row.deaths || 0);
        const assists = Number(row.assists || 0);
        const acs = Number(row.acs || 0);
        if (Number.isNaN(acs) || acs <= 0) {
          errors.push(`Row ${i + 1}: Invalid ACS value "${row.acs}".`);
          continue;
        }
        const dateStr = row.date || new Date().toISOString();
        const sig = `${row.map}|${row.agent}|${kills}-${deaths}-${assists}|${acs}|${dateStr.slice(0, 10)}`;
        if (existingSignatures.has(sig)) {
          duplicatesSkipped++;
          continue;
        }
        existingSignatures.add(sig);
        validMatches.push({
          id: `imp-csv-${Date.now()}-${i}`,
          map: row.map as ValorantMapName,
          agent: row.agent as ValorantAgentName,
          role: (row.role as any) || 'Duelist',
          result: (row.result?.toUpperCase() as any) || 'WIN',
          scoreFor: Number(row.scorefor || 13),
          scoreAgainst: Number(row.scoreagainst || 9),
          kills,
          deaths,
          assists,
          acs,
          adr: Number(row.adr || 145),
          hsPercent: Number(row.hspercent || 25),
          firstBloods: Number(row.firstbloods || 2),
          firstDeaths: Number(row.firstdeaths || 1),
          clutchesWon: Number(row.clutcheswon || 1),
          clutchesAttempted: Number(row.clutchesattempted || 2),
          attackRoundsWon: 7,
          attackRoundsPlayed: 12,
          defenseRoundsWon: 6,
          defenseRoundsPlayed: 10,
          durationMinutes: Number(row.durationminutes || 35),
          gameMode: 'Competitive',
          rankAtMatch: row.rank || 'Ascendant 2',
          date: dateStr,
          source: 'CSV_IMPORT',
          notes: 'Imported via CSV',
        });
      }
    }
  } catch (err: any) {
    errors.push(`Parse error: ${err?.message || 'Invalid format'}`);
  }

  return { validMatches, duplicatesSkipped, errors };
}
