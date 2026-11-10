"use client";

import type { EnvironmentState, Drone, DroneId, WeatherType, HazardType } from "../types/mission";

export type SimToolMode = "inspect" | "add_hazard" | "add_survivor";

interface SimControlsBarProps {
  toolMode: SimToolMode;
  onSelectToolMode: (mode: SimToolMode) => void;
  selectedHazardType: HazardType;
  onSelectHazardType: (type: HazardType) => void;
  environment: EnvironmentState;
  onChangeEnvironment: (env: EnvironmentState) => void;
  drones: Drone[];
  onInjectFailure: (droneId: DroneId, fault: Drone["manualFault"]) => void;
  onResetSim: () => void;
}

export default function SimControlsBar({
  toolMode,
  onSelectToolMode,
  selectedHazardType,
  onSelectHazardType,
  environment,
  onChangeEnvironment,
  drones,
  onInjectFailure,
  onResetSim,
}: SimControlsBarProps) {
  return (
    <div className="sim-toolbar-container">
      {/* Tool Selection Palette */}
      <div className="sim-tool-palette">
        <span className="palette-label">INTERACTIVE SIMULATION ENGINE</span>

        <div className="tool-btn-group">
          <button
            className={`tool-btn ${toolMode === "inspect" ? "active" : ""}`}
            onClick={() => onSelectToolMode("inspect")}
            title="Inspect & click drones or map elements"
          >
            <span className="tool-icon">👆</span>
            <span>Inspect</span>
          </button>

          <button
            className={`tool-btn ${toolMode === "add_hazard" ? "active" : ""}`}
            onClick={() => onSelectToolMode("add_hazard")}
            title="Click anywhere on the rescue map to place a dynamic obstacle"
          >
            <span className="tool-icon">⚠️</span>
            <span>+ Place Hazard</span>
          </button>

          <button
            className={`tool-btn ${toolMode === "add_survivor" ? "active" : ""}`}
            onClick={() => onSelectToolMode("add_survivor")}
            title="Click anywhere on the rescue map to add a survivor hypothesis"
          >
            <span className="tool-icon">🎯</span>
            <span>+ Add Survivor</span>
          </button>
        </div>

        {toolMode === "add_hazard" && (
          <div className="sub-palette-options animate-fade-in">
            <small>Hazard type:</small>
            {(["landslide", "flood", "smoke"] as HazardType[]).map((hType) => (
              <button
                key={hType}
                className={`mini-chip ${selectedHazardType === hType ? "active" : ""}`}
                onClick={() => onSelectHazardType(hType)}
              >
                {hType === "landslide" ? "⛰️ Landslide" : hType === "flood" ? "🌊 Flash Flood" : "💨 Dense Smoke"}
              </button>
            ))}
            <span className="click-hint">Click on map to drop</span>
          </div>
        )}

        {toolMode === "add_survivor" && (
          <div className="sub-palette-options animate-fade-in">
            <span className="click-hint">Click on map to place new survivor hotspot</span>
          </div>
        )}
      </div>

      {/* Drone Fault Injection Controls */}
      <div className="sim-fault-injector">
        <span className="palette-label">INJECT FAULT</span>
        <div className="drone-fault-selector">
          {drones.map((drone) => (
            <div key={drone.id} className="drone-fault-unit">
              <span className="fault-drone-id" style={{ color: drone.color }}>
                {drone.id}
              </span>
              <select
                aria-label={`Inject fault for drone ${drone.id}`}
                value={drone.manualFault ?? "none"}
                onChange={(e) =>
                  onInjectFailure(drone.id, e.target.value as Drone["manualFault"])
                }
              >
                <option value="none">Normal (Healthy)</option>
                <option value="partition">Cut Link (Mesh Partition)</option>
                <option value="battery_drain">Drain Battery (14%)</option>
                <option value="sensor_fault">Sensor Glitch (Degrade)</option>
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Environmental Controls */}
      <div className="sim-env-controls">
        <span className="palette-label">HIMALAYAN WEATHER & WIND</span>

        <div className="env-inputs">
          <div className="env-wind-slider">
            <div className="wind-label-row">
              <small>Wind Gusts: <b>{environment.windSpeed} km/h</b></small>
              {environment.windSpeed > 35 && (
                <span className="wind-danger-badge">TURBULENCE</span>
              )}
            </div>
            <input
              type="range"
              min="0"
              max="65"
              step="5"
              value={environment.windSpeed}
              onChange={(e) =>
                onChangeEnvironment({
                  ...environment,
                  windSpeed: Number(e.target.value),
                  turbulent: Number(e.target.value) > 35,
                })
              }
            />
          </div>

          <div className="env-weather-select">
            {(["clear", "rain", "fog"] as WeatherType[]).map((w) => (
              <button
                key={w}
                className={`weather-chip ${environment.weather === w ? "active" : ""}`}
                onClick={() => onChangeEnvironment({ ...environment, weather: w })}
              >
                {w === "clear" ? "☀️ Clear" : w === "rain" ? "🌧️ Monsoon Rain" : "🌫️ Fog"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Reset button */}
      <div className="sim-reset-wrap">
        <button className="sim-reset-btn" onClick={onResetSim} title="Reset custom hazards and faults">
          ↺ Reset
        </button>
      </div>
    </div>
  );
}
