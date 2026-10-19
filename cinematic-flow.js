/**
 * ============================================================================
 * CinematicFlow - Interactive Diagram & Flow Visualization Component
 * ============================================================================
 * Features:
 *  - 6 Component Node Types:
 *      1. 'square' / 'process' (Standard processing block)
 *      2. 'conditional' (Diamond decision block with Red/Green branches)
 *      3. 'input' (Ingress capsule with radio wave pulse)
 *      4. 'output' (Egress terminal with signal beacon)
 *      5. 'database' (3D cylinder platter with read/write LED indicators)
 *      6. 'thread' (Multithread worker with animated CPU sparklines & gear)
 *  - Color Flows: Red (Error/False/DLQ), Blue (Ingress/Query), Green (Success/True/Result)
 *  - Dynamic Thread Spawner: flow.spawnThread({ parentId, label, ... })
 *  - Smooth bezier curve rendering with glowing particle packet animations
 *  - Camera pan, zoom, auto-focus, smooth lerping
 *  - Built-in 60 FPS MediaRecorder video export (.webm)
 *  - Web Audio 8-bit synthesizer SFX
 *  - Dual API: JavaScript Class (`new CinematicFlow(...)`) and Web Component (`<cinematic-flow>`)
 * ============================================================================
 */

class CinematicFlow {
   /**
    * @param {HTMLElement|string} container - Element or query selector for mounting
    * @param {Object} [options] - Configuration options
    */
   constructor(container, options = {}) {
      this.container =
         typeof container === "string"
            ? document.querySelector(container)
            : container;
      if (!this.container) {
         throw new Error(
            `CinematicFlow: Container element "${container}" not found.`,
         );
      }

      this.options = Object.assign(
         {
            theme: "cyberpunk",
            backgroundColor: "#06090f",
            gridColor: "rgba(30, 41, 59, 0.45)",
            autoSpawnPackets: true,
            packetIntervalMs: 320,
            soundEnabled: false,
            interactive: true,
            showTelemetry: true,
            zoomOnClick: true,
            onNodeClick: null,
            onCanvasClick: null,
         },
         options,
      );

      // Core Data
      this.nodes = [];
      this.edges = [];
      this.packets = [];
      this.threads = []; // Dynamic thread pool tracking
      this.groups = []; // Process region bounding groups

      // Telemetry Statistics
      this.stats = {
         processed: 0,
         successCount: 0,
         failoverCount: 0,
         activeThreads: 0,
         latency: 16,
      };

      // Camera
      this.camera = {
         x: 500,
         y: 300,
         scale: 1.0,
         targetX: 500,
         targetY: 300,
         targetScale: 1.0,
         lerpSpeed: 0.08,
      };

      // Interaction state
      this.isDragging = false;
      this.isConnecting = false;
      this.connectSource = null;
      this.connectColor = "blue";
      this.draggedNode = null;
      this.dragOffset = { x: 0, y: 0 };
      this.lastMousePos = { x: 0, y: 0 };
      this.hoveredNode = null;

      // Recording
      this.mediaRecorder = null;
      this.recordedChunks = [];
      this.isRecording = false;

      // Color definitions
      this.COLORS = {
         red: {
            main: "#ef4444",
            glow: "#f87171",
            particle: "#fee2e2",
            text: "#fca5a5",
         },
         blue: {
            main: "#0ea5e9",
            glow: "#38bdf8",
            particle: "#bae6fd",
            text: "#7dd3fc",
         },
         green: {
            main: "#10b981",
            glow: "#34d399",
            particle: "#d1fae5",
            text: "#6ee7b7",
         },
         amber: {
            main: "#f59e0b",
            glow: "#fbbf24",
            particle: "#fef3c7",
            text: "#fde68a",
         },
         purple: {
            main: "#a855f7",
            glow: "#c084fc",
            particle: "#f3e8ff",
            text: "#e9d5ff",
         },
         cyan: {
            main: "#06b6d4",
            glow: "#22d3ee",
            particle: "#cffafe",
            text: "#67e8f9",
         },
      };

      // Initialize Canvas & Audio
      this._initCanvas();
      this._initAudio();
      this._bindEvents();

      // Start render loop & packet spawner
      this._animFrameId = requestAnimationFrame(this._renderLoop.bind(this));
      if (this.options.autoSpawnPackets) {
         this.startPacketSpawner();
      }

      // Load initial nodes if passed in options
      if (Array.isArray(options.nodes)) {
         options.nodes.forEach((n) => this.addNode(n));
      }
      if (Array.isArray(options.edges)) {
         options.edges.forEach((e) => this.addConnection(e));
      }
      if (this.nodes.length > 0) {
         this.fitView(false);
      }
   }

   // ==========================================
   // Public Component API
   // ==========================================

   /**
    * Add a node to the diagram.
    * Supported types: 'square', 'conditional', 'input', 'output', 'database', 'thread'
    */
   addNode(nodeConfig) {
      const id =
         nodeConfig.id ||
         `node_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      const type = (nodeConfig.type || "square").toLowerCase();
      const colorKey =
         nodeConfig.color ||
         (type === "input"
            ? "blue"
            : type === "output"
              ? "green"
              : type === "conditional"
                ? "amber"
                : type === "database"
                  ? "cyan"
                  : type === "thread"
                    ? "green"
                    : "blue");

      // Dimension presets based on type
      let w = nodeConfig.width || 170;
      let h = nodeConfig.height || 64;
      if (type === "conditional") {
         w = nodeConfig.width || 150;
         h = nodeConfig.height || 74;
      } else if (type === "input" || type === "output") {
         w = nodeConfig.width || 160;
         h = nodeConfig.height || 58;
      } else if (type === "database") {
         w = nodeConfig.width || 180;
         h = nodeConfig.height || 84;
      } else if (type === "thread") {
         w = nodeConfig.width || 175;
         h = nodeConfig.height || 68;
      }

      const node = {
         id,
         type,
         label: nodeConfig.label || `Node ${id}`,
         sublabel:
            nodeConfig.sublabel ||
            nodeConfig.sub ||
            this._getDefaultSublabel(type),
         group: nodeConfig.group || null,
         forcedState:
            nodeConfig.forcedState !== undefined
               ? nodeConfig.forcedState === "true" ||
                 nodeConfig.forcedState === true
                  ? true
                  : nodeConfig.forcedState === "false" ||
                      nodeConfig.forcedState === false
                    ? false
                    : "auto"
               : "auto",
         x: nodeConfig.x || 100,
         y: nodeConfig.y || 100,
         width: w,
         height: h,
         color: colorKey,
         pulse: 0,
         spawnAnim: 1.0, // For thread spawn animation
         condition: nodeConfig.condition || null, // e.g. "auth === true"
         metrics: {
            iops: Math.floor(Math.random() * 5000 + 3000),
            cpuBars: [0.3, 0.6, 0.9, 0.4, 0.7],
         },
         customData: nodeConfig.data || {},
      };

      if (type === "thread") {
         this.stats.activeThreads++;
         this.threads.push(node.id);
      }

      this.nodes.push(node);
      return node;
   }

   /**
    * Normalize port name from English/Indonesian to standard 'top' | 'bottom' | 'left' | 'right'
    */
   _normalizePort(port) {
      if (!port) return null;
      const p = String(port).toLowerCase().trim();
      if (p === "top" || p === "atas" || p === "up") return "top";
      if (p === "bottom" || p === "bawah" || p === "down") return "bottom";
      if (p === "left" || p === "kiri") return "left";
      if (p === "right" || p === "kanan") return "right";
      return null;
   }

   /**
    * Get world coordinates and outward direction vector for a node's port
    */
   _getPortWorldCoord(node, port) {
      switch (port) {
         case "top":
            return { x: node.x + node.width / 2, y: node.y, dirX: 0, dirY: -1 };
         case "bottom":
            return {
               x: node.x + node.width / 2,
               y: node.y + node.height,
               dirX: 0,
               dirY: 1,
            };
         case "left":
            return {
               x: node.x,
               y: node.y + node.height / 2,
               dirX: -1,
               dirY: 0,
            };
         case "right":
         default:
            return {
               x: node.x + node.width,
               y: node.y + node.height / 2,
               dirX: 1,
               dirY: 0,
            };
      }
   }

   /**
    * Add a directional connection / edge between two nodes.
    * Allows choosing connector placement on either side: 'top' | 'bottom' | 'left' | 'right' (or 'atas' | 'bawah' | 'kiri' | 'kanan')
    * Color: 'red' | 'blue' | 'green' | 'amber' | 'purple' | 'cyan'
    */
   addConnection(edgeConfig) {
      const id =
         edgeConfig.id ||
         `edge_${edgeConfig.from || edgeConfig.source}_${edgeConfig.to || edgeConfig.target}_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
      const source = edgeConfig.from || edgeConfig.source;
      const target = edgeConfig.to || edgeConfig.target;
      const color = (edgeConfig.color || "blue").toLowerCase();
      const label = edgeConfig.label || edgeConfig.condition || "";

      // Connector port locations ('top' | 'bottom' | 'left' | 'right' / 'atas' | 'bawah' | 'kiri' | 'kanan')
      const fromPort = this._normalizePort(
         edgeConfig.fromPort || edgeConfig.sourcePort || edgeConfig.fromSide,
      );
      const toPort = this._normalizePort(
         edgeConfig.toPort || edgeConfig.targetPort || edgeConfig.toSide,
      );

      const edge = {
         id,
         source,
         target,
         fromPort, // 'top' | 'bottom' | 'left' | 'right' | null
         toPort, // 'top' | 'bottom' | 'left' | 'right' | null
         color,
         label,
         speedMultiplier: edgeConfig.speed || 1.0,
         condition: edgeConfig.condition || null, // e.g. 'true' (green) or 'false' (red)
      };

      this.edges.push(edge);
      return edge;
   }

