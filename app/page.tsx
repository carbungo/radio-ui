"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";

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

/* ─── Equalizer ─────────────────────────────────────────── */

function Equalizer({ playing, color }: { playing: boolean; color: string }) {
  const bars = useMemo(() =>
    Array.from({ length: 32 }, (_, i) => ({
      min: 2 + Math.random() * 2,
      max: 8 + Math.random() * 24,
      speed: 0.3 + Math.random() * 0.5,
      delay: i * 0.03,
    })), []
  );

  return (
    <div className="flex items-end justify-center gap-[1.5px] h-8 w-full">
      {bars.map((bar, i) => (
        <div
          key={i}
          className="eq-bar flex-1"
          style={{
            ["--eq-min" as string]: `${bar.min}px`,
            ["--eq-max" as string]: `${bar.max}px`,
            ["--eq-speed" as string]: `${bar.speed}s`,
            animationDelay: `${bar.delay}s`,
            animationPlayState: playing ? "running" : "paused",
            background: `linear-gradient(to top, ${color}, ${color}88)`,
            height: playing ? undefined : `${bar.min}px`,
            transition: "height 0.3s",
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────── */

export default function RadioPage() {
  const [stationIdx, setStationIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [nowPlaying, setNowPlaying] = useState("");
  const [listeners, setListeners] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const station = STATIONS[stationIdx];

  const startStream = useCallback((st: Station) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = "";
      audioRef.current = null;
    }
    const audio = new Audio(`${STREAM_BASE}${st.mount}`);
    audio.crossOrigin = "anonymous";
    audio.play().catch(console.error);
    audioRef.current = audio;
  }, []);

  const togglePlay = useCallback(() => {
    if (playing) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
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
          {/* Genre pill */}
          <div className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full"
            style={{ background: `${station.color}15`, border: `1px solid ${station.color}30` }}>
            <span className="text-[11px] font-medium tracking-wider uppercase"
              style={{ color: station.color, fontFamily: "'JetBrains Mono', monospace" }}>
              {station.genre}
            </span>
          </div>

          {/* Station name */}
          <h1
            className="text-3xl md:text-5xl font-bold tracking-tight leading-tight mb-2"
            style={{ color: "#fff" }}
          >
            {station.name}
          </h1>

          {/* Tagline */}
          <p className="text-sm md:text-base" style={{ color: "#666" }}>
            {station.tagline}
          </p>

          {/* Dimension + Freq */}
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
            /* Stop icon */
            <div className="w-6 h-6 md:w-7 md:h-7 rounded-sm"
              style={{ background: station.color }} />
          ) : (
            /* Play icon */
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

        {/* Equalizer */}
        <div className="w-full max-w-sm px-4">
          <Equalizer playing={playing} color={station.color} />
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
