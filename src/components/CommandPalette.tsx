import { useState, useEffect, useRef, useCallback } from "react";
import { Search, CornerDownLeft, Type, ArrowUpRight } from "lucide-react";
import type { AiCommand } from "@/types";
import * as commands from "@/commands";

// Map behavior to a shortcut icon
function BehaviorIcon({ behavior }: { behavior: AiCommand["behavior"] }) {
  switch (behavior) {
    case "replace_selection":
      return <Type className="w-3.5 h-3.5 text-text-muted" />;
    case "insert_after":
      return <CornerDownLeft className="w-3.5 h-3.5 text-text-muted" />;
    case "answer_in_new":
      return <ArrowUpRight className="w-3.5 h-3.5 text-text-muted" />;
    default:
      return null;
  }
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
  onSelect: (command: AiCommand) => void;
}

export function CommandPalette({ open, onClose, onSelect }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [aiCommands, setAiCommands] = useState<AiCommand[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Load AI commands when palette opens
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setSelectedIndex(0);
    commands.listAiCommands().then((cmds) => {
      setAiCommands(cmds.filter((c) => c.enabled).sort((a, b) => a.sortOrder - b.sortOrder));
    });
    // Focus input after a frame
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

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
            onSelect(filtered[selectedIndex]);
            onClose();
          }
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    },
    [filtered, selectedIndex, onSelect, onClose]
  );

  // Close on backdrop click
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-start justify-center pt-[15vh]"
      onClick={handleBackdropClick}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Palette */}
      <div
        className="relative w-full max-w-[480px] rounded-2xl overflow-hidden shadow-2xl border border-glass-border animate-slide-up"
        style={{
          background: "var(--color-surface)",
          boxShadow:
            "0 25px 60px rgba(0, 0, 0, 0.35), 0 0 0 1px var(--color-glass-border), 0 0 80px rgba(139, 92, 246, 0.1)",
        }}
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
                onClick={() => {
                  onSelect(cmd);
                  onClose();
                }}
                onMouseEnter={() => setSelectedIndex(i)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-100 ${
                  i === selectedIndex
                    ? "bg-primary/12 text-text-primary"
                    : "text-text-primary hover:bg-primary/6"
                }`}
              >
                {/* Icon */}
                <span className="text-base flex-shrink-0 w-5 text-center leading-none">
                  {cmd.icon === "⚡" ? (
                    <span className="text-amber-400">{cmd.icon}</span>
                  ) : (
                    cmd.icon
                  )}
                </span>

                {/* Label */}
                <span className="flex-1 text-sm font-medium truncate">
                  {cmd.label}
                </span>

                {/* Behavior hint icon */}
                <BehaviorIcon behavior={cmd.behavior} />
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
