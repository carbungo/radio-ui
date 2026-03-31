"use client";

import { useState, useEffect, useCallback } from "react";
import "./admin.css";

const TOKEN = "crab-admin-2026";

interface Station {
  id: string;
  name: string;
  mount: string;
  color: string;
  title: string;
  artist: string;
  listeners: number;
  peak: number;
  remaining: number;
  metadata: Record<string, string>;
}

interface Status {
  stations: Station[];
  uptime: string;
  totalListeners: number;
}

function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function StationCard({
  station,
  onAction,
}: {
  station: Station;
  onAction: (action: string, stationId: string) => void;
}) {
  const [skipping, setSkipping] = useState(false);

  const handleSkip = async () => {
    setSkipping(true);
    await onAction("skip", station.id);
    setTimeout(() => setSkipping(false), 1500);
  };

  return (
    <div className="station-card" style={{ "--accent": station.color } as any}>
      <div className="station-header">
        <div className="station-dot" />
        <h3>{station.name}</h3>
        <div className="listener-badge">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          {station.listeners}
        </div>
      </div>

      <div className="now-playing">
        <div className="track-info">
          <span className="track-title">{station.title}</span>
          {station.artist && <span className="track-artist">{station.artist}</span>}
        </div>
        {station.remaining > 0 && (
          <span className="remaining">{formatTime(station.remaining)} left</span>
        )}
      </div>

      <div className="station-actions">
        <button
          className="btn btn-skip"
          onClick={handleSkip}
          disabled={skipping}
        >
          {skipping ? "⏭ Skipping..." : "⏭ Skip"}
        </button>
        <button
          className="btn btn-reload"
          onClick={() => onAction("reload", station.id)}
        >
          🔄 Reload
        </button>
      </div>

      {station.metadata?.album && (
        <div className="meta-extra">
          <span className="meta-tag">💿 {station.metadata.album}</span>
        </div>
      )}
    </div>
  );
}

export default function AdminPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [memory, setMemory] = useState<string | null>(null);
  const [actionLog, setActionLog] = useState<string[]>([]);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/admin", {
        headers: { Authorization: `Bearer ${TOKEN}` },
        cache: "no-store",
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      setStatus(data);
      setLastUpdate(new Date());
      setError(null);
    } catch (e: any) {
      setError(e.message);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    const iv = setInterval(fetchStatus, 3000);
    return () => clearInterval(iv);
  }, [fetchStatus]);

  const handleAction = async (action: string, station: string) => {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action, station }),
      });
      const data = await res.json();
      const msg = `${new Date().toLocaleTimeString()} — ${action} ${station}: ${data.ok ? "✅" : "❌ " + data.error}`;
      setActionLog((prev) => [msg, ...prev].slice(0, 20));
      // Refresh after action
      setTimeout(fetchStatus, 500);
    } catch (e: any) {
      setActionLog((prev) => [`${new Date().toLocaleTimeString()} — ${action} ${station}: ❌ ${e.message}`, ...prev].slice(0, 20));
    }
  };

  const fetchMemory = async () => {
    try {
      const res = await fetch("/api/admin", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action: "runtime_memory" }),
      });
      const data = await res.json();
      setMemory(data.result);
    } catch {}
  };

  return (
    <div className="admin-root">
      <header className="admin-header">
        <div className="header-left">
          <h1>📡 Radio Control</h1>
          <span className="header-sub">Interdimensional Cable Radio — Admin</span>
        </div>
        <div className="header-right">
          {status && (
            <>
              <div className="stat">
                <span className="stat-value">{status.totalListeners}</span>
                <span className="stat-label">listeners</span>
              </div>
              <div className="stat">
                <span className="stat-value">{status.uptime}</span>
                <span className="stat-label">uptime</span>
              </div>
            </>
          )}
          {lastUpdate && (
            <span className="last-update">
              Updated {lastUpdate.toLocaleTimeString()}
            </span>
          )}
        </div>
      </header>

      {error && <div className="error-bar">⚠️ {error}</div>}

      <div className="stations-grid">
        {status?.stations.map((s) => (
          <StationCard key={s.id} station={s} onAction={handleAction} />
        ))}
      </div>

      <div className="bottom-panels">
        <div className="panel action-log">
          <h3>📋 Action Log</h3>
          {actionLog.length === 0 ? (
            <p className="empty">No actions yet</p>
          ) : (
            <ul>
              {actionLog.map((msg, i) => (
                <li key={i}>{msg}</li>
              ))}
            </ul>
          )}
        </div>

        <div className="panel system-panel">
          <h3>⚙️ System</h3>
          <div className="sys-actions">
            <button className="btn btn-sys" onClick={fetchMemory}>
              📊 Memory Usage
            </button>
            <button className="btn btn-sys" onClick={fetchStatus}>
              🔄 Force Refresh
            </button>
          </div>
          {memory && <pre className="memory-output">{memory}</pre>}
        </div>
      </div>
    </div>
  );
}
