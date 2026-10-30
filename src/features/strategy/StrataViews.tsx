import React, { useState } from 'react';
import {
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Save,
  Trash2,
  Sparkles,
  Plus,
} from 'lucide-react';
import { useValocore } from '../../context/ValocoreContext';
import {
  MAP_METADATA,
  ALL_AGENTS,
  ALL_MAPS,
  getAgentCatalogItem,
} from '../../utils/seedData';
import {
  MarkerType,
  StrategyMarker,
  StrategyRecord,
  ValorantAgentName,
  ValorantMapName,
} from '../../types/valocore';

const TOOLS: { id: MarkerType; label: string; color: string }[] = [
  { id: 'player', label: 'Attack Position', color: '#36D399' },
  { id: 'defense', label: 'Defense Anchor', color: '#38BDF8' },
  { id: 'smoke', label: 'Smoke Sphere', color: '#9333EA' },
  { id: 'flash', label: 'Flash Curve', color: '#F5B942' },
  { id: 'molly', label: 'Molly / Incendiary', color: '#FF4655' },
  { id: 'recon', label: 'Recon / Scan', color: '#22D3EE' },
  { id: 'arrow', label: 'Execute Path Arrow', color: '#FF4655' },
  { id: 'text', label: 'Tactical Label', color: '#F5F5F7' },
];

