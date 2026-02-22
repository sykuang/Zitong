import { useState, useEffect, useRef, useCallback } from "react";
import { Plus, Trash2 } from "lucide-react";
import type { PromptTemplate } from "@/types";
import * as commands from "@/commands";

export function TemplatesTab() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState("general");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestRef = useRef({ editName: "", editContent: "", editCategory: "general" });
  latestRef.current = { editName, editContent, editCategory };

  const autosaveTemplate = useCallback(() => {
    if (!editingId) return;
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      const existing = templates.find((t) => t.id === editingId);
      if (!existing) return;
      const v = latestRef.current;
      const vars = Array.from(
        new Set(
          (v.editContent.match(/\{\{(\w+)\}\}/g) || []).map((m) =>
            m.replace(/\{\{|\}\}/g, "")
          )
        )
      );
      const updated: PromptTemplate = {
        ...existing,
        name: v.editName,
        content: v.editContent,
        category: v.editCategory,
        variables: vars,
        updatedAt: Date.now(),
      };
      await commands.savePromptTemplate(updated);
      await loadTemplates();
    }, 400);
  }, [editingId, templates]);

  const loadTemplates = async () => {
    try {
      const list = await commands.listPromptTemplates();
      setTemplates(list);
    } catch (e) {
      console.error("Failed to load templates:", e);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const handleAdd = async () => {
    const newTemplate: PromptTemplate = {
      id: crypto.randomUUID(),
      name: "New Prompt",
      content: "",
      category: "general",
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await commands.savePromptTemplate(newTemplate);
    await loadTemplates();
    setEditingId(newTemplate.id);
    setEditName(newTemplate.name);
    setEditContent(newTemplate.content);
    setEditCategory(newTemplate.category);
  };

  const handleDelete = async (id: string) => {
    await commands.deletePromptTemplate(id);
    if (editingId === id) setEditingId(null);
    await loadTemplates();
  };

  const flushPendingSave = useCallback(() => {
    if (!debounceRef.current || !editingId) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
    const existing = templates.find((t) => t.id === editingId);
    if (!existing) return;
    const v = latestRef.current;
    const vars = Array.from(
      new Set(
        (v.editContent.match(/\{\{(\w+)\}\}/g) || []).map((m) =>
          m.replace(/\{\{|\}\}/g, "")
        )
      )
    );
    const updated: PromptTemplate = {
      ...existing,
      name: v.editName,
      content: v.editContent,
      category: v.editCategory,
      variables: vars,
      updatedAt: Date.now(),
    };
    commands.savePromptTemplate(updated).then(() => loadTemplates());
  }, [editingId, templates]);

  useEffect(() => {
    return () => {
      flushPendingSave();
    };
  }, [flushPendingSave]);

  const handleSelect = (t: PromptTemplate) => {
    // Flush pending save before switching
    flushPendingSave();
    setEditingId(t.id);
    setEditName(t.name);
    setEditContent(t.content);
    setEditCategory(t.category);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-glass-border">
        <div>
          <h3 className="text-sm font-medium text-text-primary">Prompt Templates</h3>
          <p className="text-xs text-text-muted mt-0.5">
            Create reusable system prompts. Use {"{{variable}}"} for placeholders.
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-primary text-white hover:bg-primary-hover transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Template list */}
        <div className="w-[220px] flex-shrink-0 border-r border-glass-border overflow-y-auto">
          {templates.length === 0 ? (
            <div className="p-4 text-center text-text-muted text-xs">
              No templates yet. Click + Add to create one.
            </div>
          ) : (
            templates.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className={`w-full text-left px-3 py-2.5 text-sm border-b border-glass-border transition-colors flex items-center justify-between group ${
                  editingId === t.id
                    ? "bg-primary/10 text-primary"
                    : "text-text-primary glass-hover"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate">{t.name}</div>
                  <div className="text-xs text-text-muted truncate">
                    {t.content
                      ? t.content.substring(0, 50) + (t.content.length > 50 ? "..." : "")
                      : "Empty"}
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(t.id);
                  }}
                  className="ml-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-error/20 text-text-muted hover:text-error transition-all"
                  title="Delete"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </button>
            ))
          )}
        </div>

        {/* Editor */}
        <div className="flex-1 p-5 pb-8 overflow-y-auto">
          {editingId ? (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => { setEditName(e.target.value); autosaveTemplate(); }}
                  className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Category</label>
                <select
                  value={editCategory}
                  onChange={(e) => { setEditCategory(e.target.value); autosaveTemplate(); }}
                  className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary"
                >
                  <option value="general">General</option>
                  <option value="coding">Coding</option>
                  <option value="writing">Writing</option>
                  <option value="analysis">Analysis</option>
                  <option value="creative">Creative</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Prompt Content</label>
                <textarea
                  value={editContent}
                  onChange={(e) => { setEditContent(e.target.value); autosaveTemplate(); }}
                  rows={8}
                  placeholder="Enter your system prompt here. Use {{variable}} for placeholders..."
                  className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary resize-none font-mono"
                />
              </div>
              {/* Variables preview */}
              {editContent.match(/\{\{(\w+)\}\}/g) && (
                <div>
                  <label className="block text-xs font-medium text-text-secondary mb-1">
                    Detected Variables
                  </label>
                  <div className="flex flex-wrap gap-1">
                    {Array.from(
                      new Set(
                        (editContent.match(/\{\{(\w+)\}\}/g) || []).map((v) =>
                          v.replace(/\{\{|\}\}/g, "")
                        )
                      )
                    ).map((v) => (
                      <span
                        key={v}
                        className="px-2 py-0.5 text-xs rounded-full bg-primary/15 text-primary font-mono"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-text-muted text-sm">
              Select a template to edit, or click + Add to create one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
