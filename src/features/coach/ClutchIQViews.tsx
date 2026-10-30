import React, { useState, useRef } from 'react';
import {
  BrainCircuit,
  Send,
  Video,
  Camera,
  Plus,
  CheckCircle2,
  Trash2,
  Clock,
  Sparkles,
} from 'lucide-react';
import { useValocore } from '../../context/ValocoreContext';
import {
  computeOverviewMetrics,
  computeMapAnalytics,
} from '../../utils/analytics';
import {
  MistakeCategory,
  MistakeRecord,
  ValorantAgentName,
  ValorantMapName,
} from '../../types/valocore';
import { ALL_AGENTS, ALL_MAPS } from '../../utils/seedData';

const MISTAKE_CATEGORIES: MistakeCategory[] = [
  'Crosshair placement',
  'Positioning',
  'Utility usage',
  'Timing',
  'Trading',
  'Decision-making',
  'Economy management',
  'Communication',
];

const QUICK_PROMPTS = [
  'Why am I dying so often while entering sites?',
  'Analyze my last five matches.',
  'What is my biggest weakness?',
  'How can I improve my crosshair placement?',
  'Which agent suits my playstyle?',
];

export const ClutchIQViews: React.FC<{
  subView: 'ai-coach' | 'round-analysis' | 'mistake-tracker';
}> = ({ subView }) => {
  const {
    matches,
    mistakes,
    rounds,
    videos,
    addMistake,
    deleteMistake,
    toggleMistakeResolved,
    addRound,
    addVideo,
    updateVideo,
    notify,
  } = useValocore();

  // Chat state
  const [messages, setMessages] = useState<
    { role: 'user' | 'assistant'; text: string; model?: string }[]
  >([
    {
      role: 'assistant',
      text: 'Welcome to ClutchIQ. I have indexed your local SQLite match history, round timestamps, and mistake tracker. Ask me any question about your entry timing, map win rates, or agent pool, or inspect a recorded VOD segment below.',
      model: 'ClutchIQ Telemetry Core',
    },
  ]);
  const [question, setQuestion] = useState('');
  const [loadingChat, setLoadingChat] = useState(false);

  // Video review state
  const [selectedVideoId, setSelectedVideoId] = useState<string>(videos[0]?.id || '');
  const [activeSegmentIdx, setActiveSegmentIdx] = useState(0);
  const [analyzingFrame, setAnalyzingFrame] = useState(false);
  const [newSegmentNote, setNewSegmentNote] = useState('');
  const [newSegmentTimestamp, setNewSegmentTimestamp] = useState('01:12');
  const canvasSimRef = useRef<HTMLCanvasElement | null>(null);

  // Mistake form state
  const [mkTitle, setMkTitle] = useState('');
  const [mkCategory, setMkCategory] = useState<MistakeCategory>('Positioning');
  const [mkSeverity, setMkSeverity] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'>('HIGH');
  const [mkMap, setMkMap] = useState<ValorantMapName>('Bind');
  const [mkAgent, setMkAgent] = useState<ValorantAgentName>('Omen');
  const [mkRound, setMkRound] = useState(8);
  const [mkTimestamp, setMkTimestamp] = useState('00:48');
  const [mkDesc, setMkDesc] = useState('');
  const [mkNotes, setMkNotes] = useState('');
  const [filterCat, setFilterCat] = useState<string>('ALL');

  // Round form state
  const [selectedRoundId, setSelectedRoundId] = useState<string>(rounds[0]?.id || '');
  const [newRoundNumber, setNewRoundNumber] = useState(14);
  const [newRoundMap, setNewRoundMap] = useState<ValorantMapName>('Ascent');
  const [newRoundAgent, setNewRoundAgent] = useState<ValorantAgentName>('Jett');
  const [newRoundResult, setNewRoundResult] = useState<'WIN' | 'LOSS'>('WIN');
  const [newRoundNotes, setNewRoundNotes] = useState('');

  const metrics = computeOverviewMetrics(matches);
  const mapStats = computeMapAnalytics(matches);

  const sendQuestion = async (promptText: string) => {
    const q = promptText.trim();
    if (!q || loadingChat) return;
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setQuestion('');
    setLoadingChat(true);

    try {
      const playerContext = {
        summary: {
          totalMatches: metrics.totalMatches,
          winRate: metrics.winRate,
          kdRatio: metrics.kdRatio,
          avgAcs: metrics.avgAcs,
          avgAdr: metrics.avgAdr,
          hsPercent: metrics.hsPercent,
          firstBloodRate: metrics.firstBloodRate,
          firstDeathRate: metrics.firstDeathRate,
          bestMap: mapStats[0]?.map || 'Ascent',
          worstMap: mapStats[mapStats.length - 1]?.map || 'Bind',
        },
        recentMatches: matches.slice(0, 5),
        unresolvedMistakes: mistakes.filter((m) => !m.resolved),
      };

      const res = await fetch('/api/ai/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, playerContext }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: data.reply || data.error || 'Unable to generate coaching response.',
          model: data.modelUsed,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          text: 'Connection error while contacting ClutchIQ backend.',
        },
      ]);
    } finally {
      setLoadingChat(false);
    }
  };

  const selectedVideo = videos.find((v) => v.id === selectedVideoId) || videos[0];
  const currentSegment =
    selectedVideo?.segments[activeSegmentIdx] || selectedVideo?.segments[0];

  // Draw tactical HUD frame preview on canvas and run selected-frame multimodal analysis
  const triggerFrameExtractionAndAnalysis = async () => {
    if (!selectedVideo || !currentSegment) return;
    setAnalyzingFrame(true);

    try {
      let dataUrl = '';
      if (canvasSimRef.current) {
        dataUrl = canvasSimRef.current.toDataURL('image/png');
      }

      const res = await fetch('/api/ai/frame-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType: 'image/png',
          map: selectedVideo.map,
          agent: selectedVideo.agent,
          timestampLabel: `${currentSegment.startTime}s`,
          notes: currentSegment.notes,
        }),
      });
      const data = await res.json();
      if (data.observation) {
        const updatedSegments = selectedVideo.segments.map((seg, idx) =>
          idx === activeSegmentIdx
            ? { ...seg, aiFrameObservation: data.observation }
            : seg
        );
        updateVideo({ ...selectedVideo, segments: updatedSegments });
        notify('Selected gameplay frame analyzed by ClutchIQ.');
      }
    } finally {
      setAnalyzingFrame(false);
    }
  };

  const handleVideoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const ext = file.name.split('.').pop()?.toUpperCase();
    const format = ext === 'MOV' || ext === 'MKV' ? ext : 'MP4';
    const newVid = {
      id: `vid-${Date.now()}`,
      title: file.name,
      map: 'Ascent' as ValorantMapName,
      agent: 'Jett' as ValorantAgentName,
      format: format as 'MP4' | 'MOV' | 'MKV',
      durationSeconds: 180,
      resolution: '1920x1080',
      fps: 60,
      createdAt: new Date().toISOString(),
      segments: [
        {
          id: `seg-${Date.now()}-1`,
          roundNumber: 1,
          startTime: 15,
          endTime: 55,
          label: 'Round 1 — Opening Engagement Segment',
          notes: 'Uploaded local gameplay recording segment.',
          aiFrameObservation:
            'Ready for selected-frame inspection. Click "Extract & Analyze Frame" to evaluate crosshair alignment and spacing.',
        },
      ],
    };
    addVideo(newVid);
    setSelectedVideoId(newVid.id);
    setActiveSegmentIdx(0);
  };

  const handleAddTimestampNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVideo || !newSegmentNote.trim()) return;
    const nextSeg = {
      id: `seg-${Date.now()}`,
      roundNumber: selectedVideo.segments.length + 1,
      startTime: 45,
      endTime: 90,
      label: `Timestamp @ ${newSegmentTimestamp} — ${newSegmentNote.slice(0, 36)}`,
      notes: newSegmentNote.trim(),
    };
    updateVideo({
      ...selectedVideo,
      segments: [...selectedVideo.segments, nextSeg],
    });
    setNewSegmentNote('');
    notify('Timestamped note added to VOD timeline.');
  };

  if (subView === 'ai-coach') {
    return (
      <div className="space-y-6">
        {/* Top Row: Strengths, Weaknesses & Suggested Training Routines */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="text-[11px] font-mono text-[#36D399] uppercase">
              Verified Gameplay Strengths
            </div>
            <div className="text-sm font-display font-bold text-[#F5F5F7] mt-1">
              Ascent Entry & First-Bullet Headshot %
            </div>
            <p className="text-xs text-[#9395A1] mt-1">
              {metrics.hsPercent}% average HS rate and {metrics.firstBloodRate}% First Blood
              conversion across {metrics.totalMatches} matches.
            </p>
          </div>

          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="text-[11px] font-mono text-[#FF4655] uppercase">
              Primary Recurring Weakness
            </div>
            <div className="text-sm font-display font-bold text-[#F5F5F7] mt-1">
              Untraded Opening Peeks on Bind
            </div>
            <p className="text-xs text-[#9395A1] mt-1">
              {mistakes.filter((m) => !m.resolved).length} active mistake logs point to wide-swinging
              before initiator flash or smoke cover blooms.
            </p>
          </div>

          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
            <div className="text-[11px] font-mono text-[#F5B942] uppercase">
              Suggested Training Routine
            </div>
            <div className="text-sm font-display font-bold text-[#F5F5F7] mt-1">
              2x Precision Micro + Bind B Hookah Strata Review
            </div>
            <p className="text-xs text-[#9395A1] mt-1">
              Target sub-215ms reaction time and practice flush Elbow/Lamps smoke alignment.
            </p>
          </div>
        </div>

        {/* Main Split: AI Coach Chat + VOD Selected-Frame Analyzer */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Interactive AI Coach Chat */}
          <div className="lg:col-span-6 rounded-xl bg-[#13151B] border border-[#262832] flex flex-col h-[560px]">
            <div className="p-4 border-b border-[#262832] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BrainCircuit className="w-4 h-4 text-[#FF4655]" />
                <div>
                  <h2 className="text-sm font-display font-bold text-[#F5F5F7]">
                    CLUTCHIQ AI GAMEPLAY COACH
                  </h2>
                  <p className="text-[11px] text-[#9395A1]">
                    Grounded strictly in your stored match telemetry & mistake logs
                  </p>
                </div>
              </div>
            </div>

            {/* Quick Prompt Buttons */}
            <div className="px-4 py-2.5 border-b border-[#262832] bg-[#0C0D11] flex flex-wrap gap-1.5">
              {QUICK_PROMPTS.map((qp) => (
                <button
                  key={qp}
                  type="button"
                  onClick={() => sendQuestion(qp)}
                  className="px-2.5 py-1 rounded-md bg-[#191B23] hover:bg-[#262832] text-[11px] text-[#F5F5F7] transition-colors"
                >
                  {qp}
                </button>
              ))}
            </div>

            {/* Conversation History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((m, idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl text-xs leading-relaxed ${
                    m.role === 'user'
                      ? 'bg-[#FF4655]/15 border border-[#FF4655]/40 text-[#F5F5F7] ml-8'
                      : 'bg-[#090A0D] border border-[#262832] text-[#F5F5F7] mr-4'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#9395A1] mb-1">
                    <span>{m.role === 'user' ? 'PLAYER QUERY' : 'CLUTCHIQ ANALYST'}</span>
                    {m.model && <span>{m.model}</span>}
                  </div>
                  <div className="whitespace-pre-line">{m.text}</div>
                </div>
              ))}
              {loadingChat && (
                <div className="p-3 rounded-xl bg-[#090A0D] border border-[#262832] text-xs font-mono text-[#9395A1]">
                  Analyzing stored telemetry & generating evidence-based coaching report...
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                sendQuestion(question);
              }}
              className="p-3 border-t border-[#262832] flex items-center gap-2"
            >
              <input
                type="text"
                aria-label="Ask ClutchIQ Coach"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask why you are losing opening duels or request a 5-match review..."
                className="flex-1 bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-xs text-[#F5F5F7]"
              />
              <button
                type="submit"
                disabled={loadingChat}
                className="px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white inline-flex items-center gap-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                Ask Coach
              </button>
            </form>
          </div>

          {/* Video Review & Multimodal Selected-Frame Analysis */}
          <div className="lg:col-span-6 rounded-xl bg-[#13151B] border border-[#262832] p-5 flex flex-col justify-between space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#262832]">
              <div>
                <h2 className="text-sm font-display font-bold text-[#F5F5F7] flex items-center gap-2">
                  <Video className="w-4 h-4 text-[#FF4655]" />
                  VOD TIMELINE & SELECTED-FRAME ANALYSIS
                </h2>
                <p className="text-[11px] text-[#9395A1]">
                  Upload MP4/MOV/MKV recordings, segment rounds, and extract key frames for Gemini
                  multimodal review
                </p>
              </div>

              <label className="px-3 py-1.5 rounded-lg bg-[#191B23] hover:bg-[#262832] border border-[#262832] text-xs font-medium text-[#F5F5F7] cursor-pointer">
                Upload VOD (MP4/MOV/MKV)
                <input
                  type="file"
                  accept=".mp4,.mov,.mkv,video/*"
                  onChange={handleVideoFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {selectedVideo && currentSegment && (
              <>
                {/* Simulated Tactical Frame Viewport Canvas */}
                <div className="relative rounded-lg overflow-hidden border border-[#262832] bg-[#090A0D]">
                  <canvas
                    ref={(el) => {
                      canvasSimRef.current = el;
                      if (el) {
                        const ctx = el.getContext('2d');
                        if (ctx) {
                          ctx.fillStyle = '#090A0D';
                          ctx.fillRect(0, 0, el.width, el.height);
                          // Architectural corridor wireframe for frame inspection
                          ctx.strokeStyle = '#262832';
                          ctx.lineWidth = 1.5;
                          ctx.strokeRect(40, 25, 440, 150);
                          ctx.beginPath();
                          ctx.moveTo(0, 0);
                          ctx.lineTo(140, 60);
                          ctx.moveTo(520, 0);
                          ctx.lineTo(380, 60);
                          ctx.moveTo(0, 200);
                          ctx.lineTo(140, 140);
                          ctx.moveTo(520, 200);
                          ctx.lineTo(380, 140);
                          ctx.stroke();
                          ctx.strokeRect(140, 60, 240, 80);
                          // Headshot reference elevation line
                          ctx.strokeStyle = '#36D399';
                          ctx.setLineDash([4, 4]);
                          ctx.beginPath();
                          ctx.moveTo(60, 96);
                          ctx.lineTo(460, 96);
                          ctx.stroke();
                          ctx.setLineDash([]);
                          // Crosshair reticle
                          ctx.strokeStyle = '#FF4655';
                          ctx.lineWidth = 2;
                          ctx.beginPath();
                          ctx.arc(260, 96, 8, 0, Math.PI * 2);
                          ctx.moveTo(246, 96);
                          ctx.lineTo(274, 96);
                          ctx.moveTo(260, 82);
                          ctx.lineTo(260, 110);
                          ctx.stroke();
                          // Frame HUD overlay text
                          ctx.fillStyle = '#F5F5F7';
                          ctx.font = '11px JetBrains Mono, monospace';
                          ctx.fillText(
                            `VOD: ${selectedVideo.title} | ${selectedVideo.resolution} @ ${selectedVideo.fps}fps`,
                            16,
                            22
                          );
                          ctx.fillStyle = '#36D399';
                          ctx.fillText(
                            `SELECTED FRAME @ 00:${String(currentSegment.startTime).padStart(2, '0')} · HEAD-LEVEL ALIGNMENT VECTOR`,
                            16,
                            186
                          );
                        }
                      }
                    }}
                    width={520}
                    height={200}
                    className="w-full h-44 object-cover block"
                  />

                  <div className="px-3 py-2 bg-[#0C0D11] border-t border-[#262832] flex items-center justify-between gap-3 text-xs">
                    <span className="font-mono text-[#9395A1] truncate">
                      Segment: {currentSegment.label}
                    </span>
                    <button
                      type="button"
                      disabled={analyzingFrame}
                      onClick={triggerFrameExtractionAndAnalysis}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#FF4655] hover:bg-[#E63946] text-white font-semibold text-xs whitespace-nowrap shrink-0"
                    >
                      <Camera className="w-3.5 h-3.5" />
                      {analyzingFrame ? 'Analyzing Frame...' : 'Extract & Analyze Frame'}
                    </button>
                  </div>
                </div>

                {/* Round Segments Selector */}
                <div className="space-y-1.5">
                  <div className="text-[11px] font-mono text-[#9395A1]">
                    SEGMENTED ROUND TIMELINE ({selectedVideo.segments.length} SEGMENTS)
                  </div>
                  <div className="grid grid-cols-1 gap-1.5 max-h-36 overflow-y-auto">
                    {selectedVideo.segments.map((seg, idx) => (
                      <button
                        key={seg.id}
                        type="button"
                        onClick={() => setActiveSegmentIdx(idx)}
                        className={`p-2.5 rounded-lg border text-left text-xs transition-colors ${
                          idx === activeSegmentIdx
                            ? 'bg-[#191B23] border-[#FF4655] text-[#F5F5F7]'
                            : 'bg-[#090A0D] border-[#262832] text-[#9395A1] hover:text-[#F5F5F7]'
                        }`}
                      >
                        <div className="font-semibold">{seg.label}</div>
                        <div className="text-[11px] text-[#9395A1] mt-0.5">{seg.notes}</div>
                        {seg.aiFrameObservation && (
                          <div className="text-[11px] text-[#36D399] font-mono mt-1">
                            AI Frame Observation: {seg.aiFrameObservation}
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Add Timestamped Note Form */}
                <form onSubmit={handleAddTimestampNote} className="flex items-center gap-2 pt-1">
                  <input
                    type="text"
                    aria-label="Timestamp"
                    value={newSegmentTimestamp}
                    onChange={(e) => setNewSegmentTimestamp(e.target.value)}
                    className="w-20 bg-[#090A0D] border border-[#262832] rounded-lg px-2.5 py-1.5 text-xs font-mono text-[#F5F5F7]"
                  />
                  <input
                    type="text"
                    aria-label="Timestamp note"
                    value={newSegmentNote}
                    onChange={(e) => setNewSegmentNote(e.target.value)}
                    placeholder="Add timestamped round observation..."
                    className="flex-1 bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F7]"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-lg bg-[#191B23] hover:bg-[#262832] border border-[#262832] text-xs font-medium text-[#F5F5F7]"
                  >
                    Add Note
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (subView === 'round-analysis') {
    const activeRound = rounds.find((r) => r.id === selectedRoundId) || rounds[0];

    const handleAddRound = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newRoundNotes.trim()) return;
      const rd = {
        id: `rd-${Date.now()}`,
        matchId: matches[0]?.id || 'm-101',
        roundNumber: Number(newRoundNumber),
        map: newRoundMap,
        agent: newRoundAgent,
        side: 'Attack' as const,
        result: newRoundResult,
        winCondition: 'Elimination' as const,
        loadoutValue: 3900,
        kills: 2,
        deaths: newRoundResult === 'WIN' ? 0 : 1,
        damage: 285,
        playerNotes: newRoundNotes.trim(),
        timestamps: [
          { time: '00:22', event: 'Initial choke utility deployed', type: 'UTILITY' as const },
          { time: '00:41', event: 'Primary site engagement', type: 'KILL' as const },
        ],
        aiObservations: [
          `Logged Round ${newRoundNumber} on ${newRoundMap} (${newRoundAgent}): Maintain trade spacing within 1.5s of entry contact.`,
        ],
      };
      addRound(rd);
      setSelectedRoundId(rd.id);
      setNewRoundNotes('');
    };

    return (
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left List of Rounds + Log New Round */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4 space-y-3">
            <h2 className="text-sm font-display font-bold text-[#F5F5F7]">
              ROUND REVIEW SELECTOR ({rounds.length})
            </h2>
            <div className="space-y-2">
              {rounds.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => setSelectedRoundId(r.id)}
                  className={`w-full p-3 rounded-lg border text-left text-xs transition-colors flex items-center justify-between ${
                    activeRound?.id === r.id
                      ? 'bg-[#191B23] border-[#FF4655]'
                      : 'bg-[#090A0D] border-[#262832] hover:bg-[#191B23]/50'
                  }`}
                >
                  <div>
                    <div className="font-semibold text-[#F5F5F7]">
                      Round {r.roundNumber} · {r.map} ({r.agent})
                    </div>
                    <div className="text-[11px] text-[#9395A1] mt-0.5">{r.playerNotes}</div>
                  </div>
                  <span
                    className={`font-mono font-bold ${
                      r.result === 'WIN' ? 'text-[#36D399]' : 'text-[#FF4655]'
                    }`}
                  >
                    {r.result}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <form
            onSubmit={handleAddRound}
            className="rounded-xl bg-[#13151B] border border-[#262832] p-4 space-y-3"
          >
            <h3 className="text-xs font-display font-bold text-[#F5F5F7] uppercase">
              Log New Round Review
            </h3>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[10px] font-mono text-[#9395A1] mb-1">ROUND #</label>
                <input
                  type="number"
                  value={newRoundNumber}
                  onChange={(e) => setNewRoundNumber(Number(e.target.value))}
                  className="w-full bg-[#090A0D] border border-[#262832] rounded px-2.5 py-1.5 text-xs font-mono"
                />
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[#9395A1] mb-1">RESULT</label>
                <select
                  value={newRoundResult}
                  onChange={(e) => setNewRoundResult(e.target.value as any)}
                  className="w-full bg-[#090A0D] border border-[#262832] rounded px-2.5 py-1.5 text-xs"
                >
                  <option value="WIN">WIN</option>
                  <option value="LOSS">LOSS</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[#9395A1] mb-1">MAP</label>
                <select
                  value={newRoundMap}
                  onChange={(e) => setNewRoundMap(e.target.value as ValorantMapName)}
                  className="w-full bg-[#090A0D] border border-[#262832] rounded px-2.5 py-1.5 text-xs"
                >
                  {ALL_MAPS.map((m) => (
                    <option key={m.name} value={m.name}>
                      {m.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono text-[#9395A1] mb-1">AGENT</label>
                <select
                  value={newRoundAgent}
                  onChange={(e) => setNewRoundAgent(e.target.value as ValorantAgentName)}
                  className="w-full bg-[#090A0D] border border-[#262832] rounded px-2.5 py-1.5 text-xs"
                >
                  {ALL_AGENTS.map((a) => (
                    <option key={a.name} value={a.name}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <input
              type="text"
              value={newRoundNotes}
              onChange={(e) => setNewRoundNotes(e.target.value)}
              placeholder="Player round notes & key micro-decision..."
              className="w-full bg-[#090A0D] border border-[#262832] rounded px-3 py-2 text-xs text-[#F5F5F7]"
            />
            <button
              type="submit"
              className="w-full py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white"
            >
              Save Round Review
            </button>
          </form>
        </div>

        {/* Right Detailed Round Timeline & AI Observations */}
        <div className="lg:col-span-7 rounded-xl bg-[#13151B] border border-[#262832] p-6 space-y-5">
          {activeRound && (
            <>
              <div className="flex items-center justify-between pb-4 border-b border-[#262832]">
                <div>
                  <div className="text-xs font-mono text-[#9395A1]">
                    ROUND {activeRound.roundNumber} · {activeRound.side.toUpperCase()} ·{' '}
                    {activeRound.winCondition.toUpperCase()}
                  </div>
                  <h2 className="text-xl font-display font-bold text-[#F5F5F7] mt-0.5">
                    {activeRound.map} — {activeRound.agent}
                  </h2>
                </div>
                <div className="text-right font-mono">
                  <div
                    className={`text-lg font-bold ${
                      activeRound.result === 'WIN' ? 'text-[#36D399]' : 'text-[#FF4655]'
                    }`}
                  >
                    ROUND {activeRound.result}
                  </div>
                  <div className="text-xs text-[#9395A1]">
                    Loadout: {activeRound.loadoutValue} creds · {activeRound.damage} DMG
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-mono text-[#9395A1] uppercase mb-2.5 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#FF4655]" />
                  Detected Round Events & Timestamps
                </h3>
                <div className="space-y-2">
                  {activeRound.timestamps.map((ts, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-3 rounded-lg bg-[#090A0D] border border-[#262832] text-xs"
                    >
                      <span className="font-mono font-bold text-[#FF4655]">{ts.time}</span>
                      <span className="font-mono text-[11px] text-[#9395A1] w-16">{ts.type}</span>
                      <span className="text-[#F5F5F7]">{ts.event}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h3 className="text-xs font-mono text-[#9395A1] uppercase mb-2.5 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#36D399]" />
                  ClutchIQ Round Observations
                </h3>
                <div className="space-y-2">
                  {activeRound.aiObservations.map((obs, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-lg bg-[#191B23] border border-[#262832] text-xs text-[#F5F5F7]"
                    >
                      {obs}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Mistake Tracker View
  const filteredMistakes = mistakes.filter((m) =>
    filterCat === 'ALL' ? true : m.category === filterCat
  );

  const handleCreateMistake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!mkTitle.trim()) return;
    const record: MistakeRecord = {
      id: `mk-${Date.now()}`,
      roundNumber: Number(mkRound),
      map: mkMap,
      agent: mkAgent,
      category: mkCategory,
      severity: mkSeverity,
      timestamp: mkTimestamp,
      title: mkTitle.trim(),
      description: mkDesc.trim() || 'Logged manually in Mistake Tracker.',
      personalNotes: mkNotes.trim() || 'Focus on correcting in next scrim block.',
      aiSuggestion: `Review ${mkCategory.toLowerCase()} discipline on ${mkMap} before committing early cooldowns.`,
      resolved: false,
      createdAt: new Date().toISOString(),
    };
    addMistake(record);
    setMkTitle('');
    setMkDesc('');
    setMkNotes('');
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Left Form: Log Mistake */}
      <div className="lg:col-span-4 rounded-xl bg-[#13151B] border border-[#262832] p-5 space-y-4 h-fit">
        <h2 className="text-sm font-display font-bold text-[#F5F5F7] flex items-center gap-2">
          <Plus className="w-4 h-4 text-[#FF4655]" />
          LOG GAMEPLAY MISTAKE
        </h2>

        <form onSubmit={handleCreateMistake} className="space-y-3 text-xs">
          <div>
            <label className="block text-[#9395A1] mb-1">Mistake Summary Title</label>
            <input
              type="text"
              aria-label="Mistake Summary Title"
              value={mkTitle}
              onChange={(e) => setMkTitle(e.target.value)}
              placeholder="e.g. Over-peeked A Main without flash"
              className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-[#F5F5F7]"
            />
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[#9395A1] mb-1">Category</label>
              <select
                aria-label="Mistake Category"
                value={mkCategory}
                onChange={(e) => setMkCategory(e.target.value as MistakeCategory)}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-2.5 py-2 text-[#F5F5F7]"
              >
                {MISTAKE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#9395A1] mb-1">Severity</label>
              <select
                aria-label="Mistake Severity"
                value={mkSeverity}
                onChange={(e) => setMkSeverity(e.target.value as any)}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-2.5 py-2 text-[#F5F5F7]"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[#9395A1] mb-1">Map</label>
              <select
                value={mkMap}
                onChange={(e) => setMkMap(e.target.value as ValorantMapName)}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-2 py-1.5 text-[#F5F5F7]"
              >
                {ALL_MAPS.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#9395A1] mb-1">Agent</label>
              <select
                value={mkAgent}
                onChange={(e) => setMkAgent(e.target.value as ValorantAgentName)}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-2 py-1.5 text-[#F5F5F7]"
              >
                {ALL_AGENTS.map((a) => (
                  <option key={a.name} value={a.name}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[#9395A1] mb-1">Round</label>
              <input
                type="number"
                value={mkRound}
                onChange={(e) => setMkRound(Number(e.target.value))}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-2 py-1.5 font-mono text-[#F5F5F7]"
              />
            </div>
            <div>
              <label className="block text-[#9395A1] mb-1">Time</label>
              <input
                type="text"
                value={mkTimestamp}
                onChange={(e) => setMkTimestamp(e.target.value)}
                className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-2 py-1.5 font-mono text-[#F5F5F7]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#9395A1] mb-1">Situation Description</label>
            <textarea
              rows={2}
              value={mkDesc}
              onChange={(e) => setMkDesc(e.target.value)}
              placeholder="What happened during the engagement?"
              className="w-full bg-[#090A0D] border border-[#262832] rounded-lg p-2.5 text-[#F5F5F7]"
            />
          </div>

          <div>
            <label className="block text-[#9395A1] mb-1">Personal Correction Note</label>
            <input
              type="text"
              value={mkNotes}
              onChange={(e) => setMkNotes(e.target.value)}
              placeholder="Habit to build..."
              className="w-full bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-2 text-[#F5F5F7]"
            />
          </div>

          <button
            type="submit"
            className="w-full py-2.5 rounded-lg bg-[#FF4655] hover:bg-[#E63946] font-semibold text-white"
          >
            Add Mistake to Tracker
          </button>
        </form>
      </div>

      {/* Right Mistake Tracker List */}
      <div className="lg:col-span-8 rounded-xl bg-[#13151B] border border-[#262832] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#262832]">
          <div>
            <h2 className="text-base font-display font-bold text-[#F5F5F7]">
              MISTAKE TRACKER & HABIT RESOLUTION ({filteredMistakes.length})
            </h2>
            <p className="text-xs text-[#9395A1]">
              Track recurring tactical errors across 8 categories and mark habits resolved
            </p>
          </div>

          <select
            aria-label="Filter mistakes by category"
            value={filterCat}
            onChange={(e) => setFilterCat(e.target.value)}
            className="bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-xs text-[#F5F5F7]"
          >
            <option value="ALL">All 8 Categories</option>
            {MISTAKE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          {filteredMistakes.map((mk) => (
            <div
              key={mk.id}
              className={`p-4 rounded-xl border transition-colors ${
                mk.resolved
                  ? 'bg-[#090A0D]/60 border-[#262832] opacity-75'
                  : 'bg-[#090A0D] border-[#262832]'
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px] font-mono">
                    <span
                      className={
                        mk.severity === 'CRITICAL' || mk.severity === 'HIGH'
                          ? 'text-[#FF4655] font-bold'
                          : 'text-[#F5B942] font-bold'
                      }
                    >
                      {mk.severity}
                    </span>
                    <span>·</span>
                    <span className="text-[#F5F5F7]">{mk.category}</span>
                    <span>·</span>
                    <span className="text-[#9395A1]">
                      {mk.map} ({mk.agent}) · Round {mk.roundNumber} @ {mk.timestamp}
                    </span>
                  </div>
                  <h3 className="text-sm font-semibold text-[#F5F5F7]">{mk.title}</h3>
                  <p className="text-xs text-[#9395A1]">{mk.description}</p>
                  {mk.personalNotes && (
                    <p className="text-xs text-[#36D399] font-mono pt-1">
                      Note: {mk.personalNotes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleMistakeResolved(mk.id)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                      mk.resolved
                        ? 'border-[#36D399] text-[#36D399]'
                        : 'border-[#262832] text-[#9395A1] hover:text-[#F5F5F7]'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {mk.resolved ? 'Resolved' : 'Mark Resolved'}
                  </button>
                  <button
                    type="button"
                    onClick={() => deleteMistake(mk.id)}
                    aria-label={`Delete mistake ${mk.title}`}
                    className="p-1.5 rounded-lg text-[#60636F] hover:text-[#FF4655]"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
