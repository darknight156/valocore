import https from 'https';
import { MatchRecord, ValorantAgentName, ValorantMapName } from '../types/valocore';
import { ALL_AGENTS, ALL_MAPS, ALL_TIERS } from '../utils/seedData';

export const FORCED_CIPHERS = [
  'ECDHE-ECDSA-AES256-GCM-SHA384',
  'ECDHE-ECDSA-AES128-GCM-SHA256',
  'ECDHE-ECDSA-CHACHA20-POLY1305',
  'ECDHE-RSA-AES128-GCM-SHA256',
  'ECDHE-RSA-CHACHA20-POLY1305',
  'ECDHE-RSA-AES128-SHA256',
  'ECDHE-RSA-AES128-SHA',
  'ECDHE-RSA-AES256-SHA',
  'ECDHE-ECDSA-AES128-SHA256',
  'ECDHE-ECDSA-AES128-SHA',
  'ECDHE-ECDSA-AES256-SHA',
  'ECDHE+AES128',
  'ECDHE+AES256',
  'ECDHE+3DES',
  'RSA+AES128',
  'RSA+AES256',
  'RSA+3DES',
];

export const CURRENCY_VP = '85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741';
export const CURRENCY_RADIANITE = 'e59aa87c-4cbf-517a-5983-6e81511be9b7';
export const CURRENCY_KINGDOM_CREDITS = '85ca954a-41f2-ce94-9b45-8ca3dd39a00d';

export const BASE_AUTH_URL = 'https://auth.riotgames.com';
export const BASE_ENTITLEMENTS_URL = 'https://entitlements.auth.riotgames.com';
export const BASE_VALORANT_API = 'https://valorant-api.com/v1';
export const BASE_HENRIK_API = 'https://api.henrikdev.xyz';
export const RIOT_GEO_URL = 'https://riot-geo.chat.si.riotgames.com/pas/v1/product/valorant';

export const RIOT_AUTH_URL =
  'https://auth.riotgames.com/authorize' +
  '?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in' +
  '&client_id=play-valorant-web-prod' +
  '&response_type=token%20id_token' +
  '&nonce=1&scope=account%20openid';

export const CLIENT_PLATFORM_B64 =
  'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuMjU2LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9';

export const RIOT_USER_AGENT =
  'RiotClient/60.0.6.4770705.4749685 rso-auth (Windows;10;;Professional, x64)';

export interface RiotAuthSession {
  username: string;
  gameName: string;
  tagLine: string;
  puuid: string;
  region: string;
  shard: string;
  accessToken: string;
  idToken?: string;
  entitlementsToken: string;
  expiresAt: number;
  authenticatedAt: string;
}

export interface SkinOfferItem {
  uuid: string;
  displayName: string;
  displayIcon: string;
  vpCost: number;
  discountedVpCost?: number;
  discountPercent?: number;
  contentTierUuid?: string;
  tierName?: string;
  tierIcon?: string;
  highlightColor?: string;
}

export interface WalletBalances {
  vp: number;
  radianite: number;
  kingdomCredits: number;
}

let cachedClientVersion: string | null = null;
let cachedSkinLevels: Record<
  string,
  { displayName: string; displayIcon: string; contentTierUuid?: string }
> | null = null;
let cachedAllSkinsList: any[] | null = null;
let cachedContentTiers: Record<
  string,
  { displayName: string; displayIcon: string; highlightColor: string }
> | null = null;

// Create HTTPS agent with custom TLS cipher suite from the Python reference
const riotHttpsAgent = new https.Agent({
  ciphers: FORCED_CIPHERS.join(':'),
  minVersion: 'TLSv1.2',
  keepAlive: true,
});

export function getShard(region: string): string {
  const r = String(region || 'ap').toLowerCase();
  const mapping: Record<string, string> = {
    na: 'na',
    latam: 'na',
    br: 'na',
    eu: 'eu',
    euw: 'eu',
    ap: 'ap',
    apac: 'ap',
    jp: 'ap',
    oce: 'ap',
    sea: 'ap',
    kr: 'kr',
  };
  return mapping[r] || 'ap';
}

export function shardToValocoreRegion(shardOrRegion: string): 'NA' | 'EUW' | 'APAC' | 'KR' | 'BR' {
  const r = String(shardOrRegion || 'ap').toLowerCase();
  if (r === 'eu' || r === 'euw') return 'EUW';
  if (r === 'kr') return 'KR';
  if (r === 'br') return 'BR';
  if (r === 'na' || r === 'latam') return 'NA';
  return 'APAC';
}

