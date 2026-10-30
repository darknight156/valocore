import React, { useState, useEffect, useRef } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Crosshair, Zap, Trophy, Play, RotateCcw } from 'lucide-react';
import { useValocore } from '../../context/ValocoreContext';
import { TrainingMode } from '../../types/valocore';

export const TrainingViews: React.FC<{
  subView: 'aim-trainer' | 'reaction-tests' | 'training-history';
}> = ({ subView }) => {
  const { trainingSessions, addTrainingSession } = useValocore();

  // Aim Trainer state
  const [mode, setMode] = useState<TrainingMode>('Flick Training');
  const [difficulty, setDifficulty] = useState<'Standard' | 'Hard' | 'Radiant'>('Hard');
  const [durationSec, setDurationSec] = useState<number>(15);
  const [targetRadius, setTargetRadius] = useState<number>(22);
  const [isPlaying, setIsPlaying] = useState(false);
  const [timeLeft, setTimeLeft] = useState(15);
  const [hits, setHits] = useState(0);
  const [misses, setMisses] = useState(0);
  const [streak, setStreak] = useState(0);
  const [bestStreak, setBestStreak] = useState(0);
  const [reactionSamples, setReactionSamples] = useState<number[]>([]);
  const [targetPos, setTargetPos] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const lastSpawnTimeRef = useRef<number>( performance.now() );

  // Reaction Test state
  const [reactionState, setReactionState] = useState<
    'IDLE' | 'WAITING' | 'READY' | 'RESULT' | 'EARLY'
  >('IDLE');
  const [reactionMs, setReactionMs] = useState<number | null>(null);
  const [reactionAttempts, setReactionAttempts] = useState<number[]>([]);
  const reactionTimerRef = useRef<number | null>(null);
  const reactionStartRef = useRef<number>(0);

  const spawnNextTarget = () => {
    const margin = 14;
    const nx = Math.floor(margin + Math.random() * (100 - margin * 2));
    const ny = Math.floor(margin + Math.random() * (100 - margin * 2));
    setTargetPos({ x: nx, y: ny });
    lastSpawnTimeRef.current = performance.now();
  };

  useEffect(() => {
    if (!isPlaying) return;
    const timer = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          setIsPlaying(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isPlaying]);

  // Save completed session when timer reaches 0
  useEffect(() => {
    if (!isPlaying && timeLeft === 0 && (hits > 0 || misses > 0)) {
      const totalShots = hits + misses;
      const acc = totalShots > 0 ? Number(((hits / totalShots) * 100).toFixed(1)) : 0;
      const avgReact =
        reactionSamples.length > 0
          ? Math.round(
              reactionSamples.reduce((a, b) => a + b, 0) / reactionSamples.length
            )
          : 240;
      const score = Math.max(0, hits * 140 - misses * 45 + bestStreak * 25);

      addTrainingSession({
        id: `tr-${Date.now()}`,
        mode,
        difficulty,
        durationSeconds: durationSec,
        score,
        accuracyPercent: acc,
        avgReactionMs: avgReact,
        targetsHit: hits,
        targetsMissed: misses,
        bestStreak,
        createdAt: new Date().toISOString(),
      });
      setTimeLeft(durationSec);
    }
  }, [
    isPlaying,
    timeLeft,
    hits,
    misses,
    bestStreak,
    reactionSamples,
    mode,
    difficulty,
    durationSec,
    addTrainingSession,
  ]);

  const startAimSession = () => {
    setHits(0);
    setMisses(0);
    setStreak(0);
    setBestStreak(0);
    setReactionSamples([]);
    setTimeLeft(durationSec);
    setIsPlaying(true);
    spawnNextTarget();
  };

  const handleTargetHit = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isPlaying) return;
    const delta = Math.max(110, Math.round(performance.now() - lastSpawnTimeRef.current));
    setReactionSamples((prev) => [...prev, delta]);
    setHits((h) => h + 1);
    setStreak((s) => {
      const next = s + 1;
      setBestStreak((b) => Math.max(b, next));
      return next;
    });
    spawnNextTarget();
  };

  const handleArenaMiss = () => {
    if (!isPlaying) return;
    setMisses((m) => m + 1);
    setStreak(0);
  };

  // Reaction Test handlers
  const startReactionTrial = () => {
    if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current);
    setReactionState('WAITING');
    const delay = 1200 + Math.floor(Math.random() * 1800);
    reactionTimerRef.current = window.setTimeout(() => {
      reactionStartRef.current = performance.now();
      setReactionState('READY');
    }, delay);
  };

  const handleReactionClick = () => {
    if (reactionState === 'IDLE' || reactionState === 'RESULT' || reactionState === 'EARLY') {
      startReactionTrial();
      return;
    }
    if (reactionState === 'WAITING') {
      if (reactionTimerRef.current) window.clearTimeout(reactionTimerRef.current);
      setReactionState('EARLY');
      return;
    }
    if (reactionState === 'READY') {
      const elapsed = Math.max(115, Math.round(performance.now() - reactionStartRef.current));
      setReactionMs(elapsed);
      setReactionState('RESULT');
      const nextList = [...reactionAttempts, elapsed];
      setReactionAttempts(nextList);

      if (nextList.length >= 3) {
        const avg = Math.round(nextList.reduce((a, b) => a + b, 0) / nextList.length);
        addTrainingSession({
          id: `tr-react-${Date.now()}`,
          mode: 'Reaction Time',
          difficulty: 'Standard',
          durationSeconds: 15,
          score: Math.max(1500, 6000 - avg * 12),
          accuracyPercent: 100,
          avgReactionMs: avg,
          targetsHit: nextList.length,
          targetsMissed: 0,
          bestStreak: nextList.length,
          createdAt: new Date().toISOString(),
        });
      }
    }
  };

  if (subView === 'aim-trainer') {
    const totalShots = hits + misses;
    const liveAcc = totalShots > 0 ? ((hits / totalShots) * 100).toFixed(1) : '100.0';
    const avgMs =
      reactionSamples.length > 0
        ? Math.round(
            reactionSamples.reduce((a, b) => a + b, 0) / reactionSamples.length
          )
        : 0;

    return (
      <div className="space-y-6">
        {/* Controls Header */}
        <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div>
              <label className="block text-[10px] font-mono text-[#9395A1] mb-1">
                TRAINING MODE
              </label>
              <select
                aria-label="Training Mode"
                value={mode}
                onChange={(e) => setMode(e.target.value as TrainingMode)}
                className="bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-[#F5F5F7]"
              >
                <option value="Flick Training">Flick Training</option>
                <option value="Precision Micro">Precision Micro</option>
                <option value="Target Switching">Target Switching</option>
                <option value="Strafe Tracking">Strafe Tracking</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-[#9395A1] mb-1">
                DIFFICULTY
              </label>
              <select
                aria-label="Difficulty"
                value={difficulty}
                onChange={(e) => {
                  const val = e.target.value as 'Standard' | 'Hard' | 'Radiant';
                  setDifficulty(val);
                  setTargetRadius(val === 'Standard' ? 28 : val === 'Hard' ? 20 : 14);
                }}
                className="bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 text-[#F5F5F7]"
              >
                <option value="Standard">Standard (28px)</option>
                <option value="Hard">Hard (20px)</option>
                <option value="Radiant">Radiant Micro (14px)</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-mono text-[#9395A1] mb-1">
                DURATION
              </label>
              <select
                aria-label="Session Duration"
                value={durationSec}
                onChange={(e) => {
                  const d = Number(e.target.value);
                  setDurationSec(d);
                  setTimeLeft(d);
                }}
                className="bg-[#090A0D] border border-[#262832] rounded-lg px-3 py-1.5 font-mono text-[#F5F5F7]"
              >
                <option value={15}>15 Seconds</option>
                <option value={30}>30 Seconds</option>
                <option value={60}>60 Seconds</option>
              </select>
            </div>
          </div>

          {/* Live Telemetry Readout */}
          <div className="flex items-center gap-6 font-mono text-xs">
            <div>
              <span className="text-[#9395A1] block text-[10px]">TIME</span>
              <span className="text-base font-bold text-[#F5F5F7]">{timeLeft}s</span>
            </div>
            <div>
              <span className="text-[#9395A1] block text-[10px]">HITS</span>
              <span className="text-base font-bold text-[#36D399]">{hits}</span>
            </div>
            <div>
              <span className="text-[#9395A1] block text-[10px]">ACCURACY</span>
              <span className="text-base font-bold text-[#F5F5F7]">{liveAcc}%</span>
            </div>
            <div>
              <span className="text-[#9395A1] block text-[10px]">AVG TIME</span>
              <span className="text-base font-bold text-[#FF4655]">{avgMs}ms</span>
            </div>

            <button
              type="button"
              onClick={startAimSession}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-sans font-semibold text-white cursor-pointer"
            >
              <Play className="w-3.5 h-3.5" />
              {isPlaying ? 'Restart Drill' : 'Start Aim Drill'}
            </button>
          </div>
        </div>

        {/* Interactive Aim Training Arena */}
        <div
          data-testid="aim-trainer-arena"
          onClick={handleArenaMiss}
          className="relative h-[460px] rounded-xl bg-[#090A0D] border border-[#262832] overflow-hidden cursor-crosshair select-none flex items-center justify-center"
        >
          {/* Subtle Reference Grid */}
          <div
            className="absolute inset-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                'linear-gradient(to right, #262832 1px, transparent 1px), linear-gradient(to bottom, #262832 1px, transparent 1px)',
              backgroundSize: '48px 48px',
            }}
          />

          {!isPlaying ? (
            <div className="relative z-10 text-center space-y-3 p-6 rounded-xl bg-[#13151B]/90 border border-[#262832] max-w-md">
              <Crosshair className="w-8 h-8 text-[#FF4655] mx-auto" />
              <h2 className="text-lg font-display font-bold text-[#F5F5F7]">
                {mode} — {difficulty} Calibration
              </h2>
              <p className="text-xs text-[#9395A1]">
                Independent desktop precision lab. Click &ldquo;Start Aim Drill&rdquo; to spawn
                targets and record your accuracy and reaction telemetry to SQLite.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  startAimSession();
                }}
                className="px-5 py-2.5 rounded-lg bg-[#FF4655] hover:bg-[#E63946] text-xs font-semibold text-white"
              >
                Start Aim Drill
              </button>
            </div>
          ) : (
            <button
              type="button"
              aria-label="Aim target"
              onClick={handleTargetHit}
              style={{
                left: `${targetPos.x}%`,
                top: `${targetPos.y}%`,
                width: `${targetRadius * 2}px`,
                height: `${targetRadius * 2}px`,
                transform: 'translate(-50%, -50%)',
              }}
              className="absolute rounded-full bg-[#FF4655] border-2 border-white shadow-[0_0_20px_rgba(255,70,85,0.75)] flex items-center justify-center cursor-crosshair"
            >
              <span className="w-2 h-2 rounded-full bg-white" />
            </button>
          )}
        </div>
      </div>
    );
  }

  if (subView === 'reaction-tests') {
    const avgReaction =
      reactionAttempts.length > 0
        ? Math.round(
            reactionAttempts.reduce((a, b) => a + b, 0) / reactionAttempts.length
          )
        : 184;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <button
              type="button"
              onClick={handleReactionClick}
              className={`w-full h-[420px] rounded-xl border transition-colors flex flex-col items-center justify-center p-8 text-center cursor-pointer ${
                reactionState === 'READY'
                  ? 'bg-[#36D399]/20 border-[#36D399]'
                  : reactionState === 'WAITING'
                  ? 'bg-[#FF4655]/15 border-[#FF4655]'
                  : 'bg-[#13151B] border-[#262832] hover:border-[#383B4A]'
              }`}
            >
              <Zap
                className={`w-10 h-10 mb-3 ${
                  reactionState === 'READY' ? 'text-[#36D399]' : 'text-[#FF4655]'
                }`}
              />
              {reactionState === 'IDLE' && (
                <>
                  <h2 className="text-2xl font-display font-bold text-[#F5F5F7]">
                    Visual Reaction Latency Test
                  </h2>
                  <p className="text-xs text-[#9395A1] mt-2 max-w-md">
                    Click anywhere inside this panel to begin. Wait for the signal to turn emerald
                    green, then click immediately.
                  </p>
                </>
              )}
              {reactionState === 'WAITING' && (
                <>
                  <h2 className="text-2xl font-display font-bold text-[#FF4655]">
                    HOLD ANGLE... WAIT FOR GREEN
                  </h2>
                  <p className="text-xs text-[#9395A1] mt-1 font-mono">
                    Do not fire early
                  </p>
                </>
              )}
              {reactionState === 'READY' && (
                <>
                  <h2 className="text-3xl font-display font-bold text-[#36D399]">
                    FIRE NOW! CLICK!
                  </h2>
                </>
              )}
              {reactionState === 'EARLY' && (
                <>
                  <h2 className="text-xl font-display font-bold text-[#F5B942]">
                    Pre-Fired Too Early!
                  </h2>
                  <p className="text-xs text-[#9395A1] mt-1">Click to retry trial.</p>
                </>
              )}
              {reactionState === 'RESULT' && (
                <>
                  <div className="text-4xl font-mono font-bold text-[#36D399]">
                    {reactionMs} ms
                  </div>
                  <p className="text-xs text-[#9395A1] mt-2">
                    Click anywhere to run next reaction trial ({reactionAttempts.length} logged)
                  </p>
                </>
              )}
            </button>
          </div>

          <div className="lg:col-span-4 rounded-xl bg-[#13151B] border border-[#262832] p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-display font-bold text-[#F5F5F7]">
                REACTION BENCHMARKS
              </h3>
              <button
                type="button"
                onClick={() => {
                  setReactionAttempts([]);
                  setReactionMs(null);
                  setReactionState('IDLE');
                }}
                aria-label="Reset reaction attempts"
                className="p-1.5 rounded bg-[#090A0D] border border-[#262832] text-[#9395A1] hover:text-[#F5F5F7]"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 rounded-lg bg-[#090A0D] border border-[#262832] font-mono">
              <div className="text-[11px] text-[#9395A1]">SESSION AVERAGE</div>
              <div className="text-2xl font-bold text-[#F5F5F7] mt-1">{avgReaction} ms</div>
              <div className="text-[11px] text-[#36D399] mt-1">
                VCT Pro Operator Threshold: 165–190 ms
              </div>
            </div>

            <div className="space-y-1.5 text-xs font-mono">
              <div className="text-[#9395A1] text-[10px]">RECENT TRIALS</div>
              {reactionAttempts.length === 0 ? (
                <div className="text-[#60636F] font-sans">
                  Complete 3 trials to automatically log a Reaction Time session.
                </div>
              ) : (
                reactionAttempts.map((ms, i) => (
                  <div
                    key={i}
                    className="flex justify-between py-1.5 border-b border-[#262832]"
                  >
                    <span>Trial #{i + 1}</span>
                    <span className="text-[#36D399] font-bold">{ms} ms</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Training History View
  const personalBest =
    trainingSessions.length > 0
      ? Math.max(...trainingSessions.map((t) => t.score))
      : 0;
  const bestReaction =
    trainingSessions.length > 0
      ? Math.min(...trainingSessions.map((t) => t.avgReactionMs))
      : 0;

  const historyChart = [...trainingSessions]
    .reverse()
    .map((tr, idx) => ({
      name: `#${idx + 1}`,
      score: tr.score,
      accuracy: tr.accuracyPercent,
      reaction: tr.avgReactionMs,
    }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
        <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
          <div className="text-[11px] text-[#9395A1]">PERSONAL BEST SCORE</div>
          <div className="text-2xl font-bold text-[#36D399] mt-1">{personalBest} PTS</div>
        </div>
        <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
          <div className="text-[11px] text-[#9395A1]">FASTEST AVG REACTION</div>
          <div className="text-2xl font-bold text-[#F5F5F7] mt-1">{bestReaction} ms</div>
        </div>
        <div className="rounded-xl bg-[#13151B] border border-[#262832] p-4">
          <div className="text-[11px] text-[#9395A1]">RECORDED SESSIONS</div>
          <div className="text-2xl font-bold text-[#FF4655] mt-1">
            {trainingSessions.length}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-[#13151B] border border-[#262832] p-5">
        <h2 className="text-sm font-display font-bold text-[#F5F5F7] mb-4">
          TRAINING SCORE PROGRESSION
        </h2>
        <div className="h-60">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={historyChart}>
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
              <Area
                type="monotone"
                dataKey="score"
                stroke="#FF4655"
                fill="#FF4655"
                fillOpacity={0.2}
                name="Score"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-xl bg-[#13151B] border border-[#262832] overflow-hidden">
        <div className="p-4 border-b border-[#262832] flex items-center gap-2">
          <Trophy className="w-4 h-4 text-[#FF4655]" />
          <h3 className="text-sm font-display font-bold text-[#F5F5F7]">
            SESSION LOG ARCHIVE
          </h3>
        </div>
        <table className="w-full text-left border-collapse text-xs font-mono">
          <thead>
            <tr className="border-b border-[#262832] text-[11px] text-[#60636F] bg-[#0C0D11]">
              <th className="py-2.5 px-4">MODE</th>
              <th className="py-2.5 px-3">DIFFICULTY</th>
              <th className="py-2.5 px-3 text-right">SCORE</th>
              <th className="py-2.5 px-3 text-right">ACCURACY</th>
              <th className="py-2.5 px-3 text-right">AVG REACTION</th>
              <th className="py-2.5 px-3 text-right">STREAK</th>
              <th className="py-2.5 px-4 text-right">DATE</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#262832]">
            {trainingSessions.map((tr) => (
              <tr key={tr.id} className="hover:bg-[#191B23]">
                <td className="py-3 px-4 font-sans font-semibold text-[#F5F5F7]">{tr.mode}</td>
                <td className="py-3 px-3 text-[#9395A1]">{tr.difficulty}</td>
                <td className="py-3 px-3 text-right font-bold text-[#F5F5F7]">{tr.score}</td>
                <td className="py-3 px-3 text-right text-[#36D399]">{tr.accuracyPercent}%</td>
                <td className="py-3 px-3 text-right text-[#F5F5F7]">{tr.avgReactionMs} ms</td>
                <td className="py-3 px-3 text-right text-[#9395A1]">{tr.bestStreak}</td>
                <td className="py-3 px-4 text-right text-[#9395A1]">
                  {new Date(tr.createdAt).toLocaleDateString([], {
                    month: 'short',
                    day: 'numeric',
                  })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
