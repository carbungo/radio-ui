import { NextRequest, NextResponse } from "next/server";
import * as net from "net";

const LIQUIDSOAP_HOST = process.env.LIQUIDSOAP_HOST || "192.168.1.184";
const LIQUIDSOAP_PORT = parseInt(process.env.LIQUIDSOAP_PORT || "1234");
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "crab-admin-2026";
const ICECAST_URL = process.env.ICECAST_URL || "http://192.168.1.184:8000";
const ICECAST_ADMIN_PASS = process.env.ICECAST_ADMIN_PASS || "crab-admin-2026";

function telnet(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const sock = new net.Socket();
    let data = "";
    const timeout = setTimeout(() => {
      sock.destroy();
      reject(new Error("telnet timeout"));
    }, 5000);

    sock.connect(LIQUIDSOAP_PORT, LIQUIDSOAP_HOST, () => {
      sock.write(command + "\n");
      sock.write("quit\n");
    });
    sock.on("data", (chunk) => (data += chunk.toString()));
    sock.on("end", () => {
      clearTimeout(timeout);
      // Strip telnet protocol noise from liquidsoap responses
      const cleaned = data
        .split("\n")
        .filter((l) => {
          const t = l.trim();
          return t !== "" && t !== "END" && t !== "Bye!" && !t.startsWith("Bye");
        })
        .join("\n")
        .trim();
      resolve(cleaned);
    });
    sock.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });
}

const STATIONS = [
  { id: "gormax", name: "GORMAX FM", mount: "/gormax-fm", playlist: "gormax-fm_m3u", color: "#ff6b35" },
  { id: "void", name: "The Void Lounge", mount: "/void-lounge", playlist: "void-lounge_m3u", color: "#8b5cf6" },
  { id: "neon", name: "Neon Drift FM", mount: "/neon-drift", playlist: "neon-drift_m3u", color: "#06b6d4" },
  { id: "portal", name: "Portal Static", mount: "/portal-static", playlist: "portal-static_m3u", color: "#22c55e" },
  { id: "council", name: "Council Radio Σ-12", mount: "/council-radio", playlist: "council-radio_m3u", color: "#eab308" },
  { id: "mall", name: "MALL∞ FM", mount: "/mall-fm", playlist: "vaporwave_m3u", color: "#e0aaff" },
  { id: "stream", name: "Channel Surfing", mount: "/stream", playlist: null, color: "#ef4444" },
];

async function getIcecastStats() {
  try {
    const res = await fetch(`${ICECAST_URL}/status-json.xsl`, { cache: "no-store" });
    const data = await res.json();
    let sources = data?.icestats?.source || [];
    if (!Array.isArray(sources)) sources = [sources];
    const map: Record<string, any> = {};
    for (const s of sources) {
      // listenurl contains the mount path
      const mount = s.listenurl?.replace(/.*:8000/, "") || s.server_name || "";
      map[mount] = {
        listeners: s.listeners || 0,
        peak: s.listener_peak || 0,
        bitrate: s.bitrate || 0,
        title: s.title || "",
        artist: s.artist || "",
        genre: s.genre || "",
      };
    }
    return map;
  } catch {
    return {};
  }
}

async function getStationStatus() {
  const [iceStats, uptime] = await Promise.all([
    getIcecastStats(),
    telnet("uptime").catch(() => "unknown"),
  ]);

  const stations = await Promise.all(
    STATIONS.map(async (s) => {
      let metadata: Record<string, string> = {};
      let remaining = 0;
      try {
        const raw = await telnet(`out_${s.id}.metadata`);
        for (const line of raw.split("\n")) {
          const m = line.match(/^(\w+)="(.+)"$/);
          if (m) metadata[m[1]] = m[2];
          // Also match --- N --- lines (skip them)
        }
      } catch {}
      try {
        const r = await telnet(`out_${s.id}.remaining`);
        remaining = parseFloat(r) || 0;
      } catch {}

      const ice = iceStats[s.mount] || {};
      return {
        ...s,
        metadata,
        remaining,
        listeners: ice.listeners || 0,
        peak: ice.peak || 0,
        title: metadata.title || ice.title || "Unknown",
        artist: metadata.artist || ice.artist || "",
      };
    })
  );

  return { stations, uptime, totalListeners: stations.reduce((a, s) => a + s.listeners, 0) };
}

export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (token !== ADMIN_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const status = await getStationStatus();
    return NextResponse.json(status);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (token !== ADMIN_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action, station } = body;

    switch (action) {
      case "skip": {
        // Skip at playlist source level, not output level.
        // out_X.skip confuses the crossfade buffer (causes buzzing/silence).
        // Playlist skip properly advances the track and lets crossfade blend naturally.
        const s2 = STATIONS.find((s) => s.id === station);
        if (s2?.playlist) {
          const result = await telnet(`${s2.playlist}.skip`);
          return NextResponse.json({ ok: true, result });
        } else {
          // Fallback for stream/surfing (no dedicated playlist)
          const result = await telnet(`out_${station}.skip`);
          return NextResponse.json({ ok: true, result });
        }
      }
      case "reload": {
        const s = STATIONS.find((s) => s.id === station);
        if (!s?.playlist) return NextResponse.json({ error: "no playlist" }, { status: 400 });
        const result = await telnet(`${s.playlist}.reload`);
        return NextResponse.json({ ok: true, result });
      }
      case "skip_playlist": {
        const s = STATIONS.find((s) => s.id === station);
        if (!s?.playlist) return NextResponse.json({ error: "no playlist" }, { status: 400 });
        const result = await telnet(`${s.playlist}.skip`);
        return NextResponse.json({ ok: true, result });
      }
      case "runtime_memory": {
        const result = await telnet("runtime.memory");
        return NextResponse.json({ ok: true, result });
      }
      case "uptime": {
        const result = await telnet("uptime");
        return NextResponse.json({ ok: true, result });
      }
      default:
        return NextResponse.json({ error: "unknown action" }, { status: 400 });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
