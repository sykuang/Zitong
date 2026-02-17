import { useState, useRef } from "react";
import { useApp } from "@/context/AppContext";
import {
  Plus,
  Search,
  PanelLeftClose,
  Pencil,
  Archive,
  Trash2,
  Settings,
  Sparkles,
  X,
} from "lucide-react";

export function Sidebar() {
  const {
    conversations,
    activeConversationId,
    selectConversation,
    createConversation,
    deleteConversation,
    renameConversation,
    archiveConversation,
    searchConversations,
    sidebarOpen,
    toggleSidebar,
    toggleSettings,
    settings,
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<typeof conversations | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  if (!sidebarOpen) return null;

  const handleNewChat = async () => {
    await createConversation({
      model: settings?.defaultModel || "gpt-4o",
      providerId: settings?.defaultProviderId || "openai",
      systemPrompt: settings?.defaultSystemPrompt,
    });
  };

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    searchTimeoutRef.current = setTimeout(async () => {
      try {
        const results = await searchConversations(query);
        setSearchResults(results);
      } catch {
        setSearchResults([]);
      }
    }, 300);
  };

  const startRename = (id: string, currentTitle: string) => {
    setRenamingId(id);
    setRenameValue(currentTitle || "");
    setTimeout(() => renameInputRef.current?.select(), 50);
  };

  const confirmRename = async () => {
    if (renamingId && renameValue.trim()) {
      await renameConversation(renamingId, renameValue.trim());
    }
    setRenamingId(null);
  };

  const displayList = searchResults ?? conversations;

  return (
    <aside className="flex flex-col w-72 h-full glass z-10">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h1 className="text-sm font-semibold text-text-primary">Zitong</h1>
        </div>
        <div className="flex gap-1">
          <button
            onClick={handleNewChat}
            className="p-2 rounded-lg glass-button text-text-secondary hover:text-primary"
            title="New Chat"
            aria-label="New Chat"
          >
            <Plus className="w-4 h-4" />
          </button>
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg glass-button text-text-secondary hover:text-primary"
            title="Close Sidebar"
            aria-label="Close Sidebar"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search conversations..."
            className="w-full pl-9 pr-9 py-2 text-sm rounded-lg glass-input text-text-primary placeholder:text-text-muted"
          />
          {searchQuery && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-muted hover:text-text-secondary transition-colors"
              aria-label="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto py-1">
        {displayList.length === 0 ? (
          <div className="px-3 py-8 text-center text-text-muted text-xs">
            {searchQuery ? "No conversations found." : "No conversations yet.\nStart a new chat!"}
          </div>
        ) : (
          displayList.map((convo) => (
            <div
              key={convo.id}
              onClick={() => {
                if (renamingId !== convo.id) selectConversation(convo.id);
              }}
              onDoubleClick={() => startRename(convo.id, convo.title)}
              className={`group flex items-center justify-between px-3 py-2 mx-2 rounded-lg cursor-pointer transition-all duration-200 ${
                convo.id === activeConversationId
                  ? "bg-primary/12 text-primary border border-primary/20"
                  : "hover:bg-glass-hover text-text-primary border border-transparent"
              }`}
            >
              {renamingId === convo.id ? (
                <input
                  ref={renameInputRef}
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={confirmRename}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmRename();
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  autoFocus
                  className="flex-1 text-sm glass-input px-2 py-0.5 rounded-md text-text-primary"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <span className="text-sm truncate flex-1">
                  {convo.title || "New Chat"}
                </span>
              )}
              {renamingId !== convo.id && (
                <div className="hidden group-hover:flex items-center gap-0.5 ml-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      startRename(convo.id, convo.title);
                    }}
                    className="p-1.5 rounded-md hover:bg-glass-hover text-text-muted hover:text-text-primary transition-colors"
                    title="Rename"
                    aria-label="Rename conversation"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      archiveConversation(convo.id);
                    }}
                    className="p-1.5 rounded-md hover:bg-warning/10 text-text-muted hover:text-warning transition-colors"
                    title="Archive"
                    aria-label="Archive conversation"
                  >
                    <Archive className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(convo.id);
                    }}
                    className="p-1.5 rounded-md hover:bg-danger/10 text-text-muted hover:text-danger transition-colors"
                    title="Delete"
                    aria-label="Delete conversation"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-glass-border p-3">
        <button
          onClick={toggleSettings}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg glass-button text-text-secondary text-sm hover:text-primary"
          aria-label="Open Settings"
        >
          <Settings className="w-4 h-4" />
          Settings
        </button>
      </div>
    </aside>
  );
}
