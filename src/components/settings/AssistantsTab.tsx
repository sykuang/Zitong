import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { Assistant, Provider } from "@/types";
import * as commands from "@/commands";

const ASSISTANT_ICONS = ["🤖", "🧠", "✍️", "💻", "🔍", "📝", "🎨", "📊", "🗣️", "🎯", "⚡", "🌟"];

export function AssistantsTab({ providers }: { providers: Provider[] }) {
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    loadAssistants();
  }, []);

  async function loadAssistants() {
    try {
      const list = await commands.listAssistants();
      setAssistants(list);
      if (!selectedId && list.length > 0) setSelectedId(list[0].id);
    } catch (e) {
      console.error("Failed to load assistants:", e);
    }
  }

  const selected = assistants.find((a) => a.id === selectedId) || null;

  async function handleSave(updated: Assistant) {
    try {
      await commands.saveAssistant(updated);
      if (updated.isDefault) {
        setAssistants((prev) =>
          prev.map((a) =>
            a.id === updated.id ? updated : { ...a, isDefault: false }
          )
        );
      } else {
        setAssistants((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a))
        );
      }
    } catch (e) {
      console.error("Failed to save assistant:", e);
    }
  }

  async function handleAdd() {
    const now = Date.now();
    const newAssistant: Assistant = {
      id: crypto.randomUUID(),
      name: "New Assistant",
      icon: "🤖",
      description: "",
      systemPrompt: "",
      isDefault: false,
      sortOrder: assistants.length,
      createdAt: now,
      updatedAt: now,
    };
    try {
      await commands.saveAssistant(newAssistant);
      setAssistants((prev) => [...prev, newAssistant]);
      setSelectedId(newAssistant.id);
    } catch (e) {
      console.error("Failed to add assistant:", e);
    }
  }

  async function handleDelete(id: string) {
    try {
      await commands.deleteAssistant(id);
      setAssistants((prev) => prev.filter((a) => a.id !== id));
      if (selectedId === id)
        setSelectedId(assistants.find((a) => a.id !== id)?.id || null);
    } catch (e) {
      console.error("Failed to delete assistant:", e);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-glass-border">
        <p className="text-xs text-text-muted">
          Create AI personas with custom system prompts, models, and generation settings.
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
        {/* Left: assistant list */}
        <div className="w-[220px] flex-shrink-0 border-r border-glass-border overflow-y-auto">
          {assistants.map((a) => (
            <div
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className={`flex items-center gap-2 px-3 py-2.5 text-sm cursor-pointer transition-colors group border-b border-glass-border ${
                selectedId === a.id
                  ? "bg-primary/10 text-primary"
                  : "text-text-primary glass-hover"
              }`}
            >
              <span className="text-sm">{a.icon}</span>
              <span className="truncate flex-1 text-xs">{a.name}</span>
              {a.isDefault && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium flex-shrink-0">
                  DEFAULT
                </span>
              )}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(a.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-error/20 text-text-muted hover:text-error transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {assistants.length === 0 && (
            <div className="p-4 text-center text-text-muted text-xs">
              No assistants yet. Click + Add to create one.
            </div>
          )}
        </div>

        {/* Right: assistant detail */}
        <div className="flex-1 p-5 pb-8 overflow-y-auto">
          {selected ? (
            <AssistantDetail
              key={selected.id}
              assistant={selected}
              providers={providers}
              onSave={handleSave}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted text-sm">
              Select an assistant to edit, or click + Add to create one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AssistantDetail({
  assistant,
  providers,
  onSave,
}: {
  assistant: Assistant;
  providers: Provider[];
  onSave: (a: Assistant) => void;
}) {
  const [name, setName] = useState(assistant.name);
  const [icon, setIcon] = useState(assistant.icon);
  const [description, setDescription] = useState(assistant.description);
  const [systemPrompt, setSystemPrompt] = useState(assistant.systemPrompt);
  const [providerId, setProviderId] = useState(assistant.providerId || "");
  const [model, setModel] = useState(assistant.model || "");
  const [temperature, setTemperature] = useState(assistant.temperature ?? 0.7);
  const [maxTokens, setMaxTokens] = useState(assistant.maxTokens ?? 4096);
  const [isDefault, setIsDefault] = useState(assistant.isDefault);
  const [showIconPicker, setShowIconPicker] = useState(false);

  const latestRef = useRef({ name, icon, description, systemPrompt, providerId, model, temperature, maxTokens, isDefault });
  latestRef.current = { name, icon, description, systemPrompt, providerId, model, temperature, maxTokens, isDefault };
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autosave = useCallback(
    (overrides: Record<string, any> = {}) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const v = { ...latestRef.current, ...overrides };
        onSave({
          ...assistant,
          name: v.name,
          icon: v.icon,
          description: v.description,
          systemPrompt: v.systemPrompt,
          providerId: v.providerId || undefined,
          model: v.model || undefined,
          temperature: v.temperature,
          maxTokens: v.maxTokens,
          isDefault: v.isDefault,
        });
      }, 400);
    },
    [assistant, onSave]
  );

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  useEffect(() => {
    setName(assistant.name);
    setIcon(assistant.icon);
    setDescription(assistant.description);
    setSystemPrompt(assistant.systemPrompt);
    setProviderId(assistant.providerId || "");
    setModel(assistant.model || "");
    setTemperature(assistant.temperature ?? 0.7);
    setMaxTokens(assistant.maxTokens ?? 4096);
    setIsDefault(assistant.isDefault);
  }, [assistant]);

  return (
    <div className="space-y-3">
      {/* Icon + Name row */}
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
              {ASSISTANT_ICONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { setIcon(emoji); setShowIconPicker(false); autosave({ icon: emoji }); }}
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
          <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => { setName(e.target.value); autosave({ name: e.target.value }); }}
            className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Description</label>
        <input
          type="text"
          value={description}
          onChange={(e) => { setDescription(e.target.value); autosave({ description: e.target.value }); }}
          placeholder="Brief description of this assistant's purpose..."
          className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary"
        />
      </div>

      {/* System Prompt */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">System Prompt</label>
        <textarea
          value={systemPrompt}
          onChange={(e) => { setSystemPrompt(e.target.value); autosave({ systemPrompt: e.target.value }); }}
          rows={5}
          placeholder="Instructions that define this assistant's personality and behavior..."
          className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary resize-none font-mono"
        />
      </div>

      {/* AI Service + Model row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">AI Service</label>
          <select
            value={providerId}
            onChange={(e) => { setProviderId(e.target.value); setModel(""); autosave({ providerId: e.target.value, model: "" }); }}
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
            onChange={(e) => { setModel(e.target.value); autosave({ model: e.target.value }); }}
            placeholder="Default"
            className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary"
          />
        </div>
      </div>

      {/* Temperature + Max Tokens row */}
      <div className="flex gap-3">
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">
            Temperature: {temperature.toFixed(1)}
          </label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => { const v = parseFloat(e.target.value); setTemperature(v); autosave({ temperature: v }); }}
            className="w-full accent-primary"
          />
          <div className="flex justify-between text-[10px] text-text-muted mt-0.5">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>
        <div className="flex-1">
          <label className="block text-xs font-medium text-text-secondary mb-1">Max Tokens</label>
          <input
            type="number"
            value={maxTokens}
            onChange={(e) => { const v = parseInt(e.target.value) || 4096; setMaxTokens(v); autosave({ maxTokens: v }); }}
            min={256}
            max={128000}
            className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary"
          />
        </div>
      </div>

      {/* Default toggle */}
      <div className="flex items-center gap-3 pt-1">
        <label className="flex items-center gap-2 text-sm text-text-primary cursor-pointer">
          <input
            type="checkbox"
            checked={isDefault}
            onChange={(e) => { setIsDefault(e.target.checked); autosave({ isDefault: e.target.checked }); }}
            className="w-4 h-4 rounded accent-primary"
          />
          <span className="text-xs">Set as default assistant</span>
        </label>
      </div>
    </div>
  );
}
