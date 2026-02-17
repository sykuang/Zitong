import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { AiCommand, Provider } from "@/types";
import * as commands from "@/commands";

const BEHAVIOR_OPTIONS = [
  { value: "replace_selection", label: "Replace Selection" },
  { value: "insert_after", label: "Insert After" },
  { value: "answer_in_new", label: "Answer in New Chat" },
] as const;

const ICON_OPTIONS = ["✨", "📝", "🔧", "📖", "📋", "🎯", "💡", "🔍", "✏️", "📊", "🗣️", "⚡"];

const LANGUAGE_OPTIONS = [
  "Auto", "English", "Spanish", "French", "German", "Chinese",
  "Japanese", "Korean", "Portuguese", "Russian", "Arabic",
];

export function CommandsTab({ providers }: { providers: Provider[] }) {
  const [cmds, setCmds] = useState<AiCommand[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCommands();
  }, []);

  async function loadCommands() {
    try {
      const list = await commands.listAiCommands();
      setCmds(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } catch (e) {
      console.error("Failed to load AI commands:", e);
    }
  }

  const selected = cmds.find((c) => c.id === selectedId) || null;

  async function handleToggle(id: string, enabled: boolean) {
    const cmd = cmds.find((c) => c.id === id);
    if (!cmd) return;
    const updated = { ...cmd, enabled };
    try {
      await commands.saveAiCommand(updated);
      setCmds((prev) => prev.map((c) => (c.id === id ? updated : c)));
    } catch (e) {
      console.error("Failed to toggle command:", e);
    }
  }

  async function handleSave(updated: AiCommand) {
    setSaving(true);
    try {
      await commands.saveAiCommand(updated);
      setCmds((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setTimeout(() => setSaving(false), 1200);
    } catch (e) {
      console.error("Failed to save command:", e);
      setSaving(false);
    }
  }

  async function handleAdd() {
    const newCmd: AiCommand = {
      id: crypto.randomUUID(),
      label: "New Command",
      icon: "✨",
      behavior: "answer_in_new",
      systemPrompt: "",
      outputLanguage: "Auto",
      enabled: true,
      sortOrder: cmds.length,
    };
    try {
      await commands.saveAiCommand(newCmd);
      setCmds((prev) => [...prev, newCmd]);
      setSelectedId(newCmd.id);
    } catch (e) {
      console.error("Failed to add command:", e);
    }
  }

  async function handleDelete(id: string) {
    try {
      await commands.deleteAiCommand(id);
      setCmds((prev) => prev.filter((c) => c.id !== id));
      if (selectedId === id) setSelectedId(cmds.find((c) => c.id !== id)?.id || null);
    } catch (e) {
      console.error("Failed to delete command:", e);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-glass-border">
        <p className="text-xs text-text-muted">
          Configure AI commands for selected text or the command palette.
        </p>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left: command list */}
        <div className="w-[220px] flex-shrink-0 border-r border-glass-border overflow-y-auto">
          {cmds.map((cmd) => (
            <div
              key={cmd.id}
              onClick={() => setSelectedId(cmd.id)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors group border-b border-glass-border ${
                selectedId === cmd.id
                  ? "bg-primary/10 text-primary"
                  : "text-text-primary glass-hover"
              }`}
            >
              <input
                type="checkbox"
                checked={cmd.enabled}
                onChange={(e) => {
                  e.stopPropagation();
                  handleToggle(cmd.id, e.target.checked);
                }}
                className="w-4 h-4 rounded accent-primary flex-shrink-0"
              />
              <span className="text-sm">{cmd.icon}</span>
              <span className="truncate flex-1 text-xs">{cmd.label}</span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(cmd.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-error/20 text-text-muted hover:text-error transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {cmds.length === 0 && (
            <div className="p-4 text-center text-text-muted text-xs">
              No commands yet. Click + Add to create one.
            </div>
          )}
        </div>

        {/* Right: command detail */}
        <div className="flex-1 p-5 pb-8 overflow-y-auto">
          {selected ? (
            <CommandDetail
              key={selected.id}
              command={selected}
              providers={providers}
              onSave={handleSave}
              saving={saving}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted text-sm">
              Select a command to edit, or click + Add to create one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CommandDetail({
  command,
  providers,
  onSave,
  saving,
}: {
  command: AiCommand;
  providers: Provider[];
  onSave: (cmd: AiCommand) => void;
  saving: boolean;
}) {
  const [label, setLabel] = useState(command.label);
  const [icon, setIcon] = useState(command.icon);
  const [behavior, setBehavior] = useState(command.behavior);
  const [systemPrompt, setSystemPrompt] = useState(command.systemPrompt);
  const [providerId, setProviderId] = useState(command.providerId || "");
  const [model, setModel] = useState(command.model || "");
  const [outputLanguage, setOutputLanguage] = useState(command.outputLanguage);
  const [keyboardShortcut, setKeyboardShortcut] = useState(command.keyboardShortcut || "");
  const [showIconPicker, setShowIconPicker] = useState(false);

  useEffect(() => {
    setLabel(command.label);
    setIcon(command.icon);
    setBehavior(command.behavior);
    setSystemPrompt(command.systemPrompt);
    setProviderId(command.providerId || "");
    setModel(command.model || "");
    setOutputLanguage(command.outputLanguage);
    setKeyboardShortcut(command.keyboardShortcut || "");
  }, [command]);

  function handleSubmit() {
    onSave({
      ...command,
      label,
      icon,
      behavior,
      systemPrompt,
      providerId: providerId || undefined,
      model: model || undefined,
      outputLanguage,
      keyboardShortcut: keyboardShortcut || undefined,
    });
  }

  return (
    <div className="space-y-3">
      {/* Label + Icon row */}
      <div className="flex gap-3">
        <div className="relative">
          <label className="block text-xs font-medium text-text-secondary mb-1">Icon</label>
          <button
            onClick={() => setShowIconPicker(!showIconPicker)}
            className="w-10 h-[38px] flex items-center justify-center rounded-lg glass-input text-lg"
          >
            {icon}
          </button>
          {showIconPicker && (
            <div className="absolute top-full left-0 mt-1 p-2 glass rounded-xl shadow-lg z-10 grid grid-cols-6 gap-1">
              {ICON_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { setIcon(emoji); setShowIconPicker(false); }}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg text-base transition-colors ${
                    icon === emoji ? "bg-primary/15 ring-1 ring-primary" : "glass-hover"
                  }`}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">Label</label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary"
          />
        </div>
      </div>

      {/* Behavior */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Behavior</label>
        <select
          value={behavior}
          onChange={(e) => setBehavior(e.target.value as AiCommand["behavior"])}
          className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary"
        >
          {BEHAVIOR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* System Prompt */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">System Prompt</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={5}
          placeholder="Instructions for the AI when this command is triggered..."
          className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary resize-none font-mono"
        />
      </div>

      {/* AI Service + Model row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">AI Service</label>
          <select
            value={providerId}
            onChange={(e) => { setProviderId(e.target.value); setModel(""); }}
            className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary"
          >
            <option value="">Default</option>
            {providers
              .filter((p) => p.enabled)
              .map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">Model</label>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="Default"
            className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary"
          />
        </div>
      </div>

      {/* Output Language + Shortcut row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">Output Language</label>
          <select
            value={outputLanguage}
            onChange={(e) => setOutputLanguage(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary"
          >
            {LANGUAGE_OPTIONS.map((lang) => (
              <option key={lang} value={lang}>{lang}</option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">Keyboard Shortcut</label>
          <input
            type="text"
            value={keyboardShortcut}
            onChange={(e) => setKeyboardShortcut(e.target.value)}
            placeholder="e.g. Cmd+Shift+I"
            className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary"
          />
        </div>
      </div>

      {/* Save button */}
      <div className="flex items-center gap-2 pt-1">
        <button
          onClick={handleSubmit}
          className="px-4 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
        >
          Save Command
        </button>
        {saving && (
          <span className="text-xs text-success font-medium">Saved!</span>
        )}
      </div>
    </div>
  );
}
