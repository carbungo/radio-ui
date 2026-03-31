"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ─── Station Data ──────────────────────────────────────── */

interface Station {
  id: string;
  name: string;
  shortName: string;
  freq: string;
  dimension: string;
  genre: string;
  color: string;
  tagline: string;
  mount: string;
}

const STATIONS: Station[] = [
  {
    id: "gormax-fm",
    name: "GORMAX FM",
    shortName: "GORMAX",
    freq: "94.7 PHz",
    dimension: "Ω-70s",
    genre: "Space Funk",
    color: "#ff6b35",
    tagline: "Hauling grooves across the void",
    mount: "/gormax-fm",
  },
  {
    id: "void-lounge",
    name: "THE VOID LOUNGE",
    shortName: "VOID",
    freq: "33.3 MHz",
    dimension: "C-137",
    genre: "Lofi / Ambient",
    color: "#7b68ee",
    tagline: "Reality is negotiable here",
    mount: "/void-lounge",
  },
  {
    id: "neon-drift",
    name: "NEON DRIFT FM",
    shortName: "NEON",
    freq: "88.8 GHz",
    dimension: "K-22β",
    genre: "NCS / Electronic",
    color: "#00ffcc",
    tagline: "Neon-soaked beats from the grid",
    mount: "/neon-drift",
  },
  {
    id: "portal-static",
    name: "PORTAL STATIC",
    shortName: "PORTAL",
    freq: "∞ Hz",
    dimension: "NULL",
    genre: "Lofi Jazz",
    color: "#ff71ce",
    tagline: "Frequencies between frequencies",
    mount: "/portal-static",
  },
  {
    id: "council-radio",
    name: "COUNCIL RADIO Σ-12",
    shortName: "COUNCIL",
    freq: "0.001 Hz",
    dimension: "Σ-12",
    genre: "Synthwave",
    color: "#ffd700",
    tagline: "Mandatory listening by decree",
    mount: "/council-radio",
  },
];

const STREAM_BASE = "https://radio.carbun.xyz";
const STATUS_URL = "https://radio.carbun.xyz/status-json.xsl";
const EQ_BARS = 32;

/* ─── Marquee (auto-scroll long titles) ─────────────────── */

