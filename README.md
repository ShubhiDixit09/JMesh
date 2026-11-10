# JeevanMesh Command Center

<!-- LIVE DEPLOYMENT LINK -->

[**Open live JeevanMesh simulation**](https://jeevanmesh-shubhidixit09.vercel.app/)

**Deployment:** Vercel · Interactive disaster-rescue mesh simulation. The prototype models drones and autonomous coordination; it is not connected to physical rescue drones.
<!-- END LIVE DEPLOYMENT LINK -->

**A leaderless, self-healing rescue swarm for disaster zones where internet and infrastructure cannot be trusted.**

JeevanMesh is an interactive hackathon prototype that simulates autonomous drones coordinating during a Himalayan flash flood. The command center shows live movement, 3D positions, battery levels, peer-to-peer links, survivor confidence, blocked routes, local decision-making, task handoff, delayed data delivery, reconnection and human approval of high-risk actions.

> This repository is a browser simulation and proof of concept. It does not control real aircraft. All telemetry and benchmark values are seeded for demonstration.

## Signature innovations

### BubbleNet Adaptive Search

A whale-inspired search policy starts with a broad spiral when the survivor location is uncertain, then tightens around stronger evidence. A second drone verifies high-confidence detections before the system recommends action.

### Firefly Relay Positioning

Potential relay positions receive a virtual brightness score based on connectivity gain, survivor priority and energy cost. A healthy drone moves toward the brightest safe point when the mesh partitions, temporarily becoming a communication relay.

### Search–Remember–Recover

- **Search:** each drone performs local multisensor perception and route planning.
- **Remember:** a disconnected drone keeps signed facts, tasks and timestamps in a local packet buffer.
- **Recover:** after reconnection, the swarm merges packets, flags conflicts and restores the best role assignment.

## What the working prototype demonstrates

- **No permanent leader:** Loss of any single drone does not stop or freeze the mission.
- **Interactive Simulation Engine:** Place custom hazards (landslides, flash floods, dense smoke) and survivor hypotheses directly on the rescue map.
- **Manual Fault Injection:** Test swarm resilience by cutting individual mesh links, draining battery to 14%, or degrading thermal sensors.
- **Himalayan Environmental Engine:** Dynamic wind gust slider (up to 65 km/h) causing flight turbulence and increased battery burn rate, plus weather toggles (Clear, Monsoon Rain, Alpine Mist).
- **CRDT State Persistence & GeoJSON Export:** Cryptographically signed event stream with vector clocks, mathematical merge guarantees ($0.72 \oplus 0.76 = 0.93$), and 1-click **GeoJSON Incident Map** & **Full Audit Ledger JSON** downloads for incident commanders.
- **Interactive JeevanLink Civilian Smartphone Portal:** Live smartphone modal showing what stranded survivors see on captive Wi-Fi (One-Touch Emergency SOS, Safe Haven Compass, 40-char mesh tactical chat, and offline flood survival guide).
- **Enhanced 3D Geospatial & RF Visualization:** Dynamic line-of-sight RF coverage cones scaling with drone altitude ($z$), vertical 3D altitude drop lines, and animated breadcrumb flight trails.
- **BubbleNet Adaptive Search:** Whale-inspired spiral search and confidence heatmap.
- **Simulated RGB/Thermal Sensor Fusion:** Edge YOLO11n + SmolVLM2 reasoning with provenance and confidence rings.
- **D* Lite Local Detours:** Automatic dynamic route recalculation around blocked corridors.
- **Battery-Aware Task Capsules:** Seamless handoff of unfinished tasks and mission context to neighboring drones before return-to-base.
- **Store–Carry–Forward Delay-Tolerant Networking (DTN):** Disconnected nodes buffer signed facts and reconcile upon reconnection.
- **Firefly Relay Optimization:** Autonomous temporary relay repositioning based on link gain, survivor priority, and battery cost.
- **Human Safety Checkpoint:** Explicit commander authorization required for high-risk rescue maneuvers.
- **Real Interactive Geographic Map Engine:** Live, zero-config high-resolution satellite imagery (Esri World Imagery) and real Himalayan topographic contour maps (Esri World Topo) centered at $30.981^\circ\text{N}, 78.934^\circ\text{E}$ (Bhagirathi Valley, Uttarakhand). No API keys or billing setup required.
- **Dual Map Architecture:** Instant toggle between 🛰️ Real Satellite/Topo Geographic Engine and 📐 Tactical Vector (2D/3D tilt) Engine. Also maintains optional Google Maps JavaScript SDK compatibility.

## Quick start

Requirements: Node.js 22.13+ and npm.

### Windows PowerShell

```powershell
cd "C:\path\to\jeevanmesh-command"
npm.cmd install
npm.cmd run dev:windows
```

Open [http://localhost:5174](http://localhost:5174).

If PowerShell blocks `npm.ps1`, always use `npm.cmd` and `npx.cmd`, or run the same commands in Command Prompt. You do not need to weaken the system execution policy.

### macOS or Linux

```bash
npm install
npm run dev
```

## Optional Google Maps setup

The prototype works immediately with its detailed offline rescue map. To enable Google Maps, copy `.env.example` to `.env.local` and add a restricted browser key:

```env
VITE_GOOGLE_MAPS_API_KEY=your_restricted_google_maps_browser_key
```

In Google Cloud Console:

1. Enable **Maps JavaScript API**.
2. Restrict the key to that API.
3. Add `http://localhost:5174/*` and `http://127.0.0.1:5174/*` as website referrers.
4. Restart the development server.

Never commit `.env.local` or a real API key. If Google rejects the key, JeevanMesh automatically returns to the offline map instead of showing a broken map surface.

## Two-minute judge demo

1. Click **Run failure demo** in the scenario strip.
2. Show the BubbleNet path tightening around an 82% survivor hotspot.
3. Let a blocked route trigger local rerouting and a low battery trigger task inheritance.
4. At **Disconnect**, show D4 continuing locally while storing packets.
5. At **Connect**, point out the Firefly relay repair and JeevanLink civilian portal.
6. At **Reconnect**, show packet merge and conflict handling, then use the human checkpoint to approve or hold the proposed rescue route.

Every stage can also be triggered manually from the **Innovation & Operator Guide** inside the prototype.

## Prototype architecture

| Layer | Hackathon implementation | Real deployment path |
|---|---|---|
| Perception | Seeded RGB/thermal detections and evidence cards | YOLO11n or equivalent edge detector, thermal camera, optional compact VLM |
| Local autonomy | Browser state machine, role and battery logic | PX4/ArduPilot companion computer with ROS 2 nodes |
| Search | Adaptive spiral and confidence updates | Bayesian belief map with replanning from observations |
| Routing | Simulated blocked-edge detour | D* Lite or A* over a shared traversability graph |
| Mesh | Link graph, partition, buffers and replay | Wi-Fi Direct/802.11s, LoRa telemetry or MANET radios |
| Data merge | Event IDs, timestamps and conflict flags | Signed append-only events with CRDT-style reconciliation |
| Human control | Approve/hold checkpoint and audit event | Authenticated incident-command console with policy rules |

Suggested real-drone hardware includes an RGB camera, radiometric thermal sensor, GNSS, IMU, barometer, LiDAR or depth sensor, mesh radio and an edge computer such as Jetson Orin Nano. Hardware choice depends on payload, flight time, regulation and terrain.

## Responsible claims

The displayed **39.7% faster** comparison is the result of the prototype's seeded scenario, not a universal scientific guarantee. A real evaluation should compare BubbleNet and lawnmower scans across identical target priors, terrain, sensor range, wind, false-positive rates and energy budgets, then publish confidence intervals.

JeevanMesh treats AI output as evidence, not truth. Survivor detections retain confidence, sensor source and timestamp; disagreements request another observation; and high-risk actions remain subject to human approval.

## Production check

```bash
npm run lint
npm run build
```

On Windows, the direct build command is:

```powershell
npm.cmd run build:windows
```

## Repository hygiene

- `.env.local`, build output and dependencies are ignored.
- `.env.example` is safe to commit.
- Do not put personal API keys, flight credentials or survivor data in Git.
- Keep the prototype labelled as simulated until it has hardware-in-the-loop validation.

## License

Add the license selected by the hackathon team before public release.
