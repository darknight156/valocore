import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateKD,
  computeOverviewMetrics,
  computeAgentAnalytics,
  computeMapAnalytics,
  validateAndParseImportMatches,
} from './analytics';
import { MatchRecord } from '../types/valocore';

const sampleMatches: MatchRecord[] = [
  {
    id: 'm1',
    map: 'Ascent',
    agent: 'Jett',
    role: 'Duelist',
    result: 'WIN',
    scoreFor: 13,
    scoreAgainst: 8,
    kills: 24,
    deaths: 12,
    assists: 4,
    acs: 280,
    adr: 175,
    hsPercent: 32,
    firstBloods: 5,
    firstDeaths: 1,
    clutchesWon: 2,
    clutchesAttempted: 3,
    attackRoundsWon: 7,
    attackRoundsPlayed: 11,
    defenseRoundsWon: 6,
    defenseRoundsPlayed: 10,
    durationMinutes: 36,
    gameMode: 'Competitive',
    rankAtMatch: 'Ascendant 3',
    date: '2026-10-29T18:00:00.000Z',
    source: 'RIOT_ID_LIVE_SYNC',
  },
  {
    id: 'm2',
    map: 'Bind',
    agent: 'Omen',
    role: 'Controller',
    result: 'LOSS',
    scoreFor: 9,
    scoreAgainst: 13,
    kills: 15,
    deaths: 18,
    assists: 9,
    acs: 190,
    adr: 130,
    hsPercent: 24,
    firstBloods: 1,
    firstDeaths: 3,
    clutchesWon: 0,
    clutchesAttempted: 2,
    attackRoundsWon: 4,
    attackRoundsPlayed: 11,
    defenseRoundsWon: 5,
    defenseRoundsPlayed: 11,
    durationMinutes: 39,
    gameMode: 'Competitive',
    rankAtMatch: 'Ascendant 3',
    date: '2026-10-28T18:00:00.000Z',
    source: 'RIOT_ID_LIVE_SYNC',
  },
];

test('calculateKD computes accurate ratio and handles zero deaths', () => {
  assert.equal(calculateKD(24, 12), 2.0);
  assert.equal(calculateKD(15, 0), 15);
});

test('computeOverviewMetrics aggregates win rate, KD, ACS, ADR, and deltas', () => {
  const metrics = computeOverviewMetrics(sampleMatches);
  assert.equal(metrics.totalMatches, 2);
  assert.equal(metrics.winRate, 50.0);
  assert.equal(metrics.kdRatio, 1.3);
  assert.equal(metrics.avgAcs, 235);
  assert.equal(metrics.avgAdr, 153);
  assert.equal(metrics.hsPercent, 28.0);
});

test('computeAgentAnalytics and computeMapAnalytics rank properly', () => {
  const agents = computeAgentAnalytics(sampleMatches);
  assert.equal(agents.length, 2);
  const maps = computeMapAnalytics(sampleMatches);
  assert.equal(maps[0].map, 'Ascent');
  assert.equal(maps[0].winRate, 100);
  assert.equal(maps[1].map, 'Bind');
  assert.equal(maps[1].winRate, 0);
});

test('validateAndParseImportMatches parses CSV and detects duplicates', () => {
  const csv = `map,agent,result,kills,deaths,assists,acs,adr,hspercent,date
Ascent,Jett,WIN,24,12,4,280,175,32,2026-10-29T18:00:00.000Z
Corrode,Waylay,WIN,19,11,11,245,158,29,2026-10-30T10:00:00.000Z`;

  const result = validateAndParseImportMatches(csv, 'CSV', sampleMatches);
  assert.equal(result.errors.length, 0);
  assert.equal(result.duplicatesSkipped, 1);
  assert.equal(result.validMatches.length, 1);
  assert.equal(result.validMatches[0].map, 'Corrode');
  assert.equal(result.validMatches[0].agent, 'Waylay');
});

