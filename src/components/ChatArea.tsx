import { useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppContext";
import { ChatMessage } from "./ChatMessage";
import { ChatInput } from "./ChatInput";
import {
  PanelLeft,
  Lightbulb,
  FileText,
  SearchCode,
  Code2,
  Bot,
  ChevronDown,
  Ban,
  Sparkles,
} from "lucide-react";

export function ChatArea() {
  const {
    messages,
    activeConversationId,
    isStreaming,
    streamingContent,
    sidebarOpen,
    toggleSidebar,
    createConversation,
    sendMessage,
    settings,
    providers,
    assistants,
    activeAssistantId,
    setActiveAssistantId,
  } = useApp();

  const [showAssistantPicker, setShowAssistantPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming content
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Close assistant picker on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setShowAssistantPicker(false);
      }
    }
    if (showAssistantPicker) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [showAssistantPicker]);

  const activeAssistant = assistants.find((a) => a.id === activeAssistantId);

  const handleQuickAction = async (prompt: string) => {
    const configuredProvider = providers.find(
      (p) => p.enabled && p.apiKey
    );
    const providerId =
      activeAssistant?.providerId ||
      settings?.defaultProviderId ||
      configuredProvider?.id ||
      "openai";
    const resolvedProvider = providers.find((p) => p.id === providerId);
    const model =
      activeAssistant?.model ||
      resolvedProvider?.defaultModel ||
      settings?.defaultModel ||
      "gpt-4o";
    const systemPrompt =
      activeAssistant?.systemPrompt || settings?.defaultSystemPrompt;

    const convoId = await createConversation({
      model,
      providerId,
      systemPrompt,
    });
    await sendMessage({
      conversationId: convoId,
      content: prompt,
      model,
      providerId,
    });
  };

  return (
    <div className="flex flex-col flex-1 h-full min-w-0 z-10">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-2 glass border-b border-glass-border">
        {!sidebarOpen && (
          <button
            onClick={toggleSidebar}
            className="p-2 rounded-lg glass-button text-text-secondary hover:text-primary"
            title="Open Sidebar"
            aria-label="Open Sidebar"
          >
            <PanelLeft className="w-4 h-4" />
          </button>
        )}
        <h2 className="text-sm font-medium text-text-primary truncate">
          {activeConversationId ? "Chat" : "Zitong AI"}
        </h2>
        {/* Assistant selector */}
        <div className="relative ml-auto" ref={pickerRef}>
          <button
            onClick={() => setShowAssistantPicker(!showAssistantPicker)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg glass-button text-text-secondary text-sm"
            aria-label="Select assistant"
          >
            <Bot className="w-4 h-4" />
            <span className="max-w-[120px] truncate">
              {activeAssistant?.name || "No Assistant"}
            </span>
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showAssistantPicker && (
            <div className="absolute right-0 top-full mt-1 w-56 glass rounded-xl shadow-lg z-20 overflow-hidden animate-fade-in">
              <div className="p-1.5">
                <button
                  onClick={() => {
                    setActiveAssistantId(null);
                    setShowAssistantPicker(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                    !activeAssistantId
                      ? "bg-primary/12 text-primary"
                      : "text-text-primary hover:bg-glass-hover"
                  }`}
                >
                  <Ban className="w-4 h-4" />
                  <span>No Assistant</span>
                </button>
                {assistants.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setActiveAssistantId(a.id);
                      setShowAssistantPicker(false);
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeAssistantId === a.id
                        ? "bg-primary/12 text-primary"
                        : "text-text-primary hover:bg-glass-hover"
                    }`}
                  >
                    <Bot className="w-4 h-4" />
                    <span className="truncate">{a.name}</span>
                    {a.isDefault && (
                      <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-medium">
                        DEFAULT
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {!activeConversationId ? (
          <div className="flex flex-col items-center justify-center h-full text-text-muted animate-fade-in">
            <div className="w-16 h-16 rounded-2xl glass flex items-center justify-center mb-5">
              <Sparkles className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-primary-light bg-clip-text text-transparent mb-2">
              Welcome to Zitong
            </h2>
            <p className="text-sm text-center max-w-md text-text-secondary">
              Your cross-platform AI chat client. Start a new conversation or
              select one from the sidebar.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 max-w-sm">
              <QuickAction
                icon={<Lightbulb className="w-4 h-4 text-primary" />}
                text="Brainstorm ideas"
                onClick={() =>
                  handleQuickAction(
                    "Help me brainstorm creative ideas for a project."
                  )
                }
              />
              <QuickAction
                icon={<FileText className="w-4 h-4 text-primary" />}
                text="Write content"
                onClick={() =>
                  handleQuickAction(
                    "Help me write engaging content. What topic would you like me to write about?"
                  )
                }
              />
              <QuickAction
                icon={<SearchCode className="w-4 h-4 text-primary" />}
                text="Analyze data"
                onClick={() =>
                  handleQuickAction(
                    "Help me analyze some data. Please share the data you'd like me to look at."
                  )
                }
              />
              <QuickAction
                icon={<Code2 className="w-4 h-4 text-primary" />}
                text="Write code"
                onClick={() =>
                  handleQuickAction(
                    "Help me write code. What programming task would you like me to assist with?"
                  )
                }
              />
            </div>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            {isStreaming && streamingContent && (
              <ChatMessage
                message={{
                  id: "streaming",
                  conversationId: activeConversationId,
                  role: "assistant",
                  content: streamingContent,
                  createdAt: Date.now(),
                  sortOrder: messages.length,
                }}
                isStreaming
              />
            )}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Input */}
      <ChatInput />
    </div>
  );
}

function QuickAction({
  icon,
  text,
  onClick,
}: {
  icon: React.ReactNode;
  text: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2.5 px-4 py-3 rounded-xl glass-hover text-sm text-text-secondary transition-all duration-200 hover:text-primary"
    >
      {icon}
      <span>{text}</span>
    </button>
  );
}
