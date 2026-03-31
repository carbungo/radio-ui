"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ─── Station Data ──────────────────────────────────────── */

interface Station {
  id: string;
  name: string;
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
    freq: "94.7 PHz",
    dimension: "Ω-70s",
    genre: "SPACE FUNK",
    color: "#ff6b35",
    tagline: "Hauling grooves across the void",
    mount: "/gormax-fm",
  },
  {
    id: "void-lounge",
    name: "THE VOID LOUNGE",
    freq: "33.3 MHz",
    dimension: "C-137",
    genre: "LOFI / AMBIENT",
    color: "#7b68ee",
    tagline: "Reality is negotiable here",
    mount: "/void-lounge",
  },
  {
    id: "neon-drift",
    name: "NEON DRIFT FM",
    freq: "88.8 GHz",
    dimension: "K-22β",
    genre: "NCS / ELECTRONIC",
    color: "#00ffcc",
    tagline: "Neon-soaked beats from the grid",
    mount: "/neon-drift",
  },
  {
    id: "portal-static",
    name: "PORTAL STATIC",
    freq: "∞ Hz",
    dimension: "NULL",
    genre: "LOFI JAZZ",
    color: "#ff71ce",
    tagline: "Frequencies between frequencies",
    mount: "/portal-static",
  },
  {
    id: "council-radio",
    name: "COUNCIL RADIO Σ-12",
    freq: "0.001 Hz",
    dimension: "Σ-12",
    genre: "SYNTHWAVE",
    color: "#ffd700",
    tagline: "Mandatory listening by decree",
    mount: "/council-radio",
  },
];

const STREAM_BASE = "https://radio.carbun.xyz";
const STATUS_URL = "https://radio.carbun.xyz/status-json.xsl";

/* ─── Equalizer Component ───────────────────────────────── */