   /**
    * Spawn a new thread dynamically with cinematic visual effects!
    * Creates a thread node, forks a connection line from parent, and animates arrival.
    */
   spawnThread(options = {}) {
      const threadCount = this.threads.length + 1;
      const parentNode = options.parentId
         ? this.nodes.find((n) => n.id === options.parentId)
         : this.nodes[0];

      // Position near parent or auto calculate
      const px = parentNode ? parentNode.x + (options.offsetX || 220) : 400;
      const py = parentNode
         ? parentNode.y +
           (options.offsetY || (threadCount % 2 === 1 ? -90 : 90))
         : 250;

      const threadId = options.id || `thread_${Date.now()}`;
      const threadLabel = options.label || `Worker Thread #${threadCount}`;
      const threadSub =
         options.sub ||
         `Core #${(threadCount % 8) + 1} · PID ${Math.floor(Math.random() * 8000 + 1000)}`;

      const threadNode = this.addNode({
         id: threadId,
         type: "thread",
         label: threadLabel,
         sublabel: threadSub,
         x: px,
         y: py,
         color: options.color || "green",
      });

      threadNode.spawnAnim = 0.0; // Trigger spawn bloom animation

      // Auto connect from parent if specified
      if (parentNode && options.autoConnect !== false) {
         this.addConnection({
            from: parentNode.id,
            to: threadId,
            color: options.edgeColor || "green",
            label: options.edgeLabel || "Fork Thread",
         });
      }

      // Trigger audio & toast/burst
      this._playTone(740, "triangle", 0.2, 0.08);
      this._playTone(980, "sine", 0.25, 0.06);

      // Burst packet to the new thread
      setTimeout(() => {
         if (parentNode) {
            this.triggerPacket(
               parentNode.id,
               threadId,
               options.edgeColor || "green",
            );
         }
      }, 150);

      return threadNode;
   }

   /**
    * Determine if an edge is intended as a TRUE/SUCCESS branch vs FALSE/FAIL branch.
    */
   _isEdgeSuccessBranch(edge) {
      if (!edge) return null;
      const cond = String(edge.condition || "")
         .trim()
         .toLowerCase();
      if (
         [
            "true",
            "yes",
            "pass",
            "success",
            "1",
            "ok",
            "valid",
            "allow",
         ].includes(cond)
      )
         return true;
      if (
         [
            "false",
            "no",
            "fail",
            "failed",
            "error",
            "0",
            "invalid",
            "deny",
            "reject",
            "timeout",
         ].includes(cond)
      )
         return false;

      const col = String(edge.color || "")
         .trim()
         .toLowerCase();
      if (["green", "emerald", "cyan", "teal"].includes(col)) return true;
      if (["red", "rose", "orange", "amber"].includes(col)) return false;

      const lbl = String(edge.label || "")
         .trim()
         .toLowerCase();
      if (
         lbl.includes("true") ||
         lbl.includes("pass") ||
         lbl.includes("yes") ||
         lbl.includes("success") ||
         lbl.includes("ok") ||
         lbl.includes("200")
      )
         return true;
      if (
         lbl.includes("false") ||
         lbl.includes("fail") ||
         lbl.includes("no") ||
         lbl.includes("err") ||
         lbl.includes("dlq") ||
         lbl.includes("429") ||
         lbl.includes("drop")
      )
         return false;

      return null;
   }

   /**
    * Identify outgoing branches for a conditional node
    * @param {string} nodeId - ID of the conditional node
    */
   _getConditionalEdges(nodeId) {
      const outEdges = this.edges.filter((e) => e.source === nodeId);
      let trueEdge = null;
      let falseEdge = null;

      for (const e of outEdges) {
         const isSuccess = this._isEdgeSuccessBranch(e);
         if (isSuccess === true && !trueEdge) trueEdge = e;
         else if (isSuccess === false && !falseEdge) falseEdge = e;
      }

      // If one branch is detected and there are 2 outgoing edges, infer counterpart
      if (outEdges.length === 2) {
         if (trueEdge && !falseEdge) {
            falseEdge = outEdges.find((e) => e !== trueEdge);
         } else if (falseEdge && !trueEdge) {
            trueEdge = outEdges.find((e) => e !== falseEdge);
         }
      }

      return { trueEdge, falseEdge, all: outEdges };
   }

   /**
    * Trigger an individual animated data packet along an edge.
    * Enforces strict conditional branching when originating from a conditional node.
    */
   triggerPacket(sourceId, targetId = null, colorOverride = null) {
      let edge = null;
      if (targetId) {
         edge = this.edges.find(
            (e) => e.source === sourceId && e.target === targetId,
         );
      } else if (sourceId) {
         const srcNode = this.nodes.find((n) => n.id === sourceId);
         if (srcNode && srcNode.type === "conditional") {
            const { trueEdge, falseEdge, all } =
               this._getConditionalEdges(sourceId);
            const forced = srcNode.forcedState;
            if (forced === true || forced === "true") {
               edge = trueEdge;
            } else if (forced === false || forced === "false") {
               edge = falseEdge;
            } else {
               edge =
                  Math.random() < 0.75
                     ? trueEdge || falseEdge
                     : falseEdge || trueEdge;
            }
            if (!edge && all.length > 0 && forced === "auto") {
               edge = all[0];
            }
         } else {
            const outEdges = this.edges.filter((e) => e.source === sourceId);
            if (outEdges.length > 0) {
               edge = outEdges[Math.floor(Math.random() * outEdges.length)];
            }
         }
      }
      if (!edge) return null;

      const srcNode = this.nodes.find((n) => n.id === edge.source);
      const dstNode = this.nodes.find((n) => n.id === edge.target);
      if (!srcNode || !dstNode) return null;

      // STRICT CONDITIONAL BRANCH GUARD:
      // If edge leaves a conditional node, strictly enforce its forcedState!
      if (srcNode.type === "conditional") {
         const { trueEdge, falseEdge } = this._getConditionalEdges(srcNode.id);
         const forced = srcNode.forcedState;
         if (
            (forced === false || forced === "false") &&
            (edge === trueEdge || this._isEdgeSuccessBranch(edge) === true)
         ) {
            // Strictly blocked: true branch forbidden when forced false!
            return null;
         }
         if (
            (forced === true || forced === "true") &&
            (edge === falseEdge || this._isEdgeSuccessBranch(edge) === false)
         ) {
            // Strictly blocked: false branch forbidden when forced true!
            return null;
         }
      }

      const color = colorOverride || edge.color || "blue";
      const isRed =
         color === "red" || this._isEdgeSuccessBranch(edge) === false;

      const pkt = {
         edge,
         src: srcNode,
         dst: dstNode,
         progress: 0,
         speed: (0.018 + Math.random() * 0.008) * (edge.speedMultiplier || 1.0),
         color: this.COLORS[color] ? this.COLORS[color].main : color,
         colorKey: color,
         isFailover: isRed,
         trail: [],
      };
      this.packets.push(pkt);
      return pkt;
   }

   /**
    * Set forced condition state for a conditional node.
    * Automatically purges conflicting in-flight packets and notifies listeners.
    * @param {string} nodeId - ID of the conditional node
    * @param {boolean|string} state - true, false, or 'auto'/'random'
    */
   setConditionState(nodeId, state) {
      const node = this.nodes.find((n) => n.id === nodeId);
      if (!node) return null;
      if (state === "true" || state === true) node.forcedState = true;
      else if (state === "false" || state === false) node.forcedState = false;
      else node.forcedState = "auto";

      // Instantly purge any in-flight packets on edges leaving this conditional node that contradict the new state
      if (node.forcedState !== "auto") {
         const { trueEdge, falseEdge } = this._getConditionalEdges(nodeId);
         this.packets = this.packets.filter((pkt) => {
            if (pkt.edge && pkt.edge.source === nodeId) {
               if (
                  node.forcedState === false &&
                  (pkt.edge === trueEdge ||
                     this._isEdgeSuccessBranch(pkt.edge) === true)
               ) {
                  return false;
               }
               if (
                  node.forcedState === true &&
                  (pkt.edge === falseEdge ||
                     this._isEdgeSuccessBranch(pkt.edge) === false)
               ) {
                  return false;
               }
            }
            return true;
         });
      }

      node.pulse = 1.0;
      if (node.forcedState === true) {
         this._playTone(720, "sine", 0.12, 0.06);
      } else if (node.forcedState === false) {
         this._playTone(220, "sawtooth", 0.15, 0.08);
      } else {
         this._playTone(480, "triangle", 0.08, 0.04);
      }

      if (typeof this.options.onConditionChange === "function") {
         this.options.onConditionChange({
            nodeId,
            node,
            state: node.forcedState,
         });
      }

      return node.forcedState;
   }

   /**
    * Get current forced condition state of a conditional node
    */
   getConditionState(nodeId) {
      const node = this.nodes.find((n) => n.id === nodeId);
      return node ? node.forcedState : null;
   }