function Marquee({ text, className }: { text: string; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [needsScroll, setNeedsScroll] = useState(false);

  useEffect(() => {
    const check = () => {
      if (containerRef.current && textRef.current) {
        setNeedsScroll(textRef.current.scrollWidth > containerRef.current.clientWidth);
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [text]);

  if (!needsScroll) {
    return (
      <div ref={containerRef} className={`overflow-hidden ${className || ""}`}>
        <span ref={textRef} className="whitespace-nowrap">{text}</span>
      </div>
    );
  }

  const duration = Math.max(8, text.length * 0.3);

  return (
    <div ref={containerRef} className={`overflow-hidden ${className || ""}`}>
      <span ref={textRef} className="hidden">{text}</span>
      <div className="marquee-track" style={{ ["--marquee-duration" as string]: `${duration}s` }}>
        <span className="whitespace-nowrap pr-16">{text}</span>
        <span className="whitespace-nowrap pr-16">{text}</span>
      </div>
    </div>
  );
}

/* ─── Real Audio Equalizer (Web Audio API) ──────────────── */

function Equalizer({ color, analyserRef }: { color: string; analyserRef: React.RefObject<AnalyserNode | null> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const smoothedRef = useRef<Float32Array>(new Float32Array(EQ_BARS).fill(0));
  const dimsRef = useRef({ w: 0, h: 0 });

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      dimsRef.current = { w: rect.width, h: rect.height };
      const ctx = canvas.getContext("2d");
      if (ctx) ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);

      const { w, h } = dimsRef.current;
      if (!w || !h) return;

      // Clear with the DPR-scaled context
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      const analyser = analyserRef.current;
      const smoothed = smoothedRef.current;

      if (analyser) {
        const bufLen = analyser.frequencyBinCount;
        const data = new Uint8Array(bufLen);
        analyser.getByteFrequencyData(data);

        // Mild log mapping + per-band gain to spread energy across all bars
        const SKIP_BINS = 2;
        const NOISE_FLOOR = 10;
        const usableBins = bufLen - SKIP_BINS;

        for (let i = 0; i < EQ_BARS; i++) {
          const lowFrac = i / EQ_BARS;
          const highFrac = (i + 1) / EQ_BARS;
          // Gentler curve (1.3) so high-freq bars get enough bins
          const lowIdx = SKIP_BINS + Math.floor(Math.pow(lowFrac, 1.3) * usableBins);
          const highIdx = Math.max(lowIdx + 1, SKIP_BINS + Math.floor(Math.pow(highFrac, 1.3) * usableBins));

          let sum = 0;
          let count = 0;
          for (let j = lowIdx; j < highIdx && j < bufLen; j++) {
            const val = data[j] > NOISE_FLOOR ? data[j] - NOISE_FLOOR : 0;
            sum += val;
            count++;
          }
          let raw = count > 0 ? sum / count / (255 - NOISE_FLOOR) : 0;

          // Per-band gain: tame bass, boost highs (music has way more low-freq energy)
          const bandPos = i / (EQ_BARS - 1); // 0=bass, 1=treble
          const gain = 0.55 + bandPos * 0.8; // bass ~0.55x, treble ~1.35x
          raw = Math.min(1, raw * gain);

          // Fast attack, slow decay for satisfying visual
          if (raw > smoothed[i]) {
            smoothed[i] += (raw - smoothed[i]) * 0.6;
          } else {
            smoothed[i] += (raw - smoothed[i]) * 0.12;
          }
        }
      } else {
        // No analyser — decay to zero
        for (let i = 0; i < EQ_BARS; i++) {
          smoothed[i] *= 0.92;
        }
      }

      const gap = 1.5;
      const barW = (w - gap * (EQ_BARS - 1)) / EQ_BARS;

      for (let i = 0; i < EQ_BARS; i++) {
        const val = smoothed[i];
        const barH = Math.max(2, val * h);
        const x = i * (barW + gap);
        const y = h - barH;

        const grad = ctx.createLinearGradient(x, h, x, y);
        grad.addColorStop(0, color);
        grad.addColorStop(1, color + "88");
        ctx.fillStyle = grad;
        ctx.fillRect(x, y, barW, barH);
      }
    };

    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [color, analyserRef]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-8"
      style={{ display: "block" }}
    />
  );
}

/* ─── Main Page ─────────────────────────────────────────── */

export default function RadioPage() {
  const [stationIdx, setStationIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [nowPlaying, setNowPlaying] = useState("");
  const [listeners, setListeners] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

  const station = STATIONS[stationIdx];

  const connectAnalyser = useCallback((audio: HTMLAudioElement) => {
    // Reuse or create AudioContext
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    const ctx = audioCtxRef.current;

    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Create analyser once
    if (!analyserRef.current) {
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;
      analyser.connect(ctx.destination);
      analyserRef.current = analyser;
    }

    // Disconnect previous source
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch { /* ok */ }
      sourceNodeRef.current = null;
    }

    // Connect new audio element → analyser → destination
    try {
      const source = ctx.createMediaElementSource(audio);
      source.connect(analyserRef.current);
      sourceNodeRef.current = source;
    } catch (e) {
      console.warn("Could not create media source:", e);
    }
  }, []);

  const startStream = useCallback((st: Station) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    if (sourceNodeRef.current) {
      try { sourceNodeRef.current.disconnect(); } catch { /* ok */ }
      sourceNodeRef.current = null;
    }

    const audio = new Audio(`${STREAM_BASE}${st.mount}`);
    audio.crossOrigin = "anonymous";
    audioRef.current = audio;

    connectAnalyser(audio);
    audio.play().catch(console.error);
  }, [connectAnalyser]);

  const togglePlay = useCallback(() => {
    if (playing) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
      if (sourceNodeRef.current) {
        try { sourceNodeRef.current.disconnect(); } catch { /* ok */ }
        sourceNodeRef.current = null;
      }
      setPlaying(false);
    } else {
      startStream(station);
      setPlaying(true);
    }
  }, [playing, station, startStream]);

  const selectStation = useCallback((idx: number) => {
    if (idx === stationIdx) return;
    setStationIdx(idx);
    setNowPlaying("");
    if (playing) {
      startStream(STATIONS[idx]);
    }
  }, [stationIdx, playing, startStream]);

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        selectStation((stationIdx + 1) % STATIONS.length);
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        selectStation((stationIdx - 1 + STATIONS.length) % STATIONS.length);
      } else if (e.key === " ") {
        e.preventDefault();
        togglePlay();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectStation, stationIdx, togglePlay]);

  // Poll Icecast metadata
  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch(STATUS_URL, { cache: "no-store" });
        const data = await res.json();
        const sources = data?.icestats?.source;
        if (!sources) return;
        const sourceList = Array.isArray(sources) ? sources : [sources];
        const src = sourceList.find(
          (s: Record<string, unknown>) => (s.listenurl as string)?.endsWith(station.mount)
        );
        if (src) {
          const title = (src.title as string) || "";
          const artist = (src.artist as string) || "";
          if (artist && title) {
            setNowPlaying(`${artist} — ${title}`);
          } else if (title) {
            setNowPlaying(title);
          } else {
            setNowPlaying("");
          }
          setListeners(
            sourceList.reduce((sum: number, s: Record<string, unknown>) =>
              sum + ((s.listeners as number) || 0), 0
            )
          );
        }
      } catch { /* noop */ }
    };
    poll();
    const interval = setInterval(poll, 8000);
    return () => clearInterval(interval);
  }, [station]);

  return (
    <div className="h-full w-full flex flex-col relative overflow-hidden safe-top safe-bottom">
      {/* Ambient glow backdrop */}
      <div
        className="glow-backdrop absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full"
        style={{ background: `radial-gradient(circle, ${station.color}30, transparent 70%)` }}
      />

      {/* ─── Header ─────────────────────────── */}
      <header className="relative z-10 px-5 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="text-lg">📡</span>
          <span
            className="text-xs font-medium tracking-widest uppercase"
            style={{ fontFamily: "'JetBrains Mono', monospace", color: "#666" }}
          >
            ICR
          </span>
        </div>
        <div className="flex items-center gap-3">
          {listeners > 0 && (
            <span className="text-xs" style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>
              {listeners} listening
            </span>
          )}
          {playing && (
            <div className="relative flex items-center justify-center w-5 h-5">
              <div className="w-2 h-2 rounded-full" style={{ background: station.color }} />
              <div className="pulse-ring absolute inset-0" style={{ color: station.color }} />
            </div>
          )}
        </div>
      </header>

      {/* ─── Main Content ───────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-5 gap-6">

        {/* Station info */}
        <div className="text-center max-w-lg w-full fade-enter" key={station.id}>
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full"
            style={{ background: `${station.color}15`, border: `1px solid ${station.color}30` }}>
            <span className="text-[11px] font-medium tracking-wider uppercase"
              style={{ color: station.color, fontFamily: "'JetBrains Mono', monospace" }}>
              {station.genre}
            </span>
          </div>

          <h1
            className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-2"
            style={{ color: "#fff" }}
          >
            {station.name}
          </h1>

          <p className="text-sm md:text-base" style={{ color: "#666" }}>
            {station.tagline}
          </p>

          <div className="mt-3 flex items-center justify-center gap-4 text-xs"
            style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>
            <span>DIM {station.dimension}</span>
            <span style={{ color: "#333" }}>·</span>
            <span>{station.freq}</span>
          </div>
        </div>

        {/* Play button */}
        <button
          onClick={togglePlay}
          className="play-ring relative w-20 h-20 md:w-24 md:h-24 rounded-full flex items-center justify-center"
          style={{
            background: playing
              ? `linear-gradient(135deg, ${station.color}20, ${station.color}05)`
              : `linear-gradient(135deg, ${station.color}, ${station.color}cc)`,
            border: `2px solid ${playing ? station.color + '40' : 'transparent'}`,
            boxShadow: playing ? 'none' : `0 8px 32px ${station.color}40`,
          }}
          aria-label={playing ? "Stop" : "Play"}
        >
          {playing ? (
            <div className="w-6 h-6 md:w-7 md:h-7 rounded-sm"
              style={{ background: station.color }} />
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff" className="ml-1">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </button>

        {/* Now playing */}
        <div className="w-full max-w-md text-center min-h-[48px] flex flex-col items-center justify-center">
          {playing && nowPlaying ? (
            <div className="w-full">
              <div className="text-[10px] uppercase tracking-widest mb-1.5"
                style={{ color: "#555", fontFamily: "'JetBrains Mono', monospace" }}>
                Now Playing
              </div>
              <Marquee
                text={nowPlaying}
                className="text-base md:text-lg font-medium"
              />
            </div>
          ) : playing ? (
            <span className="text-sm" style={{ color: "#555" }}>Tuning in...</span>
          ) : null}
        </div>

        {/* Equalizer — real audio data via Web Audio API */}
        <div className="w-full max-w-sm px-4">
          <Equalizer color={station.color} analyserRef={analyserRef} />
        </div>
      </main>

      {/* ─── Station Selector ───────────────── */}
      <nav className="relative z-10 px-3 pb-4 pt-2">
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {STATIONS.map((st, idx) => {
            const active = idx === stationIdx;
            return (
              <button
                key={st.id}
                onClick={() => selectStation(idx)}
                className="station-card flex-shrink-0 flex flex-col items-start gap-1.5 rounded-xl px-4 py-3 min-w-[120px]"
                style={{
                  background: active ? `${st.color}15` : '#141414',
                  border: `1px solid ${active ? st.color + '40' : '#1e1e1e'}`,
                }}
              >
                <span
                  className="text-[10px] font-semibold tracking-wider"
                  style={{
                    color: active ? st.color : '#555',
                    fontFamily: "'JetBrains Mono', monospace",
                  }}
                >
                  {st.shortName}
                </span>
                <span className="text-[11px]" style={{ color: active ? '#999' : '#444' }}>
                  {st.genre}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
