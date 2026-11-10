"use client";

import { useState } from "react";
import type { CRDTEvent, Drone, ObstacleHazard, SurvivorHotspot } from "../types/mission";

interface AuditExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  events: CRDTEvent[];
  drones: Drone[];
  survivors: SurvivorHotspot[];
  obstacles: ObstacleHazard[];
  scenarioStep: number;
}

export default function AuditExportModal({
  isOpen,
  onClose,
  events,
  drones,
  survivors,
  obstacles,
  scenarioStep,
}: AuditExportModalProps) {
  const [filterType, setFilterType] = useState<string>("ALL");
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // Vector clock representation
  const vectorClocks: Record<string, number> = {
    D1: 14 + Math.max(0, scenarioStep),
    D2: 11 + Math.max(0, scenarioStep - 1),
    D3: 18 + Math.max(0, scenarioStep * 2),
    D4: scenarioStep >= 4 ? 22 : 8,
  };

  const filteredEvents =
    filterType === "ALL" ? events : events.filter((e) => e.type === filterType);

  // Generate GeoJSON representation
  function generateGeoJSON() {
    const geojson = {
      type: "FeatureCollection",
      name: "JeevanMesh_Himalayan_Sector_A_Mission",
      crs: {
        type: "name",
        properties: { name: "urn:ogc:def:crs:OGC:1.3:CRS84" },
      },
      metadata: {
        missionId: "JM-2026-HIMALAYA-SEC-A",
        center: [78.934, 30.981],
        exportTime: new Date().toISOString(),
        activeDrones: drones.filter((d) => d.state !== "offline").length,
        networkPartitions: scenarioStep === 4 || scenarioStep === 5 ? 1 : 0,
        crdtMergedPackets: scenarioStep >= 6 ? 6 : 0,
      },
      features: [
        // Drones
        ...drones.map((drone) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [
              78.934 + (drone.x - 50) * 0.00012,
              30.981 + (50 - drone.y) * 0.00009,
              drone.z,
            ],
          },
          properties: {
            featureClass: "DroneTelemetry",
            droneId: drone.id,
            role: drone.role,
            batteryPercent: drone.battery,
            signalPercent: drone.signal,
            state: drone.state,
            bufferedPackets: drone.packets,
            task: drone.task,
          },
        })),
        // Survivors / Hotspots
        ...survivors.map((survivor) => ({
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [
              78.934 + (survivor.x - 50) * 0.00012,
              30.981 + (50 - survivor.y) * 0.00009,
              survivor.elevation ?? 2450,
            ],
          },
          properties: {
            featureClass: "SurvivorHypothesis",
            hotspotId: survivor.id,
            label: survivor.label,
            confidence: survivor.confidence,
            sources: survivor.sources,
            status: survivor.status,
            headcount: survivor.headcount ?? 1,
            timestamp: survivor.timestamp,
          },
        })),
        // Obstacles
        ...obstacles.map((obs) => ({
          type: "Feature",
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [78.934 + (obs.x - 50 - 3) * 0.00012, 30.981 + (50 - obs.y - 2) * 0.00009],
                [78.934 + (obs.x - 50 + 3) * 0.00012, 30.981 + (50 - obs.y - 2) * 0.00009],
                [78.934 + (obs.x - 50 + 3) * 0.00012, 30.981 + (50 - obs.y + 2) * 0.00009],
                [78.934 + (obs.x - 50 - 3) * 0.00012, 30.981 + (50 - obs.y + 2) * 0.00009],
                [78.934 + (obs.x - 50 - 3) * 0.00012, 30.981 + (50 - obs.y - 2) * 0.00009],
              ],
            ],
          },
          properties: {
            featureClass: "HazardObstacle",
            hazardId: obs.id,
            type: obs.type,
            label: obs.label,
          },
        })),
      ],
    };
    return geojson;
  }

  function downloadGeoJSON() {
    const data = generateGeoJSON();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jeevanmesh-mission-sectorA-${Date.now()}.geojson`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function downloadAuditLedger() {
    const payload = {
      missionHeader: {
        protocol: "JeevanCore-v1.4",
        consistencyModel: "CRDT-LWW-PnCounter-ProvenanceWeighted",
        partitionTolerant: true,
        generatedAt: new Date().toISOString(),
        vectorClockSummary: vectorClocks,
      },
      auditEvents: events,
      swarmNodes: drones,
      survivorsRegistered: survivors,
      hazardsCataloged: obstacles,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `jeevanmesh-crdt-audit-ledger-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function copyJSONToClipboard() {
    const geojson = generateGeoJSON();
    navigator.clipboard.writeText(JSON.stringify(geojson, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="audit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="audit-title"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="audit-modal-header">
          <div>
            <span className="eyebrow">CRDT STATE PERSISTENCE & INCIDENT AUDIT</span>
            <h2 id="audit-title">Swarm Consensus & Mission Ledger</h2>
            <p>Cryptographically signed immutable events with vector clock causal ordering.</p>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            ✕
          </button>
        </div>

        {/* Vector Clock & CRDT State Inspector */}
        <div className="crdt-inspector-grid">
          <div className="crdt-card">
            <span className="card-subhead">LOGICAL VECTOR CLOCKS (CAUSALITY)</span>
            <div className="vector-clock-row">
              {Object.entries(vectorClocks).map(([droneId, clock]) => (
                <div key={droneId} className="vclock-pill">
                  <strong>{droneId}</strong>
                  <span>T_{clock}</span>
                </div>
              ))}
            </div>
            <p className="crdt-math-note">
              {scenarioStep === 4 || scenarioStep === 5
                ? "⚠️ D4 partitioned: Local vector clock incrementing independently. Divergence bounded."
                : "✓ Converged: All nodes merged via Commutative State Resolution."}
            </p>
          </div>

          <div className="crdt-card">
            <span className="card-subhead">MATHEMATICAL MERGE GUARANTEES</span>
            <div className="formula-display">
              <code>0.72 ⊕ 0.76 = 1 − (1−0.72)(1−0.76) = 0.93</code>
              <small>Discounted multi-sensor independence formula (max ≤ 1.0)</small>
            </div>
            <div className="crdt-properties">
              <span>Commutative</span>
              <span>Associative</span>
              <span>Idempotent</span>
              <span>2-Source Quorum</span>
            </div>
          </div>
        </div>

        {/* Export Action Bar */}
        <div className="export-action-strip">
          <button className="export-btn geojson" onClick={downloadGeoJSON}>
            <span>🗺️</span>
            <div>
              <strong>Export GeoJSON Incident Map</strong>
              <small>Load directly into QGIS, ArcGIS or Google Earth</small>
            </div>
          </button>

          <button className="export-btn ledger" onClick={downloadAuditLedger}>
            <span>📜</span>
            <div>
              <strong>Export Full CRDT Audit Ledger</strong>
              <small>Complete signed event history for NDMA/SDRF commanders</small>
            </div>
          </button>

          <button className="export-btn copy" onClick={copyJSONToClipboard}>
            <span>📋</span>
            <div>
              <strong>{copied ? "Copied to Clipboard!" : "Copy GeoJSON"}</strong>
              <small>JSON representation</small>
            </div>
          </button>
        </div>

        {/* Event Ledger Filter & List */}
        <div className="ledger-events-container">
          <div className="ledger-toolbar">
            <span className="ledger-count">
              <strong>{filteredEvents.length}</strong> signed events recorded
            </span>
            <div className="ledger-filters">
              {[
                "ALL",
                "OBSERVATION",
                "ROLE_CHANGE",
                "TASK_HANDOFF",
                "PARTITION_DETECTED",
                "CRDT_MERGE",
                "CIVILIAN_SOS",
                "HAZARD_DETECTED",
              ].map((f) => (
                <button
                  key={f}
                  className={filterType === f ? "active" : ""}
                  onClick={() => setFilterType(f)}
                >
                  {f.replace("_", " ")}
                </button>
              ))}
            </div>
          </div>

          <div className="ledger-table-wrap">
            <table className="ledger-table">
              <thead>
                <tr>
                  <th>Event ID</th>
                  <th>Time</th>
                  <th>Origin Node</th>
                  <th>Event Type</th>
                  <th>Description</th>
                  <th>Vector Clock</th>
                  <th>Signature</th>
                </tr>
              </thead>
              <tbody>
                {filteredEvents.map((evt) => (
                  <tr key={evt.id}>
                    <td><code>{evt.id}</code></td>
                    <td>{evt.time}</td>
                    <td>
                      <span className={`node-badge ${evt.droneId.toLowerCase()}`}>
                        {evt.droneId}
                      </span>
                    </td>
                    <td>
                      <span className={`type-tag ${evt.tone}`}>{evt.type}</span>
                    </td>
                    <td>{evt.text}</td>
                    <td>
                      <code>{JSON.stringify(evt.vectorClock).replace(/[{"}]/g, "")}</code>
                    </td>
                    <td>
                      <span className="sig-hash">{evt.signature.slice(0, 10)}…</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
