import { useState, useEffect, useCallback } from "react";
import { emit } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { ProvidersTab } from "@/components/settings/ProvidersTab";
import { GeneralTab } from "@/components/settings/GeneralTab";
import { AppearanceTab } from "@/components/settings/AppearanceTab";
import { ShortcutsTab } from "@/components/settings/ShortcutsTab";
import { TemplatesTab } from "@/components/settings/TemplatesTab";
import { CommandsTab } from "@/components/settings/CommandsTab";
import { AssistantsTab } from "@/components/settings/AssistantsTab";
import {
  Server,
  Settings,
  Palette,
  Keyboard,
  FileText,
  Zap,
  Bot,
} from "lucide-react";
import * as commands from "@/commands";
import type { Provider, AppSettings } from "@/types";

type SettingsTabId =
  | "providers"
  | "general"
  | "appearance"
  | "shortcuts"
  | "templates"
  | "commands"
  | "assistants";

const TABS: { id: SettingsTabId; label: string; icon: React.ReactNode }[] = [
  { id: "providers", label: "Providers", icon: <Server className="w-4 h-4" /> },
  { id: "general", label: "General", icon: <Settings className="w-4 h-4" /> },
  { id: "appearance", label: "Appearance", icon: <Palette className="w-4 h-4" /> },
  { id: "shortcuts", label: "Shortcuts", icon: <Keyboard className="w-4 h-4" /> },
  { id: "templates", label: "Templates", icon: <FileText className="w-4 h-4" /> },
  { id: "commands", label: "Commands", icon: <Zap className="w-4 h-4" /> },
  { id: "assistants", label: "Assistants", icon: <Bot className="w-4 h-4" /> },
];

const defaultSettings: AppSettings = {
  theme: "system",
  defaultModel: "",
  defaultProviderId: "",
  defaultSystemPrompt: "You are a helpful assistant.",
  globalHotkey: "CommandOrControl+Shift+Space",
  sendOnEnter: true,
  streamResponses: true,
  fontSize: 14,
  accentColor: "blue",
  fontFamily: "system",
  chatBubbleStyle: "minimal",
  codeTheme: "oneDark",
  compactMode: false,
  launchAtLogin: false,
  startAsBackground: false,
};

export function SettingsApp() {
  const [activeTab, setActiveTab] = useState<SettingsTabId>("providers");
  const [providers, setProviders] = useState<Provider[]>([]);
  const [settings, setSettings] = useState<AppSettings | null>(null);

  const loadProviders = useCallback(async () => {
    try {
      const provs = await commands.listProviders();
      setProviders(provs);
    } catch (err) {
      console.error("Failed to load providers:", err);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    try {
      const s = await commands.getSettings();
      setSettings(s);
    } catch (err) {
      console.error("Failed to load settings, using defaults:", err);
      setSettings(defaultSettings);
    }
  }, []);

  // Wrap loadProviders/loadSettings to also emit a settings-changed event
  const onRefreshProviders = useCallback(async () => {
    await loadProviders();
    emit("settings-changed", { kind: "providers" });
  }, [loadProviders]);

  const onRefreshSettings = useCallback(async () => {
    await loadSettings();
    emit("settings-changed", { kind: "settings" });
  }, [loadSettings]);

  // Initial data load
  useEffect(() => {
    loadProviders();
    loadSettings();
  }, [loadProviders, loadSettings]);

  // Apply theme to the settings window itself
  useEffect(() => {
    const root = document.documentElement;
    if (settings?.theme === "dark") {
      root.classList.add("dark");
    } else if (settings?.theme === "light") {
      root.classList.remove("dark");
    } else {
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const update = () => {
        if (mq.matches) root.classList.add("dark");
        else root.classList.remove("dark");
      };
      update();
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
  }, [settings?.theme]);

  // Close window on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        getCurrentWindow().close();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex h-screen w-screen flex-col bg-bg text-text-primary">
      {/* macOS drag region */}
      <div
        data-tauri-drag-region
        className="h-8 shrink-0 w-full"
      />

      {/* Tabs */}
      <div className="flex overflow-x-auto scrollbar-hide border-b border-glass-border px-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex shrink-0 items-center gap-1.5 px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors relative ${
              activeTab === tab.id
                ? "text-primary"
                : "text-text-secondary hover:text-text-primary"
            }`}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className={`flex-1 overflow-y-auto ${activeTab === "providers" || activeTab === "commands" || activeTab === "assistants" || activeTab === "templates" ? "" : "p-5"}`}>
        {activeTab === "providers" && (
          <ProvidersTab providers={providers} onRefresh={onRefreshProviders} settings={settings} onRefreshSettings={onRefreshSettings} />
        )}
        {activeTab === "general" && (
          <GeneralTab settings={settings} onRefresh={onRefreshSettings} />
        )}
        {activeTab === "appearance" && (
          <AppearanceTab settings={settings} onRefresh={onRefreshSettings} />
        )}
        {activeTab === "shortcuts" && (
          <ShortcutsTab settings={settings} onRefresh={onRefreshSettings} />
        )}
        {activeTab === "templates" && <TemplatesTab />}
        {activeTab === "commands" && <CommandsTab providers={providers} />}
        {activeTab === "assistants" && <AssistantsTab providers={providers} />}
      </div>
    </div>
  );
}
