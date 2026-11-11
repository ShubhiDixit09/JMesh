"use client";

import { useEffect, useRef, useState } from "react";
import type {
  Drone,
  DroneId,
  LayerKey,
  ObstacleHazard,
  SurvivorHotspot,
} from "../types/mission";
import type { SimToolMode } from "./SimControlsBar";

interface RealMissionMapProps {
  drones: Drone[];
  layers: Record<LayerKey, boolean>;
  scenarioStep: number;
  selectedDrone: DroneId;
  onSelectDrone: (id: DroneId) => void;
  spiralRadius: number;
  obstacles: ObstacleHazard[];
  survivors: SurvivorHotspot[];
  toolMode: SimToolMode;
  onMapClickCoordinates: (xPercent: number, yPercent: number) => void;
}

type BaseMapStyle = "satellite" | "topo" | "tactical";

const CENTER_LAT = 30.981;
const CENTER_LNG = 78.934;
const LAT_SCALE = 0.00015;
const LNG_SCALE = 0.00018;

function toLatLng(x: number, y: number): [number, number] {
  const lat = CENTER_LAT + (50 - y) * LAT_SCALE;
  const lng = CENTER_LNG + (x - 50) * LNG_SCALE;
  return [lat, lng];
}

function fromLatLng(lat: number, lng: number): [number, number] {
  const y = 50 - (lat - CENTER_LAT) / LAT_SCALE;
  const x = 50 + (lng - CENTER_LNG) / LNG_SCALE;
  return [Math.round(x), Math.round(y)];
}

