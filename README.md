# 🎬 CinematicFlow.js

> **A high-performance, cyberpunk-inspired, interactive HTML5 Canvas workflow engine.**  
> Designed for real-time data pipeline visualizations, interactive architecture diagrams, automated packet simulations, and lag-free live presentations / screen shares.

---

## 📑 Table of Contents

- [Overview](#-overview)
- [Key Features](#-key-features)
- [Installation & Quick Start](#-installation--quick-start)
- [Node Types](#-node-types)
- [Core Concepts & Architecture](#-core-concepts--architecture)
  - [Auto-Sizing & Scalable Text](#auto-sizing--scalable-text)
  - [Bezier Connection Routing](#bezier-connection-routing)
  - [Packet Particle Traversal](#packet-particle-traversal)
- [In-Depth: The `onNodeArrival` Callback](#-in-depth-the-onnodearrival-callback)
  - [Callback Signature & Parameters](#callback-signature--parameters)
  - [Real-World Use Cases & Code Examples](#real-world-use-cases--code-examples)
- [Full API Reference](#-full-api-reference)
  - [Initialization](#initialization)
  - [Node Management](#node-management)
  - [Connection Management](#connection-management)
  - [Group Management](#group-management)
  - [Packet Emission & Control](#packet-emission--control)
  - [Auto-Spawn Engine](#auto-spawn-engine)
  - [Conditional & Decision Routing](#conditional--decision-routing)
  - [Camera & Viewport Controls](#camera--viewport-controls)
  - [Events & Listeners](#events--listeners)
- [Declarative Web Component `<cinematic-flow>`](#-declarative-web-component-cinematic-flow)
- [Performance & Screen-Share Optimizations](#-performance--screen-share-optimizations)
- [Browser Support & Dependencies](#-browser-support--dependencies)

---

## 🌟 Overview

`CinematicFlow.js` is a zero-dependency, GPU-accelerated canvas library for rendering animated, interactive system architectures. Unlike static flowcharts or heavy SVG diagramming tools, `CinematicFlow` renders dynamic glowing packet particles travelling across cubic Bezier curves, simulates live worker threads, and provides an event-driven workflow execution model with Web Audio synthesizer sound effects.

---

## ✨ Key Features

- **🚀 6 Distinct Specialized Node Renderers**:
  - `square` / `process`: Standard enterprise service cards with status badges and metrics.
  - `conditional`: Diamond rhombus decision nodes with dual-path outputs (True/False or custom routes).
  - `input`: High-contrast ingress pill containers with animated RF broadcast wave indicators.
  - `output`: Client egress terminals with completion status LEDs.
  - `database`: 3D isometric cylinder disks with rotating activity indicators and IOPS counters.
  - `thread`: Multithreaded worker nodes with real-time animated CPU sparkline graphs and spinning gears.
- **📐 Dynamic Auto-Width**: Nodes automatically compute their pixel dimensions based on `label` and `sublabel` length using unscaled font measurement, ensuring text never overflows borders.
- **🔍 Seamless Infinite Canvas & Zoom-Proportional Text**: Panning, dragging, and zooming with camera lerp smoothing. Font sizes scale proportionally down when zoomed out without ugly clipping.
- **⚡ Screen-Share & High-FPS Optimizations**:
  - **Dynamic Fast Mode**: Automatically disables expensive glow filters (`shadowBlur`) during active dragging, panning, or fast camera zooms.
  - **Offscreen Grid Caching**: Pre-renders dot grids onto an offscreen canvas.
  - **Viewport Culling**: Skips calculations for off-screen nodes, edges, and packets.
- **🔀 Multi-Path Route Selection**: Target specific edges by connection label (e.g. `'normal'`, `'major'`), destination node ID, or color.
- **🔔 Rich Event-Driven Hooks**: Hook into arrival events (`onNodeArrival`, `onThreadArrival`) to build interactive state machines or live dashboards.
- **🎵 Built-in Web Audio Sound FX**: Procedural synthesizer tones for packet completions, failovers, and decision branches.
- **📦 Dual API**: Imperative JavaScript API (`CinematicFlow`) + Declarative Web Component (`<cinematic-flow>`).

---

## 🚀 Installation & Quick Start

### 1. Include Script

```html
<script src="cinematic-flow.js"></script>
```

### 2. Prepare HTML Container

```html
<div id="flow-container" style="width: 100vw; height: 100vh; position: relative;"></div>
```

### 3. Initialize & Build Flow

```javascript
// Initialize canvas
const flow = new CinematicFlow("flow-container", {
   theme: "cyberpunk",
   autoSpawnPackets: true,
   packetIntervalMs: 2500,
   enableSound: true,
});

// Add nodes
const ingress = flow.addNode({
   id: "ingress",
   type: "input",
   label: "API Gateway",
   sublabel: "HTTP /api/v1/orders",
   x: 100,
   y: 200,
   color: "blue",
});

const validator = flow.addNode({
   id: "validator",
   type: "conditional",
   label: "Payload Valid?",
   sublabel: "AUTO EVAL",
   x: 380,
   y: 190,
   color: "amber",
});

const database = flow.addNode({
   id: "db",
   type: "database",
   label: "PostgreSQL",
   sublabel: "Primary Cluster",
   x: 700,
   y: 120,
   color: "cyan",
});

const errorNode = flow.addNode({
   id: "err_handler",
   type: "output",
   label: "400 Bad Request",
   sublabel: "Validation Error",
   x: 700,
   y: 300,
   color: "red",
});

// Connect nodes
flow.addConnection({
   from: ingress.id,
   to: validator.id,
   label: "POST JSON",
   color: "blue",
});

flow.addConnection({
   from: validator.id,
   to: database.id,
   label: "valid",
   condition: "true",
   color: "green",
});

flow.addConnection({
   from: validator.id,
   to: errorNode.id,
   label: "invalid",
   condition: "false",
   color: "red",
});
```

---

## 🎨 Node Types

| Type | Visual Shape | Default Size | Best Used For |
| :--- | :--- | :--- | :--- |
| `square` (or `process`) | Rounded rectangular card | Min 170x64 px (Auto-expanding) | General microservices, worker processes, queues, controllers |
| `conditional` | Diamond Rhombus | Min 150x74 px (Geometric fit) | Decision gates, validation checks, circuit breakers |
| `input` | Capsule / Pill with RF wave icon | Min 160x58 px (Auto-expanding) | Ingress points, Webhooks, API Gateways, Schedulers |
| `output` | Terminal container with delivery badge | Min 160x58 px (Auto-expanding) | Client responses, 200 OK, 500 Failures, Endpoints |
| `database` | 3D Perspective Cylinder with platter lines | Min 180x84 px (Auto-expanding) | Relational DBs, Redis cache, DWH, storage disks |
| `thread` | Container with rotating cog & live sparklines | Min 175x68 px (Auto-expanding) | Background thread pools, MQ consumers, batch runners |

---

## 💡 In-Depth: The `onNodeArrival` Callback

The `flow.onNodeArrival(nodeId, callback)` method is one of the most powerful capabilities in `CinematicFlow.js`. It turns a visual canvas into an **event-driven simulation engine**.

Whenever an animated packet particle finishes travelling along an edge and enters the destination node, `CinematicFlow` triggers this callback.

### Callback Signature & Parameters

```javascript
flow.onNodeArrival(nodeId, (node, packet) => {
   // node: The destination node object where packet arrived
   // packet: The packet metadata object that completed the traversal
});
```

#### `node` Object Properties:
- `node.id`: String ID of the node (e.g. `'validate_inp'`).
- `node.type`: Node type (`'square'`, `'conditional'`, `'input'`, `'output'`, `'database'`, `'thread'`).
- `node.label`: Main label text.
- `node.sublabel`: Subtitle text.
- `node.forcedState`: For conditional nodes (`true`, `false`, or `'auto'`).
- `node.x`, `node.y`: World coordinates.
- `node.width`, `node.height`: Calculated dimensions.

#### `packet` Object Properties:
- `packet.src`: Origin node object where packet started.
- `packet.dst`: Target node object (matches `node`).
- `packet.edge`: The connection edge object traversed (includes `edge.label`, `edge.color`, `edge.condition`).
- `packet.colorKey`: Color name (`'blue'`, `'green'`, `'red'`, `'amber'`, `'cyan'`).
- `packet.isFailover`: Boolean `true` if edge was marked as failover / red.
- `packet.cascade`: Boolean `true` if packet triggers automatic forwarding along downstream edges.

---

### Real-World Use Cases & Code Examples

#### 1. Real-Time Counter & KPI Dashboard
Increment UI counters, update DOM elements, or refresh statistical charts:

```javascript
let totalProcessed = 0;
const counterEl = document.getElementById("processed-counter");

flow.onNodeArrival("success_node", (node, packet) => {
   totalProcessed += 1;
   counterEl.textContent = totalProcessed.toLocaleString();
   
   // Flash highlight effect on HTML counter
   counterEl.classList.add("text-emerald-400");
   setTimeout(() => counterEl.classList.remove("text-emerald-400"), 300);
});
```

#### 2. Stateful Decision Trees & Dynamic Circuit Breakers
Dynamically change downstream conditional logic based on simulated metrics or error thresholds:

```javascript
let errorCount = 0;

flow.onNodeArrival("payment_gateway", (node, packet) => {
   // If packet failed or simulated failure rate exceeds threshold:
   if (packet.isFailover || Math.random() < 0.2) {
      errorCount++;
      if (errorCount >= 3) {
         // Trip circuit breaker: force conditional node to FALSE
         flow.setConditionState("circuit_breaker_cond", false);
         console.warn("⚠️ Circuit breaker TRIPPED! Routing traffic to Stand-in.");
      }
   }
});
```

#### 3. Automatic Cascade & Loop Control (`toggleAutoSpawn`)
Stop or switch auto-spawners when batch operations finish:

```javascript
let sentRecords = 0;

flow.onNodeArrival("mq_publisher", (node, packet) => {
   sentRecords += 500;
   
   if (sentRecords >= 10000) {
      // Reached batch quota: Stop auto-spawning from scheduler
      flow.toggleAutoSpawn("scheduler_node");
      console.log("✓ Batch complete! AutoSpawn stopped.");
   }
});
```

#### 4. "Director Mode" — Auto-Focusing the Camera on Active Nodes
Keep the camera tracking the workflow automatically during live demonstrations:

```javascript
flow.onNodeArrival("dwh_process", (node, packet) => {
   // Smoothly zoom in on the data warehouse node when packets arrive
   flow.focusNode(node.id, true, 1.6);
});
```

#### 5. Triggering External APIs or WebSockets
Bridge the frontend animation with actual backend services:

```javascript
flow.onNodeArrival("sync_customer", async (node, packet) => {
   try {
      await fetch("/api/v1/trigger-sync", {
         method: "POST",
         headers: { "Content-Type": "application/json" },
         body: JSON.stringify({ source: packet.src.id, timestamp: Date.now() }),
      });
   } catch (err) {
      console.error("Failed to sync backend:", err);
   }
});
```

---

## 📖 Full API Reference

### Initialization

```javascript
const flow = new CinematicFlow(container, options);
```

#### `options` Object:
| Option | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `theme` | `string` | `'cyberpunk'` | Theme palette (`'cyberpunk'`, `'slate'`, etc.) |
| `autoSpawnPackets` | `boolean` | `true` | Automatically spawn packets periodically |
| `packetIntervalMs` | `number` | `2800` | Delay between auto-spawn emissions (ms) |
| `packetSpeed` | `number` | `1.0` | Global multiplier for packet traversal speed |
| `enableSound` | `boolean` | `true` | Enable Web Audio synthesizer sounds |
| `showLabels` | `boolean` | `true` | Display edge connection labels |
| `gridSize` | `number` | `24` | Size of background dot-grid cells (px) |

---

### Node Management

#### `flow.addNode(config)`
Adds a new node to the diagram with automatic dimension calculation.

```javascript
const node = flow.addNode({
   id: "user_service",               // Unique string ID
   type: "square",                   // 'square' | 'conditional' | 'input' | 'output' | 'database' | 'thread'
   label: "User Auth Service",       // Primary title
   sublabel: "OAuth2 / JWT Token",   // Secondary subtitle
   x: 200,                           // World X position
   y: 150,                           // World Y position
   color: "blue",                    // 'blue' | 'green' | 'red' | 'amber' | 'cyan'
   group: "auth_cluster",            // (Optional) ID of parent group
   forcedState: "auto",              // (Conditional only) true | false | "auto"
   metrics: { iops: "18.2k" },       // (Database only) Custom metrics
});
```

---

### Connection Management

#### `flow.addConnection(edgeConfig)`
Connects two nodes via a smooth cubic Bezier curve.

```javascript
flow.addConnection({
   from: "nodeA",          // Source node ID
   to: "nodeB",            // Target node ID
   label: "gRPC",          // Connection label displayed on line
   color: "cyan",          // 'blue' | 'green' | 'red' | 'amber' | 'cyan'
   fromPort: "right",      // 'right' | 'left' | 'top' | 'bottom' (auto-selected if omitted)
   toPort: "left",         // 'left' | 'right' | 'top' | 'bottom'
   condition: "true",      // 'true' | 'false' (used for conditional outputs)
   speedMultiplier: 1.2,   // Speed modifier for packets on this edge
});
```

#### `flow.setNodeRoute(nodeId, route)`
Pins which outgoing connection packets should take from `nodeId`.
```javascript
// Target can be a destination node ID, connection label, or color
flow.setNodeRoute("router_node", "major");
```

#### `flow.getNodeRoute(nodeId)`
Returns the currently pinned route for a node (or `null`).

#### `flow.clearNodeRoute(nodeId)`
Removes the route restriction, reverting to default routing.

---

### Group Management

#### `flow.addGroup(groupConfig)`
Draws a glowing backdrop bounding enclosure around a set of nodes.

```javascript
flow.addGroup({
   id: "saf_major",
   label: "STAND-IN SYSTEM CLUSTER",
   color: "amber",
   nodeIds: ["standin_node", "db_balance", "process_incr"],
});
```

---

### Packet Emission & Control

#### `flow.triggerPacket(sourceId, targetId, colorOverride, options)`
Spawns an animated packet from `sourceId`.
- `targetId` *(Optional)*: Filter which outgoing connection the packet takes. Supports:
  - Destination Node ID (`"isFlagExist"`)
  - Connection Label (`"normal"`, `"major"`)
  - Color name (`"green"`, `"amber"`)
  - Selector object (`{ label: "normal", color: "green" }`)
- `colorOverride` *(Optional)*: Force packet to render in a specific color.
- `options` *(Optional)*: `{ stepOnly: boolean }` (set `true` to stop at 1 hop without cascading).

```javascript
// Trigger packet from nodeA to nodeB via specific 'major' branch
flow.triggerPacket("cassie_hhe", "major");
```

#### `flow.stepPacket(sourceId, targetId, colorOverride)`
Single-step trigger (hops only to the immediate next node without auto-forwarding further).

#### `flow.triggerIngress(colorOverride)`
Triggers a packet from the first root ingress node found on the canvas.

---

### Auto-Spawn Engine

#### `flow.toggleAutoSpawn(...args)`
Toggles the continuous background packet emission. Fully supports targeted scoping:

```javascript
// 1. Global toggle (all root ingress nodes)
flow.toggleAutoSpawn();

// 2. Toggle specific node ID
flow.toggleAutoSpawn("scheduler_saf");

// 3. Toggle specific node with a specific connection route
flow.toggleAutoSpawn("cassie_hhe", "normal");
// Or using arrow syntax:
flow.toggleAutoSpawn("cassie_hhe->normal");

// 4. Toggle multiple nodes
flow.toggleAutoSpawn("nodeA", "nodeB");
```

#### `flow.isAutoSpawnRunning(nodeId, routeSelector)`
Returns `boolean` (`true` if auto-spawning, `false` otherwise).
```javascript
if (flow.isAutoSpawnRunning("scheduler_saf")) {
   console.log("Scheduler is actively spawning packets.");
}
```

#### `flow.getAutoSpawn(nodeId)`
Returns detailed auto-spawn metadata:
```javascript
const status = flow.getAutoSpawn("cassie_hhe");
console.log(status);
// Returns: { active: true, route: "normal", isGlobal: false }
```

#### `flow.getActiveAutoSpawnNodes()`
Returns array of all node IDs currently scoped for auto-spawning.

---

### Conditional & Decision Routing

#### `flow.setConditionState(nodeId, state, options)`
Controls the evaluated path of a conditional diamond node:
- `true`: Always route along the `TRUE` edge (Green right exit).
- `false`: Always route along the `FALSE` edge (Red bottom exit).
- `"auto"`: Evaluates dynamically based on incoming packet payload / randomness.

**Graceful In-Flight Handling (Default)**:
- Secara default, packet yang sudah terlanjur meluncur di jalur lama **tetap dibiarkan berjalan sampai selesai ke node tujuan** (`purgeInFlight: false`). Hanya packet baru yang akan mengikuti state baru.
- Jika Anda secara eksplisit ingin langsung memusnahkan packet yang sedang meluncur, tambahkan opsi `{ purgeInFlight: true }`:

```javascript
// 1. Default (Graceful): packet yang sedang jalan tidak akan hilang
flow.setConditionState("valcond", false);

// 2. Explicit Purge: langsung hapus packet in-flight yang bertentangan
flow.setConditionState("valcond", false, { purgeInFlight: true });
// atau shorthand boolean:
flow.setConditionState("valcond", false, true);
```

#### `flow.getConditionState(nodeId)`
Returns the current state: `true`, `false`, or `"auto"`.

#### `flow.toggleConditionState(nodeId)`
Cycles state through `auto -> true -> false -> auto`.

---

### Camera & Viewport Controls

#### `flow.focusNode(nodeId, smooth = true, targetScale = 1.45)`
Smoothly centers the viewport onto a specific node.

#### `flow.focusGroup(groupOrIds, smooth = true, padding = 40)`
Calculates the bounding box of a group or array of node IDs and smoothly zooms to fit all nodes neatly on screen.

#### `flow.zoom(factor)`
Zooms camera in or out (`factor > 1` zooms in, `factor < 1` zooms out).

#### `flow.resetCamera()`
Restores camera coordinates to `(0, 0)` with scale `1.0`.

---

### Events & Listeners

```javascript
// General packet arrival
flow.on("packetArrive", (targetNode, packet) => {});

// Node-specific arrival
flow.onNodeArrival("node_id", (node, packet) => {});

// Thread-specific arrival
flow.onThreadArrival((threadNode, packet) => {});

// Condition evaluation
flow.on("conditionEvaluated", ({ nodeId, result, forced }) => {});

// Node interaction / click events
flow.onNodeClick((node, event) => {
   console.log("Any node clicked:", node.id);
});

// Specific node click
flow.onNodeClick("node_id", (node, event) => {
   console.log("Specific node clicked:", node.id);
});

// Direct callback on node configuration
flow.addNode({
   id: "my_node",
   label: "Interactive Node",
   onClick: (node, event) => {
      console.log("Direct onClick handler:", node.id);
   },
});

// Canvas empty space click
flow.on("canvasClick", (event) => {});
```

---

## 🧩 Declarative Web Component `<cinematic-flow>`

You can embed full cinematic diagrams directly in HTML without writing boilerplate JavaScript using custom elements:

```html
<cinematic-flow theme="cyberpunk" autospawn="true" interval="2500" style="width: 100%; height: 600px;">
   <!-- Group Enclosure -->
   <flow-group id="grp_core" label="CORE PROCESSING" color="blue">
      <flow-node id="api" type="input" label="Ingress API" sublabel="Payload Entry" x="80" y="150" color="blue"></flow-node>
      <flow-node id="auth" type="square" label="Auth Service" sublabel="JWT Verification" x="320" y="150" color="blue"></flow-node>
      <flow-node id="check" type="conditional" label="Authorized?" x="560" y="150" color="amber"></flow-node>
      <flow-node id="worker" type="thread" label="Worker Pool" sublabel="Async Queue" x="800" y="100" color="green"></flow-node>
      <flow-node id="denied" type="output" label="403 Forbidden" sublabel="Access Denied" x="800" y="240" color="red"></flow-node>
   </flow-group>

   <!-- Connections -->
   <flow-connection from="api" to="auth" label="POST"></flow-connection>
   <flow-connection from="auth" to="check"></flow-connection>
   <flow-connection from="check" to="worker" condition="true" label="valid" color="green"></flow-connection>
   <flow-connection from="check" to="denied" condition="false" label="invalid" color="red"></flow-connection>
</cinematic-flow>
```

---

## ⚡ Performance & Screen-Share Optimizations

During live video presentations or Discord / Zoom / Teams screen shares, high-DPI canvas rendering can experience frame drops if unoptimized. `CinematicFlow.js` includes built-in real-time optimizations:

1. **Auto Fast Mode**: Whenever the user drags a node, pans the canvas, or zooms, the renderer automatically turns off CPU/GPU-heavy canvas filters (`shadowBlur`, glowing particle trails) and switches to simplified alpha-blending until the camera stabilizes.
2. **Offscreen Dot Grid**: The infinite canvas background dot grid is rendered onto an offscreen canvas once and blitted via `ctx.createPattern()`, avoiding thousands of `arc()` calls per frame.
3. **Viewport Culling**: Nodes, edges, and packets outside the visible camera bounding box are culled prior to rasterization.
4. **Text Caching**: Font widths are measured once per node upon creation, preventing repeated expensive `measureText()` operations during the 60fps render loop.

---

## 💻 Browser Support & Dependencies

- **Dependencies**: None (100% vanilla JavaScript, HTML5 Canvas 2D API, Web Audio API).
- **Supported Browsers**: Chrome 80+, Firefox 75+, Safari 13.1+, Edge 80+.
- **Module Support**: Works in standard `<script>` tags, CommonJS (`require()`), and ES Modules.

---

*Authored for high-end cinematic system visualizers.*
