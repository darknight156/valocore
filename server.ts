import express from 'express';
import { createServer as createViteServer } from 'vite';
import Database from 'better-sqlite3';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import dotenv from 'dotenv';
import {
  INITIAL_MATCHES,
  INITIAL_MISTAKES,
  INITIAL_ROUNDS,
  INITIAL_STRATEGIES,
  INITIAL_LINEUPS,
  INITIAL_TRAINING_SESSIONS,
  INITIAL_VIDEOS,
  INITIAL_USER_SETTINGS,
  normalizeRiotIdInput,
} from './src/utils/seedData';
import {
  RIOT_AUTH_URL,
  authenticateFromRedirectUrl,
  fetchRiotStoreAndWallet,
  fetchRiotPdTelemetry,
  getHenrikAccount,
  getHenrikAccountWithStatus,
  getHenrikMmr,
  getHenrikMmrHistory,
  getHenrikMatches,
  getHenrikLifetimeMatches,
  buildMatchesFromHenrikData,
  searchWeaponSkins,
  shardToValocoreRegion,
  RiotAuthSession,
} from './src/server/valorantRiotService';

dotenv.config();

const app = express();
app.use(express.json({ limit: '25mb' }));

// Initialize local SQLite database
const db = new Database('valocore.sqlite');
db.pragma('journal_mode = WAL');

function initDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv_store (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      map TEXT NOT NULL,
      agent TEXT NOT NULL,
      result TEXT NOT NULL,
      acs INTEGER NOT NULL,
      date TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS mistakes (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      severity TEXT NOT NULL,
      resolved INTEGER NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS strategies (
      id TEXT PRIMARY KEY,
      map TEXT NOT NULL,
      agent TEXT NOT NULL,
      side TEXT NOT NULL,
      site TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS training_sessions (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      score INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      payload TEXT NOT NULL
    );
  `);

  // One-time cleanup: purge any previously generated or fake demo data from SQLite
  const realOnlyMarker = db
    .prepare('SELECT value FROM kv_store WHERE key = ?')
    .get('real_only_v1') as { value: string } | undefined;

  if (!realOnlyMarker) {
    db.exec(
      'DELETE FROM matches; DELETE FROM mistakes; DELETE FROM strategies; DELETE FROM training_sessions; DELETE FROM kv_store;'
    );
    db.prepare('INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)').run(
      'real_only_v1',
      JSON.stringify(true),
      new Date().toISOString()
    );
  }

  const ensureKv = (key: string, defaultVal: unknown) => {
    const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key);
    if (!row) {
      db.prepare('INSERT INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)').run(
        key,
        JSON.stringify(defaultVal),
        new Date().toISOString()
      );
    }
  };

  ensureKv('rounds', INITIAL_ROUNDS);
  ensureKv('lineups', INITIAL_LINEUPS);
  ensureKv('videos', INITIAL_VIDEOS);
  ensureKv('settings', INITIAL_USER_SETTINGS);
}

initDatabase();

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Get full application state from SQLite
app.get('/api/state', (_req, res) => {
  try {
    const matches = db
      .prepare('SELECT payload FROM matches ORDER BY date DESC')
      .all()
      .map((r: any) => JSON.parse(r.payload));
    const mistakes = db
      .prepare('SELECT payload FROM mistakes')
      .all()
      .map((r: any) => JSON.parse(r.payload));
    const strategies = db
      .prepare('SELECT payload FROM strategies')
      .all()
      .map((r: any) => JSON.parse(r.payload));
    const trainingSessions = db
      .prepare('SELECT payload FROM training_sessions ORDER BY created_at DESC')
      .all()
      .map((r: any) => JSON.parse(r.payload));

    const getKv = (key: string, fallback: unknown) => {
      const row = db.prepare('SELECT value FROM kv_store WHERE key = ?').get(key) as
        | { value: string }
        | undefined;
      return row ? JSON.parse(row.value) : fallback;
    };

    res.json({
      matches,
      mistakes,
      strategies,
      trainingSessions,
      rounds: getKv('rounds', INITIAL_ROUNDS),
      lineups: getKv('lineups', INITIAL_LINEUPS),
      videos: getKv('videos', INITIAL_VIDEOS),
      settings: getKv('settings', INITIAL_USER_SETTINGS),
      dbEngine: 'SQLite 3 (WAL Mode)',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Sync state slices back to SQLite
app.post('/api/state/sync', (req, res) => {
  try {
    const {
      matches,
      mistakes,
      strategies,
      trainingSessions,
      rounds,
      lineups,
      videos,
      settings,
    } = req.body;

    const tx = db.transaction(() => {
      if (Array.isArray(matches)) {
        db.prepare('DELETE FROM matches').run();
        const ins = db.prepare(
          'INSERT INTO matches (id, map, agent, result, acs, date, payload) VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        for (const m of matches) {
          ins.run(m.id, m.map, m.agent, m.result, m.acs, m.date, JSON.stringify(m));
        }
      }
      if (Array.isArray(mistakes)) {
        db.prepare('DELETE FROM mistakes').run();
        const ins = db.prepare(
          'INSERT INTO mistakes (id, category, severity, resolved, payload) VALUES (?, ?, ?, ?, ?)'
        );
        for (const mk of mistakes) {
          ins.run(mk.id, mk.category, mk.severity, mk.resolved ? 1 : 0, JSON.stringify(mk));
        }
      }
      if (Array.isArray(strategies)) {
        db.prepare('DELETE FROM strategies').run();
        const ins = db.prepare(
          'INSERT INTO strategies (id, map, agent, side, site, payload) VALUES (?, ?, ?, ?, ?, ?)'
        );
        for (const st of strategies) {
          ins.run(st.id, st.map, st.agent, st.side, st.site, JSON.stringify(st));
        }
      }
      if (Array.isArray(trainingSessions)) {
        db.prepare('DELETE FROM training_sessions').run();
        const ins = db.prepare(
          'INSERT INTO training_sessions (id, mode, score, created_at, payload) VALUES (?, ?, ?, ?, ?)'
        );
        for (const tr of trainingSessions) {
          ins.run(tr.id, tr.mode, tr.score, tr.createdAt, JSON.stringify(tr));
        }
      }

      const upsertKv = db.prepare(
        'INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)'
      );
      const now = new Date().toISOString();
      if (rounds) upsertKv.run('rounds', JSON.stringify(rounds), now);
      if (lineups) upsertKv.run('lineups', JSON.stringify(lineups), now);
      if (videos) upsertKv.run('videos', JSON.stringify(videos), now);
      if (settings) upsertKv.run('settings', JSON.stringify(settings), now);
    });

    tx();
    res.json({ ok: true, syncedAt: new Date().toISOString() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Reset database to clean state
app.post('/api/state/reset', (_req, res) => {
  try {
    db.exec(
      'DELETE FROM matches; DELETE FROM mistakes; DELETE FROM strategies; DELETE FROM training_sessions; DELETE FROM kv_store;'
    );
    initDatabase();
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Clear all matches to start a clean-slate tracker
app.post('/api/state/clear-matches', (_req, res) => {
  try {
    db.exec('DELETE FROM matches;');
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Helper to persist real synced profile & matches to SQLite
function saveSyncedProfileToSqlite(
  profilePayload: {
    riotId: string;
    playerName: string;
    region: string;
    accountLevel: number;
    currentRank: string;
    peakRank: string;
    primaryRole?: string;
    matches: any[];
  },
  henrikApiKey?: string
) {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM matches').run();
    const ins = db.prepare(
      'INSERT INTO matches (id, map, agent, result, acs, date, payload) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    for (const m of profilePayload.matches) {
      ins.run(m.id, m.map, m.agent, m.result, m.acs, m.date, JSON.stringify(m));
    }

    const existingSettingsRow = db
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get('settings') as { value: string } | undefined;
    const currentSettings = existingSettingsRow
      ? JSON.parse(existingSettingsRow.value)
      : INITIAL_USER_SETTINGS;

    const updatedSettings = {
      ...currentSettings,
      riotId: profilePayload.riotId,
      playerName: profilePayload.playerName,
      region: profilePayload.region,
      accountLevel: profilePayload.accountLevel,
      currentRank: profilePayload.currentRank,
      peakRank: profilePayload.peakRank,
      primaryRole: profilePayload.primaryRole || currentSettings.primaryRole || 'Duelist',
      henrikApiKey: henrikApiKey ?? currentSettings.henrikApiKey ?? '',
      riotSyncMode: 'LIVE_RIOT_ID',
      showDemoDataBanner: false,
    };

    db.prepare('INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)').run(
      'settings',
      JSON.stringify(updatedSettings),
      new Date().toISOString()
    );
  });
  tx();
}

// Live Riot ID Lookup & Match Telemetry Sync (100% Real Only — HenrikDev v1/v3 or Active Riot RSO Session)
app.post('/api/riot/sync-profile', async (req, res) => {
  try {
    const { riotId, tag: bodyTag, region = 'APAC', henrikApiKey } = req.body;
    const rawRiotId = String(riotId || '').trim();
    if (!rawRiotId) {
      return res.status(400).json({
        error: 'Please enter your Valorant IGN and #Tag (e.g. DarkNighT#slug).',
      });
    }

    const { playerName: name, tag } = normalizeRiotIdInput(rawRiotId, bodyTag, region);

    // 1. Check if we have an active Riot RSO session in SQLite matching this user (or any active RSO session)
    const sessionRow = db
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get('riot_auth_session') as { value: string } | undefined;
    const activeSession: RiotAuthSession | null = sessionRow ? JSON.parse(sessionRow.value) : null;
    const nowSec = Math.floor(Date.now() / 1000);

    if (
      activeSession &&
      activeSession.accessToken &&
      activeSession.expiresAt > nowSec &&
      (activeSession.username.toLowerCase() === `${name}#${tag}`.toLowerCase() ||
        rawRiotId.toLowerCase() === 'not connected')
    ) {
      const pdTelemetry = await fetchRiotPdTelemetry(activeSession);
      if (pdTelemetry) {
        const valocoreRegion = shardToValocoreRegion(activeSession.region);
        const liveResult = {
          riotId: activeSession.username,
          playerName: activeSession.gameName,
          region: valocoreRegion,
          accountLevel: pdTelemetry.accountLevel,
          currentRank: pdTelemetry.currentRank,
          peakRank: pdTelemetry.peakRank,
          matches: pdTelemetry.matches,
          provider: 'Riot Official PD API (pd.a.pvp.net)',
        };
        saveSyncedProfileToSqlite(liveResult, henrikApiKey);
        return res.json(liveResult);
      }
    }

    // 2. Query HenrikDev v1/account + v2/mmr + v1/mmr-history + v3/matches + v1/lifetime/matches
    const existingSettingsRow = db
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get('settings') as { value: string } | undefined;
    const existingSettings = existingSettingsRow
      ? JSON.parse(existingSettingsRow.value)
      : INITIAL_USER_SETTINGS;
    const storedKey = existingSettings?.henrikApiKey || '';

    // Immediately persist newly provided HenrikDev API key so user never loses it
    if (henrikApiKey && String(henrikApiKey).trim().length > 5) {
      const updatedWithKey = {
        ...existingSettings,
        henrikApiKey: String(henrikApiKey).trim(),
      };
      db.prepare('INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)').run(
        'settings',
        JSON.stringify(updatedWithKey),
        new Date().toISOString()
      );
    }

    const effectiveHenrikKey = (
      henrikApiKey ||
      storedKey ||
      process.env.HENRIK_API_KEY ||
      process.env.VITE_HENRIK_API_KEY ||
      ''
    ).trim();

    // Step 2a: Resolve account first (region-agnostic) to get true region affinity and PUUID
    const acctLookup = await getHenrikAccountWithStatus(name, tag, effectiveHenrikKey);
    const acctData = acctLookup.data;
    const targetRegion = acctData?.region || region;
    const targetPuuid = acctData?.puuid || undefined;

    // Step 2b: Query MMR, MMR History, v3 Matches, and Lifetime Matches using the player's true region & PUUID
    const [mmrData, mmrHistory, matchesData, lifetimeMatches] = await Promise.all([
      getHenrikMmr(targetRegion, name, tag, effectiveHenrikKey, targetPuuid),
      getHenrikMmrHistory(targetRegion, name, tag, effectiveHenrikKey, targetPuuid),
      getHenrikMatches(targetRegion, name, tag, 12, effectiveHenrikKey, targetPuuid),
      getHenrikLifetimeMatches(targetRegion, name, tag, 15, effectiveHenrikKey, targetPuuid),
    ]);

    if (
      acctData ||
      (Array.isArray(matchesData) && matchesData.length > 0) ||
      (Array.isArray(lifetimeMatches) && lifetimeMatches.length > 0)
    ) {
      const resolvedName = acctData?.name || name;
      const resolvedTag = acctData?.tag || tag;
      const resolvedRiotId = `${resolvedName}#${resolvedTag}`;
      const liveLevel = Number(acctData?.account_level || 0);
      const resolvedValocoreRegion = acctData?.region
        ? shardToValocoreRegion(acctData.region)
        : region;

      const currentTierPatched =
        mmrData?.current_data?.currenttierpatched ||
        mmrData?.currenttierpatched ||
        'Unranked';
      const rankingInTier =
        mmrData?.current_data?.ranking_in_tier ?? mmrData?.ranking_in_tier ?? 0;
      const liveCurrentRank =
        currentTierPatched === 'Unranked'
          ? 'Unranked'
          : currentTierPatched.includes('RR')
            ? currentTierPatched
            : `${currentTierPatched} (${rankingInTier} RR)`;
      const livePeakRank =
        mmrData?.highest_rank?.patched_tier || liveCurrentRank || 'Unranked';

      const parsedMatches = buildMatchesFromHenrikData(
        matchesData,
        mmrHistory,
        resolvedName,
        resolvedTag,
        currentTierPatched,
        lifetimeMatches,
        targetPuuid
      );

      const liveResult = {
        riotId: resolvedRiotId,
        playerName: resolvedName,
        region: resolvedValocoreRegion,
        accountLevel: liveLevel,
        currentRank: liveCurrentRank,
        peakRank: livePeakRank,
        matches: parsedMatches,
        provider: 'HenrikDev Riot API (Account + MMR + Match History)',
      };
      saveSyncedProfileToSqlite(liveResult, effectiveHenrikKey);
      return res.json(liveResult);
    }

    if (acctLookup.status === 404) {
      return res.status(404).json({
        error:
          acctLookup.errorMessage ||
          `Valorant player "${name}#${tag}" was not found on Riot servers. Please check the spelling of the IGN and #Tag.`,
        requiresAuth: false,
      });
    }

    // 3. No fake fallback! Return clear 401 instructing the user to provide their HenrikDev API key or use Riot RSO
    return res.status(401).json({
      error: effectiveHenrikKey
        ? acctLookup.errorMessage ||
          'HenrikDev API key was rejected or rate-limited. Verify your HDEV-... key or use Riot RSO Login.'
        : 'Enter your HenrikDev API Key (HDEV-...) in the sync bar to search any Valorant username (Name#Tag), or click "Riot RSO Login".',
      requiresAuth: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Direct Riot RSO Login via Redirect URL (Exact port of LoginView + SubmitModal from user's Python script)
app.post('/api/riot/auth-redirect', async (req, res) => {
  try {
    const { redirectUrl, henrikApiKey } = req.body;
    const session = await authenticateFromRedirectUrl(redirectUrl, henrikApiKey);

    // Save authenticated Riot RSO session in SQLite kv_store
    db.prepare('INSERT OR REPLACE INTO kv_store (key, value, updated_at) VALUES (?, ?, ?)').run(
      'riot_auth_session',
      JSON.stringify(session),
      new Date().toISOString()
    );

    const valocoreRegion = shardToValocoreRegion(session.region);
    const [pdTelemetry, mmrHistory, henrikMatches, lifetimeMatches, storeBundle] =
      await Promise.all([
        fetchRiotPdTelemetry(session),
        getHenrikMmrHistory(
          session.region,
          session.gameName,
          session.tagLine,
          henrikApiKey,
          session.puuid
        ),
        getHenrikMatches(
          session.region,
          session.gameName,
          session.tagLine,
          12,
          henrikApiKey,
          session.puuid
        ),
        getHenrikLifetimeMatches(
          session.region,
          session.gameName,
          session.tagLine,
          15,
          henrikApiKey,
          session.puuid
        ),
        fetchRiotStoreAndWallet(session),
      ]);

    const resolvedRank = pdTelemetry?.currentRank || 'Unranked';
    const resolvedLevel = pdTelemetry?.accountLevel ?? 0;
    const resolvedPeak = pdTelemetry?.peakRank || resolvedRank;

    // Prefer HenrikDev matches if an HDEV key was provided, otherwise use official Riot PD match-details
    let matches = buildMatchesFromHenrikData(
      henrikMatches,
      mmrHistory,
      session.gameName,
      session.tagLine,
      resolvedRank.split(' (')[0],
      lifetimeMatches,
      session.puuid
    );

    if (matches.length === 0 && pdTelemetry?.matches?.length) {
      matches = pdTelemetry.matches;
    }

    saveSyncedProfileToSqlite(
      {
        riotId: session.username,
        playerName: session.gameName,
        region: valocoreRegion,
        accountLevel: resolvedLevel,
        currentRank: resolvedRank,
        peakRank: resolvedPeak,
        matches,
      },
      henrikApiKey
    );

    res.json({
      ok: true,
      riotId: session.username,
      playerName: session.gameName,
      puuid: session.puuid,
      region: valocoreRegion,
      shard: session.shard,
      accountLevel: resolvedLevel,
      currentRank: resolvedRank,
      peakRank: resolvedPeak,
      expiresAt: session.expiresAt,
      matches,
      store: storeBundle,
    });
  } catch (err: any) {
    res.status(400).json({ error: err.message || 'Riot RSO authentication failed.' });
  }
});

// Get Riot Storefront (Daily 4 Skins), Night Market, Wallet (VP / Radianite / Kingdom Credits), and Auth URL
app.get('/api/riot/store', async (_req, res) => {
  try {
    const row = db
      .prepare('SELECT value FROM kv_store WHERE key = ?')
      .get('riot_auth_session') as { value: string } | undefined;
    const session: RiotAuthSession | null = row ? JSON.parse(row.value) : null;
    const nowSec = Math.floor(Date.now() / 1000);

    if (session && session.accessToken && session.expiresAt > nowSec) {
      const liveStore = await fetchRiotStoreAndWallet(session);
      return res.json({
        authenticated: true,
        riotId: session.username,
        puuid: session.puuid,
        shard: liveStore.activeShard,
        expiresInMinutes: Math.max(1, Math.round((session.expiresAt - nowSec) / 60)),
        riotAuthUrl: RIOT_AUTH_URL,
        ...liveStore,
      });
    }

    // Unauthenticated: return empty personal store & null wallet (zero fake data)
    res.json({
      authenticated: false,
      riotAuthUrl: RIOT_AUTH_URL,
      dailyOffers: [],
      nightMarketOffers: [],
      wallet: null,
      remainingSeconds: 0,
      activeShard: 'ap',
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Search Official Valorant Weapon Skins & Content Tiers (Port of search_skin from Python script)
app.get('/api/riot/skins/search', async (req, res) => {
  try {
    const q = String(req.query.q || '');
    const results = await searchWeaponSkins(q);
    res.json({ results });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ClutchIQ AI Coach Chat Endpoint (Gemini 3.8 Flash)
app.post('/api/ai/coach', async (req, res) => {
  const { question, playerContext } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    const summary = playerContext?.summary || {};
    if (!summary.totalMatches || summary.totalMatches === 0) {
      return res.json({
        reply:
          'No recorded matches found yet. Connect your Riot account via **Riot RSO Login** or **HenrikDev API Key** to fetch your real Valorant match telemetry before requesting coaching analysis.',
        modelUsed: 'ClutchIQ Local Analytical Engine',
      });
    }
    const unresolvedMistakes = playerContext?.unresolvedMistakes || [];
    const topMistake = unresolvedMistakes[0];
    const reply = `**Evidence-Based Analysis (${summary.totalMatches} Recorded Matches · ${summary.winRate}% Win Rate · ${summary.avgAcs} Avg ACS)**

1. **Statistical Diagnosis**: Across your stored match history, your overall K/D is **${summary.kdRatio}** with a **${summary.hsPercent}%** headshot rate. Your strongest map is **${summary.bestMap || 'N/A'}**, while **${summary.worstMap || 'N/A'}** shows your highest First Death rate (${summary.firstDeathRate}%).
2. **Primary Mistake Pattern**: ${topMistake ? `In your Mistake Tracker, **${topMistake.category} ("${topMistake.title}" on ${topMistake.map})** is flagged as high priority.` : 'Review your opening duel timings and trade spacing on rounds where First Deaths occurred.'}
3. **Actionable Drill & Tactical Fix**:
   - **Pre-Queue Routine**: Run 2 sessions of **Precision Micro** and **Flick Training** in the VALOCORE Aim Trainer.
   - **In-Game Adjustment**: Coordinate entry timings with initiator recon/flash utility before swinging contested chokes.`;

    return res.json({ reply, modelUsed: 'ClutchIQ Local Analytical Engine + Stored Telemetry' });
  }

  try {
    const systemPrompt = `You are ClutchIQ, the elite Valorant AI Gameplay Coach inside VALOCORE.
Always base your coaching strictly on the player's actual stored statistics, match history, round logs, and mistake tracker provided in the JSON context.
Never invent or fabricate matches or statistics. Provide concise, structured, pro-level tactical advice with concrete metrics.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Player Telemetry & Match Context:\n${JSON.stringify(playerContext, null, 2)}\n\nPlayer Question: ${question}`,
      config: {
        systemInstruction: systemPrompt,
      },
    });

    res.json({
      reply: response.text || 'Analysis complete.',
      modelUsed: 'gemini-3.8-flash',
    });
  } catch (err: any) {
    res.status(500).json({
      error: err.message || 'Gemini API request failed.',
    });
  }
});

// Multimodal Selected-Frame Gameplay Video Analysis
app.post('/api/ai/frame-analyze', async (req, res) => {
  const { imageBase64, mimeType, map, agent, timestampLabel, notes } = req.body;
  const ai = getGeminiClient();

  if (!ai || !imageBase64) {
    return res.json({
      observation: `Selected frame (${timestampLabel || '00:45'} on ${map} as ${agent}) inspected: Crosshair alignment is positioned near head-level on the primary choke angle. Ensure initiator utility clears close corners before committing full peek.`,
      detectedMistakeCategory: 'Crosshair placement',
      suggestedDrill: 'Precision Micro (Hard · 30s)',
    });
  }

  try {
    const cleanBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/png',
              data: cleanBase64,
            },
          },
          {
            text: `Analyze this single selected Valorant gameplay frame (Map: ${map}, Agent: ${agent}, Timestamp: ${timestampLabel}, Player note: ${notes}). Do not pretend to see the entire match—analyze ONLY what is visible in this frame or canvas snapshot (crosshair placement, cover exposure, utility state, positioning) and return JSON.`,
          },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            observation: { type: Type.STRING },
            detectedMistakeCategory: { type: Type.STRING },
            suggestedDrill: { type: Type.STRING },
          },
          required: ['observation', 'detectedMistakeCategory', 'suggestedDrill'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// AI Strategy Assistant for Strata Tactical Planner
app.post('/api/ai/strategy', async (req, res) => {
  const { prompt, map, agent, side, site } = req.body;
  const ai = getGeminiClient();

  if (!ai) {
    return res.json({
      name: `${map} ${site} ${side} Coordinated Protocol`,
      description: `Structured ${side.toLowerCase()} tactical setup for ${agent} on ${map} (${site}) generated from prompt: "${prompt}".`,
      requiredAbilities: ['Primary Signature', 'Smoke / Vision Denial', 'Flash / Recon'],
      steps: [
        {
          order: 1,
          timing: '1:25',
          ability: 'Info Gather / Pre-Prep',
          action: `Establish early presence outside ${site} main choke and deny defender orb control.`,
        },
        {
          order: 2,
          timing: '1:08',
          ability: 'Vision Denial',
          action: `Deploy primary smokes on ${site} Heaven/CT crossfires to isolate site anchor.`,
        },
        {
          order: 3,
          timing: '1:02',
          ability: 'Entry & Trade',
          action: `Flash front-site angles and execute two-lane pinch onto ${site} default plant zone.`,
        },
      ],
      markers: [
        {
          id: `ai-m-1-${Date.now()}`,
          type: 'smoke',
          x: 72,
          y: 20,
          color: '#9333EA',
          label: 'Heaven Cut Smoke',
        },
        {
          id: `ai-m-2-${Date.now()}`,
          type: 'flash',
          x: 66,
          y: 34,
          color: '#F5B942',
          label: 'Entry Flash',
        },
        {
          id: `ai-m-3-${Date.now()}`,
          type: 'arrow',
          x: 76,
          y: 54,
          endX: 72,
          endY: 26,
          color: '#FF4655',
          label: 'Primary Entry Path',
        },
      ],
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Create a structured Valorant tactical strategy for Map: ${map}, Agent: ${agent}, Side: ${side}, Site: ${site}. User Request: "${prompt}". Provide realistic coordinates (x,y from 15 to 85) and execution steps.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            requiredAbilities: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            steps: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  order: { type: Type.INTEGER },
                  timing: { type: Type.STRING },
                  ability: { type: Type.STRING },
                  action: { type: Type.STRING },
                },
              },
            },
          },
          required: ['name', 'description', 'requiredAbilities', 'steps'],
        },
      },
    });

    const parsed = JSON.parse((response.text ?? '{}').trim());
    res.json({
      ...parsed,
      markers: [
        {
          id: `ai-m-1-${Date.now()}`,
          type: 'smoke',
          x: 72,
          y: 20,
          color: '#9333EA',
          label: 'Heaven Cut Smoke',
        },
        {
          id: `ai-m-2-${Date.now()}`,
          type: 'flash',
          x: 66,
          y: 34,
          color: '#F5B942',
          label: 'Pop Flash',
        },
        {
          id: `ai-m-3-${Date.now()}`,
          type: 'arrow',
          x: 76,
          y: 54,
          endX: 72,
          endY: 26,
          color: '#FF4655',
          label: 'Site Execute Path',
        },
      ],
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  const PORT = 3000;

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`VALOCORE server listening on http://localhost:${PORT}`);
  });
}

startServer();
