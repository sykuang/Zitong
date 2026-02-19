import { useState, useCallback, useRef } from "react";
import type { AppSettings } from "@/types";
import * as commands from "@/commands";
import { enable, disable } from "@tauri-apps/plugin-autostart";

export function GeneralTab({
  settings,
  onRefresh,
}: {
  settings: AppSettings | null;
  onRefresh: () => Promise<void>;
}) {
  const [launchAtLogin, setLaunchAtLogin] = useState(settings?.launchAtLogin ?? false);
  const [startAsBackground, setStartAsBackground] = useState(settings?.startAsBackground ?? false);
  const [sendOnEnter, setSendOnEnter] = useState(settings?.sendOnEnter ?? true);
  const [streamResponses, setStreamResponses] = useState(settings?.streamResponses ?? true);
  const [fontSize, setFontSize] = useState(settings?.fontSize || 14);
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState(
    settings?.defaultSystemPrompt || "You are a helpful assistant."
  );

  // Use a ref to always have the latest values for the debounced save
  const latestRef = useRef({ launchAtLogin, startAsBackground, sendOnEnter, streamResponses, fontSize, defaultSystemPrompt });
  latestRef.current = { launchAtLogin, startAsBackground, sendOnEnter, streamResponses, fontSize, defaultSystemPrompt };

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistSettings = useCallback(
    (overrides: Partial<AppSettings> = {}) => {
      if (!settings) return;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(async () => {
        try {
          const vals = latestRef.current;
          await commands.saveSettings({
            ...settings,
            ...vals,
            ...overrides,
          });
          await onRefresh();
        } catch (err) {
          console.error("Failed to save settings:", err);
        }
      }, 300);
    },
    [settings, onRefresh]
  );

  const handleLaunchAtLoginToggle = async (checked: boolean) => {
    try {
      if (checked) {
        await enable();
      } else {
        await disable();
      }
      setLaunchAtLogin(checked);
      persistSettings({ launchAtLogin: checked });
    } catch (err) {
      console.error("Failed to toggle launch at login:", err);
      setLaunchAtLogin(!checked);
    }
  };

  const handleToggle = (setter: (v: boolean) => void, key: keyof AppSettings) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.checked;
    setter(val);
    persistSettings({ [key]: val });
  };

  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={launchAtLogin}
            onChange={(e) => handleLaunchAtLoginToggle(e.target.checked)}
            className="rounded accent-primary"
          />
          <div>
            <span className="text-sm text-text-primary">Launch at login</span>
            <p className="text-xs text-text-secondary">Automatically start Zitong when you log in</p>
          </div>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={startAsBackground}
            onChange={handleToggle(setStartAsBackground, "startAsBackground")}
            className="rounded accent-primary"
          />
          <div>
            <span className="text-sm text-text-primary">Start in background</span>
            <p className="text-xs text-text-secondary">Launch without showing the main window (accessible via tray icon or hotkey)</p>
          </div>
        </label>
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Default System Prompt
        </label>
        <textarea
          value={defaultSystemPrompt}
          onChange={(e) => {
            setDefaultSystemPrompt(e.target.value);
            persistSettings({ defaultSystemPrompt: e.target.value });
          }}
          rows={3}
          className="w-full px-3 py-2 text-sm glass-input rounded-lg text-text-primary resize-none"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Font Size: {fontSize}px
        </label>
        <input
          type="range"
          min={12}
          max={20}
          value={fontSize}
          onChange={(e) => {
            const val = Number(e.target.value);
            setFontSize(val);
            persistSettings({ fontSize: val });
          }}
          className="w-full accent-primary"
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sendOnEnter}
            onChange={handleToggle(setSendOnEnter, "sendOnEnter")}
            className="rounded accent-primary"
          />
          <span className="text-sm text-text-primary">Send on Enter</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={streamResponses}
            onChange={handleToggle(setStreamResponses, "streamResponses")}
            className="rounded accent-primary"
          />
          <span className="text-sm text-text-primary">Stream responses</span>
        </label>
      </div>
    </div>
  );
}
