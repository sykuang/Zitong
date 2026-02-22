import { useState, useRef, useCallback, useEffect } from "react";
import type { AppSettings } from "@/types";
import * as commands from "@/commands";

// --- Hotkey Recorder ---
function HotkeyRecorder({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  const eventToAccelerator = (e: React.KeyboardEvent): string | null => {
    const parts: string[] = [];
    if (e.metaKey || e.ctrlKey) parts.push("CommandOrControl");
    if (e.altKey) parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");

    if (parts.length === 0) return null;

    const key = e.key;
    if (["Control", "Meta", "Alt", "Shift"].includes(key)) return null;

    // Use e.code for reliable physical key detection (e.key can be altered
    // by modifiers — e.g. Option+Space on macOS produces a non-breaking space).
    const codeMap: Record<string, string> = {
      Space: "Space",
      ArrowUp: "Up", ArrowDown: "Down", ArrowLeft: "Left", ArrowRight: "Right",
      Escape: "Escape", Enter: "Enter", Backspace: "Backspace", Delete: "Delete",
      Tab: "Tab", Home: "Home", End: "End", PageUp: "PageUp", PageDown: "PageDown",
    };

    let mappedKey = codeMap[e.code] || key;
    if (mappedKey.length === 1) mappedKey = mappedKey.toUpperCase();

    parts.push(mappedKey);
    return parts.join("+");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!recording) return;
    e.preventDefault();
    e.stopPropagation();
    const accelerator = eventToAccelerator(e);
    if (accelerator) {
      onChange(accelerator);
      setRecording(false);
    }
  };

  const isMac = navigator.platform.includes("Mac");
  const displayValue = value
    .replace(/CommandOrControl/g, isMac ? "\u2318" : "Ctrl")
    .replace(/Shift/g, "\u21E7")
    .replace(/Alt/g, isMac ? "\u2325" : "Alt")
    .replace(/\+/g, " + ");

  return (
    <div className="flex gap-2">
      <div
        ref={inputRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        onBlur={() => setRecording(false)}
        onClick={() => { setRecording(true); inputRef.current?.focus(); }}
        className={`flex-1 px-3 py-2 text-sm rounded-lg cursor-pointer select-none transition-all duration-200 ${
          recording
            ? "glass text-primary ring-2 ring-primary/40"
            : "glass-input text-text-primary"
        }`}
      >
        {recording ? (
          <span className="animate-pulse">Press your shortcut...</span>
        ) : (
          <span className="font-mono">{displayValue}</span>
        )}
      </div>
      {recording && (
        <button
          onClick={(e) => { e.stopPropagation(); setRecording(false); }}
          className="px-3 py-1.5 text-xs rounded-lg glass-hover text-text-muted hover:text-text-secondary transition-colors"
        >
          Cancel
        </button>
      )}
    </div>
  );
}

// --- Shortcuts Tab ---
interface ShortcutDef {
  id: string;
  label: string;
  defaultMac: string;
  defaultWin: string;
}

const defaultShortcuts: ShortcutDef[] = [
  { id: "new_chat", label: "New Chat", defaultMac: "CommandOrControl+N", defaultWin: "CommandOrControl+N" },
  { id: "toggle_sidebar", label: "Toggle Sidebar", defaultMac: "CommandOrControl+B", defaultWin: "CommandOrControl+B" },
  { id: "open_settings", label: "Open Settings", defaultMac: "CommandOrControl+,", defaultWin: "CommandOrControl+," },
  { id: "search", label: "Search Conversations", defaultMac: "CommandOrControl+K", defaultWin: "CommandOrControl+K" },
  { id: "focus_input", label: "Focus Chat Input", defaultMac: "CommandOrControl+L", defaultWin: "CommandOrControl+L" },
  { id: "delete_conversation", label: "Delete Conversation", defaultMac: "CommandOrControl+Shift+Backspace", defaultWin: "CommandOrControl+Shift+Backspace" },
];

export function ShortcutsTab({
  settings,
  onRefresh,
}: {
  settings: AppSettings | null;
  onRefresh: () => Promise<void>;
}) {
  const [globalHotkey, setGlobalHotkey] = useState(
    settings?.globalHotkey || "CommandOrControl+Shift+Space"
  );

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistHotkey = useCallback(
    (hotkey: string) => {
      if (!settings) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          await commands.saveSettings({ ...settings, globalHotkey: hotkey });
          await onRefresh();
        } catch (err) {
          console.error("Failed to save shortcuts:", err);
        }
      }, 400);
    },
    [settings, onRefresh]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        // Flush pending save on unmount
        if (settings) {
          commands.saveSettings({ ...settings, globalHotkey }).then(() => onRefresh());
        }
      }
    };
  }, [settings, globalHotkey, onRefresh]);

  const handleHotkeyChange = (v: string) => {
    setGlobalHotkey(v);
    persistHotkey(v);
  };

  const isMac = navigator.platform.includes("Mac");
  const formatShortcut = (s: string) =>
    s
      .replace(/CommandOrControl/g, isMac ? "⌘" : "Ctrl")
      .replace(/Shift/g, "⇧")
      .replace(/Alt/g, isMac ? "⌥" : "Alt")
      .replace(/Backspace/g, "⌫")
      .replace(/\+/g, " ");

  return (
    <div className="space-y-5">
      {/* Global Hotkey */}
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-1">Global Hotkey</h3>
        <p className="text-xs text-text-muted mb-2">
          Activate Zitong from anywhere on your system
        </p>
        <HotkeyRecorder value={globalHotkey} onChange={handleHotkeyChange} />
      </div>

      <div className="border-t border-glass-border pt-4">
        <h3 className="text-sm font-medium text-text-primary mb-3">App Shortcuts</h3>
        <div className="glass rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-glass-border">
                <th className="text-left text-xs font-medium text-text-secondary px-3 py-2">Action</th>
                <th className="text-right text-xs font-medium text-text-secondary px-3 py-2">Shortcut</th>
              </tr>
            </thead>
            <tbody>
              {defaultShortcuts.map((s) => (
                <tr key={s.id} className="border-t border-glass-border">
                  <td className="text-sm text-text-primary px-3 py-2.5">{s.label}</td>
                  <td className="text-right px-3 py-2.5">
                    <span className="inline-flex items-center gap-0.5 font-mono text-xs">
                      {formatShortcut(isMac ? s.defaultMac : s.defaultWin)
                        .split(" ")
                        .map((k, i) => (
                          <kbd
                            key={i}
                            className="px-1.5 py-0.5 rounded-md glass text-text-secondary text-xs min-w-[22px] text-center"
                          >
                            {k}
                          </kbd>
                        ))}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-text-muted mt-2">
          Custom shortcut editing coming soon.
        </p>
      </div>
    </div>
  );
}
