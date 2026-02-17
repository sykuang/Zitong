/**
 * DevAudit — Dev-only component that bridges the MCP UI audit server
 * to the live DOM via WebSocket.
 *
 * Only mounts when import.meta.env.DEV is true.
 * Connects to ws://localhost:17891, listens for inspection requests,
 * executes DOM queries, and sends results back.
 */

import { useEffect, useRef, useState } from "react";

const WS_URL = "ws://localhost:17891";
const RECONNECT_INTERVAL = 3000;

// ─── DOM Inspection Helpers ──────────────────────────────────────────

/** Build a human-readable CSS selector path for an element */
function getSelectorPath(el: Element): string {
  const parts: string[] = [];
  let current: Element | null = el;

  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector += `#${current.id}`;
      parts.unshift(selector);
      break; // ID is unique enough
    }

    const classes = Array.from(current.classList)
      .filter((c) => !c.startsWith("__")) // skip internal classes
      .slice(0, 3) // limit to 3 classes for readability
      .join(".");

    if (classes) {
      selector += `.${classes}`;
    }

    // Add nth-child if needed for disambiguation
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (s) => s.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-child(${index})`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
  }

  return parts.join(" > ");
}

/** Get the visible text content of an element (truncated) */
function getVisibleText(el: Element): string {
  const text = (el as HTMLElement).innerText || el.textContent || "";
  return text.trim().slice(0, 60);
}

/** Get compact computed style info */
function getStyleInfo(el: Element) {
  const s = getComputedStyle(el);
  return {
    padding: `${s.paddingTop} ${s.paddingRight} ${s.paddingBottom} ${s.paddingLeft}`,
    margin: `${s.marginTop} ${s.marginRight} ${s.marginBottom} ${s.marginLeft}`,
    fontSize: s.fontSize,
    lineHeight: s.lineHeight,
    fontWeight: s.fontWeight,
    color: s.color,
    backgroundColor: s.backgroundColor,
    borderColor: s.borderColor,
    borderWidth: s.borderWidth,
    borderRadius: s.borderRadius,
    display: s.display,
    position: s.position,
    overflow: s.overflow,
    opacity: s.opacity,
    cursor: s.cursor,
  };
}

/** Get bounding rect as a plain object */
function getRect(el: Element) {
  const r = el.getBoundingClientRect();
  return {
    x: Math.round(r.x),
    y: Math.round(r.y),
    width: Math.round(r.width),
    height: Math.round(r.height),
    top: Math.round(r.top),
    right: Math.round(r.right),
    bottom: Math.round(r.bottom),
    left: Math.round(r.left),
  };
}

/** Build element info object */
function getElementInfo(el: Element, includeStyles = true) {
  const rect = getRect(el);
  const info: Record<string, unknown> = {
    tag: el.tagName.toLowerCase(),
    selector: getSelectorPath(el),
    text: getVisibleText(el),
    rect,
    classes: Array.from(el.classList).join(" "),
    role: el.getAttribute("role"),
    ariaLabel: el.getAttribute("aria-label"),
  };

  if (includeStyles) {
    info.styles = getStyleInfo(el);
  }

  return info;
}

// ─── Request Handlers ────────────────────────────────────────────────

const INTERACTIVE_SELECTOR =
  'button, a[href], input, select, textarea, [role="button"], [role="link"], [role="tab"], [tabindex]';

function handleAuditUI(params: { includeStyles?: boolean; minTouchTarget?: number }) {
  const minSize = params.minTouchTarget ?? 44;
  const includeStyles = params.includeStyles ?? true;
  const elements = document.querySelectorAll(INTERACTIVE_SELECTOR);
  const results: Array<Record<string, unknown>> = [];

  elements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    // Skip hidden/zero-size elements
    if (rect.width === 0 && rect.height === 0) return;

    const info = getElementInfo(el, includeStyles);
    const issues: string[] = [];

    if (rect.width < minSize || rect.height < minSize) {
      issues.push(
        `Touch target ${Math.round(rect.width)}×${Math.round(rect.height)}px < ${minSize}×${minSize}px minimum`
      );
    }

    // Check if element is clipped by viewport
    if (rect.bottom > window.innerHeight) {
      issues.push(`Extends ${Math.round(rect.bottom - window.innerHeight)}px below viewport`);
    }
    if (rect.right > window.innerWidth) {
      issues.push(`Extends ${Math.round(rect.right - window.innerWidth)}px beyond viewport right`);
    }
    if (rect.top < 0) {
      issues.push(`Extends ${Math.round(-rect.top)}px above viewport`);
    }
    if (rect.left < 0) {
      issues.push(`Extends ${Math.round(-rect.left)}px beyond viewport left`);
    }

    info.issues = issues;
    results.push(info);
  });

  return {
    total: results.length,
    withIssues: results.filter((r) => (r.issues as string[]).length > 0).length,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    elements: results,
  };
}

function handleGetElementInfo(params: { selector: string; index?: number }) {
  const elements = document.querySelectorAll(params.selector);
  const index = params.index ?? 0;

  if (elements.length === 0) {
    return { error: `No elements found matching "${params.selector}"` };
  }

  if (index >= elements.length) {
    return {
      error: `Index ${index} out of range, only ${elements.length} element(s) found`,
      matchCount: elements.length,
    };
  }

  const el = elements[index];
  const info = getElementInfo(el, true);
  const s = getComputedStyle(el);

  // Extended style info for single element inspection
  return {
    ...info,
    matchCount: elements.length,
    extendedStyles: {
      boxSizing: s.boxSizing,
      width: s.width,
      height: s.height,
      minWidth: s.minWidth,
      minHeight: s.minHeight,
      maxWidth: s.maxWidth,
      maxHeight: s.maxHeight,
      gap: s.gap,
      flexDirection: s.flexDirection,
      alignItems: s.alignItems,
      justifyContent: s.justifyContent,
      gridTemplateColumns: s.gridTemplateColumns,
      zIndex: s.zIndex,
      transform: s.transform,
      transition: s.transition,
      boxShadow: s.boxShadow,
      outline: s.outline,
      visibility: s.visibility,
      pointerEvents: s.pointerEvents,
    },
    childCount: el.children.length,
    parentTag: el.parentElement?.tagName.toLowerCase(),
    parentClasses: el.parentElement
      ? Array.from(el.parentElement.classList).join(" ")
      : null,
  };
}

function handleCheckTouchTargets(params: { minSize?: number }) {
  const minSize = params.minSize ?? 44;
  const elements = document.querySelectorAll(INTERACTIVE_SELECTOR);
  const undersized: Array<Record<string, unknown>> = [];

  elements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    if (rect.width < minSize || rect.height < minSize) {
      undersized.push({
        tag: el.tagName.toLowerCase(),
        selector: getSelectorPath(el),
        text: getVisibleText(el),
        size: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
        rect: getRect(el),
        classes: Array.from(el.classList).join(" "),
        deficit: {
          width: rect.width < minSize ? Math.round(minSize - rect.width) : 0,
          height: rect.height < minSize ? Math.round(minSize - rect.height) : 0,
        },
      });
    }
  });

  return {
    minSize,
    totalInteractive: elements.length,
    undersizedCount: undersized.length,
    elements: undersized,
  };
}

function handleGetElementsNearEdge(params: { threshold?: number; selector?: string }) {
  const threshold = params.threshold ?? 8;
  const selector = params.selector ?? INTERACTIVE_SELECTOR;
  const elements = document.querySelectorAll(selector);
  const nearEdge: Array<Record<string, unknown>> = [];

  elements.forEach((el) => {
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) return;

    const edges: string[] = [];
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (rect.top < threshold) edges.push(`${Math.round(rect.top)}px from top`);
    if (rect.left < threshold) edges.push(`${Math.round(rect.left)}px from left`);
    if (vh - rect.bottom < threshold) edges.push(`${Math.round(vh - rect.bottom)}px from bottom`);
    if (vw - rect.right < threshold) edges.push(`${Math.round(vw - rect.right)}px from right`);

    // Also check against scrollable parent container
    let parent = el.parentElement;
    while (parent && parent !== document.body) {
      const ps = getComputedStyle(parent);
      if (ps.overflow === "auto" || ps.overflow === "scroll" || ps.overflowY === "auto" || ps.overflowY === "scroll") {
        const pr = parent.getBoundingClientRect();
        if (rect.bottom > pr.bottom - threshold) {
          edges.push(`${Math.round(pr.bottom - rect.bottom)}px from scroll container bottom`);
        }
        if (rect.right > pr.right - threshold) {
          edges.push(`${Math.round(pr.right - rect.right)}px from scroll container right`);
        }
        break;
      }
      parent = parent.parentElement;
    }

    if (edges.length > 0) {
      nearEdge.push({
        tag: el.tagName.toLowerCase(),
        selector: getSelectorPath(el),
        text: getVisibleText(el),
        rect: getRect(el),
        edgeProximity: edges,
      });
    }
  });

  return {
    threshold,
    viewport: { width: window.innerWidth, height: window.innerHeight },
    count: nearEdge.length,
    elements: nearEdge,
  };
}

function handleGetViewport() {
  const isDark = document.documentElement.classList.contains("dark");

  return {
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    isDarkMode: isDark,
    documentTitle: document.title,
    bodyClasses: Array.from(document.body.classList).join(" "),
    htmlClasses: Array.from(document.documentElement.classList).join(" "),
  };
}

function handleQueryElements(params: { selector: string; limit?: number }) {
  const limit = params.limit ?? 50;
  const elements = document.querySelectorAll(params.selector);
  const results: Array<Record<string, unknown>> = [];

  for (let i = 0; i < Math.min(elements.length, limit); i++) {
    const el = elements[i];
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0) continue;

    results.push({
      index: i,
      tag: el.tagName.toLowerCase(),
      text: getVisibleText(el),
      rect: getRect(el),
      classes: Array.from(el.classList).join(" "),
      id: el.id || undefined,
    });
  }

  return {
    selector: params.selector,
    totalMatches: elements.length,
    returned: results.length,
    elements: results,
  };
}

// ─── Dispatcher ──────────────────────────────────────────────────────

function handleRequest(type: string, params: Record<string, unknown>) {
  switch (type) {
    case "audit_ui":
      return handleAuditUI(params as { includeStyles?: boolean; minTouchTarget?: number });
    case "get_element_info":
      return handleGetElementInfo(params as { selector: string; index?: number });
    case "check_touch_targets":
      return handleCheckTouchTargets(params as { minSize?: number });
    case "get_elements_near_edge":
      return handleGetElementsNearEdge(params as { threshold?: number; selector?: string });
    case "get_viewport":
      return handleGetViewport();
    case "query_elements":
      return handleQueryElements(params as { selector: string; limit?: number });
    default:
      return { error: `Unknown request type: ${type}` };
  }
}

// ─── React Component ─────────────────────────────────────────────────

export default function DevAudit() {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<"disconnected" | "connected">("disconnected");

  useEffect(() => {
    function connect() {
      try {
        const ws = new WebSocket(WS_URL);
        wsRef.current = ws;

        ws.onopen = () => {
          console.log("[DevAudit] Connected to MCP UI audit server");
          setStatus("connected");
        };

        ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data);
            const { id, type, params } = msg;

            if (!id || !type) return;

            try {
              const result = handleRequest(type, params || {});
              ws.send(JSON.stringify({ id, result }));
            } catch (e) {
              ws.send(
                JSON.stringify({
                  id,
                  error: e instanceof Error ? e.message : String(e),
                })
              );
            }
          } catch {
            // Ignore malformed messages
          }
        };

        ws.onclose = () => {
          console.log("[DevAudit] Disconnected, reconnecting...");
          setStatus("disconnected");
          wsRef.current = null;
          scheduleReconnect();
        };

        ws.onerror = () => {
          // onclose will fire after this
        };
      } catch {
        scheduleReconnect();
      }
    }

    function scheduleReconnect() {
      if (reconnectTimerRef.current) return;
      reconnectTimerRef.current = setTimeout(() => {
        reconnectTimerRef.current = null;
        connect();
      }, RECONNECT_INTERVAL);
    }

    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Tiny indicator dot in bottom-right corner
  return (
    <div
      title={`DevAudit: ${status}`}
      style={{
        position: "fixed",
        bottom: 6,
        right: 6,
        width: 8,
        height: 8,
        borderRadius: "50%",
        backgroundColor: status === "connected" ? "#22c55e" : "#ef4444",
        opacity: 0.7,
        zIndex: 99999,
        pointerEvents: "none",
        transition: "background-color 0.3s",
      }}
    />
  );
}
