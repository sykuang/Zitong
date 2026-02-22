import { useState } from "react";
import { useApp } from "@/context/AppContext";
import { ProvidersTab } from "./ProvidersTab";
import { GeneralTab } from "./GeneralTab";
import { AppearanceTab } from "./AppearanceTab";
import { ShortcutsTab } from "./ShortcutsTab";
import { TemplatesTab } from "./TemplatesTab";
import { CommandsTab } from "./CommandsTab";
import { AssistantsTab } from "./AssistantsTab";
import {
  X,
  Server,
  Settings,
  Palette,
  Keyboard,
  FileText,
  Zap,
  Bot,
} from "lucide-react";

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

export function SettingsPanel() {
  const { toggleSettings, settings, providers, loadProviders, loadSettings } =
    useApp();

  const [activeTab, setActiveTab] = useState<SettingsTabId>("providers");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
        <div className="glass rounded-2xl shadow-2xl w-[800px] max-w-[90vw] max-h-[80vh] flex flex-col border border-glass-border overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-glass-border">
          <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
            <Settings className="w-4 h-4 text-primary" />
            Settings
          </h2>
          <button
            onClick={toggleSettings}
            className="p-2 rounded-lg glass-button text-text-secondary hover:text-primary"
            aria-label="Close settings"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

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
            <ProvidersTab providers={providers} onRefresh={loadProviders} settings={settings} onRefreshSettings={loadSettings} />
          )}
          {activeTab === "general" && (
            <GeneralTab settings={settings} onRefresh={loadSettings} />
          )}
          {activeTab === "appearance" && (
            <AppearanceTab settings={settings} onRefresh={loadSettings} />
          )}
          {activeTab === "shortcuts" && (
            <ShortcutsTab settings={settings} onRefresh={loadSettings} />
          )}
          {activeTab === "templates" && <TemplatesTab />}
          {activeTab === "commands" && <CommandsTab providers={providers} />}
          {activeTab === "assistants" && <AssistantsTab providers={providers} />}
        </div>
      </div>
    </div>
  );
}
