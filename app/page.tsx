"use client";

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  type CSSProperties,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  ApprovalState,
  CivilianMessage,
  CivilianSOSRequest,
  CRDTEvent,
  Drone,
  DroneId,
  DroneState,
  EnvironmentState,
  HazardType,
  LayerKey,
  ObstacleHazard,
  SurvivorHotspot,
  ViewMode,
} from "./types/mission";

import JeevanLinkModal from "./components/JeevanLinkModal";
import AuditExportModal from "./components/AuditExportModal";
import SimControlsBar, { type SimToolMode } from "./components/SimControlsBar";
import RealMissionMap from "./components/RealMissionMap";

declare global {
  interface Window {
    google?: any;
    __jeevanMeshGoogleMaps?: Promise<any>;
    gm_authFailure?: () => void;
  }

  interface ImportMetaEnv {
    readonly VITE_GOOGLE_MAPS_API_KEY?: string;
  }

  interface ImportMeta {
    readonly env: ImportMetaEnv;
  }
}

const MAX_SCENARIO_STEP = 7;

const SCENARIO_STEPS = [
  {
    title: "Mission baseline",
    short: "Search",
    detail: "Four agents divide Sector A without assigning a permanent leader.",
  },
  {
    title: "Thermal clue detected",
    short: "Detect",
    detail: "D1 raises Hotspot H1 to 82% and asks D2 for an independent view.",
  },
  {
    title: "Route obstruction",
    short: "Reroute",
    detail: "A landslide blocks D2. D* Lite computes a safe local detour.",
  },
  {
    title: "Battery-aware handoff",
    short: "Handoff",
    detail: "D4 reaches reserve energy. Its supply task and mission capsule move to D3.",
  },
  {
    title: "Deliberate mesh partition",
    short: "Disconnect",
    detail: "D4 loses every link but keeps acting from its last verified mission state.",
  },
  {
    title: "JeevanLink activated",
    short: "Connect",
    detail: "D3 becomes a relay and broadcasts a local emergency portal to survivors.",
  },
  {
    title: "Store–carry–forward sync",
    short: "Reconnect",
    detail: "D4 returns with six signed packets; the swarm merges its offline discoveries.",
  },
  {
    title: "Human safety checkpoint",
    short: "Approve",
    detail: "AI recommends a rooftop winch approach. A commander must authorize it.",
  },
];

const INITIAL_OBSTACLES: ObstacleHazard[] = [
  {
    id: "OBS-1",
    label: "Bhagirathi Landslide",
    type: "landslide",
    x: 38.3,
    y: 61.5,
    radius: 34,
    createdTick: 0,
  },
  {
    id: "OBS-2",
    label: "Flash Flood Culvert",
    type: "flood",
    x: 69.0,
    y: 52.0,
    radius: 28,
    createdTick: 0,
  },
];

const INITIAL_SURVIVORS: SurvivorHotspot[] = [
  {
    id: "H1",
    label: "Hotspot H1 (Rooftop)",
    x: 62.2,
    y: 29.2,
    confidence: 82,
    sources: ["Radiometric Thermal", "YOLO11n RGB"],
    status: "verified",
    elevation: 2420,
    headcount: 2,
    timestamp: "01:28",
  },
  {
    id: "H2",
    label: "Hotspot H2 (Debris Pocket)",
    x: 69.6,
    y: 60.0,
    confidence: 61,
    sources: ["Acoustic Array", "Thermal Clue"],
    status: "review",
    elevation: 2380,
    headcount: 1,
    timestamp: "01:25",
  },
  {
    id: "H3",
    label: "Hotspot H3 (Riverbank Trail)",
    x: 55.5,
    y: 39.2,
    confidence: 28,
    sources: ["Stale Visual Evidence"],
    status: "stale",
    elevation: 2350,
    headcount: 0,
    timestamp: "01:12",
  },
];

const INITIAL_CRDT_EVENTS: CRDTEvent[] = [
  {
    id: "EVT-8921",
    time: "01:28",
    tone: "blue",
    type: "OBSERVATION",
    droneId: "D1",
    text: "New evidence added at Hotspot H1 (82% confidence · 2-sensor match)",
    vectorClock: { D1: 14, D2: 11, D3: 18, D4: 8 },
    signature: "ed25519:a71c89f24b8109d3",
  },
  {
    id: "EVT-8920",
    time: "01:27",
    tone: "orange",
    type: "ROLE_CHANGE",
    droneId: "D3",
    text: "D3 dynamically assigned Firefly Relay role for Sector A",
    vectorClock: { D1: 13, D2: 11, D3: 17, D4: 8 },
    signature: "ed25519:3e91ba04821a7c55",
  },
  {
    id: "EVT-8919",
    time: "01:26",
    tone: "orange",
    type: "TASK_HANDOFF",
    droneId: "D4",
    text: "Battery reserve threshold reached (17%) — Task Capsule handed to D3",
    vectorClock: { D1: 12, D2: 10, D3: 16, D4: 8 },
    signature: "ed25519:5f9024cbb19301da",
  },
  {
    id: "EVT-8918",
    time: "01:25",
    tone: "red",
    type: "HAZARD_DETECTED",
    droneId: "D2",
    text: "Route blocked near Grid 512, 640 — D* Lite calculated obstacle detour",
    vectorClock: { D1: 12, D2: 10, D3: 15, D4: 7 },
    signature: "ed25519:d829910aa394bc12",
  },
  {
    id: "EVT-8917",
    time: "01:22",
    tone: "slate",
    type: "PARTITION_DETECTED",
    droneId: "D4",
    text: "Mesh partition detected — D4 buffering signed packets in local DTN store",
    vectorClock: { D1: 11, D2: 9, D3: 14, D4: 6 },
    signature: "ed25519:10ccba78e0284791",
  },
  {
    id: "EVT-8916",
    time: "01:18",
    tone: "green",
    type: "OBSERVATION",
    droneId: "D1",
    text: "Possible survivor detected by RGB + thermal sensor fusion",
    vectorClock: { D1: 10, D2: 8, D3: 12, D4: 5 },
    signature: "ed25519:98aa124cfb839211",
  },
];