export default function RealMissionMap({
  drones,
  layers,
  scenarioStep,
  selectedDrone,
  onSelectDrone,
  spiralRadius,
  obstacles,
  survivors,
  toolMode,
  onMapClickCoordinates,
}: RealMissionMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const overlayGroupRef = useRef<any>(null);
  const [mapStyle, setMapStyle] = useState<BaseMapStyle>("satellite");
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(15);
  const LRef = useRef<any>(null);

  // Store the latest callback in a ref to prevent re-initializing the map on parent re-renders
  const onMapClickCoordinatesRef = useRef(onMapClickCoordinates);
  useEffect(() => {
    onMapClickCoordinatesRef.current = onMapClickCoordinates;
  }, [onMapClickCoordinates]);

  // Initialize Leaflet Map once safely on mount
  useEffect(() => {
    let isCancelled = false;

    async function initMap() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;

      try {
        const leaf = await import("leaflet");
        const L = (window as any).L || (leaf as any).default || leaf;
        if (!L || typeof L.map !== "function") {
          console.error("Leaflet is not available on import", L);
          return;
        }
        if (isCancelled || !mapContainerRef.current) return;
        LRef.current = L;

        // Clean up prior Leaflet instance on the container if any
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }
        const container = mapContainerRef.current;
        if ((container as any)._leaflet_id) {
          (container as any)._leaflet_id = null;
        }

        const map = L.map(container, {
          center: [CENTER_LAT, CENTER_LNG],
          zoom: 15,
          minZoom: 11,
          maxZoom: 18,
          zoomControl: false,
          attributionControl: false,
          preferCanvas: true,
        });

        // Click handler on map for dynamic hazard and survivor placement
        map.on("click", (e: any) => {
          const { lat, lng } = e.latlng;
          const [xPercent, yPercent] = fromLatLng(lat, lng);
          if (onMapClickCoordinatesRef.current) {
            onMapClickCoordinatesRef.current(
              Math.max(5, Math.min(95, xPercent)),
              Math.max(5, Math.min(95, yPercent)),
            );
          }
        });

        map.on("zoomend", () => {
          setZoomLevel(map.getZoom());
        });

        const overlayGroup = L.layerGroup().addTo(map);
        overlayGroupRef.current = overlayGroup;
        mapInstanceRef.current = map;

        // Invalidate size immediately and after layout paint
        map.invalidateSize();
        requestAnimationFrame(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        });
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 150);
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 600);

        setLeafletLoaded(true);
      } catch (err) {
        console.error("Leaflet map initialization error:", err);
      }
    }

    initMap();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []); // Run ONCE on mount

  // Update Base Tile Layer when style changes or map is ready
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    if (!map || !L || !leafletLoaded) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
      tileLayerRef.current = null;
    }

    let tileUrl = "";
    let maxNativeZoom = 18;

    if (mapStyle === "satellite") {
      // High-resolution Esri World Imagery (Real Satellite)
      tileUrl =
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
      maxNativeZoom = 18;
    } else if (mapStyle === "topo") {
      // Esri World Topographic Map (Real Contours, Mountains, Rivers)
      tileUrl =
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}";
      maxNativeZoom = 17;
    } else {
      // OpenStreetMap standard tiles (Tactical Road & Infrastructure)
      tileUrl = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
      maxNativeZoom = 18;
    }

    const tileLayer = L.tileLayer(tileUrl, {
      maxNativeZoom,
      maxZoom: 19,
      subdomains: ["a", "b", "c"],
      attribution: "© Esri, USGS, OpenStreetMap contributors",
    }).addTo(map);

    tileLayerRef.current = tileLayer;

    // Refresh size
    map.invalidateSize();
  }, [mapStyle, leafletLoaded]);

  // Update Real-Time Mission Overlays (Drones, Obstacles, Survivors, RF Cones, Mesh Links)
  useEffect(() => {
    const map = mapInstanceRef.current;
    const L = LRef.current;
    const overlayGroup = overlayGroupRef.current;
    if (!map || !L || !overlayGroup || !leafletLoaded) return;

    overlayGroup.clearLayers();

    // 1. Heatmap Regions
    if (layers.heatmap) {
      const heatZones = [
        { latLng: toLatLng(51, 28.9), radius: 240, color: "#ef4b35", opacity: 0.22 },
        { latLng: toLatLng(23.8, 72.3), radius: 190, color: "#ef8a23", opacity: 0.2 },
        { latLng: toLatLng(55.5, 60.3), radius: 130, color: "#d5ac38", opacity: 0.18 },
      ];
      heatZones.forEach((z) => {
        L.circle(z.latLng, {
          radius: z.radius,
          fillColor: z.color,
          fillOpacity: z.opacity,
          color: z.color,
          weight: 1.5,
          opacity: 0.5,
          interactive: false,
        }).addTo(overlayGroup);
      });
    }

    // 2. Obstacle Hazards (Landslide, Flood, Smoke)
    if (layers.obstacles) {
      obstacles.forEach((obs) => {
        const [lat, lng] = toLatLng(obs.x, obs.y);
        const radiusMeters = obs.radius * 3.5;
        const color =
          obs.type === "flood"
            ? "#0284c7"
            : obs.type === "smoke"
              ? "#64748b"
              : "#dc4439";

        const circle = L.circle([lat, lng], {
          radius: radiusMeters,
          fillColor: color,
          fillOpacity: 0.38,
          color,
          weight: 2,
          dashArray: "4, 4",
        }).addTo(overlayGroup);

        circle.bindPopup(
          `<div style="font-family: sans-serif; font-size: 12px;">
            <b style="color: ${color}; text-transform: uppercase;">⚠️ ${obs.type} HAZARD</b><br/>
            <strong>${obs.label}</strong><br/>
            <small>Grid Coordinates: ${obs.x}, ${obs.y}</small><br/>
            <small style="color: #666;">D* Lite dynamic detour active.</small>
          </div>`,
        );

        // Marker tag
        const icon = L.divIcon({
          className: "leaflet-hazard-tag",
          html: `<span style="background: ${color}; color: white; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: 900; box-shadow: 0 2px 6px rgba(0,0,0,0.5);">${obs.type === "flood" ? "FLOOD" : obs.type === "smoke" ? "SMOKE" : "BLOCKED"}</span>`,
          iconSize: [52, 20],
          iconAnchor: [26, 10],
        });
        L.marker([lat, lng], { icon, interactive: false }).addTo(overlayGroup);
      });
    }

    // 3. BubbleNet Search Spiral
    if (layers.routes) {
      const spiralCenter = toLatLng(51, 28.9);
      const points: [number, number][] = [];
      const steps = 140;
      for (let i = 0; i <= steps; i++) {
        const ratio = i / steps;
        const theta = ratio * 3.25 * Math.PI * 2;
        const radius = (8 + ratio * spiralRadius) * 0.000008;
        const lat = spiralCenter[0] + radius * Math.sin(theta);
        const lng = spiralCenter[1] + radius * Math.cos(theta) * 1.25;
        points.push([lat, lng]);
      }
      L.polyline(points, {
        color: "#287dcc",
        weight: 2.5,
        dashArray: "6, 4",
        opacity: 0.95,
        interactive: false,
      }).addTo(overlayGroup);
    }

    // 4. Mesh Communication Links
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
        if (!from || !to) return;
        const p1 = toLatLng(from.x, from.y);
        const p2 = toLatLng(to.x, to.y);
        const isOffline = from.state === "offline" || to.state === "offline";
        L.polyline([p1, p2], {
          color: isOffline ? "#d83f3a" : color,
          weight: 2.5,
          dashArray: isOffline ? "4, 6" : undefined,
          opacity: isOffline ? 0.65 : 0.9,
          interactive: false,
        }).addTo(overlayGroup);
      });
    }

    // 5. RF Line-of-Sight Cones
    if (layers.rfCones) {
      drones.forEach((drone) => {
        if (drone.state === "offline") return;
        const [lat, lng] = toLatLng(drone.x, drone.y);
        const coverageRadiusMeters = (drone.z / 90) * 220; // scale with altitude

        L.circle([lat, lng], {
          radius: coverageRadiusMeters,
          fillColor: drone.color,
          fillOpacity: 0.14,
          color: drone.color,
          weight: 1.5,
          dashArray: "3, 5",
          interactive: false,
        }).addTo(overlayGroup);
      });
    }

    // 6. Survivor Hotspots
    survivors.forEach((s) => {
      const [lat, lng] = toLatLng(s.x, s.y);
      const isSOS = s.status === "sos";

      const html = isSOS
        ? `<div class="realmap-sos-pin">
            <span class="sos-ring"></span>
            <b>SOS ${s.headcount}P</b>
          </div>`
        : `<div class="realmap-surv-pin ${s.confidence > 75 ? "high" : "medium"}">
            <b>${s.confidence}%</b>
          </div>`;

      const icon = L.divIcon({
        className: "leaflet-survivor-icon",
        html,
        iconSize: [40, 40],
        iconAnchor: [20, 20],
      });

      const marker = L.marker([lat, lng], { icon }).addTo(overlayGroup);
      marker.bindPopup(
        `<div style="font-family: sans-serif; font-size: 12px; min-width: 170px;">
          <b style="color: ${isSOS ? "#8b3cf0" : "#287dcc"};">${s.label}</b><br/>
          <strong>Confidence: ${s.confidence}%</strong><br/>
          <small>Elevation: ${s.elevation ?? 2400}m ASL</small><br/>
          <small>Sources: ${s.sources.join(" + ")}</small><br/>
          ${isSOS ? `<span style="display:inline-block; margin-top:4px; padding:2px 6px; background:#8b3cf0; color:#fff; border-radius:4px; font-size:10px; font-weight:800;">CIVILIAN WI-FI SOS</span>` : ""}
        </div>`,
      );
    });

    // 7. Drones
    drones.forEach((drone) => {
      const [lat, lng] = toLatLng(drone.x, drone.y);
      const isSelected = drone.id === selectedDrone;
      const isOffline = drone.state === "offline";

      const html = `
        <div class="realmap-drone-marker ${isSelected ? "selected" : ""} ${drone.state}" style="--drone-col: ${drone.color}">
          <div class="drone-pulse-circle"></div>
          <span class="drone-badge" style="background: ${isOffline ? "#7a8794" : drone.color};">
            ${drone.id}
          </span>
          <span class="drone-hover-label">${drone.battery}%</span>
        </div>
      `;

      const icon = L.divIcon({
        className: "leaflet-drone-icon",
        html,
        iconSize: [36, 36],
        iconAnchor: [18, 18],
      });

      const marker = L.marker([lat, lng], {
        icon,
        zIndexOffset: isSelected ? 1000 : 200,
      }).addTo(overlayGroup);

      marker.on("click", () => {
        onSelectDrone(drone.id);
      });

      marker.bindPopup(
        `<div style="font-family: sans-serif; font-size: 12px; min-width: 180px;">
          <b style="color: ${drone.color}; font-size: 14px;">DRONE ${drone.id} · ${drone.role}</b><br/>
          <span>Task: <strong>${drone.task}</strong></span><br/>
          <span>Battery: <strong>${drone.battery}%</strong> | Signal: <strong>${drone.signal}%</strong></span><br/>
          <span>Altitude: <strong>${drone.z}m ASL</strong> | Speed: <strong>${drone.speed}m/s</strong></span><br/>
          <span>Buffered Packets: <strong>${drone.packets}</strong></span><br/>
          <small style="color: ${isOffline ? "#d83f3a" : "#287dcc"}; font-weight: 700;">
            Status: ${drone.state.toUpperCase()}
          </small>
        </div>`,
      );
    });
  }, [
    drones,
    layers,
    obstacles,
    onSelectDrone,
    scenarioStep,
    selectedDrone,
    spiralRadius,
    survivors,
    leafletLoaded,
  ]);

  function handleZoom(delta: number) {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setZoom(
      Math.max(11, Math.min(18, mapInstanceRef.current.getZoom() + delta)),
    );
  }

  function handleResetView() {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([CENTER_LAT, CENTER_LNG], 15);
  }

  return (
    <div className="real-mission-map-wrapper">
      {/* Real Map Canvas */}
      <div
        ref={mapContainerRef}
        className={`real-map-canvas tool-${toolMode}`}
        aria-label="Real Interactive Himalayan Mission Map"
      />

      {/* Map Style Selector Overlay (Satellite, Topo, Tactical) */}
      <div className="map-style-switcher" role="group" aria-label="Base Map Imagery">
        <button
          className={mapStyle === "satellite" ? "active" : ""}
          onClick={() => setMapStyle("satellite")}
          title="Real High-Resolution World Satellite Imagery"
        >
          <span>🛰️</span> Satellite
        </button>
        <button
          className={mapStyle === "topo" ? "active" : ""}
          onClick={() => setMapStyle("topo")}
          title="Real Himalayan Elevation Contours & Terrain Shading"
        >
          <span>🏔️</span> Topo
        </button>
        <button
          className={mapStyle === "tactical" ? "active" : ""}
          onClick={() => setMapStyle("tactical")}
          title="Tactical Street & Infrastructure Grid"
        >
          <span>🗺️</span> Tactical
        </button>
      </div>

      {/* Live Map Attribution & Location Chip */}
      <div className="map-live-tag">
        <span className="live-gps-dot" />
        <strong>BHAGIRATHI VALLEY · 30.981°N, 78.934°E</strong>
        <small>Real Geographic Coordinates · Zoom {zoomLevel}x</small>
      </div>

      {/* Zoom Controls */}
      <div className="real-map-zoom-controls">
        <button onClick={() => handleZoom(1)} aria-label="Zoom in">+</button>
        <button onClick={handleResetView} aria-label="Center on mission">⌖</button>
        <button onClick={() => handleZoom(-1)} aria-label="Zoom out">−</button>
      </div>
    </div>
  );
}
