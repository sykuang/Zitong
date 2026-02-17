import { useState } from "react";
import type { AppSettings } from "@/types";
import * as commands from "@/commands";

export function GeneralTab({
  settings,
  onRefresh,
}: {
  settings: AppSettings | null;
  onRefresh: () => Promise<void>;
}) {
  const [sendOnEnter, setSendOnEnter] = useState(settings?.sendOnEnter ?? true);
  const [streamResponses, setStreamResponses] = useState(settings?.streamResponses ?? true);
  const [fontSize, setFontSize] = useState(settings?.fontSize || 14);
  const [defaultSystemPrompt, setDefaultSystemPrompt] = useState(
    settings?.defaultSystemPrompt || "You are a helpful assistant."
  );
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!settings) return;
    try {
      await commands.saveSettings({
        ...settings,
        sendOnEnter,
        streamResponses,
        fontSize,
        defaultSystemPrompt,
      });
      await onRefresh();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save settings:", err);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-medium text-text-primary mb-1">
          Default System Prompt
        </label>
        <textarea
          value={defaultSystemPrompt}
          onChange={(e) => setDefaultSystemPrompt(e.target.value)}
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
          onChange={(e) => setFontSize(Number(e.target.value))}
          className="w-full accent-primary"
        />
      </div>

      <div className="space-y-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={sendOnEnter}
            onChange={(e) => setSendOnEnter(e.target.checked)}
            className="rounded accent-primary"
          />
          <span className="text-sm text-text-primary">Send on Enter</span>
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={streamResponses}
            onChange={(e) => setStreamResponses(e.target.checked)}
            className="rounded accent-primary"
          />
          <span className="text-sm text-text-primary">Stream responses</span>
        </label>
      </div>

      <button
        onClick={handleSave}
        className={`px-4 py-2 text-sm rounded-lg transition-colors ${
          saved
            ? "bg-success text-white"
            : "bg-primary text-white hover:bg-primary-hover"
        }`}
      >
        {saved ? "Saved!" : "Save Settings"}
      </button>
    </div>
  );
}