const INITIAL_CIV_MESSAGES: CivilianMessage[] = [
  {
    id: "m1",
    sender: "commander",
    text: "BROADCAST: Flash flood alert in Bhagirathi Valley. Move to high ground immediately.",
    time: "01:15",
  },
  {
    id: "m2",
    sender: "civilian",
    text: "We are 3 people cut off near Dharali temple. Road is submerged.",
    time: "01:20",
  },
  {
    id: "m3",
    sender: "commander",
    text: "Drone D3 is overhead acting as mesh relay. Hold position on high ground.",
    time: "01:24",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return [hours, minutes, secs]
    .map((part) => part.toString().padStart(2, "0"))
    .join(":");
}

function spiralPath(
  cx: number,
  cy: number,
  maxRadius: number,
  turns = 3.25,
  points = 160,
) {
  let path = "";
  for (let index = 0; index <= points; index += 1) {
    const ratio = index / points;
    const theta = ratio * turns * Math.PI * 2;
    const radius = 8 + ratio * maxRadius;
    const x = cx + radius * Math.cos(theta);
    const y = cy + radius * Math.sin(theta) * 0.78;
    path += `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)} `;
  }
  return path;
}

function linePath(points: Array<[number, number]>) {
  return points
    .map(([x, y], index) => `${index === 0 ? "M" : "L"}${x},${y}`)
    .join(" ");
}

function getDrones(
  step: number,
  tick: number,
  manualFaults: Record<DroneId, Drone["manualFault"]> = {
    D1: "none",
    D2: "none",
    D3: "none",
    D4: "none",
  },
  env: EnvironmentState = { windSpeed: 20, weather: "clear", turbulent: false },
): Drone[] {
  const phase = tick / 8;
  const windDrift =
    env.windSpeed > 35 ? Math.sin(tick * 0.4) * (env.windSpeed / 45) : 0;
  const spiralRadius = step >= 1 ? Math.max(3.2, 7.8 - step * 0.5) : 6.5;
  const d1x = 52 + Math.cos(phase) * spiralRadius + windDrift;
  const d1y = 28 + Math.sin(phase) * spiralRadius * 0.72;
  const d4Offline = step === 4 || step === 5 || manualFaults.D4 === "partition";
  const d4Syncing = step === 6;

  return [
    {
      id: "D1",
      role:
        manualFaults.D1 === "sensor_fault"
          ? "SCOUT (DEGRADED)"
          : "SCOUT",
      color: "#42a846",
      x: clamp(d1x, 8, 92),
      y: clamp(d1y, 8, 92),
      z: 63,
      battery:
        manualFaults.D1 === "battery_drain"
          ? 14
          : clamp(
              72 - Math.floor(tick / (env.windSpeed > 35 ? 120 : 190)),
              28,
              72,
            ),
      speed: env.weather === "rain" ? 9 : 12,
      signal: manualFaults.D1 === "partition" ? 0 : 92,
      state:
        manualFaults.D1 === "partition"
          ? "offline"
          : manualFaults.D1 === "battery_drain"
            ? "weak"
            : "active",
      task:
        manualFaults.D1 === "sensor_fault"
          ? "Optical degraded · secondary verify"
          : manualFaults.D1 === "partition"
            ? "Buffer packets locally · last state"
            : step >= 1
              ? "BubbleNet scan · H1"
              : "Search Sector A",
      packets: manualFaults.D1 === "partition" ? 4 : 0,
      rfRange: 75,
      manualFault: manualFaults.D1,
    },
    {
      id: "D2",
      role:
        manualFaults.D2 === "sensor_fault"
          ? "VERIFIER (GLITCH)"
          : "VERIFY",
      color: "#ef8200",
      x: clamp(22 + Math.sin(phase / 1.8) * 2.5 + windDrift, 8, 92),
      y: clamp(70 + Math.cos(phase / 1.8) * 2, 8, 92),
      z: 58,
      battery:
        manualFaults.D2 === "battery_drain"
          ? 14
          : step >= 3
            ? 31
            : 34,
      speed: step >= 2 ? 7 : 10,
      signal:
        manualFaults.D2 === "partition"
          ? 0
          : step >= 4
            ? 58
            : 66,
      state:
        manualFaults.D2 === "partition"
          ? "offline"
          : step >= 3 || manualFaults.D2 === "battery_drain"
            ? "weak"
            : "active",
      task:
        manualFaults.D2 === "sensor_fault"
          ? "Thermal noise · re-calibrating"
          : manualFaults.D2 === "partition"
            ? "Partitioned · route audit"
            : step >= 2
              ? "Verify H2 · detour"
              : "Verify Hotspot H2",
      packets: manualFaults.D2 === "partition" ? 5 : 1,
      rfRange: 68,
      manualFault: manualFaults.D2,
    },
    {
      id: "D3",
      role:
        manualFaults.D3 === "sensor_fault"
          ? "RELAY (BACKUP)"
          : step >= 5
            ? "RELAY + SUPPLY"
            : "RELAY",
      color: "#2879d0",
      x: clamp(step >= 5 ? 67 : 73, 8, 92),
      y: clamp(step >= 5 ? 49 : 46, 8, 92),
      z: step >= 5 ? 92 : 81,
      battery:
        manualFaults.D3 === "battery_drain"
          ? 14
          : clamp(
              82 - Math.floor(tick / (env.windSpeed > 35 ? 150 : 240)),
              38,
              82,
            ),
      speed: 11,
      signal: manualFaults.D3 === "partition" ? 0 : 95,
      state:
        manualFaults.D3 === "partition"
          ? "offline"
          : manualFaults.D3 === "battery_drain"
            ? "weak"
            : "active",
      task:
        manualFaults.D3 === "sensor_fault"
          ? "Mesh relay only · optical isolated"
          : step >= 3
            ? "Inherited supply + mesh relay"
            : "Relay & scan",
      packets:
        step >= 6 ? 6 : manualFaults.D3 === "partition" ? 7 : 0,
      rfRange: 105,
      manualFault: manualFaults.D3,
    },
    {
      id: "D4",
      role: step >= 3 ? "LOCAL SCOUT" : "SUPPLY",
      color: "#d63a3a",
      x: clamp(step >= 6 ? 75 : 79, 8, 92),
      y: clamp(step >= 6 ? 69 : 72, 8, 92),
      z: d4Offline ? 42 : 49,
      battery:
        manualFaults.D4 === "battery_drain"
          ? 12
          : step >= 3
            ? 17
            : 46,
      speed: d4Offline ? 4 : 9,
      signal: d4Offline ? 0 : d4Syncing ? 61 : 78,
      state: d4Offline
        ? "offline"
        : d4Syncing
          ? "syncing"
          : step >= 3 || manualFaults.D4 === "battery_drain"
            ? "weak"
            : "active",
      task: d4Offline
        ? "Continue locally · last verified state"
        : d4Syncing
          ? "Merging six offline packets"
          : step >= 3
            ? "Return-to-base reserved"
            : "Medical supply drop",
      packets: d4Offline || d4Syncing ? 6 : 0,
      rfRange: 55,
      manualFault: manualFaults.D4,
    },
  ];
}

function StatusPill({ state }: { state: DroneState }) {
  const label =
    state === "active"
      ? "Good"
      : state === "weak"
        ? "Weak"
        : state === "syncing"
          ? "Syncing"
          : "No link";
  return <span className={`status-pill ${state}`}>{label}</span>;
}

function SignalBars({ value }: { value: number }) {
  return (
    <span className="signal-bars" aria-label={`${value}% signal`}>
      {[22, 42, 66, 90].map((threshold, index) => (
        <i
          key={threshold}
          className={value >= threshold ? "on" : ""}
          style={{ height: 4 + index * 3 }}
        />
      ))}
    </span>
  );
}

function DroneMarker({
  drone,
  selected,
  onSelect,
}: {
  drone: Drone;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      className={`drone-marker ${drone.state} ${selected ? "selected" : ""}`}
      style={
        {
          left: `${drone.x}%`,
          top: `${drone.y}%`,
          "--drone-color": drone.color,
          "--altitude-scale": 0.94 + drone.z / 900,
        } as CSSProperties
      }
      onClick={onSelect}
      aria-label={`${drone.id}, ${drone.role}, ${drone.state}`}
    >
      <span className="drone-glyph" aria-hidden="true">
        <i />
        <b>{drone.id}</b>
        <i />
      </span>
      <span className="drone-tag">
        <strong>{drone.id}</strong>
        <small>{drone.battery}%</small>
      </span>
    </button>
  );
}

function NetworkGraph({ drones }: { drones: Drone[] }) {
  const d4Offline = drones[3].state === "offline";
  return (
    <div className="network-graph" aria-label="Peer-to-peer mesh topology">
      <svg viewBox="0 0 300 118" role="img">
        <line x1="52" y1="28" x2="144" y2="59" className="graph-good" />
        <line x1="52" y1="92" x2="144" y2="59" className="graph-good" />
        <line x1="144" y1="59" x2="246" y2="25" className="graph-good" />
        <line
          x1="144"
          y1="59"
          x2="246"
          y2="93"
          className={d4Offline ? "graph-offline" : "graph-weak"}
        />
        <line x1="52" y1="28" x2="246" y2="25" className="graph-soft" />
      </svg>
      {drones.map((drone, index) => {
        const positions = [
          [17, 14],
          [17, 69],
          [81, 11],
          [81, 66],
        ];
        return (
          <span
            key={drone.id}
            className={`graph-node ${drone.state}`}
            style={{
              left: `${positions[index][0]}%`,
              top: `${positions[index][1]}%`,
              background: drone.color,
            }}
          >
            {drone.id}
          </span>
        );
      })}
      <span className="graph-hub">P2P</span>
    </div>
  );
}

function ConfidenceRing({ value, tone }: { value: number; tone: string }) {
  return (
    <span
      className="confidence-ring"
      style={
        {
          "--confidence": `${value * 3.6}deg`,
          "--ring-color": tone,
        } as CSSProperties
      }
    >
      <b>{value}%</b>
    </span>
  );
}

function GoogleMissionMap({
  drones,
  layers,
  scenarioStep,
  selectedDrone,
  onSelectDrone,
  viewMode,
  zoom,
  spiralRadius,
  onStatus,
  survivors,
}: {
  drones: Drone[];
  layers: Record<LayerKey, boolean>;
  scenarioStep: number;
  selectedDrone: Drone["id"];
  onSelectDrone: (id: Drone["id"]) => void;
  viewMode: ViewMode;
  zoom: number;
  spiralRadius: number;
  onStatus: (status: "loading" | "ready" | "failed") => void;
  survivors: SurvivorHotspot[];
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState("");
  const apiKey =
    typeof process !== "undefined" && process.env?.VITE_GOOGLE_MAPS_API_KEY
      ? process.env.VITE_GOOGLE_MAPS_API_KEY
      : typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY
        ? (import.meta as any).env.VITE_GOOGLE_MAPS_API_KEY.trim()
        : "";

  useEffect(() => {
    let cancelled = false;

    async function loadGoogleMaps() {
      onStatus("loading");
      if (!apiKey) {
        setMapError("Google Maps key missing — add VITE_GOOGLE_MAPS_API_KEY to .env.local");
        onStatus("failed");
        return;
      }

      try {
        window.gm_authFailure = () => {
          setMapError("Google Maps authorization unavailable");
          setMapReady(false);
          mapRef.current = null;
          onStatus("failed");
        };
        if (!window.__jeevanMeshGoogleMaps) {
          window.__jeevanMeshGoogleMaps = new Promise((resolve, reject) => {
            if (window.google?.maps) {
              resolve(window.google);
              return;
            }

            const script = document.createElement("script");
            script.id = "jeevanmesh-google-maps";
            script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
            script.async = true;
            script.defer = true;
            script.onload = () => resolve(window.google);
            script.onerror = () =>
              reject(new Error("Google Maps SDK could not be loaded"));
            document.head.appendChild(script);
          });
        }

        const google = await window.__jeevanMeshGoogleMaps;
        if (cancelled || !containerRef.current) return;

        mapRef.current = new google.maps.Map(containerRef.current, {
          center: { lat: 30.981, lng: 78.934 },
          zoom: 15,
          mapTypeId: "terrain",
          tilt: 0,
          heading: 0,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: "greedy",
          keyboardShortcuts: true,
          backgroundColor: "#dfe7e7",
        });
        setMapReady(true);
        onStatus("ready");
      } catch (error) {
        setMapError(
          error instanceof Error
            ? error.message
            : "Google Maps failed to initialize",
        );
        onStatus("failed");
      }
    }

    loadGoogleMaps();
    return () => {
      cancelled = true;
      overlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
      overlaysRef.current = [];
      window.gm_authFailure = undefined;
    };
  }, [apiKey, onStatus]);

  useEffect(() => {
    const map = mapRef.current;
    if (!mapReady || !map) return;
    map.setZoom(zoom);
    map.setMapTypeId(viewMode === "3d" ? "satellite" : "terrain");
    map.setTilt(viewMode === "3d" ? 45 : 0);
    map.setHeading(viewMode === "3d" ? 18 : 0);
  }, [mapReady, viewMode, zoom]);

  useEffect(() => {
    const google = window.google;
    const map = mapRef.current;
    if (!mapReady || !google?.maps || !map) return;

    overlaysRef.current.forEach((overlay) => overlay.setMap?.(null));
    overlaysRef.current = [];
    const overlays = overlaysRef.current;
    const center = { lat: 30.981, lng: 78.934 };
    const toLatLng = (x: number, y: number) => ({
      lat: center.lat + (50 - y) * 0.00009,
      lng: center.lng + (x - 50) * 0.00012,
    });

    if (layers.heatmap) {
      const heatZones = [
        { x: 51, y: 28.9, radius: 175, color: "#ef4b35" },
        { x: 23.8, y: 72.3, radius: 148, color: "#ef8a23" },
        { x: 55.5, y: 60.3, radius: 92, color: "#d5ac38" },
      ];
      heatZones.forEach((zone) => {
        [1, 0.65, 0.34].forEach((scale, index) => {
          overlays.push(
            new google.maps.Circle({
              map,
              center: toLatLng(zone.x, zone.y),
              radius: zone.radius * scale,
              fillColor: index === 0 ? "#65b94f" : zone.color,
              fillOpacity: index === 0 ? 0.08 : index === 1 ? 0.1 : 0.18,
              strokeOpacity: index === 2 ? 0.35 : 0,
              strokeColor: zone.color,
              strokeWeight: 1.5,
              clickable: false,
            }),
          );
        });
      });
    }

    if (layers.routes) {
      const spiralCenter = toLatLng(51, 28.9);
      const spiralCoordinates = Array.from({ length: 150 }, (_, index) => {
        const ratio = index / 149;
        const theta = ratio * 3.25 * Math.PI * 2;
        const radius = 8 + ratio * spiralRadius;
        return {
          lat: spiralCenter.lat + (radius * Math.sin(theta)) / 111320,
          lng:
            spiralCenter.lng +
            (radius * Math.cos(theta)) /
              (111320 * Math.cos((spiralCenter.lat * Math.PI) / 180)),
        };
      });
      overlays.push(
        new google.maps.Polyline({
          map,
          path: spiralCoordinates,
          strokeColor: "#287dcc",
          strokeOpacity: 0.95,
          strokeWeight: 3,
          clickable: false,
          icons: [
            {
              icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 2 },
              offset: "0",
              repeat: "14px",
            },
          ],
        }),
      );
    }

    if (layers.links) {
      const links = [
        [drones[0], drones[2], "#35a04a"],
        [drones[1], drones[2], "#e4871f"],
        [drones[0], drones[1], "#35a04a"],
        [
          drones[2],
          drones[3],
          drones[3].state === "offline" ? "#d83f3a" : "#e4871f",
        ],
      ] as const;
      links.forEach(([from, to, color]) => {
        overlays.push(
          new google.maps.Polyline({
            map,
            path: [toLatLng(from.x, from.y), toLatLng(to.x, to.y)],
            strokeColor: color,
            strokeOpacity: 0,
            strokeWeight: 2,
            icons: [
              {
                icon: { path: "M 0,-1 0,1", strokeOpacity: 0.95, scale: 1.8 },
                offset: "0",
                repeat: "11px",
              },
            ],
            clickable: false,
          }),
        );
      });
    }

    if (layers.obstacles && scenarioStep >= 2) {
      const blocked = toLatLng(38.3, 61.5);
      overlays.push(
        new google.maps.Circle({
          map,
          center: blocked,
          radius: 34,
          fillColor: "#dc4439",
          fillOpacity: 0.22,
          strokeColor: "#dc4439",
          strokeOpacity: 0.9,
          strokeWeight: 2,
          clickable: false,
        }),
        new google.maps.Marker({
          map,
          position: blocked,
          title: "Landslide — route blocked",
          label: { text: "!", color: "#ffffff", fontWeight: "900" },
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 13,
            fillColor: "#d9413a",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        }),
      );
    }

    survivors.forEach((survivor) => {
      overlays.push(
        new google.maps.Marker({
          map,
          position: toLatLng(survivor.x, survivor.y),
          title: `${survivor.label} · ${survivor.confidence}%`,
          label: {
            text: survivor.status === "sos" ? "SOS" : "S",
            color: "#ffffff",
            fontSize: "10px",
            fontWeight: "800",
          },
          icon: {
            path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
            scale: 7,
            fillColor: survivor.status === "sos" ? "#8b3cf0" : "#7451c7",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
          },
        }),
      );
    });

    drones.forEach((drone) => {
      const marker = new google.maps.Marker({
        map,
        position: toLatLng(drone.x, drone.y),
        title: `${drone.id} · ${drone.role} · ${drone.task}`,
        zIndex: drone.id === selectedDrone ? 50 : 20,
        label: {
          text: drone.id,
          color: "#ffffff",
          fontSize: "9px",
          fontWeight: "900",
        },
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: drone.id === selectedDrone ? 15 : 12,
          fillColor: drone.state === "offline" ? "#7d858b" : drone.color,
          fillOpacity: 1,
          strokeColor: drone.id === selectedDrone ? "#10202e" : "#ffffff",
          strokeWeight: drone.id === selectedDrone ? 4 : 2.5,
        },
      });
      marker.addListener("click", () => onSelectDrone(drone.id));
      overlays.push(marker);
    });
  }, [
    drones,
    layers,
    mapReady,
    onSelectDrone,
    scenarioStep,
    selectedDrone,
    spiralRadius,
    survivors,
  ]);

  return (
    <div className="google-map-surface">
      <div
        ref={containerRef}
        className="google-map-canvas"
        aria-label="Google Maps rescue mission map"
      />
      {!mapReady && (
        <div className={`google-map-loading ${mapError ? "error" : ""}`}>
          <span>{mapError ? "!" : "⌁"}</span>
          <strong>{mapError || "Loading secure Google Maps SDK…"}</strong>
          {mapError && (
            <small>Restart the local server after updating .env.local.</small>
          )}
        </div>
      )}
      {mapReady && (
        <span className="google-attribution-chip">
          LIVE GOOGLE MAP · SIMULATED MISSION OVERLAYS
        </span>
      )}
    </div>
  );
}

