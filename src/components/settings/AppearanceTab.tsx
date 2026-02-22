import { useState, useRef, useCallback, useEffect } from "react";
import type { AppSettings } from "@/types";
import * as commands from "@/commands";
import { Sun, Moon, Monitor } from "lucide-react";

export function AppearanceTab({
  settings,
  onRefresh,
}: {
  settings: AppSettings | null;
  onRefresh: () => Promise<void>;
}) {
  const [theme, setTheme] = useState(settings?.theme || "system");
  const [accentColor, setAccentColor] = useState(settings?.accentColor || "purple");
  const [fontFamily, setFontFamily] = useState(settings?.fontFamily || "system");
  const [chatBubbleStyle, setChatBubbleStyle] = useState(settings?.chatBubbleStyle || "minimal");
  const [codeTheme, setCodeTheme] = useState(settings?.codeTheme || "oneDark");
  const [compactMode, setCompactMode] = useState(settings?.compactMode || false);

  const latestRef = useRef({ theme, accentColor, fontFamily, chatBubbleStyle, codeTheme, compactMode });
  latestRef.current = { theme, accentColor, fontFamily, chatBubbleStyle, codeTheme, compactMode };

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persist = useCallback(
    (overrides: Partial<AppSettings> = {}) => {
      if (!settings) return;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        try {
          const v = latestRef.current;
          await commands.saveSettings({
            ...settings,
            theme: v.theme as AppSettings["theme"],
            accentColor: v.accentColor,
            fontFamily: v.fontFamily,
            chatBubbleStyle: v.chatBubbleStyle,
            codeTheme: v.codeTheme,
            compactMode: v.compactMode,
            ...overrides,
          });
          await onRefresh();
        } catch (err) {
          console.error("Failed to save appearance:", err);
        }
      }, 300);
    },
    [settings, onRefresh]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const accentColors = [
    { id: "violet", color: "bg-violet-500", label: "Violet" },
    { id: "blue", color: "bg-blue-500", label: "Blue" },
    { id: "purple", color: "bg-purple-500", label: "Purple" },
    { id: "green", color: "bg-green-500", label: "Green" },
    { id: "orange", color: "bg-orange-500", label: "Orange" },
    { id: "red", color: "bg-red-500", label: "Red" },
    { id: "pink", color: "bg-pink-500", label: "Pink" },
    { id: "cyan", color: "bg-cyan-500", label: "Cyan" },
  ];

  const themeOptions = [
    { id: "system" as const, label: "System", icon: <Monitor className="w-4 h-4" /> },
    { id: "light" as const, label: "Light", icon: <Sun className="w-4 h-4" /> },
    { id: "dark" as const, label: "Dark", icon: <Moon className="w-4 h-4" /> },
  ];

  return (
    <div className="space-y-6">
      {/* Theme */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Theme</label>
        <div className="flex gap-2">
          {themeOptions.map((t) => (
            <button
              key={t.id}
              onClick={() => { setTheme(t.id); persist({ theme: t.id as AppSettings["theme"] }); }}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm rounded-xl transition-all duration-200 ${
                theme === t.id
                  ? "glass text-primary border-primary/30 font-medium shadow-sm"
                  : "glass-hover text-text-secondary"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accent Color */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Accent Color</label>
        <div className="flex gap-2">
          {accentColors.map((c) => (
            <button
              key={c.id}
              onClick={() => { setAccentColor(c.id); persist({ accentColor: c.id }); }}
              className={`w-10 h-10 rounded-full ${c.color} transition-all duration-200 ${
                accentColor === c.id
                  ? "ring-2 ring-offset-2 ring-offset-surface ring-primary scale-110"
                  : "hover:scale-105 opacity-70 hover:opacity-100"
              }`}
              title={c.label}
              aria-label={`Set accent color to ${c.label}`}
            />
          ))}
        </div>
      </div>

      {/* Font Family */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">Font Family</label>
        <select
          value={fontFamily}
          onChange={(e) => { setFontFamily(e.target.value); persist({ fontFamily: e.target.value }); }}
          className="w-full px-3 py-2 text-sm glass-input rounded-lg text-text-primary"
        >
          <option value="system">System Default</option>
          <option value="inter">Inter</option>
          <option value="jetbrains">JetBrains Mono</option>
          <option value="sf-pro">SF Pro</option>
        </select>
      </div>

      {/* Chat Bubble Style */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-2">Chat Style</label>
        <div className="flex gap-2">
          {[
            { id: "minimal", label: "Minimal", desc: "Clean, no borders" },
            { id: "bubble", label: "Bubble", desc: "Chat bubbles" },
            { id: "card", label: "Card", desc: "Card layout" },
          ].map((s) => (
            <button
              key={s.id}
              onClick={() => { setChatBubbleStyle(s.id); persist({ chatBubbleStyle: s.id }); }}
              className={`flex-1 px-3 py-2 text-left rounded-xl transition-all duration-200 ${
                chatBubbleStyle === s.id
                  ? "glass text-primary border-primary/20"
                  : "glass-hover"
              }`}
            >
              <div className={`text-sm font-medium ${chatBubbleStyle === s.id ? "text-primary" : "text-text-primary"}`}>
                {s.label}
              </div>
              <div className="text-xs text-text-muted">{s.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Code Theme */}
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">Code Block Theme</label>
        <select
          value={codeTheme}
          onChange={(e) => { setCodeTheme(e.target.value); persist({ codeTheme: e.target.value }); }}
          className="w-full px-3 py-2 text-sm glass-input rounded-lg text-text-primary"
        >
          <option value="oneDark">One Dark</option>
          <option value="github">GitHub</option>
          <option value="dracula">Dracula</option>
          <option value="solarized">Solarized</option>
        </select>
      </div>

      {/* Compact Mode */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={compactMode}
          onChange={(e) => { setCompactMode(e.target.checked); persist({ compactMode: e.target.checked }); }}
          className="rounded accent-primary"
        />
        <div>
          <span className="text-sm text-text-primary">Compact Mode</span>
          <p className="text-xs text-text-muted">Reduce spacing for more content on screen</p>
        </div>
      </label>
    </div>
  );
}