export const StrataViews: React.FC<{
  subView: 'strategy-planner' | 'map-library' | 'agent-lineups';
}> = ({ subView }) => {
  const { strategies, lineups, saveStrategy, deleteStrategy, addLineup } =
    useValocore();

  const [selectedStrategyId, setSelectedStrategyId] = useState<string>(
    strategies[0]?.id || ''
  );
  const currentStrategy =
    strategies.find((s) => s.id === selectedStrategyId) || strategies[0];

  const [map, setMap] = useState<ValorantMapName>(currentStrategy?.map || 'Ascent');
  const [agent, setAgent] = useState<ValorantAgentName>(
    currentStrategy?.agent || 'Omen'
  );
  const [side, setSide] = useState<'Attack' | 'Defense'>(
    currentStrategy?.side || 'Attack'
  );
  const [site, setSite] = useState<'A Site' | 'B Site' | 'C Site' | 'Mid'>(
    currentStrategy?.site || 'A Site'
  );
  const [stratName, setStratName] = useState(
    currentStrategy?.name || 'A Site Split Execute'
  );
  const [stratDesc, setStratDesc] = useState(
    currentStrategy?.description ||
      'Coordinated two-lane execute with heaven and door smokes.'
  );
  const [markers, setMarkers] = useState<StrategyMarker[]>(
    currentStrategy?.markers || []
  );
  const [history, setHistory] = useState<StrategyMarker[][]>([]);
  const [redoStack, setRedoStack] = useState<StrategyMarker[][]>([]);
  const [activeTool, setActiveTool] = useState<MarkerType>('smoke');
  const [customLabel, setCustomLabel] = useState('One-Way Smoke');
  const [zoom, setZoom] = useState(1);

  // AI Strategy Assistant state
  const [aiPrompt, setAiPrompt] = useState('');
  const [generatingAi, setGeneratingAi] = useState(false);

  // Map library selection
  const [libraryMap, setLibraryMap] = useState<ValorantMapName>('Ascent');

  // Lineup filter state
  const [lineupMapFilter, setLineupMapFilter] = useState<string>('ALL');
  const [lineupAgentFilter, setLineupAgentFilter] = useState<string>('ALL');
  const [selectedLineupId, setSelectedLineupId] = useState<string>(
    lineups[0]?.id || ''
  );

  // New Lineup form
  const [lnTitle, setLnTitle] = useState('');
  const [lnMap, setLnMap] = useState<ValorantMapName>('Ascent');
  const [lnAgent, setLnAgent] = useState<ValorantAgentName>('Sova');
  const [lnAbility, setLnAbility] = useState('Shock Bolt');
  const [lnStand, setLnStand] = useState('');
  const [lnAim, setLnAim] = useState('');

  const loadStrategyIntoEditor = (st: StrategyRecord) => {
    setSelectedStrategyId(st.id);
    setMap(st.map);
    setAgent(st.agent);
    setSide(st.side);
    setSite(st.site);
    setStratName(st.name);
    setStratDesc(st.description);
    setMarkers(st.markers);
    setHistory([]);
    setRedoStack([]);
  };

  const handleCanvasClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Number((((e.clientX - rect.left) / rect.width) * 100).toFixed(1));
    const y = Number((((e.clientY - rect.top) / rect.height) * 100).toFixed(1));

    const toolObj = TOOLS.find((t) => t.id === activeTool) || TOOLS[0];
    const newMarker: StrategyMarker = {
      id: `mk-${Date.now()}`,
      type: activeTool,
      x,
      y,
      endX: activeTool === 'arrow' ? Math.min(92, x + 12) : undefined,
      endY: activeTool === 'arrow' ? Math.max(12, y - 14) : undefined,
      color: toolObj.color,
      label:
        activeTool === 'text'
          ? customLabel || 'Callout'
          : `${toolObj.label.split(' ')[0]}`,
      radius: activeTool === 'smoke' || activeTool === 'molly' ? 5 : 3,
    };

    setHistory((prev) => [...prev, markers]);
    setRedoStack([]);
    setMarkers((prev) => [...prev, newMarker]);
  };

  const handleUndo = () => {
    if (history.length === 0) return;
    const prev = history[history.length - 1];
    setRedoStack((r) => [markers, ...r]);
    setMarkers(prev);
    setHistory((h) => h.slice(0, -1));
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const next = redoStack[0];
    setHistory((h) => [...h, markers]);
    setMarkers(next);
    setRedoStack((r) => r.slice(1));
  };

  const handleSaveCurrentStrategy = () => {
    const agentMeta = getAgentCatalogItem(agent);
    const defaultAbilities =
      agentMeta?.abilities.slice(0, 3).map((a) => a.name) || [
        'Primary Signature',
        'Vision Denial',
      ];

    const record: StrategyRecord = {
      id: selectedStrategyId || `st-${Date.now()}`,
      name: stratName.trim() || `${map} ${site} ${side}`,
      description: stratDesc.trim(),
      map,
      agent,
      side,
      site,
      requiredAbilities: currentStrategy?.requiredAbilities || defaultAbilities,
      markers,
      steps: currentStrategy?.steps || [
        {
          order: 1,
          timing: '1:15',
          ability: defaultAbilities[0] || 'Setup & Pre-Aim',
          action: `Stage outside ${site} and clear early info utility.`,
        },
        {
          order: 2,
          timing: '1:05',
          ability: defaultAbilities[1] || 'Execute Utility',
          action: `Deploy smokes and flashes on ${site} anchor positions.`,
        },
      ],
      personalNotes: currentStrategy?.personalNotes || 'Saved via Strata Canvas.',
      updatedAt: new Date().toISOString(),
    };
    saveStrategy(record);
    setSelectedStrategyId(record.id);
  };

  const handleAskAiStrategy = async (promptText: string) => {
    const q = promptText.trim();
    if (!q || generatingAi) return;
    setGeneratingAi(true);
    try {
      const res = await fetch('/api/ai/strategy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: q, map, agent, side, site }),
      });
      const data = await res.json();
      if (data.name) {
        const newSt: StrategyRecord = {
          id: `st-ai-${Date.now()}`,
          name: data.name,
          description: data.description,
          map,
          agent,
          side,
          site,
          requiredAbilities: data.requiredAbilities || ['Smoke', 'Flash'],
          markers: data.markers || markers,
          steps: data.steps || [],
          personalNotes: `Generated by AI Strategy Assistant: "${q}"`,
          updatedAt: new Date().toISOString(),
        };
        saveStrategy(newSt);
        loadStrategyIntoEditor(newSt);
        setAiPrompt('');
      }
    } finally {
      setGeneratingAi(false);
    }
  };

  const activeMapGeo = MAP_METADATA[map] || MAP_METADATA.Ascent;

  if (subView === 'strategy-planner') {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Hierarchy Sidebar: Map -> Agent -> Side -> Site -> Strategy */}
          <div className="lg:col-span-3 rounded-xl bg-[#13151B] border border-[#262832] p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-display font-bold text-[#F5F5F7] uppercase">
                  STRATA HIERARCHY
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    const freshId = `st-${Date.now()}`;
                    setSelectedStrategyId(freshId);
                    setStratName(`New ${map} ${site} Playbook`);
                    setMarkers([]);
                  }}
                  className="text-xs text-[#FF4655] hover:underline inline-flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> New Play
                </button>
              </div>

              <div className="space-y-2 max-h-[380px] overflow-y-auto">
                {strategies.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => loadStrategyIntoEditor(st)}
                    className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                      st.id === selectedStrategyId
                        ? 'bg-[#191B23] border-[#FF4655]'
                        : 'bg-[#090A0D] border-[#262832] hover:bg-[#191B23]/60'
                    }`}
                  >
                    <div className="text-[10px] font-mono text-[#9395A1]">
                      {st.map} → {st.agent} → {st.side} → {st.site}
                    </div>
                    <div className="text-xs font-semibold text-[#F5F5F7] mt-0.5">
                      {st.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Strategy Assistant Box */}
            <div className="pt-4 border-t border-[#262832] space-y-2.5">
              <div className="text-xs font-display font-bold text-[#F5F5F7] flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#FF4655]" />
                AI STRATEGY ASSISTANT
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  'Create a Waylay + Tejo execute on Corrode A.',
                  'Suggest a Vyse defensive setup on Abyss B.',
                  'How should we retake Summit A Site?',
                ].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => handleAskAiStrategy(preset)}
                    className="text-left text-[11px] px-2 py-1 rounded bg-[#090A0D] hover:bg-[#191B23] border border-[#262832] text-[#9395A1] hover:text-[#F5F5F7]"
                  >
                    {preset}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskAiStrategy(aiPrompt);
                }}
                className="flex gap-1.5"
              >
                <input
                  type="text"
                  aria-label="Ask AI Strategy Assistant"
                  value={aiPrompt}
                  onChange={(e) => setAiPrompt(e.target.value)}
                  placeholder="Custom tactical request..."
                  className="flex-1 bg-[#090A0D] border border-[#262832] rounded-lg px-2.5 py-1.5 text-xs text-[#F5F5F7]"
                />
                <button
                  type="submit"
                  disabled={generatingAi}
                  className="px-3 py-1.5 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white"
                >
                  {generatingAi ? '...' : 'Draft'}
                </button>
              </form>
            </div>
          </div>

          {/* Center Interactive Tactical Map Canvas with Official Valorant Radar Image */}
          <div className="lg:col-span-6 rounded-xl bg-[#13151B] border border-[#262832] p-4 flex flex-col justify-between space-y-3">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#262832]">
              <div className="flex items-center gap-1 overflow-x-auto">
                {TOOLS.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setActiveTool(t.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-medium border transition-colors whitespace-nowrap shrink-0 ${
                      activeTool === t.id
                        ? 'bg-[#FF4655] border-[#FF4655] text-white'
                        : 'bg-[#090A0D] border-[#262832] text-[#9395A1] hover:text-[#F5F5F7]'
                    }`}
                  >
                    {t.label.split(' ')[0]}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={handleUndo}
                  aria-label="Undo marker"
                  className="p-1.5 rounded bg-[#090A0D] border border-[#262832] text-[#9395A1] hover:text-[#F5F5F7]"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  aria-label="Redo marker"
                  className="p-1.5 rounded bg-[#090A0D] border border-[#262832] text-[#9395A1] hover:text-[#F5F5F7]"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(1))))
                  }
                  aria-label="Zoom In"
                  className="p-1.5 rounded bg-[#090A0D] border border-[#262832] text-[#9395A1] hover:text-[#F5F5F7]"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setZoom((z) => Math.max(0.8, Number((z - 0.1).toFixed(1))))
                  }
                  aria-label="Zoom Out"
                  className="p-1.5 rounded bg-[#090A0D] border border-[#262832] text-[#9395A1] hover:text-[#F5F5F7]"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Interactive SVG Map Board with Official Valorant Radar Minimap */}
            <div className="relative rounded-xl bg-[#090A0D] border border-[#262832] overflow-hidden flex items-center justify-center h-[420px]">
              <svg
                data-testid="strata-tactical-canvas"
                viewBox="0 0 100 100"
                onClick={handleCanvasClick}
                style={{
                  transform: `scale(${zoom})`,
                  transition: 'transform 150ms ease',
                }}
                className="w-full h-full max-w-[420px] max-h-[420px] cursor-crosshair select-none"
              >
                {/* Official Valorant Top-Down Radar Minimap Image */}
                {activeMapGeo.displayIcon ? (
                  <image
                    href={activeMapGeo.displayIcon}
                    x="2"
                    y="2"
                    width="96"
                    height="96"
                    preserveAspectRatio="xMidYMid meet"
                    opacity="0.88"
                  />
                ) : (
                  <path
                    d={activeMapGeo.svgPaths.outline}
                    fill="#101116"
                    stroke="#262832"
                    strokeWidth="0.8"
                  />
                )}

                {/* Bomb Site Zones */}
                {activeMapGeo.svgPaths.siteBoxes.map((sb) => (
                  <g key={sb.label}>
                    <rect
                      x={sb.x}
                      y={sb.y}
                      width={sb.w}
                      height={sb.h}
                      rx="1.5"
                      fill="rgba(255, 70, 85, 0.14)"
                      stroke="#FF4655"
                      strokeWidth="0.5"
                    />
                    <text
                      x={sb.x + sb.w / 2}
                      y={sb.y + sb.h / 2 + 1.5}
                      textAnchor="middle"
                      fill="#FF4655"
                      fontSize="4.2"
                      fontWeight="bold"
                      fontFamily="Space Grotesk, sans-serif"
                    >
                      {sb.label}
                    </text>
                  </g>
                ))}

                {/* User & Strategy Markers */}
                {markers.map((mk) => {
                  if (
                    mk.type === 'arrow' &&
                    mk.endX !== undefined &&
                    mk.endY !== undefined
                  ) {
                    return (
                      <g key={mk.id}>
                        <line
                          x1={mk.x}
                          y1={mk.y}
                          x2={mk.endX}
                          y2={mk.endY}
                          stroke={mk.color}
                          strokeWidth="1.2"
                          strokeDasharray="2 1"
                        />
                        <circle cx={mk.endX} cy={mk.endY} r="1.8" fill={mk.color} />
                        {mk.label && (
                          <text
                            x={mk.endX}
                            y={mk.endY - 2.5}
                            textAnchor="middle"
                            fill="#F5F5F7"
                            fontSize="2.4"
                            fontFamily="JetBrains Mono, monospace"
                          >
                            {mk.label}
                          </text>
                        )}
                      </g>
                    );
                  }
                  return (
                    <g key={mk.id}>
                      <circle
                        cx={mk.x}
                        cy={mk.y}
                        r={mk.radius || 3.5}
                        fill={`${mk.color}44`}
                        stroke={mk.color}
                        strokeWidth="0.9"
                      />
                      <text
                        x={mk.x}
                        y={mk.y - (mk.radius || 3.5) - 1.2}
                        textAnchor="middle"
                        fill="#F5F5F7"
                        fontSize="2.3"
                        fontFamily="JetBrains Mono, monospace"
                      >
                        {mk.label}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <div className="flex items-center justify-between text-xs text-[#9395A1]">
              <span>
                Click anywhere on the official <strong className="text-[#F5F5F7]">{map}</strong>{' '}
                radar to place a <strong className="text-[#FF4655]">{activeTool.toUpperCase()}</strong>{' '}
                marker
              </span>
              <span className="font-mono">{markers.length} Active Markers</span>
            </div>
          </div>

          {/* Right Strategy Details & Execution Steps */}
          <div className="lg:col-span-3 rounded-xl bg-[#13151B] border border-[#262832] p-4 flex flex-col justify-between space-y-4">
            <div className="space-y-3 text-xs">
              <h2 className="text-xs font-display font-bold text-[#F5F5F7] uppercase">
                STRATEGY CONFIGURATION
              </h2>

              <div>
                <label className="block text-[#9395A1] mb-1">Strategy Title</label>
                <input
                  type="text"
                  aria-label="Strategy Title"
                  value={stratName}
                  onChange={(e) => setStratName(e.target.value)}
                  className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-[#F5F5F7]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#9395A1] mb-1">
                    Map ({ALL_MAPS.length})
                  </label>
                  <select
                    aria-label="Strategy Map"
                    value={map}
                    onChange={(e) => setMap(e.target.value as ValorantMapName)}
                    className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-2 py-1.5 text-[#F5F5F7]"
                  >
                    {ALL_MAPS.map((m) => (
                      <option key={m.uuid} value={m.name}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#9395A1] mb-1">
                    Agent ({ALL_AGENTS.length})
                  </label>
                  <select
                    aria-label="Strategy Agent"
                    value={agent}
                    onChange={(e) => setAgent(e.target.value as ValorantAgentName)}
                    className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-2 py-1.5 text-[#F5F5F7]"
                  >
                    {ALL_AGENTS.map((a) => (
                      <option key={a.uuid} value={a.name}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#9395A1] mb-1">Side</label>
                  <select
                    value={side}
                    onChange={(e) => setSide(e.target.value as any)}
                    className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-2 py-1.5 text-[#F5F5F7]"
                  >
                    <option value="Attack">Attack</option>
                    <option value="Defense">Defense</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#9395A1] mb-1">Target Site</label>
                  <select
                    value={site}
                    onChange={(e) => setSite(e.target.value as any)}
                    className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-2 py-1.5 text-[#F5F5F7]"
                  >
                    <option value="A Site">A Site</option>
                    <option value="B Site">B Site</option>
                    <option value="C Site">C Site</option>
                    <option value="Mid">Mid</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#9395A1] mb-1">Custom Marker Label</label>
                <input
                  type="text"
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-2.5 py-1.5 text-[#F5F5F7]"
                />
              </div>

              <div>
                <div className="text-[11px] font-mono text-[#9395A1] mb-1.5">
                  EXECUTION TIMING STEPS
                </div>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {(currentStrategy?.steps || []).map((st) => (
                    <div
                      key={st.order}
                      className="p-2 rounded bg-[#090A0D] border border-[#262832]"
                    >
                      <div className="font-mono text-[10px] text-[#FF4655]">
                        Step {st.order} · {st.timing} · {st.ability}
                      </div>
                      <div className="text-[11px] text-[#F5F5F7] mt-0.5">{st.action}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-3 border-t border-[#262832]">
              <button
                type="button"
                onClick={handleSaveCurrentStrategy}
                className="flex-1 inline-flex items-center justify-center gap-1.5 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white"
              >
                <Save className="w-3.5 h-3.5" />
                Save Strategy
              </button>
              {selectedStrategyId && strategies.length > 1 && (
                <button
                  type="button"
                  onClick={() => deleteStrategy(selectedStrategyId)}
                  aria-label="Delete current strategy"
                  className="p-2 rounded-lg border border-[#262832] text-[#9395A1] hover:text-[#FF4655]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (subView === 'map-library') {
    const info = MAP_METADATA[libraryMap] || MAP_METADATA.Ascent;
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-2">
          {ALL_MAPS.map((m) => (
            <button
              key={m.uuid}
              type="button"
              onClick={() => setLibraryMap(m.name)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                libraryMap === m.name
                  ? 'bg-[#FF4655] border-[#FF4655] text-white'
                  : 'bg-[#13151B] border-[#262832] text-[#9395A1] hover:text-[#F5F5F7]'
              }`}
            >
              {m.name}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 rounded-xl bg-[#13151B] border border-[#262832] p-6 flex flex-col items-center justify-center gap-4">
            <svg viewBox="0 0 100 100" className="w-full max-w-[440px] h-auto">
              {info.displayIcon ? (
                <image
                  href={info.displayIcon}
                  x="2"
                  y="2"
                  width="96"
                  height="96"
                  preserveAspectRatio="xMidYMid meet"
                  opacity="0.92"
                />
              ) : (
                <path
                  d={info.svgPaths.outline}
                  fill="#090A0D"
                  stroke="#262832"
                  strokeWidth="0.9"
                />
              )}
              {info.callouts.slice(0, 18).map((c) => (
                <g key={c.name}>
                  <circle
                    cx={c.x}
                    cy={c.y}
                    r="1.1"
                    fill={
                      c.type === 'site'
                        ? '#FF4655'
                        : c.type === 'spawn'
                        ? '#36D399'
                        : '#F5B942'
                    }
                  />
                  <text
                    x={c.x}
                    y={c.y - 1.6}
                    textAnchor="middle"
                    fill="#F5F5F7"
                    fontSize="2.1"
                    fontFamily="JetBrains Mono, monospace"
                  >
                    {c.name}
                  </text>
                </g>
              ))}
            </svg>
          </div>

          <div className="lg:col-span-5 rounded-xl bg-[#13151B] border border-[#262832] overflow-hidden flex flex-col">
            {info.splash && (
              <div className="relative h-36 bg-[#090A0D]">
                <img
                  src={info.splash}
                  alt={info.name}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover opacity-65"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#13151B] to-transparent" />
              </div>
            )}
            <div className="p-6 space-y-4">
              <div>
                <div className="text-xs font-mono text-[#9395A1]">
                  {info.coordinates} · {info.region}
                </div>
                <h2 className="text-2xl font-display font-bold text-[#F5F5F7] mt-1">
                  {info.name} Official Tactical Blueprint
                </h2>
                <p className="text-xs text-[#9395A1] mt-2 leading-relaxed">
                  {info.tacticalSummary}
                </p>
              </div>

              <div className="pt-3 border-t border-[#262832]">
                <div className="text-xs font-mono text-[#9395A1] mb-2">
                  OFFICIAL IN-GAME CALLOUT REGIONS ({info.callouts.length})
                </div>
                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1">
                  {info.callouts.map((c) => (
                    <div
                      key={c.name}
                      className="p-2 rounded-lg bg-[#090A0D] border border-[#262832] text-xs flex items-center justify-between"
                    >
                      <span className="font-medium text-[#F5F5F7] truncate">{c.name}</span>
                      <span className="font-mono text-[10px] text-[#60636F] shrink-0">
                        {c.x},{c.y}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Agent Lineups View across all 13 Maps and 30 Agents
  const filteredLineups = lineups.filter((l) => {
    if (lineupMapFilter !== 'ALL' && l.map !== lineupMapFilter) return false;
    if (lineupAgentFilter !== 'ALL' && l.agent !== lineupAgentFilter) return false;
    return true;
  });
  const activeLineup =
    filteredLineups.find((l) => l.id === selectedLineupId) || filteredLineups[0];

  const handleCreateLineup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!lnTitle.trim()) return;
    const rec = {
      id: `ln-${Date.now()}`,
      title: lnTitle.trim(),
      map: lnMap,
      agent: lnAgent,
      side: 'Attack' as const,
      site: 'A Site' as const,
      ability: lnAbility,
      difficulty: 'Medium' as const,
      standPosition: lnStand.trim() || 'Main Lobby Corner',
      aimReference: lnAim.trim() || 'Align HUD bar with roof corner',
      landPosition: 'Default Plant Zone',
      jumpThrow: false,
      description: `Custom ${lnAgent} lineup on ${lnMap} recorded in VALOCORE.`,
      standX: 76,
      standY: 54,
      landX: 73,
      landY: 24,
    };
    addLineup(rec);
    setSelectedLineupId(rec.id);
    setLnTitle('');
    setLnStand('');
    setLnAim('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <div className="lg:col-span-7 space-y-4">
        <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <select
              aria-label="Filter lineups by map"
              value={lineupMapFilter}
              onChange={(e) => setLineupMapFilter(e.target.value)}
              className="bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F7]"
            >
              <option value="ALL">All 13 Maps</option>
              {ALL_MAPS.map((m) => (
                <option key={m.uuid} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter lineups by agent"
              value={lineupAgentFilter}
              onChange={(e) => setLineupAgentFilter(e.target.value)}
              className="bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F7]"
            >
              <option value="ALL">All 30 Agents</option>
              {ALL_AGENTS.map((a) => (
                <option key={a.uuid} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <span className="text-xs font-mono text-[#9395A1]">
            {filteredLineups.length} Verified Lineups
          </span>
        </div>

        <div className="space-y-3">
          {filteredLineups.map((ln) => (
            <div
              key={ln.id}
              onClick={() => setSelectedLineupId(ln.id)}
              className={`p-4 rounded-xl border cursor-pointer transition-colors ${
                activeLineup?.id === ln.id
                  ? 'bg-[#191B23] border-[#FF4655]'
                  : 'bg-[#13151B] border-[#262832] hover:bg-[#191B23]/60'
              }`}
            >
              <div className="flex items-center justify-between text-xs font-mono text-[#9395A1]">
                <span>
                  {ln.map} · {ln.agent} · {ln.ability}
                </span>
                <span className="text-[#36D399]">{ln.difficulty}</span>
              </div>
              <h3 className="text-sm font-display font-bold text-[#F5F5F7] mt-1">
                {ln.title}
              </h3>
              <p className="text-xs text-[#9395A1] mt-1">{ln.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Right Lineup Trajectory Inspector & Add Form */}
      <div className="lg:col-span-5 space-y-4">
        {activeLineup && (
          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-5 space-y-3">
            <div className="text-xs font-mono text-[#FF4655]">
              LINEUP EXECUTION BLUEPRINT
            </div>
            <h2 className="text-base font-display font-bold text-[#F5F5F7]">
              {activeLineup.title}
            </h2>
            <div className="space-y-2 text-xs">
              <div className="p-3 rounded-lg bg-[#090A0D] border border-[#262832]">
                <div className="font-mono text-[10px] text-[#9395A1]">
                  1. STAND POSITION
                </div>
                <div className="text-[#F5F5F7] mt-0.5">{activeLineup.standPosition}</div>
              </div>
              <div className="p-3 rounded-lg bg-[#090A0D] border border-[#262832]">
                <div className="font-mono text-[10px] text-[#9395A1]">
                  2. CROSSHAIR / HUD ALIGNMENT
                </div>
                <div className="text-[#F5F5F7] mt-0.5">{activeLineup.aimReference}</div>
              </div>
              <div className="p-3 rounded-lg bg-[#090A0D] border border-[#262832]">
                <div className="font-mono text-[10px] text-[#9395A1]">
                  3. LANDING IMPACT ZONE
                </div>
                <div className="text-[#36D399] mt-0.5">{activeLineup.landPosition}</div>
              </div>
            </div>
          </div>
        )}

        <form
          onSubmit={handleCreateLineup}
          className="rounded-xl bg-[#13151B] border border-[#262832] p-5 space-y-3 text-xs"
        >
          <h3 className="text-xs font-display font-bold text-[#F5F5F7] uppercase">
            Add Custom Agent Lineup
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <select
              value={lnMap}
              onChange={(e) => setLnMap(e.target.value as ValorantMapName)}
              className="bg-[#090A0D] border border-[#262832] rounded-lg px-2.5 py-1.5 text-[#F5F5F7]"
            >
              {ALL_MAPS.map((m) => (
                <option key={m.uuid} value={m.name}>
                  {m.name}
                </option>
              ))}
            </select>
            <select
              value={lnAgent}
              onChange={(e) => setLnAgent(e.target.value as ValorantAgentName)}
              className="bg-[#090A0D] border border-[#262832] rounded-lg px-2.5 py-1.5 text-[#F5F5F7]"
            >
              {ALL_AGENTS.map((a) => (
                <option key={a.uuid} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <input
            type="text"
            value={lnTitle}
            onChange={(e) => setLnTitle(e.target.value)}
            placeholder="Lineup title (e.g. Corrode B Main Guided Salvo)"
            className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-[#F5F5F7]"
          />
          <input
            type="text"
            value={lnAbility}
            onChange={(e) => setLnAbility(e.target.value)}
            placeholder="Ability name"
            className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-[#F5F5F7]"
          />
          <input
            type="text"
            value={lnStand}
            onChange={(e) => setLnStand(e.target.value)}
            placeholder="Stand position landmark..."
            className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-[#F5F5F7]"
          />
          <input
            type="text"
            value={lnAim}
            onChange={(e) => setLnAim(e.target.value)}
            placeholder="Aim reference landmark..."
            className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-[#F5F5F7]"
          />
          <button
            type="submit"
            className="w-full py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] font-semibold text-white"
          >
            Save Lineup
          </button>
        </form>
      </div>
    </div>
  );
};
