import React, { useState, useEffect } from 'react';
import {
  X,
  KeyRound,
  ExternalLink,
  Copy,
  Check,
  ShoppingBag,
  Sparkles,
  Wallet,
  Search,
  ShieldCheck,
  RefreshCw,
  Lock,
} from 'lucide-react';
import { useValocore } from '../context/ValocoreContext';

const RIOT_AUTH_URL =
  'https://auth.riotgames.com/authorize' +
  '?redirect_uri=https%3A%2F%2Fplayvalorant.com%2Fopt_in' +
  '&client_id=play-valorant-web-prod' +
  '&response_type=token%20id_token' +
  '&nonce=1&scope=account%20openid';

interface SkinOffer {
  uuid: string;
  displayName: string;
  displayIcon: string;
  vpCost: number;
  discountedVpCost?: number;
  discountPercent?: number;
  tierName?: string;
  tierIcon?: string;
}

export const RiotAuthStoreModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'auth' | 'store' | 'nightmarket' | 'skins';
}> = ({ isOpen, onClose, initialTab = 'auth' }) => {
  const { settings, authenticateRiotRedirectUrl } = useValocore();

  const [activeTab, setActiveTab] = useState<'auth' | 'store' | 'nightmarket' | 'skins'>(
    initialTab
  );
  const [redirectUrl, setRedirectUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [authSuccess, setAuthSuccess] = useState<{
    riotId: string;
    puuid: string;
    shard: string;
    accountLevel: number;
    currentRank: string;
  } | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const [storeState, setStoreState] = useState<{
    authenticated: boolean;
    riotId?: string;
    puuid?: string;
    shard?: string;
    expiresInMinutes?: number;
    dailyOffers: SkinOffer[];
    nightMarketOffers: SkinOffer[];
    wallet: { vp: number; radianite: number; kingdomCredits: number } | null;
    remainingSeconds: number;
  }>({
    authenticated: false,
    dailyOffers: [],
    nightMarketOffers: [],
    wallet: null,
    remainingSeconds: 0,
  });
  const [loadingStore, setLoadingStore] = useState(false);

  const [skinQuery, setSkinQuery] = useState('');
  const [skinResults, setSkinResults] = useState<SkinOffer[]>([]);
  const [searchingSkins, setSearchingSkins] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      fetchStoreData();
    }
  }, [isOpen, initialTab]);

  const fetchStoreData = async () => {
    setLoadingStore(true);
    try {
      const res = await fetch('/api/riot/store');
      if (res.ok) {
        const data = await res.json();
        setStoreState({
          authenticated: Boolean(data.authenticated),
          riotId: data.riotId,
          puuid: data.puuid,
          shard: data.shard || data.activeShard || 'ap',
          expiresInMinutes: data.expiresInMinutes,
          dailyOffers: data.dailyOffers || [],
          nightMarketOffers: data.nightMarketOffers || [],
          wallet: data.wallet || null,
          remainingSeconds: data.remainingSeconds || 0,
        });
      }
    } catch {
      // ignore
    } finally {
      setLoadingStore(false);
    }
  };

  const handleSearchSkins = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchingSkins(true);
    try {
      const res = await fetch(`/api/riot/skins/search?q=${encodeURIComponent(skinQuery)}`);
      if (res.ok) {
        const data = await res.json();
        setSkinResults(data.results || []);
      }
    } catch {
      // ignore
    } finally {
      setSearchingSkins(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'skins' && skinResults.length === 0) {
      handleSearchSkins();
    }
  }, [isOpen, activeTab]);

  if (!isOpen) return null;

  const handleCopyAuthUrl = () => {
    navigator.clipboard?.writeText(RIOT_AUTH_URL);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleSubmitRedirect = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    if (!redirectUrl.includes('access_token=')) {
      setAuthError(
        'Invalid Redirect URL. Please paste the full URL starting with https://playvalorant.com/opt_in#access_token=...'
      );
      return;
    }

    setIsSubmitting(true);
    const result = await authenticateRiotRedirectUrl(redirectUrl.trim());
    setIsSubmitting(false);

    if (!result.ok) {
      setAuthError(result.error || 'Authentication failed.');
      return;
    }

    setAuthSuccess({
      riotId: result.data.riotId,
      puuid: result.data.puuid,
      shard: result.data.shard,
      accountLevel: result.data.accountLevel,
      currentRank: result.data.currentRank,
    });
    setRedirectUrl('');
    fetchStoreData();
  };

  const hoursLeft = Math.floor((storeState.remainingSeconds || 0) / 3600);
  const minsLeft = Math.floor(((storeState.remainingSeconds || 0) % 3600) / 60);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="riot-rso-modal-title"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="w-full max-w-4xl rounded-2xl bg-[#13151B] border border-[#262832] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#0C0D11] border-b border-[#262832] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-[#FF4655]/15 border border-[#FF4655] flex items-center justify-center text-[#FF4655]">
              <KeyRound className="w-4 h-4" />
            </div>
            <div>
              <h2
                id="riot-rso-modal-title"
                className="text-base font-display font-bold text-[#F5F5F7]"
              >
                RIOT RSO AUTHENTICATION, LIVE STOREFRONT &amp; WALLET ({settings.riotId})
              </h2>
              <p className="text-xs text-[#9395A1] font-mono">
                Powered by Official Riot Auth (entitlements.auth.riotgames.com · pd.a.pvp.net ·
                TLSv1.3 Cipher Suite)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close Riot RSO modal"
            className="p-1.5 rounded-lg text-[#9395A1] hover:text-[#F5F5F7] hover:bg-[#191B23]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Sub-Tabs + Wallet Balance Bar */}
        <div className="px-6 py-3 bg-[#101116] border-b border-[#262832] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5">
            {(
              [
                { id: 'auth', label: 'Riot RSO Login', icon: KeyRound },
                { id: 'store', label: 'Daily Storefront', icon: ShoppingBag },
                { id: 'nightmarket', label: 'Night Market', icon: Sparkles },
                { id: 'skins', label: 'Official Skin Catalog', icon: Search },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? 'bg-[#FF4655] text-white'
                      : 'bg-[#090A0D] text-[#9395A1] hover:text-[#F5F5F7] border border-[#262832]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Live Wallet Balances (Only displayed when authenticated with Riot RSO) */}
          {storeState.authenticated && storeState.wallet ? (
            <div className="flex items-center gap-3 px-3 py-1.5 rounded-lg bg-[#090A0D] border border-[#262832] font-mono text-xs">
              <Wallet className="w-3.5 h-3.5 text-[#FF4655]" />
              <div>
                <span className="text-[#9395A1]">VP:</span>{' '}
                <strong className="text-[#F5F5F7]">{storeState.wallet.vp.toLocaleString()}</strong>
              </div>
              <span className="text-[#262832]">|</span>
              <div>
                <span className="text-[#9395A1]">RP:</span>{' '}
                <strong className="text-[#36D399]">{storeState.wallet.radianite}</strong>
              </div>
              <span className="text-[#262832]">|</span>
              <div>
                <span className="text-[#9395A1]">KC:</span>{' '}
                <strong className="text-[#F5B942]">
                  {storeState.wallet.kingdomCredits.toLocaleString()}
                </strong>
              </div>
            </div>
          ) : (
            <div className="text-[11px] font-mono text-[#9395A1]">
              Wallet: <span className="text-[#60636F]">Not Authenticated</span>
            </div>
          )}
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {activeTab === 'auth' && (
            <div className="space-y-5">
              {/* Status Banner */}
              <div className="p-4 rounded-xl bg-[#090A0D] border border-[#262832] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${
                        storeState.authenticated
                          ? 'bg-[#36D399]/15 text-[#36D399] border-[#36D399]/30'
                          : 'bg-[#F5B942]/15 text-[#F5B942] border-[#F5B942]/30'
                      }`}
                    >
                      <ShieldCheck className="w-3 h-3" />
                      {storeState.authenticated
                        ? `RSO SESSION ACTIVE (${storeState.expiresInMinutes}m left)`
                        : 'RIOT RSO NOT CONNECTED'}
                    </span>
                    {storeState.authenticated && (
                      <span className="text-xs font-mono text-[#9395A1]">
                        {storeState.riotId} · Shard: {(storeState.shard || 'ap').toUpperCase()} ·
                        LVL {settings.accountLevel} · {settings.currentRank}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#9395A1]">
                    Authenticate directly with Riot Games (`auth.riotgames.com`) using the exact
                    2-step Redirect URL flow from your Python `LoginView` &amp; `SubmitModal` to
                    fetch your real PUUID, real Match History (`pd.a.pvp.net`), real Rank/RR
                    updates, Daily Storefront, Night Market, and VP/RP/KC Wallet.
                  </p>
                </div>
              </div>

              {/* Step 1: Authenticate Link */}
              <div className="p-4 rounded-xl bg-[#191B23] border border-[#262832] space-y-3">
                <div className="text-xs font-mono font-bold text-[#F5F5F7] uppercase">
                  STEP 1 — OPEN RIOT GAMES AUTHORIZATION URL
                </div>
                <p className="text-xs text-[#9395A1]">
                  Click <strong>Authenticate on Riot Games</strong> below (or copy the URL into your
                  browser), sign in to your Riot account (e.g. <code>DarkNighT#slug</code>), and wait
                  until it redirects to <code>https://playvalorant.com/opt_in#access_token=...</code>
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <a
                    href={RIOT_AUTH_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Authenticate on Riot Games
                  </a>
                  <button
                    type="button"
                    onClick={handleCopyAuthUrl}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#090A0D] hover:bg-[#13151B] border border-[#262832] text-xs font-mono text-[#F5F5F7] cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#36D399]" />
                        Copied Auth Link
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#9395A1]" />
                        Copy Auth URL
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Step 2: Submit Redirect URL */}
              <form
                onSubmit={handleSubmitRedirect}
                className="p-4 rounded-xl bg-[#191B23] border border-[#262832] space-y-3"
              >
                <div className="text-xs font-mono font-bold text-[#F5F5F7] uppercase">
                  STEP 2 — PASTE REDIRECT URL (#access_token=...)
                </div>
                {authError && (
                  <div className="p-3 rounded-lg bg-[#FF4655]/15 border border-[#FF4655] text-xs text-[#FF4655]">
                    {authError}
                  </div>
                )}
                {authSuccess && (
                  <div className="p-3 rounded-lg bg-[#36D399]/15 border border-[#36D399] text-xs text-[#36D399] font-mono">
                    ✓ Authenticated {authSuccess.riotId} (PUUID: {authSuccess.puuid.slice(0, 12)}...
                    · Shard: {authSuccess.shard.toUpperCase()} · LVL {authSuccess.accountLevel} ·{' '}
                    {authSuccess.currentRank})
                  </div>
                )}
                <textarea
                  rows={3}
                  value={redirectUrl}
                  onChange={(e) => setRedirectUrl(e.target.value)}
                  placeholder="https://playvalorant.com/opt_in#access_token=eyJhbGciOiJSUzI1NiIs...&id_token=...&expires_in=3600"
                  className="w-full rounded-lg bg-[#090A0D] border border-[#262832] focus:border-[#FF4655] p-3 text-xs font-mono text-[#F5F5F7] outline-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-mono text-[#60636F]">
                    Exchanges access_token → entitlements_token → userinfo → PAS live shard → PD
                    Matches, Storefront &amp; MMR
                  </span>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isSubmitting ? 'animate-spin' : ''}`} />
                    {isSubmitting ? 'Verifying Riot Token...' : 'Submit Redirect URL'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === 'store' && (
            <div className="space-y-4">
              {!storeState.authenticated ? (
                <div className="p-8 rounded-xl bg-[#090A0D] border border-[#262832] text-center space-y-3">
                  <Lock className="w-8 h-8 text-[#FF4655] mx-auto" />
                  <h3 className="text-sm font-display font-bold text-[#F5F5F7]">
                    RIOT RSO AUTHENTICATION REQUIRED FOR LIVE STOREFRONT
                  </h3>
                  <p className="text-xs text-[#9395A1] max-w-md mx-auto">
                    Your personal Daily Storefront and VP/RP/KC Wallet are private to your Riot
                    account (`pd.a.pvp.net/store/v3/storefront`). Authenticate in the Riot RSO Login
                    tab to load your live offers.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('auth')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Go to Riot RSO Login
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-display font-bold text-[#F5F5F7]">
                        DAILY FEATURED WEAPON STOREFRONT ({storeState.dailyOffers.length} OFFERS)
                      </h3>
                      <p className="text-xs text-[#9395A1]">
                        Live Riot PD v3 Storefront for {storeState.riotId} (
                        {storeState.shard?.toUpperCase()})
                      </p>
                    </div>
                    <span className="px-2.5 py-1 rounded bg-[#090A0D] border border-[#262832] text-xs font-mono text-[#F5B942]">
                      Resets in {hoursLeft}h {minsLeft}m
                    </span>
                  </div>

                  {loadingStore ? (
                    <div className="py-12 text-center text-xs font-mono text-[#9395A1]">
                      Loading Valorant storefront offers...
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      {storeState.dailyOffers.map((item) => (
                        <div
                          key={item.uuid}
                          className="p-4 rounded-xl bg-[#090A0D] border border-[#262832] hover:border-[#FF4655]/60 transition-colors flex flex-col justify-between gap-3"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {item.tierIcon && (
                                <img
                                  src={item.tierIcon}
                                  alt={item.tierName || 'Tier'}
                                  referrerPolicy="no-referrer"
                                  className="w-5 h-5 object-contain"
                                />
                              )}
                              <span className="text-xs font-semibold text-[#F5F5F7]">
                                {item.displayName}
                              </span>
                            </div>
                            <span className="px-2 py-0.5 rounded bg-[#191B23] border border-[#262832] text-xs font-mono font-bold text-[#36D399]">
                              {item.vpCost.toLocaleString()} VP
                            </span>
                          </div>

                          {item.displayIcon && (
                            <img
                              src={item.displayIcon}
                              alt={item.displayName}
                              referrerPolicy="no-referrer"
                              className="h-20 object-contain mx-auto my-2 drop-shadow-lg"
                            />
                          )}

                          <div className="flex items-center justify-between text-[11px] font-mono text-[#9395A1] pt-2 border-t border-[#262832]">
                            <span>{item.tierName || 'Premium Edition'}</span>
                            <span>UUID: {item.uuid.slice(0, 8)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {activeTab === 'nightmarket' && (
            <div className="space-y-4">
              {!storeState.authenticated ? (
                <div className="p-8 rounded-xl bg-[#090A0D] border border-[#262832] text-center space-y-3">
                  <Lock className="w-8 h-8 text-[#FF4655] mx-auto" />
                  <h3 className="text-sm font-display font-bold text-[#F5F5F7]">
                    RIOT RSO AUTHENTICATION REQUIRED FOR NIGHT MARKET
                  </h3>
                  <p className="text-xs text-[#9395A1] max-w-md mx-auto">
                    Authenticate in the Riot RSO Login tab to inspect your live Riot PD{' '}
                    <code>BonusStore.BonusStoreOffers</code>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('auth')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white cursor-pointer"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    Go to Riot RSO Login
                  </button>
                </div>
              ) : storeState.nightMarketOffers.length === 0 ? (
                <div className="p-8 rounded-xl bg-[#090A0D] border border-[#262832] text-center text-xs text-[#9395A1]">
                  Night Market (`BonusStore`) is not currently active on Riot servers for this Act
                  window.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {storeState.nightMarketOffers.map((item) => (
                    <div
                      key={item.uuid}
                      className="p-4 rounded-xl bg-[#090A0D] border border-[#262832] flex flex-col justify-between gap-3 relative overflow-hidden"
                    >
                      {item.discountPercent && (
                        <span className="self-start px-2 py-0.5 rounded bg-[#FF4655]/20 border border-[#FF4655] text-[11px] font-mono font-bold text-[#FF4655]">
                          -{item.discountPercent}% BONUS
                        </span>
                      )}

                      {item.displayIcon && (
                        <img
                          src={item.displayIcon}
                          alt={item.displayName}
                          referrerPolicy="no-referrer"
                          className="h-16 object-contain mx-auto my-1"
                        />
                      )}

                      <div>
                        <div className="text-xs font-semibold text-[#F5F5F7] truncate">
                          {item.displayName}
                        </div>
                        <div className="flex items-center justify-between mt-1.5 font-mono text-xs">
                          <span className="text-[#60636F] line-through">{item.vpCost} VP</span>
                          <span className="font-bold text-[#36D399]">
                            {(item.discountedVpCost || item.vpCost).toLocaleString()} VP
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'skins' && (
            <div className="space-y-4">
              <form onSubmit={handleSearchSkins} className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-[#60636F] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={skinQuery}
                    onChange={(e) => setSkinQuery(e.target.value)}
                    placeholder="Search any official Valorant skin from valorant-api.com (e.g. Kuronami, Prelude to Chaos, Reaver)..."
                    className="w-full rounded-lg bg-[#090A0D] border border-[#262832] pl-9 pr-3 py-2 text-xs text-[#F5F5F7] outline-none focus:border-[#FF4655]"
                  />
                </div>
                <button
                  type="submit"
                  disabled={searchingSkins}
                  className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white cursor-pointer"
                >
                  {searchingSkins ? 'Searching...' : 'Search Skins'}
                </button>
              </form>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {skinResults.map((s) => (
                  <div
                    key={s.uuid}
                    className="p-3.5 rounded-xl bg-[#090A0D] border border-[#262832] flex flex-col justify-between gap-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-[#F5F5F7] truncate">
                        {s.displayName}
                      </span>
                      <span className="text-[11px] font-mono text-[#36D399] shrink-0">
                        {s.vpCost} VP
                      </span>
                    </div>
                    {s.displayIcon && (
                      <img
                        src={s.displayIcon}
                        alt={s.displayName}
                        referrerPolicy="no-referrer"
                        className="h-12 object-contain mx-auto my-1"
                      />
                    )}
                    <div className="flex items-center justify-between text-[10px] font-mono text-[#9395A1] pt-1 border-t border-[#262832]">
                      <span className="inline-flex items-center gap-1">
                        {s.tierIcon && (
                          <img
                            src={s.tierIcon}
                            alt=""
                            referrerPolicy="no-referrer"
                            className="w-3.5 h-3.5 object-contain"
                          />
                        )}
                        {s.tierName}
                      </span>
                      <span>{s.uuid.slice(0, 8)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
