import { useState, useEffect, useRef, useCallback } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import type { Provider, AppSettings } from "@/types";
import * as commands from "@/commands";
import { ProviderIcon } from "./ProviderIcon";
import { Check, ExternalLink, RefreshCw } from "lucide-react";

export function ProvidersTab({
  providers,
  onRefresh,
  settings,
  onRefreshSettings,
}: {
  providers: Provider[];
  onRefresh: () => Promise<void>;
  settings: AppSettings | null;
  onRefreshSettings: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const defaultProviders: Provider[] = [
    { id: "openai", type: "openai", name: "OpenAI", enabled: true },
    { id: "anthropic", type: "anthropic", name: "Anthropic", enabled: true },
    { id: "gemini", type: "gemini", name: "Google Gemini", enabled: true },
    { id: "ollama", type: "ollama", name: "Ollama (Local)", baseUrl: "http://localhost:11434", enabled: true },
    { id: "github_copilot", type: "github_copilot", name: "GitHub Copilot", enabled: true },
    { id: "mistral", type: "mistral", name: "Mistral", enabled: true },
    { id: "groq", type: "groq", name: "Groq", enabled: true },
    { id: "deepseek", type: "deepseek", name: "DeepSeek", enabled: true },
    { id: "openrouter", type: "openrouter", name: "OpenRouter", enabled: true },
    { id: "xai", type: "xai", name: "xAI (Grok)", enabled: true },
  ];

  const savedById = new Map(providers.map((p) => [p.id, p]));
  const allProviders = defaultProviders.map((dp) => {
    const saved = savedById.get(dp.id);
    return saved ? { ...dp, ...saved } : dp;
  });
  const selected = allProviders.find((p) => p.id === selectedId) || null;

  const handleSave = async (provider: Provider) => {
    try {
      await commands.saveProvider(provider);
      await onRefresh();
    } catch (err) {
      console.error("Failed to save provider:", err);
    }
  };

  const handleSetDefault = async (providerId: string) => {
    if (!settings) return;
    try {
      await commands.saveSettings({ ...settings, defaultProviderId: providerId });
      await onRefreshSettings();
    } catch (err) {
      console.error("Failed to set default:", err);
    }
  };

  return (
    <div className="flex gap-0 min-h-[380px] h-full">
      {/* Provider sidebar */}
      <div className="w-52 border-r border-glass-border overflow-y-auto">
        {allProviders.map((provider) => {
          const isDefault = settings?.defaultProviderId === provider.id;
          const isConfigured = !!provider.apiKey || provider.type === "ollama";
          return (
            <button
              key={provider.id}
              onClick={() => setSelectedId(provider.id)}
              className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all duration-200 border-l-2 ${
                selectedId === provider.id
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-transparent hover:bg-glass-hover text-text-primary"
              }`}
            >
              <ProviderIcon providerId={provider.id} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium truncate">{provider.name}</div>
                <div className="flex items-center gap-1 mt-0.5">
                  {isConfigured && (
                    <span className="w-1.5 h-1.5 rounded-full bg-success flex-shrink-0" />
                  )}
                  {isDefault && (
                    <span className="text-[10px] font-semibold text-primary uppercase tracking-wide">
                      Default
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Provider detail */}
      <div className="flex-1 p-5 pb-8 overflow-y-auto">
        {selected ? (
          <ProviderDetail
            key={selected.id}
            provider={selected}
            isDefault={settings?.defaultProviderId === selected.id}
            onSave={handleSave}
            onSetDefault={() => handleSetDefault(selected.id)}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-text-muted text-sm">
            Select a provider to configure
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderDetail({
  provider,
  isDefault,
  onSave,
  onSetDefault,
}: {
  provider: Provider;
  isDefault: boolean;
  onSave: (p: Provider) => Promise<void>;
  onSetDefault: () => void;
}) {
  const [name, setName] = useState(provider.name);
  const [apiKey, setApiKey] = useState(provider.apiKey || "");
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl || "");
  const [defaultModel, setDefaultModel] = useState(provider.defaultModel || "");
  const [enabled, setEnabled] = useState(provider.enabled);
  const [models, setModels] = useState<import("@/types").ModelInfo[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);

  // Auto-save refs
  const latestRef = useRef({ name, apiKey, baseUrl, defaultModel, enabled });
  latestRef.current = { name, apiKey, baseUrl, defaultModel, enabled };
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const autosave = useCallback(
    (overrides: Partial<{ name: string; apiKey: string; baseUrl: string; defaultModel: string; enabled: boolean }> = {}) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(async () => {
        const v = { ...latestRef.current, ...overrides };
        await onSave({ ...provider, name: v.name, apiKey: v.apiKey, baseUrl: v.baseUrl, defaultModel: v.defaultModel || undefined, enabled: v.enabled });
      }, 400);
    },
    [provider, onSave]
  );

  // Copilot device flow state
  const [copilotStatus, setCopilotStatus] = useState<
    "idle" | "waiting" | "polling" | "success" | "error"
  >(provider.type === "github_copilot" && provider.apiKey ? "success" : "idle");
  const [userCode, setUserCode] = useState("");
  const [verificationUri, setVerificationUri] = useState("");
  const [copilotError, setCopilotError] = useState("");
  const pollingRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      cancelledRef.current = true;
      if (pollingRef.current) clearTimeout(pollingRef.current);
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const loadModels = async () => {
    setModelsLoading(true);
    try {
      const list = await commands.listModels(provider.id);
      setModels(list);
    } catch {
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  };

  useEffect(() => {
    if (provider.apiKey || provider.type === "ollama") {
      loadModels();
    }
  }, [provider.id, provider.apiKey]);

  const startCopilotSignIn = async () => {
    try {
      setCopilotStatus("waiting");
      setCopilotError("");
      cancelledRef.current = false;
      const resp = await commands.copilotStartDeviceFlow();
      setUserCode(resp.user_code);
      setVerificationUri(resp.verification_uri);
      try { await writeText(resp.user_code); } catch {}
      openUrl(resp.verification_uri);
      setCopilotStatus("polling");
      const interval = (resp.interval || 5) * 1000;
      const poll = async () => {
        if (cancelledRef.current) return;
        try {
          const token = await commands.copilotPollAuth(resp.device_code);
          if (cancelledRef.current) return;
          setApiKey(token);
          setCopilotStatus("success");
          try {
            await commands.saveProvider({ ...provider, apiKey: token, enabled: true });
          } catch {}
        } catch (err) {
          if (cancelledRef.current) return;
          const errStr = typeof err === "string" ? err : String(err);
          if (errStr.includes("authorization_pending") || errStr.includes("slow_down")) {
            pollingRef.current = setTimeout(poll, interval);
            return;
          }
          setCopilotError(errStr);
          setCopilotStatus("error");
        }
      };
      pollingRef.current = setTimeout(poll, interval);
    } catch (err) {
      setCopilotError(typeof err === "string" ? err : String(err));
      setCopilotStatus("error");
    }
  };

  const isCopilot = provider.type === "github_copilot";
  const isOllama = provider.type === "ollama";
  const needsBaseUrl = isOllama || provider.type === "openai_compatible";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <ProviderIcon providerId={provider.id} size="lg" />
          <h3 className="text-base font-semibold text-text-primary">{provider.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          {isDefault ? (
            <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full glass text-primary">
              DEFAULT
            </span>
          ) : (
            <button
              onClick={onSetDefault}
              className="px-3 py-1.5 text-xs rounded-lg glass-button text-text-secondary"
            >
              Set as Default
            </button>
          )}
          {isCopilot && copilotStatus === "success" && (
            <button
              onClick={() => { setApiKey(""); setCopilotStatus("idle"); }}
              className="px-3 py-1.5 text-xs rounded-lg glass-button text-text-secondary"
            >
              Sign out
            </button>
          )}
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-xs font-medium text-text-secondary mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => { setName(e.target.value); autosave({ name: e.target.value }); }}
          className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary"
        />
        <p className="text-xs text-text-muted mt-0.5">Set a friendly name</p>
      </div>

      {/* Auth section */}
      {isCopilot ? (
        <div>
          {copilotStatus === "idle" && (
            <button
              onClick={startCopilotSignIn}
              className="px-3 py-2 text-sm rounded-lg bg-gray-800 text-white hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <SiGithubIcon />
              Sign in with GitHub
            </button>
          )}
          {copilotStatus === "polling" && (
            <div className="space-y-2">
              <div className="text-xs text-text-secondary">Enter this code on GitHub:</div>
              <div className="text-2xl font-mono font-bold text-primary tracking-widest">{userCode}</div>
              <div className="text-xs text-success">Code copied to clipboard</div>
              <div className="text-xs text-text-muted">Waiting for authorization...</div>
              <button onClick={() => openUrl(verificationUri)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                <ExternalLink className="w-3 h-3" />
                Open GitHub again
              </button>
            </div>
          )}
          {copilotStatus === "success" && (
            <div className="flex items-center gap-2 text-sm text-success">
              <Check className="w-4 h-4" />
              Connected to GitHub Copilot
            </div>
          )}
          {copilotStatus === "error" && (
            <div className="space-y-2">
              <div className="text-sm text-danger">{copilotError}</div>
              <button onClick={startCopilotSignIn} className="text-xs text-primary hover:underline">Try again</button>
            </div>
          )}
        </div>
      ) : isOllama ? (
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Base URL</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => { setBaseUrl(e.target.value); autosave({ baseUrl: e.target.value }); }}
            placeholder="http://localhost:11434"
            className="w-full px-3 py-2 text-sm glass-input rounded-lg text-text-primary"
          />
        </div>
      ) : (
        <>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => { setApiKey(e.target.value); autosave({ apiKey: e.target.value }); }}
              placeholder="sk-..."
              className="w-full px-3 py-2 text-sm glass-input rounded-lg text-text-primary"
            />
          </div>
          {needsBaseUrl && (
            <div>
              <label className="block text-xs font-medium text-text-secondary mb-1">Base URL</label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => { setBaseUrl(e.target.value); autosave({ baseUrl: e.target.value }); }}
                className="w-full px-3 py-2 text-sm glass-input rounded-lg text-text-primary"
              />
            </div>
          )}
        </>
      )}

      {/* Models */}
      {(provider.apiKey || provider.type === "ollama") && (
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-xs font-medium text-text-secondary">
              Available Models
            </label>
            <button
              onClick={loadModels}
              disabled={modelsLoading}
              className="flex items-center gap-1 text-xs text-primary hover:underline disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${modelsLoading ? "animate-spin" : ""}`} />
              {modelsLoading ? "Loading..." : "Refresh"}
            </button>
          </div>
          {models.length > 0 ? (
            <>
              <select
                value={defaultModel}
                onChange={(e) => { setDefaultModel(e.target.value); autosave({ defaultModel: e.target.value }); }}
                className="w-full px-3 py-2 text-sm rounded-lg glass-input text-text-primary"
              >
                <option value="">No default (use global default)</option>
                {models.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name || m.id}
                  </option>
                ))}
              </select>
              <p className="text-xs text-text-muted mt-0.5">
                {models.length} models available
              </p>
            </>
          ) : (
            <div className="text-xs text-text-muted">
              {modelsLoading ? "Fetching models..." : "No models found"}
            </div>
          )}
        </div>
      )}

      {/* Enabled */}
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => { setEnabled(e.target.checked); autosave({ enabled: e.target.checked }); }}
          className="rounded accent-primary"
        />
        <span className="text-sm text-text-primary">Enabled</span>
      </label>
    </div>
  );
}

// Inline GitHub SVG icon (for the sign-in button)
function SiGithubIcon() {
  return (
    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
    </svg>
  );
}
