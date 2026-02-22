import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { Channel } from "@tauri-apps/api/core";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { register, unregisterAll } from "@tauri-apps/plugin-global-shortcut";
import type {
  Conversation,
  Message,
  StreamEvent,
  SendMessageRequest,
  CreateConversationRequest,
  Provider,
  AppSettings,
  Assistant,
} from "@/types";
import * as commands from "@/commands";

interface AppState {
  // Conversations
  conversations: Conversation[];
  activeConversationId: string | null;
  messages: Message[];

  // Providers
  providers: Provider[];

  // Assistants
  assistants: Assistant[];
  activeAssistantId: string | null;
  setActiveAssistantId: (id: string | null) => void;
  loadAssistants: () => Promise<void>;

  // Settings
  settings: AppSettings | null;

  // UI state
  isStreaming: boolean;
  streamingContent: string;
  sidebarOpen: boolean;

  // Actions
  loadConversations: () => Promise<void>;
  createConversation: (req: CreateConversationRequest) => Promise<string>;
  selectConversation: (id: string) => Promise<void>;
  deleteConversation: (id: string) => Promise<void>;
  renameConversation: (id: string, title: string) => Promise<void>;
  archiveConversation: (id: string) => Promise<void>;
  searchConversations: (query: string) => Promise<Conversation[]>;
  sendMessage: (req: SendMessageRequest) => Promise<void>;
  stopStreaming: () => void;
  toggleSidebar: () => void;
  toggleSettings: () => void;
  loadProviders: () => Promise<void>;
  loadSettings: () => Promise<void>;
}

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
};

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<
    string | null
  >(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [providers, setProviders] = useState<Provider[]>([]);
  const [assistants, setAssistants] = useState<Assistant[]>([]);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const abortControllerRef = React.useRef<AbortController | null>(null);
  const registeredShortcutRef = useRef<string | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const convos = await commands.listConversations();
      setConversations(convos);
    } catch (err) {
      console.error("Failed to load conversations:", err);
    }
  }, []);

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

  const loadAssistants = useCallback(async () => {
    try {
      const list = await commands.listAssistants();
      setAssistants(list);
      if (!activeAssistantId) {
        const def = list.find((a) => a.isDefault);
        if (def) setActiveAssistantId(def.id);
      }
    } catch (err) {
      console.error("Failed to load assistants:", err);
    }
  }, [activeAssistantId]);

  const selectConversation = useCallback(async (id: string) => {
    setActiveConversationId(id);
    try {
      const msgs = await commands.getMessages(id);
      setMessages(msgs);
    } catch (err) {
      console.error("Failed to load messages:", err);
    }
  }, []);

  const createConversation = useCallback(
    async (req: CreateConversationRequest): Promise<string> => {
      const convo = await commands.createConversation(req);
      setConversations((prev) => [convo, ...prev]);
      setActiveConversationId(convo.id);
      setMessages([]);
      return convo.id;
    },
    []
  );

  const deleteConversation = useCallback(
    async (id: string) => {
      await commands.deleteConversation(id);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    },
    [activeConversationId]
  );

  const renameConversation = useCallback(
    async (id: string, title: string) => {
      await commands.updateConversationTitle(id, title);
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title } : c))
      );
    },
    []
  );

  const archiveConversation = useCallback(
    async (id: string) => {
      await commands.archiveConversation(id, true);
      setConversations((prev) => prev.filter((c) => c.id !== id));
      if (activeConversationId === id) {
        setActiveConversationId(null);
        setMessages([]);
      }
    },
    [activeConversationId]
  );

  const searchConversationsAction = useCallback(
    async (query: string): Promise<Conversation[]> => {
      return commands.searchConversations(query);
    },
    []
  );

  const sendMessage = useCallback(
    async (req: SendMessageRequest) => {
      setIsStreaming(true);
      setStreamingContent("");

      // Add user message optimistically
      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversationId: req.conversationId,
        role: "user",
        content: req.content,
        createdAt: Date.now(),
        sortOrder: messages.length,
      };
      setMessages((prev) => [...prev, userMessage]);

      try {
        const channel = new Channel<StreamEvent>();
        let accumulated = "";

        channel.onmessage = (event: StreamEvent) => {
          switch (event.event) {
            case "started":
              break;
            case "delta":
              accumulated += event.data.content;
              setStreamingContent(accumulated);
              break;
            case "done": {
              const assistantMessage: Message = {
                id: crypto.randomUUID(),
                conversationId: req.conversationId,
                role: "assistant",
                content: accumulated,
                model: req.model,
                tokenCount: event.data.totalTokens,
                createdAt: Date.now(),
                sortOrder: messages.length + 1,
              };
              setMessages((prev) => [...prev, assistantMessage]);
              setStreamingContent("");
              setIsStreaming(false);
              break;
            }
            case "error":
              console.error("Stream error:", event.data.message);
              setIsStreaming(false);
              setStreamingContent("");
              break;
          }
        };

        await invoke("send_message", {
          req,
          onEvent: channel,
        });
      } catch (err) {
        console.error("Failed to send message:", err);
        setIsStreaming(false);
        setStreamingContent("");
      }
    },
    [messages.length]
  );

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
    if (streamingContent) {
      const partialMessage: Message = {
        id: crypto.randomUUID(),
        conversationId: activeConversationId || "",
        role: "assistant",
        content: streamingContent + "\n\n*[Response stopped]*",
        createdAt: Date.now(),
        sortOrder: messages.length,
      };
      setMessages((prev) => [...prev, partialMessage]);
      setStreamingContent("");
    }
  }, [streamingContent, activeConversationId, messages.length]);

  const toggleSidebar = useCallback(
    () => setSidebarOpen((prev) => !prev),
    []
  );
  const toggleSettings = useCallback(
    () => invoke("open_settings").catch((err) => console.error("Failed to open settings:", err)),
    []
  );
  // Initial load
  useEffect(() => {
    loadConversations();
    loadProviders();
    loadSettings();
    loadAssistants();
  }, [loadConversations, loadProviders, loadSettings, loadAssistants]);

  // Listen for "settings-changed" event from the settings window
  useEffect(() => {
    const unlisten = listen("settings-changed", async (event: any) => {
      const kind = event.payload?.kind;
      if (kind === "providers") {
        loadProviders();
      } else if (kind === "settings") {
        loadSettings();
      } else {
        // Reload everything if kind is unknown
        loadProviders();
        loadSettings();
      }
    });
    return () => { unlisten.then((fn) => fn()); };
  }, [loadProviders, loadSettings]);

  // Listen for "open-conversation" event from overlay (answer_in_new)
  useEffect(() => {
    const unlisten = listen<{ conversationId: string }>(
      "open-conversation",
      async (event) => {
        const { conversationId } = event.payload;
        // Refresh conversation list and navigate to the new one
        await loadConversations();
        setActiveConversationId(conversationId);
        try {
          const msgs = await commands.getMessages(conversationId);
          setMessages(msgs);
        } catch (err) {
          console.error("Failed to load messages for new conversation:", err);
        }
      }
    );
    return () => {
      unlisten.then((fn) => fn());
    };
  }, [loadConversations]);

  // Register global hotkey
  useEffect(() => {
    const hotkey = settings?.globalHotkey;
    if (!hotkey) return;

    let cancelled = false;

    (async () => {
      try {
        // Always unregister everything first to avoid duplicate registration
        await unregisterAll();
        if (cancelled) return;

        await register(hotkey, (event) => {
          if (event.state === "Pressed") {
            // Call the Rust toggle_overlay command which uses NSPanel
            // to show above fullscreen apps on macOS
            invoke("toggle_overlay").catch((err) => {
              console.error("Failed to toggle overlay:", err);
            });
          }
        });
        registeredShortcutRef.current = hotkey;
        console.log("Global shortcut registered:", hotkey);
      } catch (err) {
        console.error("Failed to register global shortcut:", err);
      }
    })();

    return () => {
      cancelled = true;
      // Unregister on cleanup (React strict mode, hotkey change, unmount)
      unregisterAll().catch((err) =>
        console.error("Failed to unregister shortcuts:", err)
      );
      registeredShortcutRef.current = null;
    };
  }, [settings?.globalHotkey]);

  const value: AppState = {
    conversations,
    activeConversationId,
    messages,
    providers,
    assistants,
    activeAssistantId,
    setActiveAssistantId,
    loadAssistants,
    settings,
    isStreaming,
    streamingContent,
    sidebarOpen,
    loadConversations,
    createConversation,
    selectConversation,
    deleteConversation,
    renameConversation,
    archiveConversation,
    searchConversations: searchConversationsAction,
    sendMessage,
    stopStreaming,
    toggleSidebar,
    toggleSettings,
    loadProviders,
    loadSettings,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