   /**
    * Toggle condition state of a conditional node: auto -> true -> false -> auto
    */
   toggleConditionState(nodeId) {
      const node = this.nodes.find((n) => n.id === nodeId);
      if (!node) return null;
      if (
         node.forcedState === "auto" ||
         node.forcedState === null ||
         node.forcedState === undefined
      ) {
         return this.setConditionState(nodeId, true);
      } else if (node.forcedState === true) {
         return this.setConditionState(nodeId, false);
      } else {
         return this.setConditionState(nodeId, "auto");
      }
   }

   /**
    * Get all conditional nodes defined in the diagram
    * @returns {Array<Object>} List of conditional nodes
    */
   getConditionNodes() {
      return this.nodes.filter((n) => n.type === "conditional");
   }

   /**
    * Set all conditional nodes in diagram to a uniform state (true, false, or 'auto')
    */
   setAllConditions(state) {
      this.getConditionNodes().forEach((n) =>
         this.setConditionState(n.id, state),
      );
   }

   /**
    * Trigger instant simulation packet flowing through a conditional node
    */
   triggerConditionSimulation(nodeId, forcedOverride = null) {
      const node = this.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      if (forcedOverride !== null) {
         this.setConditionState(nodeId, forcedOverride);
      }
      // Shoot an incoming packet into the conditional node if possible
      const inEdge = this.edges.find((e) => e.target === nodeId);
      if (inEdge) {
         this.triggerPacket(inEdge.source, inEdge.target, inEdge.color);
      } else {
         // Shoot directly out of the conditional node respecting forcedState
         const { trueEdge, falseEdge, all } = this._getConditionalEdges(nodeId);
         const forced = node.forcedState;
         let outEdge = null;
         if (forced === true || forced === "true") {
            outEdge = trueEdge;
         } else if (forced === false || forced === "false") {
            outEdge = falseEdge;
         } else {
            outEdge =
               Math.random() < 0.75
                  ? trueEdge || falseEdge
                  : falseEdge || trueEdge;
         }
         if (!outEdge && all.length > 0 && forced === "auto") {
            outEdge = all[0];
         }
         if (outEdge) {
            this.triggerPacket(outEdge.source, outEdge.target, outEdge.color);
         }
      }
   }

   /**
    * Clear all nodes, edges, packets, and groups.
    */
   clear() {
      this.nodes = [];
      this.edges = [];
      this.packets = [];
      this.threads = [];
      this.groups = [];
      this.stats = {
         processed: 0,
         successCount: 0,
         failoverCount: 0,
         activeThreads: 0,
         latency: 16,
      };
   }

   /**
    * Define a process region group (e.g. Process A, Process B)
    * @param {Object} groupConfig - { id, name, nodeIds, color, padding }
    */
   addGroup(groupConfig) {
      const group = Object.assign(
         {
            id: groupConfig.id || `group_${Date.now()}`,
            name: groupConfig.name || "PROCESS REGION",
            nodeIds: groupConfig.nodeIds || [],
            color: groupConfig.color || "cyan",
            padding: groupConfig.padding || 35,
         },
         groupConfig,
      );
      this.groups.push(group);
      return group;
   }

   /**
    * Load complete state from a JSON object.
    */
   loadJSON(data) {
      this.clear();
      if (data.nodes) data.nodes.forEach((n) => this.addNode(n));
      if (data.edges) data.edges.forEach((e) => this.addConnection(e));
      if (data.groups) data.groups.forEach((g) => this.addGroup(g));
      this.fitView(true);
   }

   /**
    * Export diagram state as clean JSON.
    */
   exportJSON() {
      return {
         nodes: this.nodes.map((n) => ({
            id: n.id,
            type: n.type,
            label: n.label,
            sublabel: n.sublabel,
            group: n.group,
            forcedState: n.forcedState,
            x: n.x,
            y: n.y,
            width: n.width,
            height: n.height,
            color: n.color,
            condition: n.condition,
         })),
         edges: this.edges.map((e) => ({
            id: e.id,
            from: e.source,
            to: e.target,
            fromPort: e.fromPort,
            toPort: e.toPort,
            color: e.color,
            label: e.label,
            condition: e.condition,
         })),
         groups: this.groups,
      };
   }

   /**
    * Automatically fit camera view to enclose all nodes.
    */
   fitView(smooth = true) {
      if (this.nodes.length === 0) return;

      let minX = Infinity,
         minY = Infinity,
         maxX = -Infinity,
         maxY = -Infinity;
      this.nodes.forEach((n) => {
         minX = Math.min(minX, n.x);
         minY = Math.min(minY, n.y);
         maxX = Math.max(maxX, n.x + n.width);
         maxY = Math.max(maxY, n.y + n.height);
      });

      const pad = 90;
      const boxW = maxX - minX + pad * 2;
      const boxH = maxY - minY + pad * 2;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const sw = this.canvas.clientWidth || window.innerWidth;
      const sh = this.canvas.clientHeight || window.innerHeight;

      const scaleX = (sw * 0.88) / boxW;
      const scaleY = (sh * 0.82) / boxH;
      const targetScale = Math.min(
         Math.max(Math.min(scaleX, scaleY), 0.35),
         1.8,
      );

      this.camera.targetX = cx;
      this.camera.targetY = cy;
      this.camera.targetScale = targetScale;

      if (!smooth) {
         this.camera.x = cx;
         this.camera.y = cy;
         this.camera.scale = targetScale;
      }
   }

   /**
    * Smoothly center camera and zoom in on a specific node by ID.
    */
   focusNode(nodeId, smooth = true, targetScale = 1.45) {
      const node = this.nodes.find((n) => n.id === nodeId);
      if (!node) return;
      this.camera.targetX = node.x + node.width / 2;
      this.camera.targetY = node.y + node.height / 2;
      this.camera.targetScale = targetScale;
      if (!smooth) {
         this.camera.x = this.camera.targetX;
         this.camera.y = this.camera.targetY;
         this.camera.scale = this.camera.targetScale;
      }
      this._playTone(180, "triangle", 0.2, 0.04);
   }

   /**
    * Smoothly zoom and fit camera to a specific process group (e.g. Process A or Process B).
    * @param {string|Array<string>|Function} groupOrIds - Group ID, array of node IDs, or filter function
    */
   focusGroup(groupOrIds, smooth = true, padding = 75) {
      let targetNodes = [];
      if (Array.isArray(groupOrIds)) {
         targetNodes = this.nodes.filter((n) => groupOrIds.includes(n.id));
      } else if (typeof groupOrIds === "string") {
         const reg = this.groups.find((g) => g.id === groupOrIds);
         if (reg && reg.nodeIds && reg.nodeIds.length > 0) {
            targetNodes = this.nodes.filter((n) => reg.nodeIds.includes(n.id));
         } else {
            targetNodes = this.nodes.filter(
               (n) => n.group === groupOrIds || n.processGroup === groupOrIds,
            );
         }
      } else if (typeof groupOrIds === "function") {
         targetNodes = this.nodes.filter(groupOrIds);
      }

      if (targetNodes.length === 0) return;

      let minX = Infinity,
         minY = Infinity,
         maxX = -Infinity,
         maxY = -Infinity;
      targetNodes.forEach((n) => {
         minX = Math.min(minX, n.x);
         minY = Math.min(minY, n.y);
         maxX = Math.max(maxX, n.x + n.width);
         maxY = Math.max(maxY, n.y + n.height);
      });

      const boxW = maxX - minX + padding * 2;
      const boxH = maxY - minY + padding * 2;
      const cx = (minX + maxX) / 2;
      const cy = (minY + maxY) / 2;

      const sw = this.canvas.clientWidth || window.innerWidth;
      const sh = this.canvas.clientHeight || window.innerHeight;

      const scaleX = (sw * 0.85) / boxW;
      const scaleY = (sh * 0.8) / boxH;
      const targetScale = Math.min(
         Math.max(Math.min(scaleX, scaleY), 0.35),
         2.2,
      );

      this.camera.targetX = cx;
      this.camera.targetY = cy;
      this.camera.targetScale = targetScale;

      if (!smooth) {
         this.camera.x = cx;
         this.camera.y = cy;
         this.camera.scale = targetScale;
      }
      this._playTone(150, "triangle", 0.22, 0.05);
   }

   /**
    * Incremental Zoom In
    */
   zoomIn(factor = 1.25) {
      this.camera.targetScale = Math.min(this.camera.targetScale * factor, 2.8);
      this._playTone(280, "sine", 0.08, 0.03);
   }

   /**
    * Incremental Zoom Out
    */
   zoomOut(factor = 0.8) {
      this.camera.targetScale = Math.max(
         this.camera.targetScale * factor,
         0.25,
      );
      this._playTone(200, "sine", 0.08, 0.03);
   }