function Equalizer({ playing, color }: { playing: boolean; color: string }) {
  const bars = 16;
  return (
    <div className="flex items-end justify-center gap-[2px] h-8">
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="eq-bar"
          style={{
            "--eq-height": `${8 + Math.random() * 20}px`,
            animationDelay: `${i * 0.05}s`,
            animationDuration: `${0.4 + Math.random() * 0.6}s`,
            animationPlayState: playing ? "running" : "paused",
            background: color,
            boxShadow: `0 0 4px ${color}`,
            height: playing ? undefined : "4px",
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

/* ─── Channel Display ───────────────────────────────────── */

function ChannelDisplay({ station, nowPlaying }: { station: Station; nowPlaying: string }) {
  return (
    <div className="space-y-3">
      {/* Station name */}
      <div className="text-center">
        <div
          className="text-4xl md:text-5xl font-bold tracking-wider"
          style={{
            fontFamily: "'Press Start 2P', monospace",
            fontSize: "clamp(14px, 3vw, 28px)",
            color: station.color,
            textShadow: `0 0 10px ${station.color}, 0 0 20px ${station.color}, 0 0 40px ${station.color}40`,
          }}
        >
          {station.name}
        </div>
      </div>

      {/* Frequency & Dimension */}
      <div className="flex justify-between items-center text-sm md:text-base opacity-80" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
        <span className="glow-green">{station.freq}</span>
        <span className="glow-amber">DIM: {station.dimension}</span>
      </div>

      {/* Genre */}
      <div className="text-center text-xs tracking-[0.3em] opacity-50" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
        {station.genre}
      </div>

      {/* Tagline */}
      <div className="text-center text-sm italic opacity-40" style={{ fontFamily: "'VT323', monospace" }}>
        &quot;{station.tagline}&quot;
      </div>

      {/* Now Playing */}
      {nowPlaying && (
        <div className="mt-4 pt-3 border-t border-green-900/50">
          <div className="text-xs opacity-40 mb-1" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
            NOW PLAYING
          </div>
          <div
            className="text-lg truncate glow-green"
            style={{ fontFamily: "'VT323', monospace" }}
          >
            {nowPlaying}
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page Component ───────────────────────────────── */

export default function RadioPage() {
  const [stationIdx, setStationIdx] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [poweredOn, setPoweredOn] = useState(false);
  const [warmingUp, setWarmingUp] = useState(false);
  const [nowPlaying, setNowPlaying] = useState("");
  const [channelChanging, setChannelChanging] = useState(false);
  const [listeners, setListeners] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const station = STATIONS[stationIdx];

  // Helper: start playing a specific station's stream
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

  // Power on with warm-up effect
  const togglePower = useCallback(() => {
    if (!poweredOn) {
      setPoweredOn(true);
      setWarmingUp(true);
      setTimeout(() => setWarmingUp(false), 2000);
    } else {
      setPoweredOn(false);
      setPlaying(false);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
        audioRef.current = null;
      }
    }
  }, [poweredOn]);

  // Play/pause
  const togglePlay = useCallback(() => {
    if (!poweredOn) return;
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
  }, [poweredOn, playing, station, startStream]);

  // Channel change — swap stream if currently playing
  const changeChannel = useCallback(
    (dir: number) => {
      if (!poweredOn) return;
      setChannelChanging(true);
      setTimeout(() => setChannelChanging(false), 600);
      const newIdx = (stationIdx + dir + STATIONS.length) % STATIONS.length;
      setStationIdx(newIdx);
      if (playing) {
        startStream(STATIONS[newIdx]);
      }
    },
    [poweredOn, stationIdx, playing, startStream]
  );

  // Keyboard controls
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowUp" || e.key === "ArrowRight") changeChannel(1);
      else if (e.key === "ArrowDown" || e.key === "ArrowLeft") changeChannel(-1);
      else if (e.key === " ") { e.preventDefault(); togglePlay(); }
      else if (e.key === "p" || e.key === "P") togglePower();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [changeChannel, togglePlay, togglePower]);

  // Poll Icecast status for current station's mount
  useEffect(() => {
    if (!poweredOn) return;
    const poll = async () => {
      try {
        const res = await fetch(STATUS_URL, { cache: "no-store" });
        const data = await res.json();
        const sources = data?.icestats?.source;
        if (!sources) return;
        // sources can be a single object or an array
        const sourceList = Array.isArray(sources) ? sources : [sources];
        // Find the source matching current station's mount
        const currentMount = station.mount;
        const src = sourceList.find(
          (s: Record<string, unknown>) => (s.listenurl as string)?.endsWith(currentMount)
        );
        if (src) {
          setNowPlaying(
            (src.title as string) || (src.server_name as string) || "Unknown Signal"
          );
          setListeners((src.listeners as number) || 0);
        } else {
          setNowPlaying("Tuning...");
          // Sum all listeners across stations
          const total = sourceList.reduce(
            (sum: number, s: Record<string, unknown>) => sum + ((s.listeners as number) || 0),
            0
          );
          setListeners(total);
        }
      } catch {
        // Icecast unreachable
      }
    };
    poll();
    const interval = setInterval(poll, 10000);
    return () => clearInterval(interval);
  }, [poweredOn, station]);

  return (
    <div className="h-screen w-screen flex items-center justify-center p-4 md:p-8" style={{ background: "radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0a 70%)" }}>
      {/* TV Unit */}
      <div className="tv-bezel w-full max-w-2xl">
        {/* Screen */}
        <div className={`crt-screen aspect-video relative ${warmingUp ? "warming-up" : ""}`}>
          {/* Static overlay */}
          <div className="static-overlay" />
          {/* VHS tracking line */}
          <div className="vhs-tracking" />
          {/* Channel change static burst */}
          {channelChanging && (
            <div
              className="absolute inset-0 z-20 channel-static"
              style={{
                background: `repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.1) 2px, rgba(255,255,255,0.1) 4px)`,
              }}
            />
          )}

          {/* Screen content */}
          <div className="relative z-5 h-full flex flex-col justify-between p-6 md:p-8">
            {!poweredOn ? (
              /* Off state */
              <div className="h-full flex items-center justify-center cursor-pointer" onClick={togglePower}>
                <div className="text-center opacity-30 hover:opacity-50 transition-opacity">
                  <div className="text-4xl mb-4">📡</div>
                  <div style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "10px" }}>
                    TAP TO POWER ON
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Top bar */}
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${playing ? "pulse-live" : ""}`} style={{ background: playing ? "#ff3131" : "#333" }} />
                    <span className="text-xs opacity-60" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                      {playing ? "LIVE" : "STANDBY"}
                    </span>
                  </div>
                  <div className="text-xs opacity-40" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                    CH {stationIdx + 1}/{STATIONS.length}
                  </div>
                </div>

                {/* Main display */}
                <div className="flex-1 flex items-center justify-center">
                  <div className="w-full max-w-md">
                    <ChannelDisplay station={station} nowPlaying={playing ? nowPlaying : ""} />
                  </div>
                </div>

                {/* Equalizer + info bar */}
                <div className="flex justify-between items-end">
                  <Equalizer playing={playing} color={station.color} />
                  <div className="text-xs opacity-30 text-right" style={{ fontFamily: "'Share Tech Mono', monospace" }}>
                    <div>👂 {listeners}</div>
                    <div>192kbps MP3</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Control panel below screen */}
        <div className="flex items-center justify-between mt-4 px-4">
          {/* Left: brand */}
          <div className="flex items-center gap-3">
            <div
              className={`power-btn ${poweredOn ? "on" : "off"}`}
              onClick={togglePower}
              title="Power (P)"
            />
            <div className="text-xs text-amber-800/60" style={{ fontFamily: "'Press Start 2P', monospace", fontSize: "7px" }}>
              INTERDIMENSIONAL<br />CABLE CO.
            </div>
          </div>

          {/* Center: play button */}
          <button
            onClick={togglePlay}
            disabled={!poweredOn}
            className="px-6 py-2 rounded-md text-sm tracking-wider transition-all disabled:opacity-20"
            style={{
              fontFamily: "'Share Tech Mono', monospace",
              background: playing ? "rgba(255,49,49,0.2)" : "rgba(57,255,20,0.15)",
              border: `1px solid ${playing ? "#ff3131" : "#39ff14"}44`,
              color: playing ? "#ff3131" : "#39ff14",
            }}
          >
            {playing ? "■ STOP" : "▶ TUNE IN"}
          </button>

          {/* Right: channel buttons */}
          <div className="flex items-center gap-2">
            <button
              className="channel-btn"
              onClick={() => changeChannel(-1)}
              disabled={!poweredOn}
              title="Channel Down (←)"
            >
              ◀
            </button>
            <button
              className="channel-btn"
              onClick={() => changeChannel(1)}
              disabled={!poweredOn}
              title="Channel Up (→)"
            >
              ▶
            </button>
          </div>
        </div>

        {/* Bottom label */}
        <div className="text-center mt-4">
          <div className="text-[8px] tracking-[0.5em] opacity-20" style={{ fontFamily: "'Share Tech Mono', monospace", color: "#8b7355" }}>
            MODEL IRC-2026 · BROADCASTING FROM DIMENSIONS UNKNOWN
          </div>
        </div>
      </div>
    </div>
  );
}