export default function Home() {
  const [missionSeconds, setMissionSeconds] = useState(5327);
  const [tick, setTick] = useState(0);
  const [missionRunning, setMissionRunning] = useState(true);
  const [scenarioStep, setScenarioStep] = useState(4);
  const [autoDemo, setAutoDemo] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("2d");
  const [mapEngine, setMapEngine] = useState<"real" | "vector">("real");
  const [zoom, setZoom] = useState(15);
  const [selectedDrone, setSelectedDrone] = useState<DroneId>("D4");
  const [approval, setApproval] = useState<ApprovalState>("pending");
  const [showModels, setShowModels] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showJeevanLinkPhone, setShowJeevanLinkPhone] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [googleMapStatus, setGoogleMapStatus] = useState<
    "loading" | "ready" | "failed"
  >("loading");
  const [toast, setToast] = useState(
    "D4 partition isolated — swarm remains operational",
  );

  // Advanced simulation states
  const [toolMode, setToolMode] = useState<SimToolMode>("inspect");
  const [selectedHazardType, setSelectedHazardType] =
    useState<HazardType>("landslide");
  const [environment, setEnvironment] = useState<EnvironmentState>({
    windSpeed: 20,
    weather: "clear",
    turbulent: false,
  });
  const [manualFaults, setManualFaults] = useState<
    Record<DroneId, Drone["manualFault"]>
  >({
    D1: "none",
    D2: "none",
    D3: "none",
    D4: "none",
  });
  const [obstacles, setObstacles] = useState<ObstacleHazard[]>(INITIAL_OBSTACLES);
  const [survivors, setSurvivors] =
    useState<SurvivorHotspot[]>(INITIAL_SURVIVORS);
  const [crdtEvents, setCrdtEvents] =
    useState<CRDTEvent[]>(INITIAL_CRDT_EVENTS);
  const [flightTrails, setFlightTrails] = useState<
    Record<DroneId, Array<[number, number]>>
  >({
    D1: [],
    D2: [],
    D3: [],
    D4: [],
  });
  const [civMessages, setCivMessages] =
    useState<CivilianMessage[]>(INITIAL_CIV_MESSAGES);

  const [layers, setLayers] = useState<Record<LayerKey, boolean>>({
    heatmap: true,
    links: true,
    obstacles: true,
    routes: true,
    rfCones: true,
    trails: true,
  });
  const autoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const drones = useMemo(
    () => getDrones(scenarioStep, tick, manualFaults, environment),
    [scenarioStep, tick, manualFaults, environment],
  );

  const activeDrones = drones.filter((drone) => drone.state !== "offline").length;
  const averageEnergy = Math.round(
    drones.reduce((sum, drone) => sum + drone.battery, 0) / drones.length,
  );
  const networkHealth =
    scenarioStep === 4 ? 71 : scenarioStep === 5 ? 79 : scenarioStep === 6 ? 88 : 94;
  const coverage = Math.min(
    40,
    18.6 + tick * 0.018 + Math.max(0, scenarioStep - 4) * 0.32,
  );
  const selected = drones.find((drone) => drone.id === selectedDrone) ?? drones[0];
  const currentStep = SCENARIO_STEPS[scenarioStep];
  const spiralRadius = clamp(178 - scenarioStep * 11, 96, 178);
  const spiral = useMemo(
    () => spiralPath(510, 188, spiralRadius),
    [spiralRadius],
  );

  useEffect(() => {
    if (!missionRunning) return;
    const timer = window.setInterval(() => {
      setMissionSeconds((value) => value + 1);
      setTick((value) => value + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [missionRunning]);

  useEffect(() => {
    return () => {
      if (autoTimer.current) clearInterval(autoTimer.current);
    };
  }, []);

  // Record dynamic flight trails
  useEffect(() => {
    setFlightTrails((prev) => {
      const updated = { ...prev };
      drones.forEach((d) => {
        const pt: [number, number] = [
          Math.round(d.x * 10),
          Math.round(d.y * 6.5),
        ];
        const currentTrail = updated[d.id] ?? [];
        updated[d.id] = [...currentTrail.slice(-18), pt];
      });
      return updated;
    });
  }, [tick, drones]);

  function addCRDTEvent(params: {
    tone: CRDTEvent["tone"];
    type: CRDTEvent["type"];
    droneId: string;
    text: string;
  }) {
    const newEvt: CRDTEvent = {
      id: `EVT-${Math.floor(1000 + Math.random() * 9000)}`,
      time: formatTime(missionSeconds).slice(0, 5),
      tone: params.tone,
      type: params.type,
      droneId: params.droneId,
      text: params.text,
      vectorClock: {
        D1: 14 + Math.floor(tick / 2),
        D2: 11 + Math.floor(tick / 2),
        D3: 18 + tick,
        D4: 8 + tick,
      },
      signature: `ed25519:${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 10)}`,
    };
    setCrdtEvents((prev) => [newEvt, ...prev]);
  }

  function applyScenarioStep(nextStep: number) {
    const safeStep = clamp(nextStep, 0, MAX_SCENARIO_STEP);
    setScenarioStep(safeStep);
    setApproval("pending");
    const message = SCENARIO_STEPS[safeStep];
    setToast(`${message.short.toUpperCase()} · ${message.detail}`);
    if (safeStep === 4) setSelectedDrone("D4");
    if (safeStep === 5) setSelectedDrone("D3");
  }

  function runAutoDemo() {
    if (autoTimer.current) clearInterval(autoTimer.current);
    setAutoDemo(true);
    setMissionRunning(true);
    setTick(0);
    applyScenarioStep(0);
    let next = 0;
    autoTimer.current = setInterval(() => {
      next += 1;
      if (next > MAX_SCENARIO_STEP) {
        if (autoTimer.current) clearInterval(autoTimer.current);
        autoTimer.current = null;
        setAutoDemo(false);
        return;
      }
      applyScenarioStep(next);
    }, 2600);
  }

  function stopAutoDemo() {
    if (autoTimer.current) clearInterval(autoTimer.current);
    autoTimer.current = null;
    setAutoDemo(false);
    setToast(
      "Automatic replay paused. Use the incident controls to continue.",
    );
  }

  function toggleLayer(layer: LayerKey) {
    setLayers((value) => ({ ...value, [layer]: !value[layer] }));
  }

  function respondToApproval(next: ApprovalState) {
    setApproval(next);
    setToast(
      next === "approved"
        ? "COMMANDER APPROVED · Rescue-support route released to D2"
        : "COMMANDER HELD ACTION · Swarm will continue observation only",
    );
    addCRDTEvent({
      tone: next === "approved" ? "green" : "orange",
      type: "HUMAN_APPROVAL",
      droneId: "COMMANDER",
      text:
        next === "approved"
          ? "Commander verified & approved rooftop winch approach for D2."
          : "Commander held high-risk winch action pending wind gust dissipation.",
    });
  }

  function activateFeature(step: number, target = "map") {
    applyScenarioStep(step);
    window.requestAnimationFrame(() => {
      document
        .getElementById(target)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  // Interactive map click for dynamic hazards & survivors
  function handleMapClick(e: React.MouseEvent<SVGSVGElement>) {
    if (toolMode === "inspect") return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);

    if (toolMode === "add_hazard") {
      const newHazard: ObstacleHazard = {
        id: `OBS-${obstacles.length + 1}`,
        label: `Dynamic ${selectedHazardType.toUpperCase()}`,
        type: selectedHazardType,
        x,
        y,
        radius: 32,
        createdTick: tick,
      };
      setObstacles((prev) => [...prev, newHazard]);
      addCRDTEvent({
        tone: "red",
        type: "HAZARD_DETECTED",
        droneId: "D2",
        text: `New ${selectedHazardType} hazard registered at Grid ${x}, ${y}. D* Lite rerouting triggered.`,
      });
      setToast(
        `HAZARD PLACED · Grid ${x}, ${y} (${selectedHazardType.toUpperCase()})`,
      );
    } else if (toolMode === "add_survivor") {
      const newHId = `H${survivors.length + 1}`;
      const newSurv: SurvivorHotspot = {
        id: newHId,
        label: `Hotspot ${newHId} (Operator Flagged)`,
        x,
        y,
        confidence: 68,
        sources: ["Visual Clue", "Incident Commander Flag"],
        status: "review",
        elevation: 2410,
        headcount: 1,
        timestamp: formatTime(missionSeconds).slice(0, 5),
      };
      setSurvivors((prev) => [...prev, newSurv]);
      addCRDTEvent({
        tone: "orange",
        type: "OBSERVATION",
        droneId: "D1",
        text: `New survivor hypothesis ${newHId} flagged at Grid ${x}, ${y} (Conf: 68%). Secondary quorum requested.`,
      });
      setToast(`SURVIVOR HYPOTHESIS ADDED · ${newHId} at Grid ${x}, ${y}`);
    }
  }

  // Civilian SOS from phone portal
  function handleCivilianSOS(req: CivilianSOSRequest) {
    const sosId = `SOS-${Date.now().toString().slice(-4)}`;
    const sosHotspot: SurvivorHotspot = {
      id: sosId,
      label: `CIVILIAN SOS (${req.headcount}P)`,
      x: req.gridX,
      y: req.gridY,
      confidence: 96,
      sources: ["JeevanLink Mesh SOS", "Overhead D3 Relay"],
      status: "sos",
      elevation: 2430,
      headcount: req.headcount,
      timestamp: formatTime(missionSeconds).slice(0, 5),
    };
    setSurvivors((prev) => [sosHotspot, ...prev]);
    setToast(
      `CIVILIAN SOS RECEIVED via D3: ${req.headcount} survivors (${req.medicalCondition || "Urgent"})`,
    );
    addCRDTEvent({
      tone: "purple",
      type: "CIVILIAN_SOS",
      droneId: "D3",
      text: `EMERGENCY SOS: ${req.headcount} persons trapped at Grid ${req.gridX}, ${req.gridY}. Urgency: ${req.urgency.toUpperCase()}. Note: ${req.notes}`,
    });
    setCivMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: "commander",
        text: `[ACKNOWLEDGED] Drone D3 registered distress beacon for ${req.headcount} people. Stay dry, rescue boat alerted.`,
        time: formatTime(missionSeconds).slice(0, 5),
      },
    ]);
  }

  function handleCivilianMessage(text: string) {
    setCivMessages((prev) => [
      ...prev,
      {
        id: `msg-${Date.now()}`,
        sender: "civilian",
        text,
        time: formatTime(missionSeconds).slice(0, 5),
      },
    ]);
    setToast(`CIVILIAN MSG via D3: "${text}"`);
    addCRDTEvent({
      tone: "blue",
      type: "CIVILIAN_SOS",
      droneId: "D3",
      text: `Civilian text packet received: "${text}"`,
    });
  }

  function handleInjectFailure(droneId: DroneId, fault: Drone["manualFault"]) {
    setManualFaults((prev) => ({ ...prev, [droneId]: fault }));
    if (fault === "partition") {
      setToast(
        `FAULT INJECTED · ${droneId} severed from mesh. Local store-carry-forward active.`,
      );
      addCRDTEvent({
        tone: "slate",
        type: "PARTITION_DETECTED",
        droneId,
        text: `Manual fault injection: ${droneId} communication cut off. Divergence tracking engaged.`,
      });
    } else if (fault === "battery_drain") {
      setToast(
        `FAULT INJECTED · ${droneId} battery dropped to 14%. Emergency handoff initiated.`,
      );
      addCRDTEvent({
        tone: "orange",
        type: "TASK_HANDOFF",
        droneId,
        text: `Manual fault injection: ${droneId} power critically low (14%). Task capsule transferred.`,
      });
    } else if (fault === "sensor_fault") {
      setToast(
        `FAULT INJECTED · ${droneId} thermal sensor glitched. Excluded from verification quorum.`,
      );
      addCRDTEvent({
        tone: "red",
        type: "ROLE_CHANGE",
        droneId,
        text: `Manual fault injection: ${droneId} sensor sanity check failed. Demoted to degraded observer.`,
      });
    } else {
      setToast(`${droneId} restored to normal healthy operation.`);
    }
  }

  function handleResetSim() {
    setObstacles(INITIAL_OBSTACLES);
    setSurvivors(INITIAL_SURVIVORS);
    setManualFaults({ D1: "none", D2: "none", D3: "none", D4: "none" });
    setEnvironment({ windSpeed: 20, weather: "clear", turbulent: false });
    setToast("Simulation reset to baseline scenario parameters.");
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#mission"
          aria-label="JeevanMesh mission dashboard"
        >
          <span className="brand-mark" aria-hidden="true">
            JM
          </span>
          <span>
            <strong>JEEVANMESH</strong>
            <small>Self-Healing Rescue Swarm</small>
          </span>
        </a>

        <nav className="main-nav" aria-label="Dashboard sections">
          <a className="active" href="#mission">
            Dashboard
          </a>
          <a href="#map">Map</a>
          <a href="#drones">Drones</a>
          <a href="#evidence">Evidence</a>
          <a href="#network">Network</a>
          <a href="#features">Features</a>
        </nav>

        <div className="topbar-actions">
          <div className="topbar-extra-actions">
            <button
              className="crdt-button"
              onClick={() => setShowAuditModal(true)}
              title="Inspect CRDT Consensus & Export GeoJSON/Audit Ledger"
            >
              <span>📜</span> CRDT & Export
            </button>
            <button
              className="phone-preview-button"
              onClick={() => setShowJeevanLinkPhone(true)}
              title="Simulate what a stranded survivor sees on their smartphone"
            >
              <span>📱</span> JeevanLink Portal
            </button>
          </div>
          <button className="models-button" onClick={() => setShowModels(true)}>
            AI stack
          </button>
          <div className="mission-clock">
            <small>Mission time</small>
            <strong>{formatTime(missionSeconds)}</strong>
          </div>
          <span
            className={`mission-state ${missionRunning ? "live" : "paused"}`}
          >
            <i /> {missionRunning ? "MISSION ACTIVE" : "MISSION PAUSED"}
          </span>
        </div>
      </header>

      <section className="command-strip" aria-label="Demo controls">
        <div className="scenario-copy">
          <span className="eyebrow">HIMALAYAN FLASH-FLOOD · SECTOR A</span>
          <strong>{currentStep.title}</strong>
          <p>{currentStep.detail}</p>
        </div>
        <div
          className="step-dots"
          aria-label={`Scenario step ${scenarioStep + 1} of ${SCENARIO_STEPS.length}`}
        >
          {SCENARIO_STEPS.map((step, index) => (
            <button
              key={step.short}
              className={
                index === scenarioStep
                  ? "current"
                  : index < scenarioStep
                    ? "done"
                    : ""
              }
              onClick={() => applyScenarioStep(index)}
              aria-label={`Jump to ${step.title}`}
              title={step.title}
            >
              <span>{index + 1}</span>
              <small>{step.short}</small>
            </button>
          ))}
        </div>
        <div className="demo-actions">
          <button
            className="secondary-button"
            onClick={() => setMissionRunning((value) => !value)}
          >
            {missionRunning ? "Pause mission" : "Resume mission"}
          </button>
          <button
            className="primary-button"
            onClick={autoDemo ? stopAutoDemo : runAutoDemo}
          >
            <span aria-hidden="true">{autoDemo ? "■" : "▶"}</span>
            {autoDemo ? "Stop replay" : "Run failure demo"}
          </button>
        </div>
      </section>

      {/* Interactive Simulation Controls */}
      <SimControlsBar
        toolMode={toolMode}
        onSelectToolMode={setToolMode}
        selectedHazardType={selectedHazardType}
        onSelectHazardType={setSelectedHazardType}
        environment={environment}
        onChangeEnvironment={setEnvironment}
        drones={drones}
        onInjectFailure={handleInjectFailure}
        onResetSim={handleResetSim}
      />

      <div className="toast" role="status">
        <span className="pulse-dot" />
        <strong>LIVE EVENT</strong>
        <p>{toast}</p>
        <button
          onClick={() =>
            setToast("System monitoring continues across all agents.")
          }
          aria-label="Dismiss event"
        >
          ×
        </button>
      </div>

      <section id="mission" className="overview-section">
        <div className="section-heading">
          <span className="section-number">1</span>
          <div>
            <h1>Mission overview</h1>
            <p>
              Tap any drone or incident step to inspect the swarm&apos;s
              response.
            </p>
          </div>
          <span className="sync-label">
            Last mesh sync · {scenarioStep === 4 ? "00:58:11" : "just now"}
          </span>
        </div>

        <div className="kpi-grid">
          <article className="kpi-card accent-blue">
            <div className="kpi-icon">↗</div>
            <span>Area covered</span>
            <strong>
              {coverage.toFixed(1)} <small>acres</small>
            </strong>
            <div className="progress-track">
              <i style={{ width: `${(coverage / 40) * 100}%` }} />
            </div>
            <p>{((coverage / 40) * 100).toFixed(0)}% of 40.0 acres</p>
          </article>
          <article className="kpi-card accent-orange">
            <div className="kpi-icon">◎</div>
            <span>Survivors detected</span>
            <strong>
              {survivors.length} <small>signals</small>
            </strong>
            <p>
              <b>
                {survivors.filter((s) => s.status === "verified").length}{" "}
                verified
              </b>{" "}
              · {survivors.filter((s) => s.status !== "verified").length}{" "}
              suspected
            </p>
          </article>
          <article className="kpi-card accent-indigo">
            <div className="kpi-icon">◷</div>
            <span>Mission time</span>
            <strong>{formatTime(missionSeconds).slice(0, 5)}</strong>
            <p>Remaining estimate · 00:41:13</p>
          </article>
          <article className="kpi-card accent-green">
            <div className="kpi-icon">▣</div>
            <span>Energy average</span>
            <strong>{averageEnergy}%</strong>
            <p>
              {environment.windSpeed > 35
                ? "Turbulence: +40% burn rate"
                : "Battery-aware allocation active"}
            </p>
          </article>
          <article className="kpi-card accent-cyan">
            <div className="kpi-icon">≋</div>
            <span>Network health</span>
            <strong>{networkHealth}%</strong>
            <p className={networkHealth < 80 ? "warning-text" : "success-text"}>
              {networkHealth < 80 ? "Partition tolerated" : "Mesh healthy"}
            </p>
          </article>
          <article className="kpi-card accent-red">
            <div className="kpi-icon">✣</div>
            <span>Active drones</span>
            <strong>{activeDrones} / 4</strong>
            <p>{4 - activeDrones} offline · no leader dependency</p>
          </article>
        </div>
      </section>

      <section className="main-grid">
        <article id="map" className="panel map-panel">
          <div className="panel-header">
            <div className="title-with-number">
              <span className="section-number">2</span>
              <div>
                <h2>Live rescue map</h2>
                <p>Bhagirathi Valley · 30.981°N, 78.934°E</p>
              </div>
            </div>
            <div className="map-toolbar">
              <div
                className="segmented-control"
                role="group"
                aria-label="Map engine"
              >
                <button
                  className={mapEngine === "real" ? "active" : ""}
                  onClick={() => setMapEngine("real")}
                  title="Real Live Satellite Imagery & Topographic Himalayan Map"
                >
                  🛰️ Real Satellite / Topo
                </button>
                <button
                  className={mapEngine === "vector" ? "active" : ""}
                  onClick={() => setMapEngine("vector")}
                  title="Tactical Vector Map with 3D tilt"
                >
                  📐 Tactical Vector
                </button>
              </div>

              {mapEngine === "vector" && (
                <div
                  className="segmented-control"
                  role="group"
                  aria-label="Map dimension"
                >
                  <button
                    className={viewMode === "2d" ? "active" : ""}
                    onClick={() => setViewMode("2d")}
                  >
                    2D
                  </button>
                  <button
                    className={viewMode === "3d" ? "active" : ""}
                    onClick={() => setViewMode("3d")}
                  >
                    3D
                  </button>
                </div>
              )}

              <div className="layer-controls">
                {(Object.keys(layers) as LayerKey[]).map((layer) => (
                  <label key={layer}>
                    <input
                      type="checkbox"
                      checked={layers[layer]}
                      onChange={() => toggleLayer(layer)}
                    />
                    <span>
                      {layer === "rfCones"
                        ? "RF cones"
                        : layer === "trails"
                          ? "trails"
                          : layer}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {mapEngine === "real" ? (
            <RealMissionMap
              drones={drones}
              layers={layers}
              scenarioStep={scenarioStep}
              selectedDrone={selectedDrone}
              onSelectDrone={setSelectedDrone}
              spiralRadius={spiralRadius}
              obstacles={obstacles}
              survivors={survivors}
              toolMode={toolMode}
              onMapClickCoordinates={(x, y) => {
                if (toolMode === "add_hazard") {
                  const newHazard: ObstacleHazard = {
                    id: `OBS-${obstacles.length + 1}`,
                    label: `Dynamic ${selectedHazardType.toUpperCase()}`,
                    type: selectedHazardType,
                    x,
                    y,
                    radius: 32,
                    createdTick: tick,
                  };
                  setObstacles((prev) => [...prev, newHazard]);
                  addCRDTEvent({
                    tone: "red",
                    type: "HAZARD_DETECTED",
                    droneId: "D2",
                    text: `New ${selectedHazardType} hazard placed at Grid ${x}, ${y}. D* Lite rerouting triggered.`,
                  });
                  setToast(
                    `HAZARD PLACED · Grid ${x}, ${y} (${selectedHazardType.toUpperCase()})`,
                  );
                } else if (toolMode === "add_survivor") {
                  const newHId = `H${survivors.length + 1}`;
                  const newSurv: SurvivorHotspot = {
                    id: newHId,
                    label: `Hotspot ${newHId} (Operator Flagged)`,
                    x,
                    y,
                    confidence: 68,
                    sources: ["Satellite Clue", "Incident Commander Flag"],
                    status: "review",
                    elevation: 2410,
                    headcount: 1,
                    timestamp: formatTime(missionSeconds).slice(0, 5),
                  };
                  setSurvivors((prev) => [...prev, newSurv]);
                  addCRDTEvent({
                    tone: "orange",
                    type: "OBSERVATION",
                    droneId: "D1",
                    text: `New survivor hypothesis ${newHId} flagged at Grid ${x}, ${y} (Conf: 68%). Secondary quorum requested.`,
                  });
                  setToast(
                    `SURVIVOR HYPOTHESIS ADDED · ${newHId} at Grid ${x}, ${y}`,
                  );
                }
              }}
            />
          ) : (
            <div className={`map-stage mode-${viewMode}`}>
            <div
              className={`map-transform ${googleMapStatus === "failed" ? "fallback-mode" : "google-mode"}`}
              style={{ "--map-zoom": zoom } as CSSProperties}
            >
              <GoogleMissionMap
                drones={drones}
                layers={layers}
                scenarioStep={scenarioStep}
                selectedDrone={selectedDrone}
                onSelectDrone={setSelectedDrone}
                viewMode={viewMode}
                zoom={zoom}
                spiralRadius={spiralRadius}
                onStatus={setGoogleMapStatus}
                survivors={survivors}
              />
              <svg
                className={`terrain-map map-canvas-interactive mode-${toolMode}`}
                viewBox="0 0 1000 650"
                preserveAspectRatio="none"
                role="img"
                aria-label="Simulated flood rescue area map"
                onClick={handleMapClick}
              >
                <defs>
                  <linearGradient id="terrainBase" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0" stopColor="#edf3ec" />
                    <stop offset=".48" stopColor="#e6ede6" />
                    <stop offset="1" stopColor="#dce7e8" />
                  </linearGradient>
                  <linearGradient id="river" x1="0" x2="1">
                    <stop offset="0" stopColor="#a9d6e8" stopOpacity=".72" />
                    <stop offset="1" stopColor="#6eb4d2" stopOpacity=".8" />
                  </linearGradient>
                  <radialGradient id="hotHigh">
                    <stop offset="0" stopColor="#ef4b35" stopOpacity=".68" />
                    <stop offset=".28" stopColor="#f6ad37" stopOpacity=".5" />
                    <stop offset=".62" stopColor="#f1d74a" stopOpacity=".28" />
                    <stop offset="1" stopColor="#62bd4c" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="hotMedium">
                    <stop offset="0" stopColor="#ef7d23" stopOpacity=".66" />
                    <stop offset=".38" stopColor="#f5c245" stopOpacity=".4" />
                    <stop offset="1" stopColor="#64bd4d" stopOpacity="0" />
                  </radialGradient>
                  <pattern
                    id="blockedPattern"
                    width="12"
                    height="12"
                    patternUnits="userSpaceOnUse"
                    patternTransform="rotate(45)"
                  >
                    <rect
                      width="12"
                      height="12"
                      fill="#fff4f2"
                      fillOpacity=".78"
                    />
                    <line
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="12"
                      stroke="#e75d51"
                      strokeWidth="4"
                    />
                  </pattern>
                  <pattern
                    id="floodPattern"
                    width="16"
                    height="16"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect
                      width="16"
                      height="16"
                      fill="#e0f2fe"
                      fillOpacity=".75"
                    />
                    <path
                      d="M0 8 Q4 4, 8 8 T16 8"
                      stroke="#0284c7"
                      strokeWidth="2"
                      fill="none"
                    />
                  </pattern>
                  <pattern
                    id="smokePattern"
                    width="20"
                    height="20"
                    patternUnits="userSpaceOnUse"
                  >
                    <rect
                      width="20"
                      height="20"
                      fill="#f1f5f9"
                      fillOpacity=".8"
                    />
                    <circle
                      cx="10"
                      cy="10"
                      r="7"
                      fill="#94a3b8"
                      fillOpacity=".4"
                    />
                  </pattern>
                  <filter
                    id="mapShadow"
                    x="-30%"
                    y="-30%"
                    width="160%"
                    height="160%"
                  >
                    <feDropShadow
                      dx="0"
                      dy="4"
                      stdDeviation="5"
                      floodColor="#14283b"
                      floodOpacity=".16"
                    />
                  </filter>

                  {/* RF Gradient Cones */}
                  <radialGradient id="rfGrad-D1" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#42a846" stopOpacity="0.32" />
                    <stop offset="70%" stopColor="#42a846" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#42a846" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="rfGrad-D2" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#ef8200" stopOpacity="0.32" />
                    <stop offset="70%" stopColor="#ef8200" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#ef8200" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="rfGrad-D3" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#2879d0" stopOpacity="0.38" />
                    <stop offset="70%" stopColor="#2879d0" stopOpacity="0.14" />
                    <stop offset="100%" stopColor="#2879d0" stopOpacity="0" />
                  </radialGradient>
                  <radialGradient id="rfGrad-D4" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#d63a3a" stopOpacity="0.32" />
                    <stop offset="70%" stopColor="#d63a3a" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#d63a3a" stopOpacity="0" />
                  </radialGradient>
                </defs>
                <rect width="1000" height="650" fill="url(#terrainBase)" />
                <g className="contours">
                  <path d="M-30 88 C160 22 263 168 415 91 S705 38 824 101 S1040 94 1080 35" />
                  <path d="M-50 138 C158 71 242 226 430 139 S703 85 841 151 S1045 144 1090 91" />
                  <path d="M-40 198 C143 126 271 286 438 202 S722 142 855 213 S1032 218 1084 163" />
                  <path d="M-60 286 C111 218 256 364 434 287 S713 235 857 301 S1032 314 1090 261" />
                  <path d="M-45 390 C150 314 278 477 449 389 S727 334 842 402 S1034 417 1096 359" />
                  <path d="M-34 508 C125 425 292 583 460 505 S721 451 859 518 S1031 537 1095 476" />
                  <path d="M-20 610 C151 532 284 674 486 598 S741 552 881 616" />
                </g>
                <path
                  className="river"
                  d="M835 -30 C794 69 867 126 823 216 C775 315 851 368 808 466 C778 537 810 596 766 694 L1035 694 L1035 -30 Z"
                  fill="url(#river)"
                />
                <path
                  className="river-line"
                  d="M850 -20 C811 74 879 128 838 223 C798 316 864 379 825 470 C798 535 831 596 787 678"
                />
                <g className="roads">
                  <path
                    className="road-major"
                    d="M-30 512 C123 485 181 408 300 406 C441 403 484 469 599 451 C704 434 743 348 824 324"
                  />
                  <path
                    className="road-major"
                    d="M97 680 C164 569 261 522 320 422 C377 323 373 201 498 145 C609 94 731 126 831 184"
                  />
                  <path
                    className="road-minor"
                    d="M129 82 C208 166 285 155 363 224 S521 287 665 259"
                  />
                  <path
                    className="road-minor"
                    d="M38 306 C150 263 242 314 324 337 S504 334 620 386"
                  />
                  <path
                    className="road-minor"
                    d="M411 608 C474 536 576 534 636 471 S721 401 790 411"
                  />
                </g>
                <g className="buildings">
                  {[
                    [92, 115, 52, 26, -11],
                    [171, 104, 38, 22, 8],
                    [247, 184, 45, 29, -5],
                    [318, 117, 31, 48, 18],
                    [625, 116, 42, 27, -12],
                    [699, 180, 48, 25, 5],
                    [98, 355, 44, 23, 10],
                    [172, 383, 31, 45, -8],
                    [272, 489, 52, 28, 14],
                    [420, 473, 39, 22, -5],
                    [530, 521, 48, 31, 10],
                    [663, 498, 34, 24, -15],
                    [590, 331, 40, 26, 12],
                    [690, 357, 52, 27, -6],
                    [470, 262, 28, 39, 14],
                  ].map(([x, y, w, h, r], index) => (
                    <rect
                      key={index}
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      rx="3"
                      transform={`rotate(${r} ${x + w / 2} ${y + h / 2})`}
                    />
                  ))}
                </g>

                {layers.heatmap && (
                  <g className="heatmap-layer">
                    <ellipse
                      cx="510"
                      cy="188"
                      rx="210"
                      ry="170"
                      fill="url(#hotHigh)"
                    />
                    <ellipse
                      cx="238"
                      cy="470"
                      rx="185"
                      ry="148"
                      fill="url(#hotMedium)"
                    />
                    <ellipse
                      cx="555"
                      cy="392"
                      rx="118"
                      ry="98"
                      fill="url(#hotMedium)"
                      opacity=".35"
                    />
                  </g>
                )}

                {/* RF Cones */}
                {layers.rfCones &&
                  drones.map((drone) => {
                    if (drone.state === "offline") return null;
                    const cx = drone.x * 10;
                    const cy = drone.y * 6.5;
                    const rx = (drone.z / 90) * 115;
                    const ry = (drone.z / 90) * 80;
                    return (
                      <g
                        key={`rf-${drone.id}`}
                        className="rf-cone-group"
                        opacity={viewMode === "3d" ? 0.72 : 0.45}
                      >
                        <ellipse
                          cx={cx}
                          cy={cy}
                          rx={rx}
                          ry={ry}
                          fill={`url(#rfGrad-${drone.id})`}
                          stroke={drone.color}
                          strokeWidth="1.2"
                          strokeDasharray="4 3"
                        />
                        {viewMode === "3d" && (
                          <line
                            x1={cx}
                            y1={cy}
                            x2={cx}
                            y2={cy - drone.z * 0.38}
                            stroke={drone.color}
                            strokeWidth="1.5"
                            strokeDasharray="2 2"
                            className="z-drop-line"
                          />
                        )}
                      </g>
                    );
                  })}

                {/* Dynamic Flight Trails */}
                {layers.trails &&
                  drones.map((drone) => {
                    const trailPoints = flightTrails[drone.id];
                    if (!trailPoints || trailPoints.length < 2) return null;
                    const pathD = linePath(trailPoints);
                    return (
                      <path
                        key={`trail-${drone.id}`}
                        d={pathD}
                        className="flight-trail"
                        stroke={drone.color}
                        strokeWidth="2.5"
                        strokeDasharray="4 3"
                      />
                    );
                  })}

                {layers.routes && (
                  <g className="route-layer">
                    <path className="search-spiral" d={spiral} />
                    <path
                      className="active-route green"
                      d={linePath([
                        [198, 193],
                        [294, 214],
                        [405, 311],
                        [510, 188],
                      ])}
                    />
                    <path
                      className="active-route orange"
                      d={linePath([
                        [220, 470],
                        [332, 426],
                        [407, 354],
                        [470, 323],
                      ])}
                    />
                    <path
                      className="planned-route"
                      d={linePath([
                        [785, 463],
                        [704, 425],
                        [682, 516],
                        [615, 575],
                      ])}
                    />
                  </g>
                )}

                {layers.links && (
                  <g className="mesh-layer">
                    <line
                      x1={drones[0].x * 10}
                      y1={drones[0].y * 6.5}
                      x2={drones[2].x * 10}
                      y2={drones[2].y * 6.5}
                      className="mesh-link good"
                    />
                    <line
                      x1={drones[1].x * 10}
                      y1={drones[1].y * 6.5}
                      x2={drones[2].x * 10}
                      y2={drones[2].y * 6.5}
                      className="mesh-link weak"
                    />
                    <line
                      x1={drones[0].x * 10}
                      y1={drones[0].y * 6.5}
                      x2={drones[1].x * 10}
                      y2={drones[1].y * 6.5}
                      className="mesh-link good"
                    />
                    <line
                      x1={drones[2].x * 10}
                      y1={drones[2].y * 6.5}
                      x2={drones[3].x * 10}
                      y2={drones[3].y * 6.5}
                      className={`mesh-link ${drones[3].state === "offline" ? "down" : "weak"}`}
                    />
                  </g>
                )}

                {/* Dynamic Obstacles (Landslide, Flood, Smoke) */}
                {layers.obstacles && (
                  <g className="obstacle-layer" filter="url(#mapShadow)">
                    {obstacles.map((obs) => {
                      const patternUrl =
                        obs.type === "flood"
                          ? "url(#floodPattern)"
                          : obs.type === "smoke"
                            ? "url(#smokePattern)"
                            : "url(#blockedPattern)";
                      const strokeColor =
                        obs.type === "flood"
                          ? "#0284c7"
                          : obs.type === "smoke"
                            ? "#64748b"
                            : "#dc4439";
                      return (
                        <g key={obs.id}>
                          <rect
                            x={obs.x * 10 - obs.radius}
                            y={obs.y * 6.5 - obs.radius * 0.65}
                            width={obs.radius * 2}
                            height={obs.radius * 1.3}
                            rx="6"
                            fill={patternUrl}
                            stroke={strokeColor}
                            strokeWidth="2.5"
                          />
                          <text
                            x={obs.x * 10}
                            y={obs.y * 6.5 + 4}
                            textAnchor="middle"
                            fill={strokeColor}
                            fontWeight="900"
                            fontSize="10"
                          >
                            {obs.type === "flood"
                              ? "FLOOD"
                              : obs.type === "smoke"
                                ? "SMOKE"
                                : "BLOCKED"}
                          </text>
                        </g>
                      );
                    })}
                  </g>
                )}

                {/* Hotspot & Survivor Markers */}
                <g className="hotspot-labels">
                  {survivors.map((s) => {
                    const cx = s.x * 10;
                    const cy = s.y * 6.5;
                    const isSOS = s.status === "sos";
                    return (
                      <g
                        key={s.id}
                        transform={`translate(${cx} ${cy})`}
                        className={`survivor-group ${isSOS ? "sos-group" : ""}`}
                      >
                        {isSOS ? (
                          <>
                            <circle r="36" className="hotspot sos" />
                            <circle r="18" fill="#8b3cf0" fillOpacity="0.85" />
                            <text
                              textAnchor="middle"
                              y="4"
                              fill="#ffffff"
                              fontWeight="900"
                              fontSize="11"
                            >
                              SOS
                            </text>
                            <text
                              textAnchor="middle"
                              y="24"
                              fill="#8b3cf0"
                              fontWeight="900"
                              fontSize="10"
                            >
                              {s.headcount}P
                            </text>
                          </>
                        ) : (
                          <>
                            <circle
                              r={
                                s.confidence > 75
                                  ? 35
                                  : s.confidence > 50
                                    ? 32
                                    : 28
                              }
                              className={`hotspot ${s.confidence > 75 ? "high" : s.confidence > 50 ? "medium" : "low"}`}
                            />
                            <text
                              textAnchor="middle"
                              y="5"
                              fontWeight="800"
                              fontSize="12"
                            >
                              {s.confidence}%
                            </text>
                          </>
                        )}
                      </g>
                    );
                  })}
                </g>

                <g className="survivor-pins">
                  {survivors.map((s) => (
                    <g
                      key={`pin-${s.id}`}
                      transform={`translate(${s.x * 10} ${s.y * 6.5})`}
                    >
                      <path
                        d="M0 -20 C-13 -20 -18 -6 -12 4 L0 23 L12 4 C18 -6 13 -20 0 -20Z"
                        fill={s.status === "sos" ? "#8b3cf0" : "#7451c7"}
                      />
                      <circle cy="-7" r="5" fill="#ffffff" />
                    </g>
                  ))}
                </g>
              </svg>

              {drones.map((drone) => (
                <DroneMarker
                  key={drone.id}
                  drone={drone}
                  selected={drone.id === selectedDrone}
                  onSelect={() => setSelectedDrone(drone.id)}
                />
              ))}
            </div>

            {googleMapStatus === "failed" && (
              <div className="offline-map-chip">
                <span>OFFLINE TERRAIN ACTIVE</span>
                <strong>
                  Google authorization unavailable · mission simulation
                  continues
                </strong>
              </div>
            )}

            <div className="map-zoom" role="group" aria-label="Map zoom controls">
              <button
                onClick={() => setZoom((value) => clamp(value + 1, 12, 19))}
                aria-label="Zoom in"
              >
                +
              </button>
              <button onClick={() => setZoom(15)} aria-label="Reset map zoom">
                ⌖
              </button>
              <button
                onClick={() => setZoom((value) => clamp(value - 1, 12, 19))}
                aria-label="Zoom out"
              >
                −
              </button>
            </div>

            <div className="map-legend">
              <span>
                <i className="legend-line search" /> BubbleNet path
              </span>
              <span>
                <i className="legend-line link" /> Mesh link
              </span>
              <span>
                <i className="legend-box danger" /> Blocked
              </span>
            </div>

            <div className="coordinate-card">
              <span>SELECTED · {selected.id}</span>
              <strong>
                {selected.x.toFixed(1)}, {selected.y.toFixed(1)}, {selected.z}m
              </strong>
              <small>Local ENU position · ±1.8m</small>
            </div>

            <div className="scale-bar">
              <span>100 m</span>
            </div>
          </div>
          )}

          <div className="map-footer">
            <div>
              <span className="live-dot" /> <strong>Belief map updating</strong>
              <small>Confidence decays unless reconfirmed</small>
            </div>
            <div className="benchmark-chip">
              <span>SEEDED BENCHMARK</span>
              <strong>39.7% lower detection time</strong>
              <small>BubbleNet 04:32 · Grid 07:31</small>
            </div>
          </div>
        </article>

        <aside id="drones" className="panel drone-panel">
          <div className="panel-header compact">
            <div className="title-with-number">
              <span className="section-number">3</span>
              <div>
                <h2>Drone status</h2>
                <p>Local agents · no permanent leader</p>
              </div>
            </div>
            <button
              className="text-button"
              onClick={() => setShowTimeline(true)}
            >
              Mission log →
            </button>
          </div>
          <div className="drone-list">
            {drones.map((drone) => (
              <button
                key={drone.id}
                className={`drone-row ${selectedDrone === drone.id ? "selected" : ""}`}
                onClick={() => setSelectedDrone(drone.id)}
              >
                <span className="drone-list-icon" style={{ color: drone.color }}>
                  ✣
                </span>
                <span className="drone-summary">
                  <span>
                    <strong style={{ color: drone.color }}>{drone.id}</strong>
                    <small>{drone.role}</small>
                  </span>
                  <b>{drone.task}</b>
                  <small>
                    Alt {drone.z}m · Speed {drone.speed}m/s · buffer{" "}
                    {drone.packets}
                  </small>
                </span>
                <span className="drone-vitals">
                  <span className="battery">
                    <i
                      style={{
                        width: `${drone.battery}%`,
                        background:
                          drone.battery < 35 ? "#ef8200" : "#55ab42",
                      }}
                    />
                  </span>
                  <b>{drone.battery}%</b>
                  <SignalBars value={drone.signal} />
                  <StatusPill state={drone.state} />
                </span>
              </button>
            ))}
          </div>
          <div className="selected-drone-detail">
            <div>
              <span>Task inheritance capsule</span>
              <strong>
                {scenarioStep >= 3 ? "Transferred & verified" : "Standby"}
              </strong>
            </div>
            <div>
              <span>Autonomy state</span>
              <strong>
                {selected.state === "offline"
                  ? "Local-safe mode"
                  : "Cooperative"}
              </strong>
            </div>
            <div>
              <span>Last verified state</span>
              <strong>
                {selected.id === "D4" && selected.state === "offline"
                  ? "00:58:11"
                  : "just now"}
              </strong>
            </div>
          </div>
        </aside>

        <aside id="network" className="panel network-panel">
          <div className="panel-header compact">
            <div className="title-with-number">
              <span className="section-number">4</span>
              <div>
                <h2>Network health</h2>
                <p>Self-forming peer-to-peer mesh</p>
              </div>
            </div>
            <span
              className={`network-score ${networkHealth < 80 ? "degraded" : ""}`}
            >
              {networkHealth}%
            </span>
          </div>
          <div className="network-grid">
            <div className="network-card">
              <span>Mesh connectivity · last 90s</span>
              <svg
                className="sparkline"
                viewBox="0 0 240 72"
                preserveAspectRatio="none"
                aria-label="Network health graph"
              >
                <path
                  className="spark-area"
                  d="M0 47 L22 42 L45 36 L68 39 L91 31 L114 37 L136 27 L158 52 L181 43 L204 56 L240 62 L240 72 L0 72 Z"
                />
                <polyline points="0,47 22,42 45,36 68,39 91,31 114,37 136,27 158,52 181,43 204,56 240,62" />
              </svg>
              <div className="chart-axis">
                <span>00:00</span>
                <span>00:45</span>
                <span>01:30</span>
              </div>
            </div>
            <div className="network-card topology-card">
              <span>Live link quality</span>
              <NetworkGraph drones={drones} />
            </div>
            <div className="network-card metric-card">
              <span>Bandwidth use</span>
              <strong>
                {scenarioStep >= 5 ? "4.8" : "2.4"} <small>Mbps</small>
              </strong>
              <div className="mini-meter">
                <i style={{ width: scenarioStep >= 5 ? "72%" : "38%" }} />
              </div>
              <small>Meaning-first packets prioritized</small>
            </div>
            <div className="network-card metric-card">
              <span>Partitions detected</span>
              <strong>
                {scenarioStep === 4 || scenarioStep === 5 ? "2" : "0"}
              </strong>
              <small>
                {scenarioStep >= 6
                  ? "Recovered · all packets signed"
                  : "Mission continuity retained"}
              </small>
            </div>
          </div>

          {/* JeevanLink Civilian Network Card */}
          <div
            className={`jeevanlink-card ${scenarioStep >= 5 ? "active" : ""}`}
            onClick={() => setShowJeevanLinkPhone(true)}
            style={{ cursor: "pointer" }}
            title="Click to launch the interactive civilian smartphone portal"
          >
            <span className="jeevanlink-icon">⌁</span>
            <div>
              <span>JEEVANLINK · CIVILIAN EMERGENCY NETWORK</span>
              <strong>
                {scenarioStep >= 5 ? "12 civilians connected" : "Ready to deploy"}
              </strong>
              <small>Click to open interactive survivor phone portal ↗</small>
            </div>
            <span className="link-state">
              {scenarioStep >= 5 ? "LIVE" : "STANDBY"}
            </span>
          </div>

          <div
            className={`firefly-relay ${scenarioStep >= 4 ? "optimizing" : ""}`}
          >
            <div className="firefly-beacon" aria-hidden="true">
              <i />
              <i />
              <i />
              <span>F</span>
            </div>
            <div>
              <span>FIREFLY RELAY POSITIONING</span>
              <strong>
                {scenarioStep >= 5
                  ? "D3 moved to brightest safe relay point"
                  : scenarioStep >= 4
                    ? "Scoring connectivity recovery points"
                    : "Monitoring relay utility field"}
              </strong>
              <small>
                Brightness = link gain + rescue priority − energy cost
              </small>
            </div>
            <div className="brightness-score">
              <small>UTILITY</small>
              <strong>
                {scenarioStep >= 5
                  ? "0.91"
                  : scenarioStep >= 4
                    ? "0.74"
                    : "0.38"}
              </strong>
            </div>
          </div>
        </aside>
      </section>

      <section className="lower-grid">
        <article className="panel confidence-panel">
          <div className="panel-header compact">
            <div className="title-with-number">
              <span className="section-number">5</span>
              <div>
                <h2>Search & confidence</h2>
                <p>Uncertainty is visible—not hidden</p>
              </div>
            </div>
          </div>
          <div className="confidence-content">
            <div className="hotspot-list">
              <span className="subhead">Top survivor hypotheses</span>
              {survivors.slice(0, 3).map((s) => (
                <div key={s.id}>
                  <ConfidenceRing
                    value={s.confidence}
                    tone={
                      s.status === "sos"
                        ? "#8b3cf0"
                        : s.confidence > 75
                          ? "#45a946"
                          : "#ef8200"
                    }
                  />
                  <p>
                    <strong>{s.label}</strong>
                    <small>
                      {s.sources.join(" + ")} · Grid {s.x}, {s.y}
                    </small>
                  </p>
                  <span className={s.status}>
                    {s.status === "sos" ? "CIVILIAN SOS" : s.status}
                  </span>
                </div>
              ))}
            </div>
            <div className="whale-card">
              <div className="whale-visual">
                <svg viewBox="0 0 170 150" aria-label="Adaptive spiral search">
                  <path d={spiralPath(84, 73, 63, 2.8, 100)} />
                  <circle cx="84" cy="73" r="5" />
                </svg>
                <span>r = {spiralRadius - 30}m</span>
              </div>
              <div>
                <span className="subhead">Whale-inspired BubbleNet search</span>
                <strong>
                  {scenarioStep >= 1
                    ? "Confidence-guided tightening"
                    : "Broad exploration"}
                </strong>
                <ul>
                  <li>
                    <span>Confidence</span>
                    <b>0.82</b>
                  </li>
                  <li>
                    <span>Contraction k</span>
                    <b>0.23</b>
                  </li>
                  <li>
                    <span>Sensor overlap</span>
                    <b>18%</b>
                  </li>
                  <li>
                    <span>Mode</span>
                    <b>
                      {scenarioStep >= 1 ? "Tightening" : "Expanding"}
                    </b>
                  </li>
                </ul>
              </div>
            </div>
            <div className="conflict-card">
              <span className="subhead">Evidence conflict</span>
              <div className="conflict-sources">
                <span>
                  <b>D1</b>
                  <strong>Person-like heat</strong>
                  <small>82% · fresh</small>
                </span>
                <i>≠</i>
                <span>
                  <b>D2</b>
                  <strong>Blue tarp movement</strong>
                  <small>61% · fresh</small>
                </span>
              </div>
              <div className="resolution-callout">
                <span>?</span>
                <p>
                  <strong>Third observation requested</strong>
                  <small>No single report becomes ground truth.</small>
                </p>
              </div>
            </div>
          </div>
        </article>

        <article id="events" className="panel events-panel">
          <div className="panel-header compact">
            <div className="title-with-number">
              <span className="section-number">6</span>
              <div>
                <h2>Tasks & events</h2>
                <p>Signed, mergeable mission facts</p>
              </div>
            </div>
            <button
              className="text-button"
              onClick={() => setShowAuditModal(true)}
            >
              CRDT Ledger →
            </button>
          </div>
          <div className="event-list">
            {crdtEvents.slice(0, 6).map((event, index) => (
              <div key={event.id} className="event-row active">
                <time>{event.time}</time>
                <span className={`event-icon ${event.tone}`}>{index + 1}</span>
                <p>{event.text}</p>
              </div>
            ))}
          </div>
          <button
            className="incident-button"
            onClick={() => applyScenarioStep(scenarioStep === 4 ? 6 : 4)}
          >
            <span>{scenarioStep === 4 || scenarioStep === 5 ? "↺" : "⊘"}</span>
            <div>
              <strong>
                {scenarioStep === 4 || scenarioStep === 5
                  ? "Reconnect D4 now"
                  : "Disconnect D4 deliberately"}
              </strong>
              <small>Judge-visible network failure control</small>
            </div>
          </button>
        </article>

        <article id="evidence" className="panel evidence-panel">
          <div className="panel-header compact">
            <div className="title-with-number">
              <span className="section-number">7</span>
              <div>
                <h2>Evidence & safety</h2>
                <p>AI recommends · humans authorize</p>
              </div>
            </div>
          </div>
          <div className="evidence-preview">
            <div
              className="thermal-frame"
              aria-label="Simulated thermal sensor evidence"
            >
              <span className="thermal-time">D2 · THERMAL · 01:27:58</span>
              <div className="thermal-grid" />
              <span className="target-box">
                <b>PERSON?</b>
                <small>0.82</small>
              </span>
            </div>
            <div className="evidence-copy">
              <span>CRITICAL EVIDENCE · H1</span>
              <strong>Possible rooftop survivor</strong>
              <p>
                RGB detector and thermal sensor agree. VLM notes partial
                occlusion by blue tarp.
              </p>
              <div>
                <b>YOLO11n · 0.87</b>
                <b>SmolVLM2 · review</b>
              </div>
            </div>
          </div>

          <div className={`approval-card ${approval}`}>
            <div className="approval-header">
              <span className="risk-icon">!</span>
              <div>
                <span>HUMAN SAFETY CHECKPOINT</span>
                <strong>Authorize rooftop winch approach?</strong>
              </div>
              <span className="risk-label">HIGH RISK</span>
            </div>
            <p>
              AI suggests D2 approach from the west at 11m altitude. Wind gust
              uncertainty remains ±{environment.windSpeed > 35 ? "14" : "8"} km/h.
            </p>
            {approval === "pending" ? (
              <div className="approval-actions">
                <button onClick={() => respondToApproval("rejected")}>
                  Hold & observe
                </button>
                <button onClick={() => respondToApproval("approved")}>
                  Approve route
                </button>
              </div>
            ) : (
              <div className="approval-result">
                <span>{approval === "approved" ? "✓" : "—"}</span>
                <p>
                  <strong>
                    {approval === "approved"
                      ? "Action authorized"
                      : "Action held"}
                  </strong>
                  <small>Commander decision recorded in audit log</small>
                </p>
                <button onClick={() => setApproval("pending")}>Reset</button>
              </div>
            )}
          </div>
        </article>
      </section>

      <section id="features" className="innovation-section">
        <div className="innovation-heading">
          <div className="title-with-number">
            <span className="section-number">8</span>
            <div>
              <span className="eyebrow">INNOVATION & OPERATOR GUIDE</span>
              <h2>Three ideas make the swarm difficult to break</h2>
              <p>
                Every feature below is connected to a visible mission state—use
                the controls to demonstrate it live.
              </p>
            </div>
          </div>
          <button className="guide-demo-button" onClick={runAutoDemo}>
            <span>▶</span>
            Run complete 20s story
          </button>
        </div>

        <div className="signature-grid">
          <article className="signature-card whale-signature">
            <div className="signature-topline">
              <span className="signature-index">01</span>
              <span className="nature-label">HUMPBACK WHALE</span>
              <span className="feature-state live">LIVE</span>
            </div>
            <div className="signature-art whale-art" aria-hidden="true">
              <svg viewBox="0 0 250 160">
                <path d={spiralPath(124, 78, 68, 3.1, 120)} />
                <circle cx="124" cy="78" r="6" />
              </svg>
              <span>r {spiralRadius - 30}m</span>
            </div>
            <div className="signature-copy">
              <h3>BubbleNet Adaptive Search</h3>
              <p>
                Search broadly when location confidence is weak, then contract
                the spiral around evidence-rich regions. A second sensor must
                verify before confirmation.
              </p>
              <div className="feature-metrics">
                <span>
                  <small>CONFIDENCE</small>
                  <b>0.82</b>
                </span>
                <span>
                  <small>CONTRACTION</small>
                  <b>k 0.23</b>
                </span>
                <span>
                  <small>OVERLAP</small>
                  <b>18%</b>
                </span>
              </div>
              <button onClick={() => activateFeature(1)}>
                Show adaptive spiral <span>→</span>
              </button>
            </div>
          </article>

          <article className="signature-card firefly-signature">
            <div className="signature-topline">
              <span className="signature-index">02</span>
              <span className="nature-label">FIREFLY SWARM</span>
              <span
                className={`feature-state ${scenarioStep >= 4 ? "live" : "standby"}`}
              >
                {scenarioStep >= 4 ? "OPTIMIZING" : "STANDBY"}
              </span>
            </div>
            <div className="signature-art firefly-art" aria-hidden="true">
              <span className="glow-node n1" />
              <span className="glow-node n2" />
              <span className="glow-node n3" />
              <span className="glow-node n4" />
              <i className="glow-link l1" />
              <i className="glow-link l2" />
              <i className="glow-link l3" />
              <div className="relay-core">
                <b>D3</b>
                <small>0.91</small>
              </div>
            </div>
            <div className="signature-copy">
              <h3>Firefly Relay Positioning</h3>
              <p>
                Possible relay locations emit virtual “brightness” from
                connectivity gain, survivor priority and battery cost. A healthy
                drone moves toward the brightest safe point to heal the mesh.
              </p>
              <div className="feature-equation">
                <span>BRIGHTNESS</span>
                <b>link gain + priority − energy cost</b>
              </div>
              <button onClick={() => activateFeature(5, "network")}>
                Trigger relay repair <span>→</span>
              </button>
            </div>
          </article>

          <article className="signature-card recover-signature">
            <div className="signature-topline">
              <span className="signature-index">03</span>
              <span className="nature-label">MISSION CONTINUITY LOOP</span>
              <span className="feature-state live">CORE</span>
            </div>
            <div className="recover-flow">
              <button
                className={scenarioStep <= 3 ? "active" : ""}
                onClick={() => activateFeature(1)}
              >
                <span>SEARCH</span>
                <b>01</b>
                <p>Perceive locally with RGB, thermal and audio.</p>
              </button>
              <i>→</i>
              <button
                className={
                  scenarioStep === 4 || scenarioStep === 5 ? "active" : ""
                }
                onClick={() => activateFeature(4)}
              >
                <span>REMEMBER</span>
                <b>02</b>
                <p>Keep signed facts and tasks through disconnection.</p>
              </button>
              <i>→</i>
              <button
                className={scenarioStep >= 6 ? "active" : ""}
                onClick={() => activateFeature(6)}
              >
                <span>RECOVER</span>
                <b>03</b>
                <p>Merge packets, resolve conflicts and restore roles.</p>
              </button>
            </div>
            <div className="recover-copy">
              <div>
                <h3>Search–Remember–Recover</h3>
                <p>
                  The swarm never assumes continuous internet. It searches
                  cooperatively, remembers independently and recovers shared
                  mission truth after reconnection.
                </p>
              </div>
              <div className="recover-status">
                <span>
                  <i className={scenarioStep >= 1 ? "done" : ""} />
                  Evidence located
                </span>
                <span>
                  <i className={scenarioStep >= 4 ? "done" : ""} />
                  Local memory retained
                </span>
                <span>
                  <i className={scenarioStep >= 6 ? "done" : ""} />
                  Six packets reconciled
                </span>
              </div>
            </div>
          </article>
        </div>

        <div className="capability-section">
          <div className="capability-intro">
            <span className="eyebrow">FULL CAPABILITY MAP</span>
            <h3>Not one AI feature. A complete resilience system.</h3>
            <p>
              The intelligence is distributed across sensing, coordination,
              memory, communication and human safety.
            </p>
          </div>
          <div className="capability-grid">
            <article>
              <span>✣</span>
              <div>
                <b>No permanent leader</b>
                <p>Any agent can fail without stopping the mission.</p>
              </div>
              <small>RESILIENCE</small>
            </article>
            <article>
              <span>⇄</span>
              <div>
                <b>Self-healing roles</b>
                <p>Scout, verifier, relay and supply roles change locally.</p>
              </div>
              <small>SWARM</small>
            </article>
            <article>
              <span>▣</span>
              <div>
                <b>Task inheritance capsule</b>
                <p>
                  Goal, evidence and safety constraints transfer together.
                </p>
              </div>
              <small>ENERGY</small>
            </article>
            <article>
              <span>⌁</span>
              <div>
                <b>Store–carry–forward</b>
                <p>Disconnected drones physically carry signed updates.</p>
              </div>
              <small>MEMORY</small>
            </article>
            <article>
              <span>◎</span>
              <div>
                <b>Evidence quorum</b>
                <p>
                  A second source verifies risky survivor declarations.
                </p>
              </div>
              <small>TRUST</small>
            </article>
            <article>
              <span>↝</span>
              <div>
                <b>D* Lite rerouting</b>
                <p>Only the affected route segment is repaired locally.</p>
              </div>
              <small>ROUTING</small>
            </article>
            <article>
              <span>◔</span>
              <div>
                <b>Time-decaying belief map</b>
                <p>Old evidence loses confidence until observed again.</p>
              </div>
              <small>UNCERTAINTY</small>
            </article>
            <article>
              <span>⚑</span>
              <div>
                <b>Meaning before media</b>
                <p>Critical facts cross weak links before raw imagery.</p>
              </div>
              <small>NETWORK</small>
            </article>
            <article>
              <span>⌁</span>
              <div>
                <b>JeevanLink</b>
                <p>
                  Local SOS, shelter and responder messages without internet.
                </p>
              </div>
              <small>CIVILIAN</small>
            </article>
            <article>
              <span>!</span>
              <div>
                <b>Human safety checkpoint</b>
                <p>AI proposes; commanders authorize dangerous action.</p>
              </div>
              <small>SAFETY</small>
            </article>
          </div>
        </div>

        <div className="operator-guide">
          <div className="guide-copy">
            <span className="eyebrow">HOW TO USE THE PROTOTYPE</span>
            <h3>Your two-minute judge walkthrough</h3>
            <p>
              Follow this sequence once. Every differentiator becomes visible
              without explaining code.
            </p>
            <button onClick={runAutoDemo}>
              <span>▶</span> Start guided failure demo
            </button>
          </div>
          <ol className="guide-steps">
            <li>
              <span>01</span>
              <div>
                <b>Start the story</b>
                <p>
                  Click “Run failure demo” and show that four agents have no
                  permanent leader.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <b>Explain the search</b>
                <p>
                  At Detect, point to the spiral shrinking around the 82%
                  confidence hotspot.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <b>Break the mission</b>
                <p>
                  At Disconnect, D4 loses every link while the other agents
                  continue moving.
                </p>
              </div>
            </li>
            <li>
              <span>04</span>
              <div>
                <b>Show self-healing</b>
                <p>
                  D3 inherits supply work and Firefly positioning repairs the
                  relay geometry.
                </p>
              </div>
            </li>
            <li>
              <span>05</span>
              <div>
                <b>Reconnect knowledge</b>
                <p>
                  Six offline packets merge; conflicts request another
                  observation.
                </p>
              </div>
            </li>
            <li>
              <span>06</span>
              <div>
                <b>End with safety</b>
                <p>
                  Approve or hold the winch route to prove the human remains
                  accountable.
                </p>
              </div>
            </li>
          </ol>
          <div className="quick-controls">
            <button onClick={() => activateFeature(1)}>
              <span>W</span>
              <b>Whale search</b>
              <small>Step 2</small>
            </button>
            <button onClick={() => activateFeature(5, "network")}>
              <span>F</span>
              <b>Firefly repair</b>
              <small>Step 6</small>
            </button>
            <button onClick={() => activateFeature(4)}>
              <span>R</span>
              <b>Remember offline</b>
              <small>Step 5</small>
            </button>
            <button onClick={() => activateFeature(6)}>
              <span>↺</span>
              <b>Recover mesh</b>
              <small>Step 7</small>
            </button>
          </div>
        </div>
      </section>

      <footer className="footer-note">
        <div>
          <span className="brand-mark small">JM</span>
          <p>
            <strong>JeevanMesh simulation console</strong>
            <small>Evidence first. Lives first.</small>
          </p>
        </div>
        <p>
          This proof of concept generates mission telemetry locally. It does
          not send real flight commands.
        </p>
        <span>Prototype build · v1.2</span>
      </footer>

      {showModels && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowModels(false)}
        >
          <section
            className="side-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="models-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setShowModels(false)}
              aria-label="Close AI stack"
            >
              ×
            </button>
            <span className="eyebrow">EDGE AI · EXPLAINABLE PIPELINE</span>
            <h2 id="models-title">What runs on each drone</h2>
            <p className="modal-lead">
              The fast model detects. The small vision-language model explains
              uncertain frames. Deterministic safety rules remain in control.
            </p>
            <div className="model-stack">
              <div>
                <span>01</span>
                <p>
                  <strong>YOLO11n</strong>
                  <small>People, debris, fire, vehicles · edge detector</small>
                </p>
                <b>ON-DEVICE</b>
              </div>
              <div>
                <span>02</span>
                <p>
                  <strong>SmolVLM2-500M</strong>
                  <small>Selective review of ambiguous evidence only</small>
                </p>
                <b>ON-DEVICE</b>
              </div>
              <div>
                <span>03</span>
                <p>
                  <strong>Confidence fusion</strong>
                  <small>
                    Thermal + RGB + time decay + source agreement
                  </small>
                </p>
                <b>RULES</b>
              </div>
              <div>
                <span>04</span>
                <p>
                  <strong>D* Lite routing</strong>
                  <small>Incremental route repair when terrain changes</small>
                </p>
                <b>PLANNER</b>
              </div>
              <div>
                <span>05</span>
                <p>
                  <strong>CRDT-style event merge</strong>
                  <small>Signed facts synchronize after reconnection</small>
                </p>
                <b>MESH</b>
              </div>
            </div>
            <div className="guardrail-list">
              <span>Responsible-AI safeguards</span>
              <ul>
                <li>No survivor marked “confirmed” from one model output.</li>
                <li>Confidence and data age always remain visible.</li>
                <li>Dangerous actions require human approval.</li>
                <li>Raw imagery stays local unless explicitly requested.</li>
              </ul>
            </div>
          </section>
        </div>
      )}

      {showTimeline && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={() => setShowTimeline(false)}
        >
          <section
            className="timeline-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="timeline-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              className="modal-close"
              onClick={() => setShowTimeline(false)}
              aria-label="Close mission log"
            >
              ×
            </button>
            <span className="eyebrow">AUDITABLE MISSION REPLAY</span>
            <h2 id="timeline-title">Incident timeline</h2>
            <div className="full-timeline">
              {SCENARIO_STEPS.map((step, index) => (
                <button
                  key={step.title}
                  className={index <= scenarioStep ? "reached" : ""}
                  onClick={() => {
                    applyScenarioStep(index);
                    setShowTimeline(false);
                  }}
                >
                  <span>{index + 1}</span>
                  <p>
                    <strong>{step.title}</strong>
                    <small>{step.detail}</small>
                  </p>
                  <b>
                    {index < scenarioStep
                      ? "DONE"
                      : index === scenarioStep
                        ? "LIVE"
                        : "QUEUED"}
                  </b>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* JeevanLink Civilian Smartphone Modal */}
      <JeevanLinkModal
        isOpen={showJeevanLinkPhone}
        onClose={() => setShowJeevanLinkPhone(false)}
        connectedDrone="D3"
        onSendSOS={handleCivilianSOS}
        onSendMessage={handleCivilianMessage}
        messages={civMessages}
      />

      {/* CRDT State Persistence & GeoJSON Incident Audit Modal */}
      <AuditExportModal
        isOpen={showAuditModal}
        onClose={() => setShowAuditModal(false)}
        events={crdtEvents}
        drones={drones}
        survivors={survivors}
        obstacles={obstacles}
        scenarioStep={scenarioStep}
      />
    </main>
  );
}