   /**
    * Start auto spawning of packets along existing connections.
    * Prioritizes root/ingress edges (e.g. input nodes or in-degree 0 nodes)
    * and never initiates traffic on forbidden conditional branches.
    */
   startPacketSpawner() {
      this.stopPacketSpawner();
      this._spawnerInterval = setInterval(() => {
         if (this.edges.length === 0) return;

         // 1. Prioritize root / ingress edges (from 'input' nodes or nodes with 0 incoming edges)
         let candidateEdges = this.edges.filter((e) => {
            const src = this.nodes.find((n) => n.id === e.source);
            if (!src) return false;
            if (src.type === "input") return true;
            const hasIncoming = this.edges.some(
               (inE) => inE.target === e.source,
            );
            return !hasIncoming;
         });

         // 2. If no root edges found (e.g. cyclic graph), pick edges that do not violate conditional forcedState
         if (candidateEdges.length === 0) {
            candidateEdges = this.edges.filter((e) => {
               const src = this.nodes.find((n) => n.id === e.source);
               if (!src) return false;
               if (src.type === "conditional") {
                  const { trueEdge, falseEdge } = this._getConditionalEdges(
                     src.id,
                  );
                  if (
                     src.forcedState === false &&
                     (e === trueEdge || this._isEdgeSuccessBranch(e) === true)
                  )
                     return false;
                  if (
                     src.forcedState === true &&
                     (e === falseEdge || this._isEdgeSuccessBranch(e) === false)
                  )
                     return false;
               }
               return true;
            });
         }

         if (candidateEdges.length > 0) {
            const edge =
               candidateEdges[
                  Math.floor(Math.random() * candidateEdges.length)
               ];
            if (edge) {
               this.triggerPacket(edge.source, edge.target, edge.color);
            }
         }
      }, this.options.packetIntervalMs);
   }

   /**
    * Stop auto spawning of packets.
    */
   stopPacketSpawner() {
      if (this._spawnerInterval) {
         clearInterval(this._spawnerInterval);
         this._spawnerInterval = null;
      }
   }

   /**
    * Toggle Video Recording (60fps canvas stream to .webm).
    */
   toggleRecording(onStopCallback) {
      if (this.isRecording) {
         this.stopRecording(onStopCallback);
      } else {
         this.startRecording();
      }
      return this.isRecording;
   }

   startRecording() {
      try {
         const stream = this.canvas.captureStream(60);
         let options = { mimeType: "video/webm;codecs=vp9" };
         if (!MediaRecorder.isTypeSupported(options.mimeType)) {
            options = { mimeType: "video/webm" };
         }
         this.mediaRecorder = new MediaRecorder(stream, options);
         this.recordedChunks = [];
         this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) this.recordedChunks.push(e.data);
         };
         this.mediaRecorder.onstop = () => {
            const blob = new Blob(this.recordedChunks, { type: "video/webm" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.style.display = "none";
            a.href = url;
            a.download = `cinematic-flow-${Date.now()}.webm`;
            document.body.appendChild(a);
            a.click();
            setTimeout(() => {
               document.body.removeChild(a);
               window.URL.revokeObjectURL(url);
            }, 150);
         };
         this.mediaRecorder.start(250);
         this.isRecording = true;
      } catch (err) {
         console.error("Recording failed:", err);
      }
   }

