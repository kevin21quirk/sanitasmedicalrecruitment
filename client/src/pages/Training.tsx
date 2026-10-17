import { useCallback, useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, GraduationCap, Film } from 'lucide-react';
import clsx from 'clsx';
import { MODULES, type Module } from '../training/modules';
import { TrainingStyles } from '../training/visuals';
import { PageHeader } from '../components/ui';

const SCENE_MS = 7000; // auto-advance cadence

export default function Training() {
  const [active, setActive] = useState<Module | null>(null);
  return (
    <div>
      <TrainingStyles />
      <PageHeader title="Training" subtitle="Short animated walkthroughs of every section — pick one to watch it play through."
        eyebrow="Staff training centre" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {MODULES.map((m) => (
          <button key={m.id} onClick={() => setActive(m)}
            className="group rounded-2xl border border-slate-200/60 bg-white/70 p-0 text-left shadow-glass transition hover:-translate-y-0.5 hover:shadow-glass-lg">
            <div className={clsx('relative flex h-28 items-center justify-center overflow-hidden rounded-t-2xl bg-gradient-to-br', m.tint)}>
              <m.icon className="h-10 w-10 text-white/90 drop-shadow" />
              <span className="absolute inset-0 flex items-center justify-center bg-black/30 opacity-0 transition group-hover:opacity-100">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 shadow-lg">
                  <Play className="ml-0.5 h-5 w-5 text-ink" />
                </span>
              </span>
              <span className="absolute bottom-2 right-2 rounded-full bg-black/40 px-2 py-0.5 text-[10px] font-semibold text-white">
                {m.scenes.length} scenes · ~{m.scenes.length * 7}s
              </span>
            </div>
            <div className="px-4 py-3">
              <p className="text-sm font-semibold text-ink">{m.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{m.subtitle}</p>
            </div>
          </button>
        ))}
      </div>
      <p className="mt-6 flex items-center gap-2 text-xs text-slate-400">
        <Film className="h-3.5 w-3.5" />
        Walkthroughs are generated from the live demo dataset — names and figures match what staff see day to day.
      </p>
      {active && <Player mod={active} onClose={() => setActive(null)} />}
    </div>
  );
}

function Player({ mod, onClose }: { mod: Module; onClose: () => void }) {
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<number>(0);

  const scene = mod.scenes[idx];

  useEffect(() => {
    if (!playing) return;
    const t0 = performance.now() - elapsed;
    const tick = () => {
      const e = performance.now() - t0;
      if (e >= SCENE_MS) {
        setElapsed(0);
        setIdx((i) => (i + 1 < mod.scenes.length ? i + 1 : i)); // stop on last scene
        if (idx + 1 >= mod.scenes.length) setPlaying(false);
        return;
      }
      setElapsed(e);
      timer.current = window.setTimeout(tick, 100);
    };
    timer.current = window.setTimeout(tick, 100);
    return () => clearTimeout(timer.current);
  }, [playing, idx, mod.scenes.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = useCallback((to: number) => {
    setElapsed(0);
    setIdx(Math.max(0, Math.min(mod.scenes.length - 1, to)));
    setPlaying(true);
  }, [mod.scenes.length]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') go(idx + 1);
      if (e.key === 'ArrowLeft') go(idx - 1);
      if (e.key === ' ') { e.preventDefault(); setPlaying((p) => !p); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, idx, onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/60 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-[78vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-slate-950 shadow-pop" onClick={(e) => e.stopPropagation()}>
        {/* header */}
        <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={clsx('flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br text-white', mod.tint)}>
              <mod.icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-white">{mod.title}</p>
              <p className="truncate text-[11px] text-sky-200/60">Scene {idx + 1} of {mod.scenes.length} — {scene.title}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => go(idx - 1)} disabled={idx === 0}><SkipBack className="h-4 w-4" /></button>
            <button className="rounded-lg bg-white/10 p-1.5 text-white hover:bg-white/20" onClick={() => setPlaying((p) => !p)}>
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            </button>
            <button className="rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={() => go(idx + 1)} disabled={idx === mod.scenes.length - 1}><SkipForward className="h-4 w-4" /></button>
            <button className="ml-1 rounded-lg p-1.5 text-white/60 hover:bg-white/10 hover:text-white" onClick={onClose}><X className="h-4 w-4" /></button>
          </div>
        </div>

        {/* progress segments */}
        <div className="flex gap-1 px-5 pt-2.5">
          {mod.scenes.map((_, i) => (
            <button key={i} onClick={() => go(i)} className="h-1 flex-1 overflow-hidden rounded-full bg-white/15">
              <div className="h-full rounded-full bg-accent-400 transition-[width] duration-100"
                style={{ width: i < idx ? '100%' : i === idx ? `${Math.min(100, (elapsed / SCENE_MS) * 100)}%` : '0%' }} />
            </button>
          ))}
        </div>

        {/* stage — key forces remount so CSS animations replay per scene */}
        <div className="m-4 min-h-0 flex-1">
          <div key={idx} className="h-full">{scene.visual}</div>
        </div>

        <div className="flex items-center justify-between border-t border-white/10 px-5 py-2">
          <p className="flex items-center gap-2 text-[11px] text-sky-200/50">
            <GraduationCap className="h-3.5 w-3.5" /> Space = pause · arrows = skip · Esc = close
          </p>
          {idx === mod.scenes.length - 1 && !playing && (
            <button className="text-[11px] font-semibold text-accent-400 hover:text-accent-500" onClick={() => go(0)}>Watch again</button>
          )}
        </div>
      </div>
    </div>
  );
}
