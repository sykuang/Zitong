import { useState, useEffect, useRef, useCallback } from "react";
import {
  Search,
  Loader2,
  AlertCircle,
  Check,
  CornerDownLeft,
  X,
  RotateCcw,
  Minus,
  Plus,
  MessageSquarePlus,
  Send,
} from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { AiCommand } from "@/types";
import * as commands from "@/commands";

export function OverlayApp() {
  const [query, setQuery] = useState("");
  const [aiCommands, setAiCommands] = useState<AiCommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const followUpRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Execution state
  type OverlayPhase =
    | { kind: "idle" }
    | { kind: "loading"; label: string }
    | {
        kind: "result";
        result: string;
        selectedText: string;
        command: AiCommand;
      }
    | { kind: "error"; message: string };
  const [phase, setPhase] = useState<OverlayPhase>({ kind: "idle" });
  const [followUp, setFollowUp] = useState("");

  // Load AI commands on mount
  useEffect(() => {
    commands.listAiCommands().then((cmds) => {
      setAiCommands(cmds.filter((c) => c.enabled).sort((a, b) => a.sortOrder - b.sortOrder));
    });
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  // Re-focus input when the overlay window becomes visible again
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onFocusChanged(({ payload: focused }) => {
      if (focused) {
        setQuery("");
        setSelectedIndex(0);
        setPhase({ kind: "idle" });
        // Reload commands in case they changed
        commands.listAiCommands().then((cmds) => {
          setAiCommands(cmds.filter((c) => c.enabled).sort((a, b) => a.sortOrder - b.sortOrder));
        });
        requestAnimationFrame(() => inputRef.current?.focus());
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const hideOverlay = useCallback(async () => {
    await invoke("hide_overlay");
  }, []);

  // Run an AI command and show result in the overlay
  const runCommand = useCallback(
    async (cmd: AiCommand, selectedText: string) => {
      setPhase({ kind: "loading", label: cmd.label });
      try {
        const result = await commands.executeAiCommand({
          selectedText,
          systemPrompt: cmd.systemPrompt,
          providerId: cmd.providerId ?? undefined,
          model: cmd.model ?? undefined,
        });
        setPhase({ kind: "result", result, selectedText, command: cmd });
        setFollowUp("");
        // Focus the follow-up input after render
        requestAnimationFrame(() => followUpRef.current?.focus());
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setPhase({ kind: "error", message });
      }
    },
    []
  );

  const handleSelect = useCallback(
    async (cmd: AiCommand) => {
      // Read clipboard with retries (⌘C was simulated when overlay was shown,
      // but the target app may not have finished copying yet)
      let selectedText = "";
      const maxRetries = 3;
      const retryDelays = [100, 200, 300];

      for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
          const text = await invoke<string>("read_clipboard_text");
          if (text.trim()) {
            selectedText = text;
            break;
          }
        } catch (clipErr) {
          if (attempt === maxRetries - 1) {
            const msg = clipErr instanceof Error ? clipErr.message : String(clipErr);
            setPhase({ kind: "error", message: `Clipboard read failed: ${msg}` });
            return;
          }
        }
        // Wait before retrying
        await new Promise((r) => setTimeout(r, retryDelays[attempt]));
      }

      if (!selectedText.trim()) {
        setPhase({ kind: "error", message: "No text in clipboard. Select text and try again." });
        return;
      }

      await runCommand(cmd, selectedText);
    },
    [runCommand]
  );

  // --- Result action handlers ---

  const handleReplace = useCallback(async () => {
    if (phase.kind !== "result") return;
    await invoke("write_clipboard_text", { text: phase.result });
    hideOverlay();
  }, [phase, hideOverlay]);

  const handleInsertAfter = useCallback(async () => {
    if (phase.kind !== "result") return;
    // Write "original + result" to clipboard so user can paste
    const combined = phase.selectedText + "\n" + phase.result;
    await invoke("write_clipboard_text", { text: combined });
    hideOverlay();
  }, [phase, hideOverlay]);

  const handleOpenInNewChat = useCallback(async () => {
    if (phase.kind !== "result") return;
    const settings = await commands.getSettings();
    const allProviders = await commands.listProviders();
    const cmd = phase.command;
    const providerId = cmd.providerId || settings.defaultProviderId;
    const resolvedProvider = allProviders.find((p: any) => p.id === providerId);
    const model = cmd.model || resolvedProvider?.defaultModel || settings.defaultModel;

    await invoke("open_in_new_chat", {
      req: {
        userText: phase.selectedText,
        aiResponse: phase.result,
        providerId,
        model,
      },
    });
  }, [phase]);

  const handleDiscard = useCallback(() => {
    hideOverlay();
  }, [hideOverlay]);

  const handleRetry = useCallback(async () => {
    if (phase.kind !== "result") return;
    await runCommand(phase.command, phase.selectedText);
  }, [phase, runCommand]);

  const handleFollowUp = useCallback(
    async (instruction: string) => {
      if (phase.kind !== "result" || !instruction.trim()) return;
      // Run a follow-up: send the current result + follow-up instruction
      setPhase({ kind: "loading", label: instruction });
      try {
        const result = await commands.executeAiCommand({
          selectedText: phase.result,
          systemPrompt: instruction,
          providerId: phase.command.providerId ?? undefined,
          model: phase.command.model ?? undefined,
        });
        setPhase({ kind: "result", result, selectedText: phase.selectedText, command: phase.command });
        setFollowUp("");
        requestAnimationFrame(() => followUpRef.current?.focus());
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setPhase({ kind: "error", message });
      }
    },
    [phase]
  );

  // Filter commands by search query
  const filtered = aiCommands.filter((cmd) =>
    cmd.label.toLowerCase().includes(query.toLowerCase())
  );

  // Keep selectedIndex in bounds
  useEffect(() => {
    if (selectedIndex >= filtered.length) {
      setSelectedIndex(Math.max(0, filtered.length - 1));
    }
  }, [filtered.length, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[selectedIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((i) => (i + 1) % Math.max(filtered.length, 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((i) => (i - 1 + filtered.length) % Math.max(filtered.length, 1));
          break;
        case "Enter":
          e.preventDefault();
          if (filtered[selectedIndex]) {
            handleSelect(filtered[selectedIndex]);
          }
          break;
        case "Escape":
          e.preventDefault();
          hideOverlay();
          break;
      }
    },
    [filtered, selectedIndex, handleSelect, hideOverlay]
  );

  // Also hide when clicking outside the palette (the transparent area)
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) hideOverlay();
    },
    [hideOverlay]
  );

  // Hide when the panel loses focus (user clicks outside)
  useEffect(() => {
    const win = getCurrentWindow();
    const unlisten = win.onFocusChanged(({ payload: focused }) => {
      if (!focused) {
        setTimeout(() => {
          invoke("hide_overlay").catch(() => {});
        }, 150);
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  // --- Shared card wrapper ---
  const cardStyle = {
    background: "var(--color-surface)",
    boxShadow:
      "0 25px 60px rgba(0, 0, 0, 0.5), 0 0 0 1px var(--color-glass-border), 0 0 80px rgba(139, 92, 246, 0.15)",
  };

  // --- ERROR STATE ---
  if (phase.kind === "error") {
    return (
      <div className="h-screen w-screen flex items-start justify-center pt-8" onClick={handleBackdropClick} style={{ background: "transparent" }}>
        <div
          className="w-full max-w-[480px] rounded-2xl overflow-hidden border border-glass-border animate-slide-up"
          style={cardStyle}
        >
          <div className="px-6 py-5 flex flex-col items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-400" />
            <p className="text-sm text-red-400 font-medium">Error</p>
            <p className="text-xs text-text-muted text-center leading-relaxed">{phase.message}</p>
            <button
              onClick={hideOverlay}
              className="mt-1 px-4 py-1.5 text-xs rounded-lg glass-button text-text-secondary hover:text-text-primary"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    );
  }

  // --- LOADING / RESULT STATE (unified compact view) ---
  if (phase.kind === "loading" || phase.kind === "result") {
    const isLoading = phase.kind === "loading";
    return (
      <div className="h-screen w-screen flex items-start justify-center pt-8" onClick={handleBackdropClick} style={{ background: "transparent" }}>
        <div
          className="w-full max-w-[420px] rounded-2xl overflow-hidden border border-glass-border animate-slide-up flex flex-col"
          style={{ ...cardStyle, maxHeight: "calc(100vh - 64px)" }}
        >
          {/* Content area — scrollable with fade mask */}
          <div className="relative">
            <div className="max-h-[200px] overflow-y-auto px-4 py-3 result-scroll">
              {isLoading ? (
                <div className="flex items-center gap-3 py-1">
                  <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />
                  <p className="text-[13px] text-text-muted">
                    Running <span className="text-text-primary font-medium">{phase.label}</span>…
                  </p>
                </div>
              ) : (
                <p className="text-[13px] text-text-primary whitespace-pre-wrap leading-relaxed select-text">
                  {phase.result}
                </p>
              )}
            </div>
          </div>

          {/* Follow-up input */}
          <div className={`px-3 py-1.5 border-t border-glass-border ${isLoading ? "opacity-40 pointer-events-none" : ""}`}>
            <div className="flex items-center gap-2">
              <Search className="w-3 h-3 text-text-muted flex-shrink-0" />
              <input
                ref={followUpRef}
                type="text"
                value={followUp}
                onChange={(e) => setFollowUp(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && followUp.trim()) {
                    e.preventDefault();
                    handleFollowUp(followUp);
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    hideOverlay();
                  }
                }}
                placeholder="Describe a change…"
                className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-muted outline-none"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {followUp.trim() && (
                <button
                  onClick={() => handleFollowUp(followUp)}
                  className="p-0.5 rounded text-primary hover:bg-primary/10"
                >
                  <Send className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {/* Compact action buttons — 2-row grid */}
          <div className={`border-t border-glass-border px-2.5 py-2 flex flex-col gap-1.5 ${isLoading ? "opacity-40 pointer-events-none" : ""}`}>
            {/* Row 1: Primary actions */}
            <div className="flex gap-1.5">
              <PillButton icon={<Check className="w-3.5 h-3.5" />} label="Replace" onClick={handleReplace} primary />
              <PillButton icon={<CornerDownLeft className="w-3.5 h-3.5" />} label="Insert" onClick={handleInsertAfter} />
              <PillButton icon={<X className="w-3.5 h-3.5" />} label="Discard" onClick={handleDiscard} destructive />
            </div>
            {/* Row 2: Modify actions */}
            <div className="flex gap-1.5">
              <PillButton icon={<RotateCcw className="w-3.5 h-3.5" />} label="Retry" onClick={handleRetry} />
              <PillButton icon={<Minus className="w-3.5 h-3.5" />} label="Shorter" onClick={() => handleFollowUp("Make it shorter and more concise.")} />
              <PillButton icon={<Plus className="w-3.5 h-3.5" />} label="Longer" onClick={() => handleFollowUp("Expand and elaborate on this, making it longer and more detailed.")} />
              <PillButton icon={<MessageSquarePlus className="w-3.5 h-3.5" />} label="Chat" onClick={handleOpenInNewChat} />
            </div>
          </div>
        </div>
      </div>
    );
  }

  // --- IDLE: Command palette ---
  return (
    <div
      className="h-screen w-screen flex items-start justify-center pt-8"
      onClick={handleBackdropClick}
      style={{ background: "transparent" }}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl overflow-hidden border border-glass-border animate-slide-up"
        style={cardStyle}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-glass-border">
          <Search className="w-4 h-4 text-text-muted flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Search and press Return"
            className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </div>

        {/* Command list */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-sm text-text-muted text-center">
                No commands found
              </div>
            ) : (
              filtered.map((cmd, i) => (
                <button
                  key={cmd.id}
                  onClick={() => handleSelect(cmd)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 ${
                    i === selectedIndex
                      ? "bg-primary/12 text-text-primary"
                      : "text-text-primary hover:bg-primary/6"
                  }`}
                >
                  <span className="text-base flex-shrink-0 w-5 text-center leading-none">
                    {cmd.icon === "⚡" ? (
                      <span className="text-amber-400">{cmd.icon}</span>
                    ) : (
                      cmd.icon
                    )}
                  </span>
                  <span className="flex-1 text-sm font-medium truncate">
                    {cmd.label}
                  </span>
                </button>
              ))
            )}
          </div>
      </div>
    </div>
  );
}

// --- Compact pill button for result actions ---
function PillButton({
  icon,
  label,
  onClick,
  primary,
  destructive,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  primary?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-[11px] font-medium transition-colors duration-150 cursor-pointer ${
        primary
          ? "bg-primary/15 text-primary hover:bg-primary/25"
          : destructive
          ? "text-red-400 hover:bg-red-500/10"
          : "text-text-secondary hover:bg-glass-hover hover:text-text-primary"
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