async function riotRequestJson(
  url: string,
  options: {
    method?: 'GET' | 'POST' | 'PUT';
    headers?: Record<string, string>;
    body?: unknown;
    timeoutMs?: number;
  } = {}
): Promise<{ status: number; data: any; rawText: string }> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const bodyStr =
      options.body !== undefined
        ? typeof options.body === 'string'
          ? options.body
          : JSON.stringify(options.body)
        : undefined;

    const req = https.request(
      {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 443,
        path: parsedUrl.pathname + parsedUrl.search,
        method: options.method || 'GET',
        headers: {
          Accept: 'application/json, text/plain, */*',
          'User-Agent': RIOT_USER_AGENT,
          ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': String(Buffer.byteLength(bodyStr)) } : {}),
          ...(options.headers || {}),
        },
        agent: riotHttpsAgent,
        timeout: options.timeoutMs || 12000,
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
        res.on('end', () => {
          const rawText = Buffer.concat(chunks).toString('utf-8');
          let data: any = null;
          try {
            data = JSON.parse(rawText);
          } catch {
            data = null;
          }
          resolve({ status: res.statusCode || 0, data, rawText });
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Request timed out'));
    });
    req.on('error', (err) => reject(err));
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

export async function fetchClientVersion(): Promise<string> {
  if (cachedClientVersion) return cachedClientVersion;
  try {
    const res = await fetch(`${BASE_VALORANT_API}/version`);
    if (res.ok) {
      const json: any = await res.json();
      const ver = json?.data?.riotClientVersion;
      if (ver) {
        cachedClientVersion = ver;
        return ver;
      }
    }
  } catch {
    // ignore
  }
  return 'release-09.10-shipping-24-2984215';
}

export async function getEntitlementsToken(accessToken: string): Promise<string | null> {
  try {
    const { status, data } = await riotRequestJson(`${BASE_ENTITLEMENTS_URL}/api/token/v1`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: {},
    });
    if (status === 200 && data?.entitlements_token) {
      return data.entitlements_token;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function getUserInfo(accessToken: string): Promise<any | null> {
  try {
    const { status, data } = await riotRequestJson(`${BASE_AUTH_URL}/userinfo`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    if (status === 200 && data) {
      return data;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function getRiotGeoRegion(
  accessToken: string,
  entitlementsToken: string,
  idToken?: string
): Promise<string | null> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const { status, data } = await riotRequestJson(RIOT_GEO_URL, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'X-Riot-Entitlements-JWT': entitlementsToken,
        },
        body: { id_token: idToken || null },
        timeoutMs: 6000,
      });
      if (status === 200 && data?.affinities?.live) {
        return String(data.affinities.live).toLowerCase();
      }
    } catch {
      // retry
    }
  }
  return null;
}

export function getHenrikAffinity(region: string): string {
  const r = String(region || 'ap').toLowerCase();
  const mapping: Record<string, string> = {
    na: 'na',
    latam: 'latam',
    br: 'br',
    eu: 'eu',
    euw: 'eu',
    ap: 'ap',
    apac: 'ap',
    jp: 'ap',
    oce: 'ap',
    sea: 'ap',
    kr: 'kr',
  };
  return mapping[r] || 'ap';
}

function buildHenrikHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    'User-Agent': 'VALOCORE-Desktop/2.6',
  };
  const key = (
    apiKey ||
    process.env.HENRIK_API_KEY ||
    process.env.VITE_HENRIK_API_KEY ||
    ''
  ).trim();
  if (key && key.length > 5) {
    headers.Authorization = key;
  }
  return headers;
}

export async function getHenrikAccountWithStatus(
  name: string,
  tag: string,
  apiKey?: string
): Promise<{ data: any | null; status: number; errorMessage?: string }> {
  const encodedName = encodeURIComponent(name.trim());
  const encodedTag = encodeURIComponent(tag.trim());
  const headers = buildHenrikHeaders(apiKey);

  for (const ver of ['v1', 'v2']) {
    const url = `${BASE_HENRIK_API}/valorant/${ver}/account/${encodedName}/${encodedTag}`;
    try {
      const res = await fetch(url, { headers });
      const json: any = await res.json().catch(() => null);
      if (res.ok && json?.data) {
        return { data: json.data, status: 200 };
      }
      const errMsg =
        json?.errors?.[0]?.message ||
        json?.message ||
        (res.status === 404
          ? `Valorant player "${name}#${tag}" was not found.`
          : res.status === 401 || res.status === 403
            ? 'HenrikDev API key is required or invalid.'
            : `HenrikDev returned HTTP ${res.status}`);
      if (res.status === 404 || res.status === 401 || res.status === 403 || res.status === 429) {
        return { data: null, status: res.status, errorMessage: errMsg };
      }
    } catch (e: any) {
      return { data: null, status: 500, errorMessage: e?.message || 'Network error' };
    }
  }
  return { data: null, status: 500 };
}

export async function getHenrikAccount(
  name: string,
  tag: string,
  apiKey?: string
): Promise<any | null> {
  const res = await getHenrikAccountWithStatus(name, tag, apiKey);
  return res.data;
}

export async function getHenrikMmr(
  region: string,
  name: string,
  tag: string,
  apiKey?: string,
  puuid?: string
): Promise<any | null> {
  const affinity = getHenrikAffinity(region);
  const encodedName = encodeURIComponent(name.trim());
  const encodedTag = encodeURIComponent(tag.trim());
  const headers = buildHenrikHeaders(apiKey);

  const urls = [
    `${BASE_HENRIK_API}/valorant/v2/mmr/${affinity}/${encodedName}/${encodedTag}`,
    ...(puuid ? [`${BASE_HENRIK_API}/valorant/v2/by-puuid/mmr/${affinity}/${puuid}`] : []),
    `${BASE_HENRIK_API}/valorant/v1/mmr/${affinity}/${encodedName}/${encodedTag}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const json: any = await res.json();
        if (json?.data) return json.data;
      }
    } catch {
      // ignore
    }
  }
  return null;
}

export async function getHenrikMmrHistory(
  region: string,
  name: string,
  tag: string,
  apiKey?: string,
  puuid?: string
): Promise<any[]> {
  const affinity = getHenrikAffinity(region);
  const encodedName = encodeURIComponent(name.trim());
  const encodedTag = encodeURIComponent(tag.trim());
  const headers = buildHenrikHeaders(apiKey);

  const urls = [
    `${BASE_HENRIK_API}/valorant/v1/mmr-history/${affinity}/${encodedName}/${encodedTag}`,
    ...(puuid ? [`${BASE_HENRIK_API}/valorant/v1/by-puuid/mmr-history/${affinity}/${puuid}`] : []),
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const json: any = await res.json();
        if (Array.isArray(json?.data) && json.data.length > 0) return json.data;
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export async function getHenrikMatches(
  region: string,
  name: string,
  tag: string,
  size = 10,
  apiKey?: string,
  puuid?: string
): Promise<any[]> {
  const affinity = getHenrikAffinity(region);
  const encodedName = encodeURIComponent(name.trim());
  const encodedTag = encodeURIComponent(tag.trim());
  const headers = buildHenrikHeaders(apiKey);

  const urls = [
    `${BASE_HENRIK_API}/valorant/v3/matches/${affinity}/${encodedName}/${encodedTag}?size=${size}`,
    ...(puuid
      ? [`${BASE_HENRIK_API}/valorant/v3/by-puuid/matches/${affinity}/${puuid}?size=${size}`]
      : []),
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const json: any = await res.json();
        if (Array.isArray(json?.data) && json.data.length > 0) return json.data;
      }
    } catch {
      // ignore
    }
  }
  return [];
}

export async function getHenrikLifetimeMatches(
  region: string,
  name: string,
  tag: string,
  size = 15,
  apiKey?: string,
  puuid?: string
): Promise<any[]> {
  const affinity = getHenrikAffinity(region);
  const encodedName = encodeURIComponent(name.trim());
  const encodedTag = encodeURIComponent(tag.trim());
  const headers = buildHenrikHeaders(apiKey);

  const urls = [
    `${BASE_HENRIK_API}/valorant/v1/lifetime/matches/${affinity}/${encodedName}/${encodedTag}?size=${size}`,
    ...(puuid
      ? [
          `${BASE_HENRIK_API}/valorant/v1/by-puuid/lifetime/matches/${affinity}/${puuid}?size=${size}`,
        ]
      : []),
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers });
      if (res.ok) {
        const json: any = await res.json();
        if (Array.isArray(json?.data) && json.data.length > 0) return json.data;
      }
    } catch {
      // ignore
    }
  }
  return [];
}

/**
 * Parse Redirect URL (`https://playvalorant.com/opt_in#access_token=...`)
 * Exactly follows `SubmitModal.on_submit` from the user's Python code.
 */
export async function authenticateFromRedirectUrl(
  redirectUrlOrToken: string,
  henrikApiKey?: string
): Promise<RiotAuthSession> {
  const raw = String(redirectUrlOrToken || '').trim();
  if (!raw) {
    throw new Error('Redirect URL is empty.');
  }

  let accessToken = '';
  let idToken = '';
  let expiresIn = 3600;

  if (raw.includes('access_token=') && raw.includes('#')) {
    const fragment = raw.split('#')[1];
    const params: Record<string, string> = {};
    for (const item of fragment.split('&')) {
      if (!item.includes('=')) continue;
      const [k, v] = item.split('=', 2);
      params[k] = decodeURIComponent(v || '');
    }
    accessToken = params.access_token || '';
    idToken = params.id_token || '';
    expiresIn = Number(params.expires_in || 3600) || 3600;
  } else if (raw.startsWith('eyJ')) {
    accessToken = raw;
  } else {
    throw new Error(
      'Invalid Redirect URL. It must contain #access_token=... from playvalorant.com/opt_in.'
    );
  }

  if (!accessToken) {
    throw new Error('Could not extract access_token from the Redirect URL.');
  }

  const entitlementsToken = await getEntitlementsToken(accessToken);
  if (!entitlementsToken) {
    throw new Error(
      'Failed to fetch Riot Entitlements token. Your access_token may have expired (tokens last 60 minutes).'
    );
  }

  const userInfo = await getUserInfo(accessToken);
  if (!userInfo) {
    throw new Error('Failed to fetch Riot userinfo from auth.riotgames.com.');
  }

  const puuid = userInfo.sub || '';
  const acct = userInfo.acct || {};
  let gameName = acct.game_name || 'DarkNighT';
  let tagLine = acct.tag_line || 'slug';

  let region = 'ap';
  const regionData = userInfo.region;
  if (regionData && typeof regionData === 'object' && regionData.tag) {
    region = String(regionData.tag).toLowerCase();
  } else if (typeof regionData === 'string') {
    region = regionData.toLowerCase();
  }

  const geoRegion = await getRiotGeoRegion(accessToken, entitlementsToken, idToken);
  if (geoRegion) {
    region = geoRegion.toLowerCase();
  }

  if (gameName && tagLine) {
    const henrikAcc = await getHenrikAccount(gameName, tagLine, henrikApiKey);
    if (henrikAcc?.region) {
      region = String(henrikAcc.region).toLowerCase();
    }
  }

  const shard = getShard(region);

  return {
    username: `${gameName}#${tagLine}`,
    gameName,
    tagLine,
    puuid,
    region,
    shard,
    accessToken,
    idToken,
    entitlementsToken,
    expiresAt: Math.floor(Date.now() / 1000) + expiresIn,
    authenticatedAt: new Date().toISOString(),
  };
}

export async function ensureSkinLevelCache() {
  if (cachedSkinLevels && cachedAllSkinsList) {
    return { index: cachedSkinLevels, skins: cachedAllSkinsList };
  }
  try {
    const res = await fetch(`${BASE_VALORANT_API}/weapons/skins`);
    if (res.ok) {
      const json: any = await res.json();
      const list = json?.data || [];
      cachedAllSkinsList = list;
      const index: Record<
        string,
        { displayName: string; displayIcon: string; contentTierUuid?: string }
      > = {};
      for (const skin of list) {
        const tier = skin.contentTierUuid;
        for (const level of skin.levels || []) {
          if (!level?.uuid) continue;
          index[level.uuid.toLowerCase()] = {
            displayName: level.displayName || skin.displayName,
            displayIcon: level.displayIcon || skin.displayIcon,
            contentTierUuid: tier,
          };
        }
      }
      cachedSkinLevels = index;
      return { index, skins: list };
    }
  } catch {
    // ignore
  }
  return { index: {}, skins: [] };
}

export async function ensureContentTierCache() {
  if (cachedContentTiers) return cachedContentTiers;
  try {
    const res = await fetch(`${BASE_VALORANT_API}/contenttiers`);
    if (res.ok) {
      const json: any = await res.json();
      const index: Record<
        string,
        { displayName: string; displayIcon: string; highlightColor: string }
      > = {};
      for (const tier of json?.data || []) {
        if (!tier?.uuid) continue;
        index[tier.uuid.toLowerCase()] = {
          displayName: tier.displayName,
          displayIcon: tier.displayIcon,
          highlightColor: tier.highlightColor,
        };
      }
      cachedContentTiers = index;
      return index;
    }
  } catch {
    // ignore
  }
  return {};
}

export async function searchWeaponSkins(query: string): Promise<SkinOfferItem[]> {
  const [{ skins }, tiers] = await Promise.all([
    ensureSkinLevelCache(),
    ensureContentTierCache(),
  ]);
  const q = String(query || '').trim().toLowerCase();
  const featuredNames = [
    'kuronami vandal',
    'prelude to chaos vandal',
    'reaver vandal',
    'recon phantom',
    'oni phantom',
    'prime vandal',
    'champions 2024 phantom',
    'araxys vandal',
    'mystbloom phantom',
    'neo frontier sheriff',
  ];

  let filtered: any[];
  if (!q) {
    const featuredMatches = featuredNames
      .map((fn) =>
        skins.find((s: any) => String(s.displayName || '').toLowerCase() === fn)
      )
      .filter(Boolean);
    const others = skins
      .filter((s: any) => {
        const name = String(s.displayName || '').toLowerCase();
        return (
          Boolean(s.contentTierUuid && s.displayIcon) &&
          (name.includes('vandal') || name.includes('phantom') || name.includes('sheriff'))
        );
      })
      .slice(0, 20);
    filtered = [...featuredMatches, ...others].slice(0, 24);
  } else {
    filtered = skins
      .filter((s: any) => {
        const name = String(s.displayName || '').toLowerCase();
        if (!name || name.startsWith('standard ') || name.includes('random favorite')) return false;
        return name.includes(q);
      })
      .slice(0, 24);
  }

  return filtered.map((s: any) => {
    const tierUuid = String(s.contentTierUuid || '').toLowerCase();
    const tierInfo = tiers[tierUuid];
    const vpByTier: Record<string, number> = {
      'Select Edition': 875,
      'Deluxe Edition': 1275,
      'Premium Edition': 1775,
      'Exclusive Edition': 2175,
      'Ultra Edition': 2475,
    };
    return {
      uuid: s.uuid,
      displayName: s.displayName,
      displayIcon: s.levels?.[0]?.displayIcon || s.displayIcon,
      vpCost: vpByTier[tierInfo?.displayName || ''] || 1775,
      contentTierUuid: s.contentTierUuid,
      tierName: tierInfo?.displayName || 'Premium Edition',
      tierIcon: tierInfo?.displayIcon,
      highlightColor: tierInfo?.highlightColor,
    };
  });
}

async function buildRiotPdHeaders(auth: RiotAuthSession) {
  const clientVersion = await fetchClientVersion();
  return {
    Authorization: `Bearer ${auth.accessToken}`,
    'X-Riot-Entitlements-JWT': auth.entitlementsToken,
    'Content-Type': 'application/json',
    'X-Riot-ClientVersion': clientVersion,
    'X-Riot-ClientPlatform': CLIENT_PLATFORM_B64,
    'User-Agent': RIOT_USER_AGENT,
    Accept: 'application/json, text/plain, */*',
  };
}

/**
 * Fetch live Storefront & Night Market using the exact v3 POST -> v2 GET + multi-shard probe
 * from the user's Python `get_store` method.
 */
export async function fetchRiotStoreAndWallet(auth: RiotAuthSession): Promise<{
  dailyOffers: SkinOfferItem[];
  nightMarketOffers: SkinOfferItem[];
  wallet: WalletBalances | null;
  remainingSeconds: number;
  activeShard: string;
}> {
  const headers = await buildRiotPdHeaders(auth);
  const [{ index: skinLevels }, tiers] = await Promise.all([
    ensureSkinLevelCache(),
    ensureContentTierCache(),
  ]);

  const tryShardStore = async (targetShard: string): Promise<any | null> => {
    const v3Url = `https://pd.${targetShard}.a.pvp.net/store/v3/storefront/${auth.puuid}`;
    try {
      const r3 = await riotRequestJson(v3Url, {
        method: 'POST',
        headers,
        body: {},
        timeoutMs: 12000,
      });
      if (r3.status === 200 && r3.data) return r3.data;
    } catch {
      // fallback to v2
    }
    const v2Url = `https://pd.${targetShard}.a.pvp.net/store/v2/storefront/${auth.puuid}`;
    try {
      const r2 = await riotRequestJson(v2Url, {
        method: 'GET',
        headers,
        timeoutMs: 12000,
      });
      if (r2.status === 200 && r2.data) return r2.data;
    } catch {
      // ignore
    }
    return null;
  };

  let activeShard = auth.shard || getShard(auth.region);
  let storeData = await tryShardStore(activeShard);

  if (!storeData) {
    const allShards = ['ap', 'na', 'eu', 'kr'].filter((s) => s !== activeShard);
    for (const probeShard of allShards) {
      const probed = await tryShardStore(probeShard);
      if (probed) {
        activeShard = probeShard;
        storeData = probed;
        break;
      }
    }
  }

  let wallet: WalletBalances | null = null;
  try {
    const walletRes = await riotRequestJson(
      `https://pd.${activeShard}.a.pvp.net/store/v1/wallet/${auth.puuid}`,
      { method: 'GET', headers, timeoutMs: 8000 }
    );
    if (walletRes.status === 200 && walletRes.data?.Balances) {
      const b = walletRes.data.Balances;
      wallet = {
        vp: Number(b[CURRENCY_VP] || 0),
        radianite: Number(b[CURRENCY_RADIANITE] || 0),
        kingdomCredits: Number(b[CURRENCY_KINGDOM_CREDITS] || 0),
      };
    }
  } catch {
    // ignore
  }

  const dailyOffers: SkinOfferItem[] = [];
  const rawOffers = storeData?.SkinsPanelLayout?.SingleItemStoreOffers || [];
  const remainingSeconds =
    Number(
      storeData?.SkinsPanelLayout?.SingleItemOffersRemainingDurationInSeconds || 43200
    ) || 43200;

  for (const offer of rawOffers) {
    const skinUuid = String(offer?.OfferID || offer?.Rewards?.[0]?.ItemID || '').toLowerCase();
    const skinMeta = skinLevels[skinUuid];
    const vpCost = Number(offer?.Cost?.[CURRENCY_VP] || 1775);
    const tierMeta = skinMeta?.contentTierUuid
      ? tiers[skinMeta.contentTierUuid.toLowerCase()]
      : undefined;

    if (skinMeta) {
      dailyOffers.push({
        uuid: skinUuid,
        displayName: skinMeta.displayName,
        displayIcon: skinMeta.displayIcon,
        vpCost,
        contentTierUuid: skinMeta.contentTierUuid,
        tierName: tierMeta?.displayName || 'Premium Edition',
        tierIcon: tierMeta?.displayIcon,
        highlightColor: tierMeta?.highlightColor,
      });
    }
  }

  const nightMarketOffers: SkinOfferItem[] = [];
  const bonusOffers = storeData?.BonusStore?.BonusStoreOffers || [];
  for (const bOffer of bonusOffers) {
    const offer = bOffer?.Offer;
    const skinUuid = String(offer?.OfferID || offer?.Rewards?.[0]?.ItemID || '').toLowerCase();
    const skinMeta = skinLevels[skinUuid];
    const baseVp = Number(offer?.Cost?.[CURRENCY_VP] || 1775);
    const discVp = Number(bOffer?.DiscountCosts?.[CURRENCY_VP] || baseVp);
    const discPct = Number(bOffer?.DiscountPercent || 0);
    const tierMeta = skinMeta?.contentTierUuid
      ? tiers[skinMeta.contentTierUuid.toLowerCase()]
      : undefined;

    if (skinMeta) {
      nightMarketOffers.push({
        uuid: skinUuid,
        displayName: skinMeta.displayName,
        displayIcon: skinMeta.displayIcon,
        vpCost: baseVp,
        discountedVpCost: discVp,
        discountPercent: discPct,
        contentTierUuid: skinMeta.contentTierUuid,
        tierName: tierMeta?.displayName || 'Premium Edition',
        tierIcon: tierMeta?.displayIcon,
        highlightColor: tierMeta?.highlightColor,
      });
    }
  }

  return {
    dailyOffers,
    nightMarketOffers,
    wallet,
    remainingSeconds,
    activeShard,
  };
}

let cachedMapUrlToName: Record<string, ValorantMapName> | null = null;

async function resolveMapNameFromMapUrl(mapUrl: string): Promise<ValorantMapName> {
  const lower = String(mapUrl || '').toLowerCase();
  const codenameFallbacks: Record<string, ValorantMapName> = {
    ascent: 'Ascent',
    duality: 'Bind',
    bonsai: 'Split',
    triad: 'Haven',
    port: 'Icebox',
    foxtrot: 'Breeze',
    canyon: 'Fracture',
    pitt: 'Pearl',
    jam: 'Lotus',
    juliett: 'Sunset',
    infinity: 'Abyss',
    corrode: 'Corrode',
    rook: 'Corrode',
  };

  for (const [code, name] of Object.entries(codenameFallbacks)) {
    if (lower.includes(code)) return name;
  }

  if (!cachedMapUrlToName) {
    cachedMapUrlToName = {};
    try {
      const res = await fetch(`${BASE_VALORANT_API}/maps`);
      if (res.ok) {
        const json: any = await res.json();
        for (const m of json?.data || []) {
          if (m?.mapUrl && m?.displayName) {
            cachedMapUrlToName[String(m.mapUrl).toLowerCase()] = m.displayName;
          }
        }
      }
    } catch {
      // ignore
    }
  }

  return cachedMapUrlToName[lower] || 'Ascent';
}

/**
 * Fetch Player Level, Rank, RR, Competitive Updates (+RR / -RR), AND Real Match History + Match Details
 * directly from Riot PD (`pd.{shard}.a.pvp.net`) when authenticated via Riot RSO Redirect URL.
 */
export async function fetchRiotPdTelemetry(auth: RiotAuthSession): Promise<{
  accountLevel: number;
  currentRank: string;
  peakRank: string;
  matches: MatchRecord[];
  competitiveUpdates: Array<{
    matchId: string;
    mapId: string;
    tierAfterUpdate: number;
    rrAfterUpdate: number;
    rrEarned: number;
    performanceBonus: number;
    matchStartTime: number;
  }>;
} | null> {
  try {
    const headers = await buildRiotPdHeaders(auth);
    const shard = auth.shard || getShard(auth.region);

    const [xpRes, mmrRes, compRes, historyRes] = await Promise.all([
      riotRequestJson(`https://pd.${shard}.a.pvp.net/account-xp/v1/players/${auth.puuid}`, {
        method: 'GET',
        headers,
        timeoutMs: 8000,
      }).catch(() => null),
      riotRequestJson(`https://pd.${shard}.a.pvp.net/mmr/v1/players/${auth.puuid}`, {
        method: 'GET',
        headers,
        timeoutMs: 8000,
      }).catch(() => null),
      riotRequestJson(
        `https://pd.${shard}.a.pvp.net/mmr/v1/players/${auth.puuid}/competitiveupdates?startIndex=0&endIndex=20&queue=competitive`,
        {
          method: 'GET',
          headers,
          timeoutMs: 8000,
        }
      ).catch(() => null),
      riotRequestJson(
        `https://pd.${shard}.a.pvp.net/match-history/v1/history/${auth.puuid}?startIndex=0&endIndex=12`,
        {
          method: 'GET',
          headers,
          timeoutMs: 8000,
        }
      ).catch(() => null),
    ]);

    const accountLevel = Number(xpRes?.data?.Progress?.Level || 0);
    const rawCompMatches: any[] = compRes?.data?.Matches || [];
    const competitiveUpdates = rawCompMatches.map((m: any) => ({
      matchId: String(m.MatchID || ''),
      mapId: String(m.MapID || ''),
      tierAfterUpdate: Number(m.TierAfterUpdate || 0),
      rrAfterUpdate: Number(m.RankedRatingAfterUpdate ?? 0),
      rrEarned: Number(m.RankedRatingEarned ?? 0),
      performanceBonus: Number(m.RankedRatingPerformanceBonus ?? 0),
      matchStartTime: Number(m.MatchStartTime || Date.now()),
    }));

    const compByMatchId = new Map(competitiveUpdates.map((u) => [u.matchId, u]));

    const latestComp =
      competitiveUpdates.find((u) => u.tierAfterUpdate > 0) ||
      (mmrRes?.data?.LatestCompetitiveUpdate
        ? {
            tierAfterUpdate: Number(mmrRes.data.LatestCompetitiveUpdate.TierAfterUpdate || 0),
            rrAfterUpdate: Number(
              mmrRes.data.LatestCompetitiveUpdate.RankedRatingAfterUpdate ?? 0
            ),
          }
        : null);

    const latestTierNum = latestComp?.tierAfterUpdate || 0;
    const latestRr = latestComp?.rrAfterUpdate ?? 0;
    const tierObj = ALL_TIERS.find((t) => t.tier === latestTierNum);
    const tierName =
      tierObj && latestTierNum > 0
        ? tierObj.name
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : 'Unranked';

    let maxTierNum = competitiveUpdates.reduce(
      (max, u) => Math.max(max, u.tierAfterUpdate),
      latestTierNum
    );
    const seasonalInfo = mmrRes?.data?.QueueSkills?.competitive?.SeasonalInfoBySeasonID || {};
    for (const s of Object.values(seasonalInfo) as any[]) {
      if (typeof s?.CompetitiveTier === 'number' && s.CompetitiveTier > maxTierNum) {
        maxTierNum = s.CompetitiveTier;
      }
    }

    const peakTierObj = ALL_TIERS.find((t) => t.tier === maxTierNum);
    const peakTierName =
      peakTierObj && maxTierNum > 0
        ? peakTierObj.name
            .toLowerCase()
            .replace(/\b\w/g, (c) => c.toUpperCase())
        : tierName;

    // Fetch real match details for the player's recent matches from Riot PD
    const historyList: any[] = historyRes?.data?.History || [];
    const matchIds = historyList
      .map((h) => String(h.MatchID || ''))
      .filter(Boolean)
      .slice(0, 10);

    const detailResponses = await Promise.all(
      matchIds.map((mid) =>
        riotRequestJson(`https://pd.${shard}.a.pvp.net/match-details/v1/matches/${mid}`, {
          method: 'GET',
          headers,
          timeoutMs: 10000,
        }).catch(() => null)
      )
    );

    const matches: MatchRecord[] = [];
    for (const dRes of detailResponses) {
      const detail = dRes?.data;
      if (!detail?.matchInfo || !Array.isArray(detail?.players)) continue;

      const me = detail.players.find(
        (p: any) => String(p.subject || '').toLowerCase() === auth.puuid.toLowerCase()
      );
      if (!me) continue;

      const matchId = String(detail.matchInfo.matchId || '');
      const mapName = await resolveMapNameFromMapUrl(detail.matchInfo.mapId || '');
      const agentItem = ALL_AGENTS.find(
        (a) => a.uuid.toLowerCase() === String(me.characterId || '').toLowerCase()
      );
      const agentName = (agentItem?.name || 'Jett') as ValorantAgentName;
      const agentRole = agentItem?.role || 'Duelist';

      const myTeamId = me.teamId || 'Blue';
      const teams: any[] = detail.teams || [];
      const myTeam = teams.find((t) => t.teamId === myTeamId);
      const enemyTeam = teams.find((t) => t.teamId !== myTeamId);

      const scoreFor = Number(myTeam?.roundsWon ?? 0);
      const scoreAgainst = Number(enemyTeam?.roundsWon ?? 0);
      const isWin = Boolean(myTeam?.won);
      const roundsPlayed = Math.max(
        1,
        Number(me.stats?.roundsPlayed || scoreFor + scoreAgainst || 1)
      );

      const kills = Number(me.stats?.kills ?? 0);
      const deaths = Number(me.stats?.deaths ?? 0);
      const assists = Number(me.stats?.assists ?? 0);
      const acs = Math.round(Number(me.stats?.score || 0) / roundsPlayed);

      // Compute exact damage (ADR), headshots (HS%), and opening duels (FB/FD) from roundResults
      let totalDamage = 0;
      let headshots = 0;
      let bodyshots = 0;
      let legshots = 0;
      let firstBloods = 0;
      let firstDeaths = 0;

      const roundResults: any[] = detail.roundResults || [];
      for (const r of roundResults) {
        const pStats: any[] = r.playerStats || [];
        const myRoundStat = pStats.find(
          (ps) => String(ps.subject || '').toLowerCase() === auth.puuid.toLowerCase()
        );
        if (myRoundStat && Array.isArray(myRoundStat.damage)) {
          for (const dmg of myRoundStat.damage) {
            totalDamage += Number(dmg.damage || 0);
            headshots += Number(dmg.headshots || 0);
            bodyshots += Number(dmg.bodyshots || 0);
            legshots += Number(dmg.legshots || 0);
          }
        }

        // Earliest kill in round
        let earliestKill: { killer: string; victim: string; time: number } | null = null;
        for (const ps of pStats) {
          for (const k of ps.kills || []) {
            const t = Number(k.roundTime ?? k.gameTime ?? 999999);
            if (!earliestKill || t < earliestKill.time) {
              earliestKill = {
                killer: String(k.killer || ''),
                victim: String(k.victim || ''),
                time: t,
              };
            }
          }
        }
        if (earliestKill) {
          if (earliestKill.killer.toLowerCase() === auth.puuid.toLowerCase()) firstBloods++;
          if (earliestKill.victim.toLowerCase() === auth.puuid.toLowerCase()) firstDeaths++;
        }
      }

      const adr = Math.round(totalDamage / roundsPlayed);
      const totalShots = headshots + bodyshots + legshots;
      const hsPercent =
        totalShots > 0 ? Number(((headshots / totalShots) * 100).toFixed(1)) : 0;

      const compUpdate = compByMatchId.get(matchId);
      const matchTierNum = Number(compUpdate?.tierAfterUpdate || me.competitiveTier || latestTierNum);
      const matchTierObj = ALL_TIERS.find((t) => t.tier === matchTierNum);
      const rankAtMatch =
        matchTierObj && matchTierNum > 0
          ? matchTierObj.name
              .toLowerCase()
              .replace(/\b\w/g, (c) => c.toUpperCase())
          : tierName;

      const rrChange = compUpdate ? compUpdate.rrEarned : 0;
      const performanceBonus = compUpdate ? compUpdate.performanceBonus : 0;
      const queueId = String(detail.matchInfo.queueID || 'competitive').toLowerCase();

      matches.push({
        id: matchId,
        map: mapName,
        agent: agentName,
        role: agentRole,
        result: scoreFor === scoreAgainst ? 'DRAW' : isWin ? 'WIN' : 'LOSS',
        scoreFor,
        scoreAgainst,
        kills,
        deaths,
        assists,
        acs,
        adr,
        hsPercent,
        firstBloods,
        firstDeaths,
        clutchesWon: 0,
        clutchesAttempted: 0,
        attackRoundsWon: Math.min(12, Math.ceil(scoreFor / 2)),
        attackRoundsPlayed: Math.min(12, roundsPlayed),
        defenseRoundsWon: Math.max(0, scoreFor - Math.min(12, Math.ceil(scoreFor / 2))),
        defenseRoundsPlayed: Math.max(0, roundsPlayed - 12),
        durationMinutes: Math.max(
          1,
          Math.round(Number(detail.matchInfo.gameLengthMillis || 1800000) / 60000)
        ),
        gameMode: queueId === 'premier' ? 'Premier' : 'Competitive',
        rankAtMatch,
        rrChange,
        performanceBonus,
        date: detail.matchInfo.gameStartMillis
          ? new Date(Number(detail.matchInfo.gameStartMillis)).toISOString()
          : new Date().toISOString(),
        source: 'RIOT_ID_LIVE_SYNC',
        riotId: auth.username,
        notes: `Official Riot PD Match (${queueId.toUpperCase()}) · ${rrChange >= 0 ? `+${rrChange}` : rrChange} RR`,
      });
    }

    return {
      accountLevel,
      currentRank: tierName === 'Unranked' ? 'Unranked' : `${tierName} (${latestRr} RR)`,
      peakRank: peakTierName,
      matches,
      competitiveUpdates,
    };
  } catch {
    return null;
  }
}

/**
 * Convert HenrikDev v3 matches + v1 lifetime matches + v1 MMR history into real MatchRecord[]
 */
export function buildMatchesFromHenrikData(
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
    if (h?.match_id) {
      mmrByMatchId.set(String(h.match_id), h);
    }
  }

  const results: MatchRecord[] = [];
  const seenIds = new Set<string>();

  // 1. Parse full v3 matches
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
    const teamObj = m.teams?.[teamKey] || {
      has_won: false,
      rounds_won: 0,
      rounds_lost: 0,
    };
    const scoreFor = Number(teamObj.rounds_won ?? 0);
    const scoreAgainst = Number(teamObj.rounds_lost ?? 0);
    const totalRounds = Math.max(1, scoreFor + scoreAgainst);

    const headshots = Number(me.stats?.headshots ?? 0);
    const bodyshots = Number(me.stats?.bodyshots ?? 0);
    const legshots = Number(me.stats?.legshots ?? 0);
    const shotsTotal = headshots + bodyshots + legshots;
    const hsPercent =
      shotsTotal > 0 ? Number(((headshots / shotsTotal) * 100).toFixed(1)) : 0;

    const acs = Math.round(Number(me.stats?.score || 0) / totalRounds);
    const adr = Math.round(Number(me.damage_made || 0) / totalRounds);
    const isWin = Boolean(teamObj.has_won);

    // Compute real First Bloods / First Deaths from m.kills if present
    let firstBloods = 0;
    let firstDeaths = 0;
    if (Array.isArray(m.kills) && m.kills.length > 0) {
      const firstKillByRound = new Map<number, any>();
      for (const k of m.kills) {
        const rNum = Number(k.round ?? 0);
        const existing = firstKillByRound.get(rNum);
        const t = Number(k.kill_time_in_round ?? 999999);
        if (!existing || t < Number(existing.kill_time_in_round ?? 999999)) {
          firstKillByRound.set(rNum, k);
        }
      }
      for (const fk of firstKillByRound.values()) {
        const killerMatch =
          (puuid && String(fk.killer_puuid || '').toLowerCase() === puuid.toLowerCase()) ||
          String(fk.killer_display_name || '').toLowerCase() === `${name}#${tag}`.toLowerCase();
        const victimMatch =
          (puuid && String(fk.victim_puuid || '').toLowerCase() === puuid.toLowerCase()) ||
          String(fk.victim_display_name || '').toLowerCase() === `${name}#${tag}`.toLowerCase();
        if (killerMatch) firstBloods++;
        if (victimMatch) firstDeaths++;
      }
    }

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

    const rankAtMatch =
      mmrEntry?.currenttierpatched || me.currenttier_patched || fallbackRank;

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
      firstBloods,
      firstDeaths,
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
      notes: `HenrikDev v3 Match (${rankAtMatch})${rrChange !== 0 ? ` · ${rrChange > 0 ? `+${rrChange}` : rrChange} RR` : ''}`,
    });
  }

  // 2. Parse v1/lifetime/matches for any additional real matches not in the 5-match v3 cache
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
    const enemyRounds = Number(
      lm.teams?.[myTeam === 'blue' ? 'red' : 'blue'] ?? 0
    );
    const totalRounds = Math.max(1, myRounds + enemyRounds);
    const isWin = myRounds > enemyRounds;

    const head = Number(stats.shots?.head ?? 0);
    const body = Number(stats.shots?.body ?? 0);
    const leg = Number(stats.shots?.leg ?? 0);
    const totalShots = head + body + leg;
    const hsPercent =
      totalShots > 0 ? Number(((head / totalShots) * 100).toFixed(1)) : 0;

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
      date: meta.started_at
        ? new Date(meta.started_at).toISOString()
        : new Date().toISOString(),
      source: 'RIOT_ID_LIVE_SYNC',
      riotId: `${name}#${tag}`,
      notes: `HenrikDev Lifetime Match (${meta.mode || 'Competitive'} · ${rankAtMatch})${rrChange !== 0 ? ` · ${rrChange > 0 ? `+${rrChange}` : rrChange} RR` : ''}`,
    });
  }

  return results;
}