test('Official Valorant catalog, zero-fake-seed state, and Riot API parsers work properly', async () => {
  const {
    ALL_AGENTS,
    ALL_MAPS,
    ALL_WEAPONS,
    INITIAL_MATCHES,
    INITIAL_MISTAKES,
    INITIAL_STRATEGIES,
    INITIAL_TRAINING_SESSIONS,
    normalizeRiotIdInput,
    getRankTierIcon,
  } = await import('./seedData');

  // Verify 0 fake pre-populated matches or fake user records
  assert.equal(INITIAL_MATCHES.length, 0);
  assert.equal(INITIAL_MISTAKES.length, 0);
  assert.equal(INITIAL_STRATEGIES.length, 0);
  assert.equal(INITIAL_TRAINING_SESSIONS.length, 0);

  // Verify official Valorant catalogs (valorant-api.com/v1)
  assert.equal(ALL_AGENTS.length, 30);
  assert.ok(ALL_AGENTS.some((a) => a.name === 'Waylay'));
  assert.ok(ALL_AGENTS.some((a) => a.name === 'Tejo'));
  assert.ok(ALL_AGENTS.some((a) => a.name === 'Vyse'));
  assert.ok(ALL_AGENTS.some((a) => a.name === 'Clove'));
  assert.equal(ALL_MAPS.length, 13);
  assert.ok(ALL_MAPS.some((m) => m.name === 'Corrode'));
  assert.ok(ALL_MAPS.some((m) => m.name === 'Abyss'));
  assert.ok(ALL_MAPS.some((m) => m.name === 'Sunset'));
  assert.ok(ALL_WEAPONS.length >= 20);

  // Verify IGN with explicit lowercase tag preserves exact casing (e.g. DarkNighT#slug)
  const normSlug = normalizeRiotIdInput('DarkNighT#slug', undefined, 'APAC');
  assert.equal(normSlug.playerName, 'DarkNighT');
  assert.equal(normSlug.tag, 'slug');
  assert.equal(normSlug.fullRiotId, 'DarkNighT#slug');

  // Verify official rank crest icon lookup for Bronze 2 / B2
  const b2Icon = getRankTierIcon('Bronze 2 (54 RR)');
  assert.ok(b2Icon.includes('competitivetiers'));
  const b2ShortIcon = getRankTierIcon('B2');
  assert.equal(b2Icon, b2ShortIcon);

  const {
    getShard,
    getHenrikAffinity,
    shardToValocoreRegion,
    buildMatchesFromHenrikData,
    CURRENCY_VP,
    CURRENCY_RADIANITE,
    CURRENCY_KINGDOM_CREDITS,
    RIOT_AUTH_URL,
  } = await import('../server/valorantRiotService');

  assert.equal(getShard('APAC'), 'ap');
  assert.equal(getShard('sea'), 'ap');
  assert.equal(getShard('EUW'), 'eu');
  assert.equal(getHenrikAffinity('APAC'), 'ap');
  assert.equal(getHenrikAffinity('BR'), 'br');
  assert.equal(getHenrikAffinity('LATAM'), 'latam');
  assert.equal(shardToValocoreRegion('ap'), 'APAC');
  assert.equal(CURRENCY_VP, '85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741');
  assert.equal(CURRENCY_RADIANITE, 'e59aa87c-4cbf-517a-5983-6e81511be9b7');
  assert.equal(CURRENCY_KINGDOM_CREDITS, '85ca954a-41f2-ce94-9b45-8ca3dd39a00d');
  assert.ok(RIOT_AUTH_URL.includes('auth.riotgames.com/authorize'));

  const parsedHenrik = buildMatchesFromHenrikData(
    [
      {
        metadata: {
          matchid: 'match-123',
          map: 'Ascent',
          game_length: 2160,
          mode: 'Competitive',
          game_start: 1730280000,
        },
        players: {
          all_players: [
            {
              name: 'DarkNighT',
              tag: 'slug',
              team: 'Blue',
              character: 'Reyna',
              currenttier_patched: 'Bronze 2',
              damage_made: 3500,
              stats: {
                score: 5400,
                kills: 21,
                deaths: 13,
                assists: 5,
                headshots: 14,
                bodyshots: 30,
                legshots: 4,
              },
            },
          ],
        },
        teams: {
          blue: { has_won: true, rounds_won: 13, rounds_lost: 8 },
        },
      },
    ],
    [
      { match_id: 'match-123', mmr_change_to_last_game: 24, currenttierpatched: 'Bronze 2' },
      { match_id: 'match-lt-456', mmr_change_to_last_game: -14, currenttierpatched: 'Bronze 2' },
    ],
    'DarkNighT',
    'slug',
    'Bronze 2',
    [
      {
        meta: {
          id: 'match-lt-456',
          map: { name: 'Bind' },
          mode: 'Competitive',
          started_at: '2026-10-29T12:00:00.000Z',
        },
        stats: {
          team: 'Red',
          character: { name: 'Jett' },
          tier: 7,
          score: 3800,
          kills: 14,
          deaths: 16,
          assists: 3,
          shots: { head: 9, body: 22, leg: 3 },
          damage: { made: 2700, received: 2900 },
        },
        teams: { red: 9, blue: 13 },
      },
    ]
  );
  assert.equal(parsedHenrik.length, 2);
  assert.equal(parsedHenrik[0].rrChange, 24);
  assert.equal(parsedHenrik[0].rankAtMatch, 'Bronze 2');
  assert.equal(parsedHenrik[1].id, 'match-lt-456');
  assert.equal(parsedHenrik[1].map, 'Bind');
  assert.equal(parsedHenrik[1].result, 'LOSS');
  assert.equal(parsedHenrik[1].rrChange, -14);
});

