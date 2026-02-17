/**
 * MCP UI Audit Server for Zitong
 *
 * Architecture:
 *   Copilot → MCP stdio → this server → WebSocket → React DevAudit component → DOM APIs → results back
 *
 * Tools exposed:
 *   - audit_ui: Full scan of all interactive elements with size/position/style info
 *   - get_element_info: Query specific CSS selector for computed styles + rect
 *   - check_touch_targets: Find undersized interactive elements (< 44×44px)
 *   - get_elements_near_edge: Find elements close to container edges (clipping risk)
 *   - get_viewport: Viewport dimensions, scroll, dark/light mode
 *   - query_elements: Arbitrary querySelectorAll with basic info
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebSocketServer } from "ws";
import { z } from "zod";

const WS_PORT = 17891;
const RESPONSE_TIMEOUT = 8000; // 8 seconds

// ─── WebSocket Bridge ────────────────────────────────────────────────

let activeClient = null;
let pendingRequests = new Map(); // id -> { resolve, reject, timer }
let requestIdCounter = 0;

const wss = new WebSocketServer({ port: WS_PORT });

wss.on("listening", () => {
  // Log to stderr so it doesn't interfere with MCP stdio
  console.error(`[mcp-ui-audit] WebSocket server listening on ws://localhost:${WS_PORT}`);
});

wss.on("connection", (ws) => {
  console.error("[mcp-ui-audit] Client connected");
  activeClient = ws;

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      const pending = pendingRequests.get(msg.id);
      if (pending) {
        clearTimeout(pending.timer);
        pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
      }
    } catch (e) {
      console.error("[mcp-ui-audit] Failed to parse message:", e);
    }
  });

  ws.on("close", () => {
    console.error("[mcp-ui-audit] Client disconnected");
    if (activeClient === ws) activeClient = null;
    // Reject all pending requests
    for (const [id, pending] of pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error("WebSocket client disconnected"));
    }
    pendingRequests.clear();
  });

  ws.on("error", (err) => {
    console.error("[mcp-ui-audit] WebSocket error:", err.message);
  });
});

function sendRequest(type, params = {}) {
  return new Promise((resolve, reject) => {
    if (!activeClient || activeClient.readyState !== 1) {
      reject(new Error("No active WebSocket client. Is the Zitong app running in dev mode?"));
      return;
    }

    const id = ++requestIdCounter;
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error(`Request timed out after ${RESPONSE_TIMEOUT}ms`));
    }, RESPONSE_TIMEOUT);

    pendingRequests.set(id, { resolve, reject, timer });
    activeClient.send(JSON.stringify({ id, type, params }));
  });
}

// ─── MCP Server ──────────────────────────────────────────────────────

const server = new McpServer({
  name: "ui-audit",
  version: "0.1.0",
});

// Tool: audit_ui
server.tool(
  "audit_ui",
  "Full scan of all interactive elements (buttons, links, inputs, selects, textareas) in the live Zitong UI. Returns pixel-accurate size, position, computed styles, and highlights issues like undersized touch targets or clipped elements.",
  {
    includeStyles: z.boolean().optional().default(true).describe("Include computed style details (padding, margin, fontSize, colors)"),
    minTouchTarget: z.number().optional().default(44).describe("Minimum acceptable touch target size in pixels"),
  },
  async ({ includeStyles, minTouchTarget }) => {
    try {
      const result = await sendRequest("audit_ui", { includeStyles, minTouchTarget });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// Tool: get_element_info
server.tool(
  "get_element_info",
  "Get detailed information about a specific element by CSS selector. Returns bounding rect, all computed styles, accessibility info, and child count.",
  {
    selector: z.string().describe("CSS selector to query (e.g., 'button.glass-button', '#sidebar', '.settings-panel')"),
    index: z.number().optional().default(0).describe("If selector matches multiple elements, which index to inspect (0-based)"),
  },
  async ({ selector, index }) => {
    try {
      const result = await sendRequest("get_element_info", { selector, index });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// Tool: check_touch_targets
server.tool(
  "check_touch_targets",
  "Scan all interactive elements and return only those with touch targets smaller than the specified minimum size. Great for accessibility auditing.",
  {
    minSize: z.number().optional().default(44).describe("Minimum acceptable touch target size in pixels (both width and height)"),
  },
  async ({ minSize }) => {
    try {
      const result = await sendRequest("check_touch_targets", { minSize });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// Tool: get_elements_near_edge
server.tool(
  "get_elements_near_edge",
  "Find elements that are within N pixels of their scrollable container's edge, indicating potential clipping or tight spacing issues.",
  {
    threshold: z.number().optional().default(8).describe("Distance in pixels from container edge to flag"),
    selector: z.string().optional().default("button, a, input, select, textarea").describe("CSS selector for elements to check"),
  },
  async ({ threshold, selector }) => {
    try {
      const result = await sendRequest("get_elements_near_edge", { threshold, selector });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// Tool: get_viewport
server.tool(
  "get_viewport",
  "Get current viewport dimensions, scroll position, device pixel ratio, and whether dark mode is active.",
  {},
  async () => {
    try {
      const result = await sendRequest("get_viewport", {});
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// Tool: query_elements
server.tool(
  "query_elements",
  "Run an arbitrary CSS querySelectorAll and return basic info (tag, text, rect, classes) for each matched element. Useful for targeted inspection.",
  {
    selector: z.string().describe("CSS selector (e.g., '.glass-button', 'div.space-y-3 > button', '[data-testid]')"),
    limit: z.number().optional().default(50).describe("Maximum number of elements to return"),
  },
  async ({ selector, limit }) => {
    try {
      const result = await sendRequest("query_elements", { selector, limit });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      return { content: [{ type: "text", text: `Error: ${e.message}` }], isError: true };
    }
  }
);

// ─── Start ───────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("[mcp-ui-audit] MCP server started (stdio transport)");
}

main().catch((e) => {
  console.error("[mcp-ui-audit] Fatal:", e);
  process.exit(1);
});
