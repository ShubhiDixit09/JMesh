export type DroneState = "active" | "weak" | "offline" | "syncing";
export type ViewMode = "2d" | "3d";
export type ApprovalState = "pending" | "approved" | "rejected";

export type DroneId = "D1" | "D2" | "D3" | "D4";

export interface Drone {
  id: DroneId;
  role: string;
  color: string;
  x: number;
  y: number;
  z: number;
  battery: number;
  speed: number;
  signal: number;
  state: DroneState;
  task: string;
  packets: number;
  rfRange?: number; // Ground coverage radius in meters / map percent
  manualFault?: "none" | "partition" | "battery_drain" | "sensor_fault";
}

export type LayerKey = "heatmap" | "links" | "obstacles" | "routes" | "rfCones" | "trails";

export type HazardType = "landslide" | "flood" | "smoke";

export interface ObstacleHazard {
  id: string;
  label: string;
  type: HazardType;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  radius: number; // map units
  createdTick: number;
}

export interface SurvivorHotspot {
  id: string;
  label: string;
  x: number; // percentage 0-100
  y: number; // percentage 0-100
  confidence: number; // 0-100
  sources: string[]; // e.g. ["Thermal", "RGB"] or ["JeevanLink SOS"]
  status: "verified" | "review" | "stale" | "sos";
  elevation?: number;
  headcount?: number;
  timestamp: string;
}

export type CRDTEventType =
  | "OBSERVATION"
  | "ROLE_CHANGE"
  | "TASK_HANDOFF"
  | "PARTITION_DETECTED"
  | "CRDT_MERGE"
  | "HUMAN_APPROVAL"
  | "CIVILIAN_SOS"
  | "HAZARD_DETECTED";

export interface CRDTEvent {
  id: string;
  time: string;
  tone: "blue" | "green" | "orange" | "red" | "purple" | "slate";
  type: CRDTEventType;
  droneId: string;
  text: string;
  vectorClock: Record<string, number>;
  signature: string;
  payload?: Record<string, unknown>;
}

export type WeatherType = "clear" | "rain" | "fog";

export interface EnvironmentState {
  windSpeed: number; // km/h 0-65
  weather: WeatherType;
  turbulent: boolean;
}

export interface CivilianMessage {
  id: string;
  sender: "civilian" | "commander";
  text: string;
  time: string;
}

export interface CivilianSOSRequest {
  headcount: number;
  medicalCondition: string;
  urgency: "urgent" | "critical";
  gridX: number;
  gridY: number;
  notes: string;
}
