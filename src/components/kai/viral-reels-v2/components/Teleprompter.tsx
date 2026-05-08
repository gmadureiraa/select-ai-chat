/**
 * Teleprompter — overlay full-screen com auto-scroll, fonte ajustável,
 * play/pause, mirror horizontal e atalhos de teclado. Usado pelo
 * ScriptCard pra ler o roteiro durante a gravação.
 */

import { useEffect, useRef, useState } from "react";
import {
  Pause,
  Play,
  RotateCcw,
  X,
  Type,
  Gauge,
  FlipHorizontal2,
} from "lucide-react";

interface TeleprompterProps {
  text: string;
  open: boolean;
  onClose: () => void;
}

export function Teleprompter({ text, open, onClose }: TeleprompterProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(60); // px/s
  const [fontSize, setFontSize] = useState(48);
  const [mirror, setMirror] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTickRef = useRef<number>(0);

  // Reset scroll quando abre
  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
      setPlaying(false);
    }
  }, [open]);

  // Auto-scroll loop
  useEffect(() => {
    if (!playing || !open) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }

    function tick(timestamp: number) {
      if (!scrollRef.current) return;
      if (lastTickRef.current === 0) lastTickRef.current = timestamp;
      const delta = (timestamp - lastTickRef.current) / 1000;
      lastTickRef.current = timestamp;

      const el = scrollRef.current;
      el.scrollTop += speed * delta;

      if (el.scrollTop + el.clientHeight >= el.scrollHeight - 1) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    lastTickRef.current = 0;
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, speed, open]);

  // Atalhos
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === " ") {
        e.preventDefault();
        setPlaying((p) => !p);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSpeed((s) => Math.min(300, s + 10));
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSpeed((s) => Math.max(10, s - 10));
      }
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        setFontSize((f) => Math.min(120, f + 4));
      }
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        setFontSize((f) => Math.max(20, f - 4));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function handleReset() {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
    setPlaying(false);
  }

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col bg-black text-white"
      role="dialog"
      aria-label="Teleprompter"
      aria-modal="true"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap p-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPlaying((p) => !p)}
            aria-label={playing ? "Pausar" : "Reproduzir"}
            className="inline-flex items-center gap-2 rounded px-4 py-2 bg-red-500 hover:bg-red-600 text-white font-bold text-sm tracking-wide"
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {playing ? "PAUSAR" : "REPRODUZIR"}
          </button>
          <button
            onClick={handleReset}
            aria-label="Voltar pro início"
            className="inline-flex items-center gap-1.5 rounded border border-white/20 px-3 py-2 text-xs hover:bg-white/5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Voltar
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* Velocidade */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/70">
            <Gauge className="h-3.5 w-3.5" />
            <input
              type="range"
              min={10}
              max={300}
              step={10}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="w-24 accent-red-500"
              aria-label="Velocidade do teleprompter"
            />
            <span className="min-w-[50px]">{speed} px/s</span>
          </div>

          {/* Fonte */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-white/70">
            <Type className="h-3.5 w-3.5" />
            <input
              type="range"
              min={20}
              max={120}
              step={2}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
              className="w-20 accent-red-500"
              aria-label="Tamanho da fonte"
            />
            <span className="min-w-[36px]">{fontSize}px</span>
          </div>

          {/* Mirror */}
          <button
            onClick={() => setMirror((m) => !m)}
            aria-pressed={mirror}
            title="Espelhar (rig de teleprompter)"
            className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-[11px] ${
              mirror ? "border-red-500 bg-red-500/20" : "border-white/20 hover:bg-white/5"
            }`}
          >
            <FlipHorizontal2 className="h-3.5 w-3.5" />
            Espelhar
          </button>

          <button
            onClick={onClose}
            aria-label="Fechar teleprompter"
            className="rounded border border-white/20 p-2 hover:bg-white/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Texto rolando */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{
          padding: "40vh 8vw 60vh",
          scrollBehavior: "auto",
          transform: mirror ? "scaleX(-1)" : "none",
        }}
      >
        <pre
          className="whitespace-pre-wrap break-words text-center max-w-[1200px] mx-auto m-0 font-semibold"
          style={{
            fontSize: `${fontSize}px`,
            lineHeight: 1.4,
            letterSpacing: "-0.01em",
          }}
        >
          {text}
        </pre>
      </div>

      {/* Hint */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[10px] font-mono text-white/40 tracking-wider pointer-events-none">
        ESPAÇO play · ↑↓ velocidade · +/− tamanho · ESC fechar
      </div>
    </div>
  );
}
