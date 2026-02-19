import { useState, useRef, useCallback, useEffect } from "react";
import TextareaAutosize from "react-textarea-autosize";
import { useApp } from "@/context/AppContext";
import type { SendMessageRequest, ModelInfo } from "@/types";
import { listModels } from "@/commands";
import { ArrowUp, Square, ChevronDown } from "lucide-react";

export function ChatInput() {
  const {
    activeConversationId,
    isStreaming,
    stopStreaming,
    sendMessage,
    settings,
    providers,
    createConversation,
  } = useApp();

  const [input, setInput] = useState("");
  const defaultProviderId = (() => {
    if (settings?.defaultProviderId) return settings.defaultProviderId;
    const configured = providers.filter((p) => p.enabled && p.apiKey);
    if (configured.length > 0) return configured[0].id;
    const enabled = providers.filter((p) => p.enabled);
    if (enabled.length > 0) return enabled[0].id;
    return "openai";
  })();

  const defaultProvider = providers.find((p) => p.id === defaultProviderId);
  const [selectedModel, setSelectedModel] = useState(
    defaultProvider?.defaultModel || settings?.defaultModel || ""
  );
  const [selectedProviderId, setSelectedProviderId] = useState(defaultProviderId);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (providers.length === 0) return;
    const enabledProviders = providers.filter((p) => p.enabled);
    const currentExists = enabledProviders.some((p) => p.id === selectedProviderId);
    if (!currentExists) {
      const configured = enabledProviders.filter((p) => p.apiKey);
      const target = configured.length > 0 ? configured[0].id : enabledProviders[0]?.id;
      if (target) {
        setSelectedProviderId(target);
      }
    }
  }, [providers, selectedProviderId]);

  // Dynamic model fetching
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setModels([]);
    setModelError(null);
    setLoadingModels(true);

    listModels(selectedProviderId)
      .then((result) => {
        if (cancelled) return;
        console.log("[ChatInput] Models loaded for", selectedProviderId, "count:", result.length, result);
        setModels(result);
        if (result.length > 0) {
          const ids = result.map((m) => m.id);
          // Prefer provider's defaultModel, then current selection, then first available
          const provider = providers.find((p) => p.id === selectedProviderId);
          const providerDefault = provider?.defaultModel;
          if (providerDefault && ids.includes(providerDefault)) {
            setSelectedModel(providerDefault);
          } else if (!ids.includes(selectedModel)) {
            setSelectedModel(result[0].id);
          }
        }
      })
      .catch((err) => {
        if (cancelled) return;
        const errMsg = typeof err === "string" ? err : String(err);
        console.error("[ChatInput] Model fetch error for", selectedProviderId, ":", errMsg);
        setModelError(errMsg);
      })
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedProviderId]);

  const handleSend = useCallback(async () => {
    const content = input.trim();
    if (!content || isStreaming) return;

    let conversationId = activeConversationId;

    if (!conversationId) {
      conversationId = await createConversation({
        model: selectedModel,
        providerId: selectedProviderId,
        title: content.slice(0, 50),
        systemPrompt: settings?.defaultSystemPrompt,
      });
    }

    const req: SendMessageRequest = {
      conversationId,
      content,
      model: selectedModel,
      providerId: selectedProviderId,
      systemPrompt: settings?.defaultSystemPrompt,
    };

    setInput("");
    await sendMessage(req);
  }, [
    input,
    isStreaming,
    activeConversationId,
    selectedModel,
    selectedProviderId,
    settings,
    createConversation,
    sendMessage,
  ]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (
      e.key === "Enter" &&
      !e.shiftKey &&
      (settings?.sendOnEnter ?? true)
    ) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="p-4 z-10">
      <div className="max-w-3xl mx-auto">
        {/* Model selectors */}
        <div className="flex items-center gap-2 mb-2">
          <div className="relative">
            <select
              value={selectedProviderId}
              onChange={(e) => {
                setSelectedProviderId(e.target.value);
              }}
              className="text-sm glass-input rounded-lg px-3 py-2 pr-7 text-text-secondary appearance-none cursor-pointer focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {providers.length > 0 ? (
                providers
                  .filter((p) => p.enabled)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
              ) : (
                <>
                  <option value="openai">OpenAI</option>
                  <option value="anthropic">Anthropic</option>
                  <option value="gemini">Gemini</option>
                  <option value="ollama">Ollama</option>
                  <option value="github_copilot">GitHub Copilot</option>
                  <option value="mistral">Mistral</option>
                  <option value="groq">Groq</option>
                  <option value="deepseek">DeepSeek</option>
                  <option value="openrouter">OpenRouter</option>
                  <option value="xai">xAI (Grok)</option>
                </>
              )}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              disabled={loadingModels || models.length === 0}
              className="text-sm glass-input rounded-lg px-3 py-2 pr-7 text-text-secondary appearance-none cursor-pointer disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-primary/50"
            >
              {loadingModels ? (
                <option value="">Loading models...</option>
              ) : modelError ? (
                <option value="">Error: {modelError.slice(0, 60)}</option>
              ) : models.length === 0 ? (
                <option value="">No models available</option>
              ) : (
                models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}{m.contextWindow ? ` (${Math.round(m.contextWindow / 1024)}k)` : ""}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-text-muted pointer-events-none" />
          </div>
        </div>

        {/* Input area */}
        <div className="flex items-end gap-2">
          <div className="flex-1 relative">
            <TextareaAutosize
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
              className="w-full resize-none glass-input rounded-2xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted transition-all focus-visible:ring-2 focus-visible:ring-primary/50 min-h-[46px]"
              minRows={1}
              maxRows={8}
              disabled={isStreaming}
            />
          </div>

          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="flex-shrink-0 p-3 rounded-xl bg-danger text-white hover:bg-danger/90 transition-colors"
              title="Stop"
              aria-label="Stop streaming"
            >
              <Square className="w-5 h-5" fill="currentColor" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim() || loadingModels || models.length === 0}
              className="flex-shrink-0 p-3 rounded-xl bg-primary text-white hover:bg-primary-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              title="Send"
              aria-label="Send message"
            >
              <ArrowUp className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