   stopRecording() {
      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
         this.mediaRecorder.stop();
      }
      this.isRecording = false;
   }

   toggleSound(enabled) {
      this.options.soundEnabled =
         enabled !== undefined ? enabled : !this.options.soundEnabled;
      if (this.options.soundEnabled) this._initAudio();
      return this.options.soundEnabled;
   }

   // ==========================================
   // Internal Canvas & Rendering Engine
   // ==========================================

   _initCanvas() {
      this.canvas = document.createElement("canvas");
      this.canvas.style.display = "block";
      this.canvas.style.width = "100%";
      this.canvas.style.height = "100%";
      this.canvas.style.outline = "none";
      this.container.appendChild(this.canvas);
      this.ctx = this.canvas.getContext("2d");
      this._resizeCanvas();
      window.addEventListener("resize", this._resizeCanvas.bind(this));
   }

   _resizeCanvas() {
      const dpr = window.devicePixelRatio || 1;
      const w = this.container.clientWidth || window.innerWidth;
      const h = this.container.clientHeight || window.innerHeight;
      this.canvas.width = w * dpr;
      this.canvas.height = h * dpr;
      this.ctx.scale(dpr, dpr);
   }

   _worldToScreen(wx, wy) {
      const sw = this.container.clientWidth || window.innerWidth;
      const sh = this.container.clientHeight || window.innerHeight;
      return {
         x: sw / 2 + (wx - this.camera.x) * this.camera.scale,
         y: sh / 2 + (wy - this.camera.y) * this.camera.scale,
      };
   }

   _screenToWorld(sx, sy) {
      const sw = this.container.clientWidth || window.innerWidth;
      const sh = this.container.clientHeight || window.innerHeight;
      return {
         x: this.camera.x + (sx - sw / 2) / this.camera.scale,
         y: this.camera.y + (sy - sh / 2) / this.camera.scale,
      };
   }

   _renderLoop() {
      // 1. Camera interpolation
      this.camera.x +=
         (this.camera.targetX - this.camera.x) * this.camera.lerpSpeed;
      this.camera.y +=
         (this.camera.targetY - this.camera.y) * this.camera.lerpSpeed;
      this.camera.scale +=
         (this.camera.targetScale - this.camera.scale) * this.camera.lerpSpeed;

      const sw = this.container.clientWidth || window.innerWidth;
      const sh = this.container.clientHeight || window.innerHeight;
      const ctx = this.ctx;

      // 2. Background & Grid
      ctx.fillStyle = this.options.backgroundColor;
      ctx.fillRect(0, 0, sw, sh);
      this._drawGrid(sw, sh);

      // 2.5 Draw Process Region Groups (e.g. Process A / Process B)
      this._drawGroups();

      // 3. Draw Edge Connections (Curves + Labels)
      this._drawEdges();

      // 4. Draw Connecting Line preview if dragging to connect
      if (this.isConnecting && this.connectSource) {
         this._drawConnectingPreview();
      }

      // 5. Update & Draw Data Packets
      this._drawPackets();

      // 6. Draw Component Nodes
      this._drawNodes();

      this._animFrameId = requestAnimationFrame(this._renderLoop.bind(this));
   }

   _drawGrid(sw, sh) {
      const ctx = this.ctx;
      const gridSize = 36 * this.camera.scale;
      const offsetX = (sw / 2 - this.camera.x * this.camera.scale) % gridSize;
      const offsetY = (sh / 2 - this.camera.y * this.camera.scale) % gridSize;

      ctx.fillStyle = this.options.gridColor;
      for (let x = offsetX; x < sw; x += gridSize) {
         for (let y = offsetY; y < sh; y += gridSize) {
            ctx.beginPath();
            ctx.arc(x, y, 1.15, 0, Math.PI * 2);
            ctx.fill();
         }
      }
   }

   _drawGroups() {
      if (!this.groups || this.groups.length === 0) return;
      const ctx = this.ctx;

      this.groups.forEach((g) => {
         const gNodes = this.nodes.filter(
            (n) => (g.nodeIds && g.nodeIds.includes(n.id)) || n.group === g.id,
         );
         if (gNodes.length === 0) return;

         let minX = Infinity,
            minY = Infinity,
            maxX = -Infinity,
            maxY = -Infinity;
         gNodes.forEach((n) => {
            minX = Math.min(minX, n.x);
            minY = Math.min(minY, n.y);
            maxX = Math.max(maxX, n.x + n.width);
            maxY = Math.max(maxY, n.y + n.height);
         });

         const pad = (g.padding || 35) * this.camera.scale;
         const p1 = this._worldToScreen(minX, minY);
         const p2 = this._worldToScreen(maxX, maxY);
         const w = p2.x - p1.x + pad * 2;
         const h = p2.y - p1.y + pad * 2;
         const x = p1.x - pad;
         const y = p1.y - pad;

         const colorData = this.COLORS[g.color] || this.COLORS.cyan;

         // Group Background Tint
         ctx.fillStyle = colorData.main + "0d";
         ctx.fillRect(x, y, w, h);

         // Group Dashed Border
         ctx.strokeStyle = colorData.main;
         ctx.globalAlpha = 0.45;
         ctx.lineWidth = Math.max(1.5, 2 * this.camera.scale);
         ctx.setLineDash([6 * this.camera.scale, 6 * this.camera.scale]);
         ctx.strokeRect(x, y, w, h);
         ctx.setLineDash([]);
         ctx.globalAlpha = 1.0;

         // Group Header Label
         if (g.name) {
            ctx.fillStyle = colorData.glow;
            ctx.font = `bold ${Math.max(10, 11 * this.camera.scale)}px 'Plus Jakarta Sans', sans-serif`;
            ctx.fillText(
               g.name.toUpperCase(),
               x + 14 * this.camera.scale,
               y + 20 * this.camera.scale,
            );
         }
      });
   }

   _getEdgeEndpoints(edge) {
      const src = this.nodes.find((n) => n.id === edge.source);
      const dst = this.nodes.find((n) => n.id === edge.target);
      if (!src || !dst) return null;

      let fromPort = this._normalizePort(
         edge.fromPort || edge.sourcePort || edge.fromSide,
      );
      let toPort = this._normalizePort(
         edge.toPort || edge.targetPort || edge.toSide,
      );

      // Auto port calculation if not explicitly specified
      if (!fromPort) {
         if (src.type === "conditional") {
            if (
               edge.color === "red" ||
               edge.condition === "false" ||
               edge.condition === "no"
            ) {
               fromPort = "bottom";
            } else {
               fromPort = "right";
            }
         } else {
            if (
               dst.y > src.y + src.height &&
               Math.abs(dst.x - src.x) < src.width * 0.7
            ) {
               fromPort = "bottom";
            } else if (
               dst.y < src.y - dst.height &&
               Math.abs(dst.x - src.x) < src.width * 0.7
            ) {
               fromPort = "top";
            } else if (dst.x + dst.width < src.x) {
               fromPort = "left";
            } else {
               fromPort = "right";
            }
         }
      }

      if (!toPort) {
         if (fromPort === "bottom" && dst.y >= src.y + src.height) {
            toPort = "top";
         } else if (fromPort === "top" && dst.y <= src.y) {
            toPort = "bottom";
         } else if (fromPort === "left") {
            toPort = "right";
         } else {
            if (src.x > dst.x + dst.width) {
               toPort = "right";
            } else if (
               Math.abs(dst.y - src.y) > 130 &&
               dst.x <= src.x + src.width * 0.8
            ) {
               toPort = "top";
            } else {
               toPort = "left";
            }
         }
      }

      const fromCoord = this._getPortWorldCoord(src, fromPort);
      const toCoord = this._getPortWorldCoord(dst, toPort);

      const p1 = this._worldToScreen(fromCoord.x, fromCoord.y);
      const p2 = this._worldToScreen(toCoord.x, toCoord.y);

      const dist = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const bend = Math.max(dist * 0.45, 28 * this.camera.scale);

      const cp1 = {
         x: p1.x + fromCoord.dirX * bend,
         y: p1.y + fromCoord.dirY * bend,
      };
      const cp2 = {
         x: p2.x + toCoord.dirX * bend,
         y: p2.y + toCoord.dirY * bend,
      };

      return { p1, p2, cp1, cp2, src, dst, fromPort, toPort };
   }

   _drawEdges() {
      const ctx = this.ctx;
      this.edges.forEach((edge) => {
         const pts = this._getEdgeEndpoints(edge);
         if (!pts) return;

         const colorData = this.COLORS[edge.color] || this.COLORS.blue;

         // Base track line
         ctx.beginPath();
         ctx.moveTo(pts.p1.x, pts.p1.y);
         ctx.bezierCurveTo(
            pts.cp1.x,
            pts.cp1.y,
            pts.cp2.x,
            pts.cp2.y,
            pts.p2.x,
            pts.p2.y,
         );

         // Line style
         ctx.strokeStyle = colorData.main;
         ctx.globalAlpha = 0.38;
         ctx.lineWidth = Math.max(1.8, 2.4 * this.camera.scale);
         ctx.stroke();

         // Subtle dashed neon core
         ctx.strokeStyle = colorData.glow;
         ctx.globalAlpha = 0.85;
         ctx.lineWidth = Math.max(1.0, 1.2 * this.camera.scale);
         ctx.setLineDash([4 * this.camera.scale, 4 * this.camera.scale]);
         ctx.stroke();
         ctx.setLineDash([]);
         ctx.globalAlpha = 1.0;

         // Connector Port Pin at Source
         ctx.beginPath();
         ctx.arc(pts.p1.x, pts.p1.y, 3 * this.camera.scale, 0, Math.PI * 2);
         ctx.fillStyle = colorData.main;
         ctx.fill();

         // Connector Port Pin at Target
         ctx.beginPath();
         ctx.arc(pts.p2.x, pts.p2.y, 3.2 * this.camera.scale, 0, Math.PI * 2);
         ctx.fillStyle = colorData.glow;
         ctx.fill();

         // Draw connection label / condition badge if exists
         if (edge.label || edge.condition) {
            const midT = 0.5;
            const midPt = this._getBezierPoint(
               pts.p1,
               pts.cp1,
               pts.cp2,
               pts.p2,
               midT,
            );
            this._drawEdgeLabel(
               midPt.x,
               midPt.y,
               edge.label || edge.condition,
               colorData,
            );
         }
      });
   }

   _drawEdgeLabel(x, y, text, colorData) {
      const ctx = this.ctx;
      const fontSize = Math.max(8, 10 * this.camera.scale);
      ctx.font = `600 ${fontSize}px 'JetBrains Mono', monospace`;
      const tw = ctx.measureText(text).width;
      const padX = 6 * this.camera.scale;
      const padY = 3 * this.camera.scale;

      ctx.fillStyle = "#0b1120";
      ctx.strokeStyle = colorData.main;
      ctx.lineWidth = 1 * this.camera.scale;
      this._roundRect(
         ctx,
         x - tw / 2 - padX,
         y - fontSize / 2 - padY,
         tw + padX * 2,
         fontSize + padY * 2,
         4 * this.camera.scale,
      );
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = colorData.text || "#f8fafc";
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(text, x, y);
      ctx.textAlign = "left";
   }

   _drawPackets() {
      const ctx = this.ctx;

      for (let i = this.packets.length - 1; i >= 0; i--) {
         const pkt = this.packets[i];
         pkt.progress += pkt.speed;

         const pts = this._getEdgeEndpoints(pkt.edge);
         if (!pts) {
            this.packets.splice(i, 1);
            continue;
         }

         const pos = this._getBezierPoint(
            pts.p1,
            pts.cp1,
            pts.cp2,
            pts.p2,
            Math.min(pkt.progress, 1),
         );
         pkt.trail.push({ x: pos.x, y: pos.y });
         if (pkt.trail.length > 7) pkt.trail.shift();

         // Render glowing trail
         const colorData = this.COLORS[pkt.colorKey] || this.COLORS.blue;
         for (let t = 0; t < pkt.trail.length; t++) {
            const tp = pkt.trail[t];
            const alpha = (t + 1) / pkt.trail.length;
            ctx.beginPath();
            ctx.arc(
               tp.x,
               tp.y,
               (1.8 + t * 0.5) * this.camera.scale,
               0,
               Math.PI * 2,
            );
            ctx.fillStyle = colorData.glow;
            ctx.globalAlpha = alpha;
            ctx.shadowBlur = 12 * this.camera.scale;
            ctx.shadowColor = colorData.main;
            ctx.fill();
         }
         ctx.shadowBlur = 0;
         ctx.globalAlpha = 1.0;

         // Packet completed journey
         if (pkt.progress >= 1) {
            pkt.dst.pulse = 1.0;
            this.stats.processed++;
            if (pkt.isFailover) {
               this.stats.failoverCount++;
               this._playTone(210, "sawtooth", 0.12, 0.08);
            } else {
               this.stats.successCount++;
               this._playTone(520 + Math.random() * 220, "sine", 0.05, 0.04);
            }
            this.stats.latency = 12 + Math.floor(Math.random() * 15);

            // Forward propagation & branch routing
            if (pkt.dst.type === "conditional") {
               // Strict conditional routing
               setTimeout(() => {
                  const condNode = pkt.dst;
                  const { trueEdge, falseEdge, all } =
                     this._getConditionalEdges(condNode.id);
                  let chosenEdge = null;
                  const forced = condNode.forcedState;

                  if (forced === true || forced === "true") {
                     chosenEdge = trueEdge;
                  } else if (forced === false || forced === "false") {
                     chosenEdge = falseEdge;
                  } else {
                     // Auto / Random mode (75% true, 25% false)
                     const isSuccess = Math.random() < 0.75;
                     chosenEdge = isSuccess
                        ? trueEdge || falseEdge
                        : falseEdge || trueEdge;
                  }

                  if (!chosenEdge && all.length > 0 && forced === "auto") {
                     chosenEdge = all[0];
                  }

                  if (chosenEdge) {
                     this.triggerPacket(
                        chosenEdge.source,
                        chosenEdge.target,
                        chosenEdge.color,
                     );
                  }
               }, 140);
            } else if (pkt.dst.type !== "output") {
               // Forward cascade for normal process nodes (square, thread, database, input)
               const outEdges = this.edges.filter(
                  (e) => e.source === pkt.dst.id,
               );
               if (outEdges.length > 0) {
                  setTimeout(() => {
                     const nextEdge =
                        outEdges[Math.floor(Math.random() * outEdges.length)];
                     if (nextEdge) {
                        this.triggerPacket(
                           nextEdge.source,
                           nextEdge.target,
                           nextEdge.color,
                        );
                     }
                  }, 90);
               }
            }

            // Database read/write flicker
            if (pkt.dst.type === "database") {
               pkt.dst.metrics.iops += Math.floor(Math.random() * 200 - 100);
            }

            this.packets.splice(i, 1);
         }
      }
   }

   _drawNodes() {
      this.nodes.forEach((node) => {
         // Spawn expand animation
         if (node.spawnAnim !== undefined && node.spawnAnim < 1.0) {
            node.spawnAnim += 0.05;
         }
         const scaleMultiplier =
            node.spawnAnim !== undefined ? Math.min(node.spawnAnim, 1.0) : 1.0;

         const pos = this._worldToScreen(node.x, node.y);
         const w = node.width * this.camera.scale * scaleMultiplier;
         const h = node.height * this.camera.scale * scaleMultiplier;

         const colorData = this.COLORS[node.color] || this.COLORS.blue;

         switch (node.type) {
            case "conditional":
               this._drawConditionalNode(node, pos, w, h, colorData);
               break;
            case "input":
               this._drawInputNode(node, pos, w, h, colorData);
               break;
            case "output":
               this._drawOutputNode(node, pos, w, h, colorData);
               break;
            case "database":
               this._drawDatabaseNode(node, pos, w, h, colorData);
               break;
            case "thread":
               this._drawThreadNode(node, pos, w, h, colorData);
               break;
            case "square":
            default:
               this._drawSquareNode(node, pos, w, h, colorData);
               break;
         }

         // Decay pulse
         if (node.pulse > 0) {
            node.pulse = Math.max(0, node.pulse - 0.04);
         }
      });
   }

   // --- Node Renderer: 1. Square / Standard Process ---
   _drawSquareNode(node, pos, w, h, colorData) {
      const ctx = this.ctx;
      const r = 6 * this.camera.scale;

      // Outer glow on packet hit
      if (node.pulse > 0) {
         ctx.shadowBlur = 18 * node.pulse * this.camera.scale;
         ctx.shadowColor = colorData.glow;
         ctx.strokeStyle = colorData.glow;
         ctx.lineWidth = 2.5 * this.camera.scale;
      } else {
         ctx.shadowBlur = 0;
         ctx.strokeStyle = "#1e293b";
         ctx.lineWidth = 1.5 * this.camera.scale;
      }

      // Card background
      ctx.fillStyle = "#0b1120";
      this._roundRect(ctx, pos.x, pos.y, w, h, r);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Accent left strip
      ctx.fillStyle = colorData.main;
      this._roundRect(
         ctx,
         pos.x,
         pos.y,
         4 * this.camera.scale,
         h,
         2 * this.camera.scale,
      );
      ctx.fill();

      // Type Badge
      ctx.fillStyle = colorData.main;
      ctx.font = `700 ${Math.max(7, 8.5 * this.camera.scale)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(
         "PROCESS",
         pos.x + 12 * this.camera.scale,
         pos.y + 16 * this.camera.scale,
      );

      // Node Title
      ctx.fillStyle = "#f1f5f9";
      ctx.font = `600 ${Math.max(9, 12 * this.camera.scale)}px 'JetBrains Mono', monospace`;
      ctx.fillText(
         node.label,
         pos.x + 12 * this.camera.scale,
         pos.y + 36 * this.camera.scale,
      );

      // Sublabel
      ctx.fillStyle = "#64748b";
      ctx.font = `500 ${Math.max(7, 9 * this.camera.scale)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(
         node.sublabel || "STANDARD NODE",
         pos.x + 12 * this.camera.scale,
         pos.y + 52 * this.camera.scale,
      );
   }

   // --- Node Renderer: 2. Conditional (Diamond Decision Node) ---
   _drawConditionalNode(node, pos, w, h, colorData) {
      const ctx = this.ctx;
      const cx = pos.x + w / 2;
      const cy = pos.y + h / 2;

      // Glowing diamond frame
      if (node.pulse > 0) {
         ctx.shadowBlur = 22 * node.pulse * this.camera.scale;
         ctx.shadowColor = colorData.glow;
         ctx.strokeStyle = colorData.glow;
      } else {
         ctx.shadowBlur = 0;
         ctx.strokeStyle =
            node.forcedState === true
               ? this.COLORS.green.main
               : node.forcedState === false
                 ? this.COLORS.red.main
                 : "#334155";
      }

      ctx.fillStyle = "#070d19";
      ctx.lineWidth = 2 * this.camera.scale;

      // Draw Diamond Rhombus / Faceted decision block
      ctx.beginPath();
      ctx.moveTo(cx, pos.y);
      ctx.lineTo(pos.x + w, cy);
      ctx.lineTo(cx, pos.y + h);
      ctx.lineTo(pos.x, cy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Inner decision icon / status badge
      ctx.textAlign = "center";
      if (node.forcedState === true) {
         ctx.fillStyle = this.COLORS.green.glow;
         ctx.font = `bold ${Math.max(7.5, 9 * this.camera.scale)}px 'JetBrains Mono', monospace`;
         ctx.fillText("COND", cx, pos.y + 16 * this.camera.scale);
      } else if (node.forcedState === false) {
         ctx.fillStyle = this.COLORS.red.glow;
         ctx.font = `bold ${Math.max(7.5, 9 * this.camera.scale)}px 'JetBrains Mono', monospace`;
         ctx.fillText("COND", cx, pos.y + 16 * this.camera.scale);
      } else {
         ctx.fillStyle = colorData.main;
         ctx.font = `bold ${Math.max(7.5, 9.5 * this.camera.scale)}px 'JetBrains Mono', monospace`;
         ctx.fillText("COND", cx, pos.y + 16 * this.camera.scale);
      }

      // Condition Text
      ctx.fillStyle = "#f8fafc";
      ctx.font = `600 ${Math.max(8.5, 11 * this.camera.scale)}px 'JetBrains Mono', monospace`;
      ctx.fillText(node.label, cx, cy + 2 * this.camera.scale);

      // Subtitle status (forced state or custom sublabel)
      ctx.fillStyle =
         node.forcedState === true
            ? this.COLORS.green.text
            : node.forcedState === false
              ? this.COLORS.red.text
              : "#64748b";
      ctx.font = `500 ${Math.max(6.5, 8 * this.camera.scale)}px 'Plus Jakarta Sans', sans-serif`;
      const stateSubtitle =
         node.forcedState === true
            ? "● ALWAYS TRUE"
            : node.forcedState === false
              ? "● ALWAYS FALSE"
              : node.sublabel || "AUTO EVAL";
      ctx.fillText(stateSubtitle, cx, cy + 18 * this.camera.scale);

      // Ports with True (Green) and False (Red) indicators
      // Right Exit: TRUE (Green)
      ctx.beginPath();
      ctx.arc(
         pos.x + w,
         cy,
         (node.forcedState === true ? 5.5 : 4) * this.camera.scale,
         0,
         Math.PI * 2,
      );
      ctx.fillStyle = this.COLORS.green.main;
      ctx.fill();
      if (node.forcedState === true) {
         ctx.strokeStyle = this.COLORS.green.glow;
         ctx.lineWidth = 1.8 * this.camera.scale;
         ctx.stroke();
      }

      // Bottom Exit: FALSE (Red)
      ctx.beginPath();
      ctx.arc(
         cx,
         pos.y + h,
         (node.forcedState === false ? 5.5 : 4) * this.camera.scale,
         0,
         Math.PI * 2,
      );
      ctx.fillStyle = this.COLORS.red.main;
      ctx.fill();
      if (node.forcedState === false) {
         ctx.strokeStyle = this.COLORS.red.glow;
         ctx.lineWidth = 1.8 * this.camera.scale;
         ctx.stroke();
      }

      ctx.textAlign = "left";
   }

   // --- Node Renderer: 3. Input (Ingress Capsule) ---
   _drawInputNode(node, pos, w, h, colorData) {
      const ctx = this.ctx;
      const r = h / 2;

      if (node.pulse > 0) {
         ctx.shadowBlur = 20 * node.pulse * this.camera.scale;
         ctx.shadowColor = colorData.glow;
         ctx.strokeStyle = colorData.glow;
      } else {
         ctx.shadowBlur = 0;
         ctx.strokeStyle = "#0284c7";
      }

      // Pill container
      ctx.fillStyle = "#081325";
      this._roundRect(ctx, pos.x, pos.y, w, h, r);
      ctx.fill();
      ctx.lineWidth = 1.8 * this.camera.scale;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Glowing Radio Wave Ingress Icon
      const iconX = pos.x + 22 * this.camera.scale;
      const iconY = pos.y + h / 2;
      ctx.strokeStyle = colorData.glow;
      ctx.lineWidth = 1.8 * this.camera.scale;
      ctx.beginPath();
      ctx.arc(iconX, iconY, 6 * this.camera.scale, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(iconX, iconY, 11 * this.camera.scale, -Math.PI / 2, Math.PI / 2);
      ctx.stroke();

      // Ingress Tag
      ctx.fillStyle = colorData.main;
      ctx.font = `bold ${Math.max(7, 8 * this.camera.scale)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(
         "INPUT",
         pos.x + 40 * this.camera.scale,
         pos.y + 20 * this.camera.scale,
      );

      // Ingress Title
      ctx.fillStyle = "#f1f5f9";
      ctx.font = `600 ${Math.max(8.5, 11 * this.camera.scale)}px 'JetBrains Mono', monospace`;
      ctx.fillText(
         node.label,
         pos.x + 40 * this.camera.scale,
         pos.y + 36 * this.camera.scale,
      );

      // Sublabel
      ctx.fillStyle = "#64748b";
      ctx.font = `500 ${Math.max(7, 8.5 * this.camera.scale)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(
         node.sublabel || "PAYLOAD ENTRY",
         pos.x + 40 * this.camera.scale,
         pos.y + 48 * this.camera.scale,
      );
   }

   // --- Node Renderer: 4. Output (Egress Terminal) ---
   _drawOutputNode(node, pos, w, h, colorData) {
      const ctx = this.ctx;
      const r = 8 * this.camera.scale;

      if (node.pulse > 0) {
         ctx.shadowBlur = 20 * node.pulse * this.camera.scale;
         ctx.shadowColor = colorData.glow;
         ctx.strokeStyle = colorData.glow;
      } else {
         ctx.shadowBlur = 0;
         ctx.strokeStyle = "#059669";
      }

      // Terminal Container
      ctx.fillStyle = "#061715";
      this._roundRect(ctx, pos.x, pos.y, w, h, r);
      ctx.fill();
      ctx.lineWidth = 1.8 * this.camera.scale;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Right Delivery Badge
      const rightX = pos.x + w - 18 * this.camera.scale;
      const centerY = pos.y + h / 2;
      ctx.fillStyle = colorData.main;
      ctx.beginPath();
      ctx.arc(rightX, centerY, 5 * this.camera.scale, 0, Math.PI * 2);
      ctx.fill();

      // Output Tag
      ctx.fillStyle = colorData.main;
      ctx.font = `bold ${Math.max(7, 8 * this.camera.scale)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(
         "OUTPUT",
         pos.x + 14 * this.camera.scale,
         pos.y + 19 * this.camera.scale,
      );

      // Output Title
      ctx.fillStyle = "#f1f5f9";
      ctx.font = `600 ${Math.max(8.5, 11 * this.camera.scale)}px 'JetBrains Mono', monospace`;
      ctx.fillText(
         node.label,
         pos.x + 14 * this.camera.scale,
         pos.y + 35 * this.camera.scale,
      );

      // Sublabel
      ctx.fillStyle = "#64748b";
      ctx.font = `500 ${Math.max(7, 8.5 * this.camera.scale)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(
         node.sublabel || "CLIENT RESPONSE",
         pos.x + 14 * this.camera.scale,
         pos.y + 48 * this.camera.scale,
      );
   }

   // --- Node Renderer: 5. Database (3D Cylinder Platter) ---
   _drawDatabaseNode(node, pos, w, h, colorData) {
      const ctx = this.ctx;
      const cx = pos.x + w / 2;
      const rx = w / 2;
      const ry = Math.min(13 * this.camera.scale, h * 0.18);
      const topY = pos.y + ry;
      const bottomY = pos.y + h - ry;
      const bodyHeight = bottomY - topY;

      if (node.pulse > 0) {
         ctx.shadowBlur = 22 * node.pulse * this.camera.scale;
         ctx.shadowColor = colorData.glow;
         ctx.strokeStyle = colorData.glow;
         ctx.lineWidth = 2.2 * this.camera.scale;
      } else {
         ctx.shadowBlur = 0;
         ctx.strokeStyle = "#0284c7";
         ctx.lineWidth = 1.6 * this.camera.scale;
      }

      // 1. Cylinder Body Wall & Bottom Curve (Mathematically continuous closed path)
      ctx.fillStyle = "#061726";
      ctx.beginPath();
      // Start at top-right edge
      ctx.moveTo(pos.x + w, topY);
      // Line straight down right side
      ctx.lineTo(pos.x + w, bottomY);
      // Lower curve: from 0 (3 o'clock) clockwise to Math.PI (9 o'clock)
      ctx.ellipse(cx, bottomY, rx, ry, 0, 0, Math.PI, false);
      // Line straight up left side
      ctx.lineTo(pos.x, topY);
      // Top back arc
      ctx.ellipse(cx, topY, rx, ry, 0, Math.PI, 0, false);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // 2. Cylinder Top Ellipse Lid (Full perspective circle)
      ctx.beginPath();
      ctx.ellipse(cx, topY, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#0f2744";
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // 3. Horizontal Platter Divider Ring (Middle disk division)
      ctx.beginPath();
      const midPlatterY = topY + bodyHeight * 0.42;
      ctx.ellipse(cx, midPlatterY, rx, ry, 0, 0, Math.PI, false);
      ctx.strokeStyle = "rgba(56, 189, 248, 0.35)";
      ctx.lineWidth = 1.2 * this.camera.scale;
      ctx.stroke();

      // 4. Read/Write Activity LED Dot
      const ledX = pos.x + 18 * this.camera.scale;
      const ledY = topY + bodyHeight * 0.65;
      const isActivity = node.pulse > 0.08 || Date.now() % 800 < 400;

      ctx.beginPath();
      ctx.arc(ledX, ledY, 3.5 * this.camera.scale, 0, Math.PI * 2);
      ctx.fillStyle = isActivity ? colorData.glow : "#1e3a5f";
      if (isActivity) {
         ctx.shadowBlur = 8 * this.camera.scale;
         ctx.shadowColor = colorData.glow;
      }
      ctx.fill();
      ctx.shadowBlur = 0;

      // 5. Database Type Tag
      ctx.fillStyle = colorData.main;
      ctx.font = `bold ${Math.max(7, 8 * this.camera.scale)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(
         "DB · STORAGE",
         pos.x + 28 * this.camera.scale,
         topY + bodyHeight * 0.36,
      );

      // 6. Database Name (Measured & fitted safely without overflow)
      ctx.fillStyle = "#f1f5f9";
      const maxTextWidth = w - 36 * this.camera.scale;
      let label = node.label;
      ctx.font = `600 ${Math.max(8.5, 11 * this.camera.scale)}px 'JetBrains Mono', monospace`;
      if (ctx.measureText(label).width > maxTextWidth) {
         while (
            label.length > 4 &&
            ctx.measureText(label + "...").width > maxTextWidth
         ) {
            label = label.slice(0, -1);
         }
         label += "...";
      }
      ctx.fillText(
         label,
         pos.x + 28 * this.camera.scale,
         topY + bodyHeight * 0.65,
      );

      // 7. Sublabel / IOPS Metric
      ctx.fillStyle = "#94a3b8";
      ctx.font = `500 ${Math.max(7, 8 * this.camera.scale)}px 'JetBrains Mono', monospace`;
      const subText = node.sublabel || `IOPS: ${node.metrics.iops || "12.4k"}`;
      ctx.fillText(
         subText,
         pos.x + 28 * this.camera.scale,
         topY + bodyHeight * 0.88,
      );
   }

   // --- Node Renderer: 6. Thread (Multithread Worker & Sparklines) ---
   _drawThreadNode(node, pos, w, h, colorData) {
      const ctx = this.ctx;
      const r = 8 * this.camera.scale;

      // Dynamic thread aura
      ctx.shadowBlur = (12 + node.pulse * 18) * this.camera.scale;
      ctx.shadowColor = colorData.main;

      // Thread Container
      ctx.fillStyle = "#081711";
      ctx.strokeStyle = colorData.main;
      ctx.lineWidth = 2 * this.camera.scale;
      this._roundRect(ctx, pos.x, pos.y, w, h, r);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Rotating Thread Cog / Gear / Orbit indicator
      const cogX = pos.x + 18 * this.camera.scale;
      const cogY = pos.y + h / 2;
      const time = Date.now() * 0.003;

      ctx.strokeStyle = colorData.glow;
      ctx.lineWidth = 1.5 * this.camera.scale;
      ctx.beginPath();
      ctx.arc(cogX, cogY, 7 * this.camera.scale, time, time + Math.PI * 1.5);
      ctx.stroke();

      // Inner thread core
      ctx.fillStyle = colorData.main;
      ctx.beginPath();
      ctx.arc(cogX, cogY, 3 * this.camera.scale, 0, Math.PI * 2);
      ctx.fill();

      // Thread Badge
      ctx.fillStyle = colorData.main;
      ctx.font = `bold ${Math.max(7, 8 * this.camera.scale)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(
         "THREAD · ACTIVE",
         pos.x + 32 * this.camera.scale,
         pos.y + 19 * this.camera.scale,
      );

      // Thread Title
      ctx.fillStyle = "#f1f5f9";
      ctx.font = `600 ${Math.max(8.5, 11 * this.camera.scale)}px 'JetBrains Mono', monospace`;
      ctx.fillText(
         node.label,
         pos.x + 32 * this.camera.scale,
         pos.y + 36 * this.camera.scale,
      );

      // Animated CPU activity sparkline bars
      const barStartX = pos.x + w - 45 * this.camera.scale;
      const barBaseY = pos.y + h - 14 * this.camera.scale;
      for (let b = 0; b < 5; b++) {
         const barH =
            (4 + Math.sin(time * 3 + b) * 3 + (b % 2) * 3) * this.camera.scale;
         ctx.fillStyle = colorData.glow;
         ctx.fillRect(
            barStartX + b * 6 * this.camera.scale,
            barBaseY - barH,
            3.5 * this.camera.scale,
            barH,
         );
      }

      // Sublabel
      ctx.fillStyle = "#64748b";
      ctx.font = `500 ${Math.max(6.5, 8 * this.camera.scale)}px 'Plus Jakarta Sans', sans-serif`;
      ctx.fillText(
         node.sublabel || "WORKER TASK",
         pos.x + 32 * this.camera.scale,
         pos.y + 50 * this.camera.scale,
      );
   }

   // --- Interactive Drag & Connect Helpers ---
   _bindEvents() {
      const c = this.canvas;

      c.addEventListener("mousedown", (e) => {
         const rect = c.getBoundingClientRect();
         const mouseX = e.clientX - rect.left;
         const mouseY = e.clientY - rect.top;
         const worldPos = this._screenToWorld(mouseX, mouseY);

         this._mouseDownPos = { x: e.clientX, y: e.clientY };
         const clickedNode = this._findNodeAt(worldPos.x, worldPos.y);
         this._mouseDownNode = clickedNode;

         if (e.shiftKey && clickedNode) {
            // Shift + Click starts connection mode
            this.isConnecting = true;
            this.connectSource = clickedNode;
         } else if (clickedNode) {
            this.draggedNode = clickedNode;
            this.dragOffset = {
               x: worldPos.x - clickedNode.x,
               y: worldPos.y - clickedNode.y,
            };
         } else {
            this.isDragging = true;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
         }
      });

      window.addEventListener("mouseup", (e) => {
         const dist = this._mouseDownPos
            ? Math.hypot(
                 e.clientX - this._mouseDownPos.x,
                 e.clientY - this._mouseDownPos.y,
              )
            : 0;
         const isClick = dist < 6;

         if (this.isConnecting && this.connectSource) {
            const rect = c.getBoundingClientRect();
            const worldPos = this._screenToWorld(
               e.clientX - rect.left,
               e.clientY - rect.top,
            );
            const targetNode = this._findNodeAt(worldPos.x, worldPos.y);
            if (targetNode && targetNode.id !== this.connectSource.id) {
               this.addConnection({
                  from: this.connectSource.id,
                  to: targetNode.id,
                  color: this.connectColor,
               });
               this._playTone(660, "sine", 0.1, 0.05);
            }
         } else if (isClick) {
            if (this._mouseDownNode) {
               // Node clicked! Trigger callback and auto zoom
               if (typeof this.options.onNodeClick === "function") {
                  this.options.onNodeClick(this._mouseDownNode);
               }
               if (this.options.zoomOnClick !== false) {
                  this.focusNode(this._mouseDownNode.id, true, 1.45);
               }
            } else {
               // Empty Canvas clicked
               if (typeof this.options.onCanvasClick === "function") {
                  this.options.onCanvasClick();
               }
            }
         }

         this.isDragging = false;
         this.isConnecting = false;
         this.connectSource = null;
         this.draggedNode = null;
         this._mouseDownNode = null;
      });

      c.addEventListener("mousemove", (e) => {
         const rect = c.getBoundingClientRect();
         const mouseX = e.clientX - rect.left;
         const mouseY = e.clientY - rect.top;

         if (this.draggedNode) {
            const worldPos = this._screenToWorld(mouseX, mouseY);
            this.draggedNode.x = worldPos.x - this.dragOffset.x;
            this.draggedNode.y = worldPos.y - this.dragOffset.y;
         } else if (this.isDragging) {
            const dx = (e.clientX - this.lastMousePos.x) / this.camera.scale;
            const dy = (e.clientY - this.lastMousePos.y) / this.camera.scale;
            this.camera.targetX -= dx;
            this.camera.targetY -= dy;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
         }

         this.lastMousePos = { x: e.clientX, y: e.clientY };
      });

      c.addEventListener(
         "wheel",
         (e) => {
            e.preventDefault();
            const zoomFactor = e.deltaY < 0 ? 1.15 : 0.88;
            this.camera.targetScale = Math.min(
               Math.max(this.camera.targetScale * zoomFactor, 0.25),
               2.5,
            );
         },
         { passive: false },
      );
   }

   _findNodeAt(wx, wy) {
      for (let i = this.nodes.length - 1; i >= 0; i--) {
         const n = this.nodes[i];
         if (
            wx >= n.x &&
            wx <= n.x + n.width &&
            wy >= n.y &&
            wy <= n.y + n.height
         ) {
            return n;
         }
      }
      return null;
   }

   _drawConnectingPreview() {
      const pts = this._worldToScreen(
         this.connectSource.x + this.connectSource.width,
         this.connectSource.y + this.connectSource.height / 2,
      );
      const mousePos = { x: this.lastMousePos.x, y: this.lastMousePos.y };
      const ctx = this.ctx;
      const colorData = this.COLORS[this.connectColor] || this.COLORS.blue;

      ctx.beginPath();
      ctx.moveTo(pts.x, pts.y);
      ctx.lineTo(mousePos.x, mousePos.y);
      ctx.strokeStyle = colorData.glow;
      ctx.lineWidth = 2 * this.camera.scale;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.setLineDash([]);
   }

   // --- Utility & Math Helpers ---
   _getBezierPoint(p1, cp1, cp2, p2, t) {
      const u = 1 - t;
      const tt = t * t;
      const uu = u * u;
      const uuu = uu * u;
      const ttt = tt * t;
      return {
         x: uuu * p1.x + 3 * uu * t * cp1.x + 3 * u * tt * cp2.x + ttt * p2.x,
         y: uuu * p1.y + 3 * uu * t * cp1.y + 3 * u * tt * cp2.y + ttt * p2.y,
      };
   }

   _roundRect(c, x, y, w, h, r) {
      if (w < 2 * r) r = w / 2;
      if (h < 2 * r) r = h / 2;
      c.beginPath();
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + h, r);
      c.arcTo(x + w, y + h, x, y + h, r);
      c.arcTo(x, y + h, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
   }

   _getDefaultSublabel(type) {
      switch (type) {
         case "conditional":
            return "DECISION EVAL";
         case "input":
            return "INGRESS PORT";
         case "output":
            return "EGRESS PORT";
         case "database":
            return "PERSISTENT CLUSTER";
         case "thread":
            return "ASYNC WORKER";
         default:
            return "ACTIVE TASK";
      }
   }

   // --- Audio Synthesizer ---
   _initAudio() {
      if (!this.audioCtx && typeof window !== "undefined") {
         try {
            this.audioCtx = new (
               window.AudioContext || window.webkitAudioContext
            )();
         } catch (e) {
            // AudioContext not supported
         }
      }
      if (this.audioCtx && this.audioCtx.state === "suspended") {
         this.audioCtx.resume();
      }
   }

   _playTone(freq, type = "sine", duration = 0.08, gainVal = 0.04) {
      if (!this.options.soundEnabled || !this.audioCtx) return;
      try {
         const osc = this.audioCtx.createOscillator();
         const gain = this.audioCtx.createGain();
         osc.type = type;
         osc.frequency.setValueAtTime(freq, this.audioCtx.currentTime);
         gain.gain.setValueAtTime(gainVal, this.audioCtx.currentTime);
         gain.gain.exponentialRampToValueAtTime(
            0.0001,
            this.audioCtx.currentTime + duration,
         );
         osc.connect(gain);
         gain.connect(this.audioCtx.destination);
         osc.start();
         osc.stop(this.audioCtx.currentTime + duration);
      } catch (e) {
         // Ignored
      }
   }
}

// ============================================================================
// Web Component Definition: <cinematic-flow>
// ============================================================================
if (
   typeof customElements !== "undefined" &&
   !customElements.get("cinematic-flow")
) {
   class CinematicFlowElement extends HTMLElement {
      connectedCallback() {
         // Wait for children to parse
         setTimeout(() => {
            this.flow = new CinematicFlow(this, {
               theme: this.getAttribute("theme") || "cyberpunk",
               soundEnabled: this.hasAttribute("sound"),
            });

            // Parse child <flow-node> tags
            const nodeEls = this.querySelectorAll("flow-node");
            nodeEls.forEach((el) => {
               this.flow.addNode({
                  id: el.getAttribute("id"),
                  type: el.getAttribute("type") || "square",
                  label: el.getAttribute("label") || el.textContent.trim(),
                  sublabel:
                     el.getAttribute("sublabel") || el.getAttribute("sub"),
                  x: parseFloat(el.getAttribute("x") || 100),
                  y: parseFloat(el.getAttribute("y") || 100),
                  color: el.getAttribute("color") || "blue",
                  condition: el.getAttribute("condition"),
                  forcedState:
                     el.getAttribute("forced-state") ||
                     el.getAttribute("forcedstate") ||
                     "auto",
               });
            });

            // Parse child <flow-edge> tags
            const edgeEls = this.querySelectorAll("flow-edge");
            edgeEls.forEach((el) => {
               this.flow.addConnection({
                  from: el.getAttribute("from") || el.getAttribute("source"),
                  to: el.getAttribute("to") || el.getAttribute("target"),
                  fromPort:
                     el.getAttribute("from-port") ||
                     el.getAttribute("fromport") ||
                     el.getAttribute("from-side") ||
                     el.getAttribute("source-port"),
                  toPort:
                     el.getAttribute("to-port") ||
                     el.getAttribute("toport") ||
                     el.getAttribute("to-side") ||
                     el.getAttribute("target-port"),
                  color: el.getAttribute("color") || "blue",
                  label:
                     el.getAttribute("label") || el.getAttribute("condition"),
                  condition: el.getAttribute("condition"),
               });
            });

            this.flow.fitView(false);
         }, 0);
      }

      // Delegate conditional controls to underlying CinematicFlow instance
      getConditionNodes() {
         return this.flow ? this.flow.getConditionNodes() : [];
      }

      setConditionState(nodeId, state) {
         return this.flow ? this.flow.setConditionState(nodeId, state) : null;
      }

      getConditionState(nodeId) {
         return this.flow ? this.flow.getConditionState(nodeId) : null;
      }

      toggleConditionState(nodeId) {
         return this.flow ? this.flow.toggleConditionState(nodeId) : null;
      }

      setAllConditions(state) {
         if (this.flow) this.flow.setAllConditions(state);
      }

      triggerConditionSimulation(nodeId, forcedOverride = null) {
         if (this.flow)
            this.flow.triggerConditionSimulation(nodeId, forcedOverride);
      }

      disconnectedCallback() {
         if (this.flow) {
            this.flow.stopPacketSpawner();
         }
      }
   }

   customElements.define("cinematic-flow", CinematicFlowElement);
}

// Export for module systems or global window
if (typeof module !== "undefined" && module.exports) {
   module.exports = { CinematicFlow };
} else if (typeof window !== "undefined") {
   window.CinematicFlow = CinematicFlow;
}
