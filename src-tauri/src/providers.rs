use futures::StreamExt;
use reqwest_eventsource::{Event, EventSource};
use serde::{Deserialize, Serialize};

// ============================================
// Provider Message Types
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChatMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "event", content = "data")]
pub enum StreamEvent {
    #[serde(rename = "started")]
    Started { message_id: String },
    #[serde(rename = "delta")]
    Delta { content: String },
    #[serde(rename = "done")]
    Done { total_tokens: i64 },
    #[serde(rename = "error")]
    Error { message: String },
}

// ============================================
// Model Info (returned to frontend)
// ============================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub name: String,
    pub context_window: Option<i64>,
}

// ============================================
// Provider Configuration
// ============================================

#[derive(Debug, Clone)]
pub struct ProviderConfig {
    pub provider_type: String,
    pub api_key: Option<String>,
    pub base_url: Option<String>,
    pub model: String,
}

impl ProviderConfig {
    pub fn get_endpoint(&self) -> String {
        match self.provider_type.as_str() {
            "openai" => {
                let base = self.base_url.as_deref().unwrap_or("https://api.openai.com/v1");
                format!("{}/chat/completions", base)
            }
            "anthropic" => {
                let base = self.base_url.as_deref().unwrap_or("https://api.anthropic.com");
                format!("{}/v1/messages", base)
            }
            "gemini" => {
                let base = self.base_url.as_deref().unwrap_or("https://generativelanguage.googleapis.com");
                format!(
                    "{}/v1beta/models/{}:streamGenerateContent?alt=sse",
                    base, self.model
                )
            }
            "ollama" => {
                let base = self.base_url.as_deref().unwrap_or("http://localhost:11434");
                format!("{}/api/chat", base)
            }
            "github_copilot" => {
                let base = self.base_url.as_deref().unwrap_or("https://api.individual.githubcopilot.com");
                format!("{}/chat/completions", base)
            }
            "mistral" => {
                let base = self.base_url.as_deref().unwrap_or("https://api.mistral.ai/v1");
                format!("{}/chat/completions", base)
            }
            "groq" => {
                let base = self.base_url.as_deref().unwrap_or("https://api.groq.com/openai/v1");
                format!("{}/chat/completions", base)
            }
            "deepseek" => {
                let base = self.base_url.as_deref().unwrap_or("https://api.deepseek.com");
                format!("{}/chat/completions", base)
            }
            "openrouter" => {
                let base = self.base_url.as_deref().unwrap_or("https://openrouter.ai/api/v1");
                format!("{}/chat/completions", base)
            }
            "xai" => {
                let base = self.base_url.as_deref().unwrap_or("https://api.x.ai/v1");
                format!("{}/chat/completions", base)
            }
            _ => {
                // OpenAI-compatible
                let base = self.base_url.as_deref().unwrap_or("https://api.openai.com/v1");
                format!("{}/chat/completions", base)
            }
        }
    }

    /// Get the model listing endpoint for this provider
    fn get_models_endpoint(&self) -> String {
        match self.provider_type.as_str() {
            "openai" => {
                let base = self.base_url.as_deref().unwrap_or("https://api.openai.com/v1");
                format!("{}/models", base)
            }
            "anthropic" => {
                let base = self.base_url.as_deref().unwrap_or("https://api.anthropic.com");
                format!("{}/v1/models", base)
            }
            "gemini" => {
                let base = self.base_url.as_deref().unwrap_or("https://generativelanguage.googleapis.com");
                format!("{}/v1beta/models", base)
            }
            "ollama" => {
                let base = self.base_url.as_deref().unwrap_or("http://localhost:11434");
                format!("{}/api/tags", base)
            }
            "github_copilot" => {
                let base = self.base_url.as_deref().unwrap_or("https://api.individual.githubcopilot.com");
                format!("{}/models", base)
            }
            "mistral" => {
                let base = self.base_url.as_deref().unwrap_or("https://api.mistral.ai/v1");
                format!("{}/models", base)
            }
            "groq" => {
                let base = self.base_url.as_deref().unwrap_or("https://api.groq.com/openai/v1");
                format!("{}/models", base)
            }
            "deepseek" => {
                let base = self.base_url.as_deref().unwrap_or("https://api.deepseek.com");
                format!("{}/models", base)
            }
            "openrouter" => {
                "https://openrouter.ai/api/v1/models".to_string()
            }
            "xai" => {
                let base = self.base_url.as_deref().unwrap_or("https://api.x.ai/v1");
                format!("{}/models", base)
            }
            _ => {
                let base = self.base_url.as_deref().unwrap_or("https://api.openai.com/v1");
                format!("{}/models", base)
            }
        }
    }
}

// ============================================
// Model Listing — Response types
// ============================================

// OpenAI-compatible format (OpenAI, Mistral, Groq, DeepSeek, xAI, GitHub Copilot)
#[derive(Deserialize)]
struct OpenAIModelsResponse {
    data: Vec<OpenAIModelEntry>,
}

#[derive(Deserialize)]
struct OpenAIModelEntry {
    id: String,
    #[serde(default)]
    #[allow(dead_code)]
    owned_by: Option<String>,
}

// Anthropic format
#[derive(Deserialize)]
struct AnthropicModelsResponse {
    data: Vec<AnthropicModelEntry>,
    has_more: Option<bool>,
    last_id: Option<String>,
}

#[derive(Deserialize)]
struct AnthropicModelEntry {
    id: String,
    display_name: Option<String>,
}

// Gemini format
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeminiModelsResponse {
    models: Option<Vec<GeminiModelEntry>>,
    next_page_token: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct GeminiModelEntry {
    name: Option<String>,
    display_name: Option<String>,
    supported_generation_methods: Option<Vec<String>>,
    input_token_limit: Option<i64>,
}

// Ollama format
#[derive(Deserialize)]
struct OllamaModelsResponse {
    models: Option<Vec<OllamaModelEntry>>,
}

#[derive(Deserialize)]
struct OllamaModelEntry {
    name: Option<String>,
    model: Option<String>,
}

// OpenRouter format
#[derive(Deserialize)]
struct OpenRouterModelsResponse {
    data: Vec<OpenRouterModelEntry>,
}

#[derive(Deserialize)]
struct OpenRouterModelEntry {
    id: String,
    name: Option<String>,
    context_length: Option<i64>,
    #[serde(default)]
    architecture: Option<OpenRouterArchitecture>,
}

#[derive(Deserialize)]
struct OpenRouterArchitecture {
    output_modalities: Option<Vec<String>>,
}

// ============================================
// Model Listing — Fetch Logic
// ============================================

/// Fetch the list of available models from a provider's API.
/// No fallbacks — if the API call fails, the error is returned directly.
pub async fn list_provider_models(config: &ProviderConfig) -> Result<Vec<ModelInfo>, String> {
    match config.provider_type.as_str() {
        "anthropic" => fetch_anthropic_models(config).await,
        "gemini" => fetch_gemini_models(config).await,
        "ollama" => fetch_ollama_models(config).await,
        "github_copilot" => fetch_copilot_models(config).await,
        "openrouter" => fetch_openrouter_models(config).await,
        // OpenAI-compatible: openai, mistral, groq, deepseek, xai, github_copilot, and fallback
        provider_type => {
            let filter: Box<dyn Fn(&str) -> bool + Send + Sync> = match provider_type {
                "openai" => Box::new(|id: &str| {
                    let id_lower = id.to_lowercase();
                    !id_lower.contains("embed")
                        && !id_lower.contains("tts")
                        && !id_lower.contains("dall-e")
                        && !id_lower.contains("whisper")
                        && !id_lower.contains("moderation")
                        && !id_lower.contains("babbage")
                        && !id_lower.contains("davinci")
                        && !id_lower.starts_with("ft:")
                }),
                "mistral" => Box::new(|id: &str| {
                    !id.to_lowercase().contains("embed")
                }),
                "groq" => Box::new(|id: &str| {
                    let id_lower = id.to_lowercase();
                    !id_lower.contains("whisper")
                        && !id_lower.contains("guard")
                        && !id_lower.contains("playai-tts")
                        && !id_lower.contains("distil-whisper")
                }),
                "xai" => Box::new(|id: &str| {
                    !id.to_lowercase().contains("imagine")
                }),
                _ => Box::new(|_: &str| true),
            };
            fetch_openai_compatible_models(config, &*filter).await
        }
    }
}

/// Fetch models using the OpenAI-compatible /models endpoint
async fn fetch_openai_compatible_models(
    config: &ProviderConfig,
    filter: &(dyn Fn(&str) -> bool + Send + Sync),
) -> Result<Vec<ModelInfo>, String> {
    let client = reqwest::Client::new();
    let endpoint = config.get_models_endpoint();

    let api_key = config
        .api_key
        .as_deref()
        .ok_or_else(|| "API key not configured".to_string())?;

    let response = client
        .get(&endpoint)
        .header("Authorization", format!("Bearer {}", api_key))
        .send()
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("API error {}: {}", status, body));
    }

    let resp: OpenAIModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse model list: {}", e))?;

    let mut models: Vec<ModelInfo> = resp
        .data
        .into_iter()
        .filter(|m| filter(&m.id))
        .map(|m| ModelInfo {
            name: m.id.clone(),
            id: m.id,
            context_window: None,
        })
        .collect();

    models.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(models)
}

/// Fetch Anthropic models with pagination
async fn fetch_anthropic_models(config: &ProviderConfig) -> Result<Vec<ModelInfo>, String> {
    let client = reqwest::Client::new();
    let base = config.base_url.as_deref().unwrap_or("https://api.anthropic.com");

    let api_key = config
        .api_key
        .as_deref()
        .ok_or_else(|| "API key not configured".to_string())?;

    let mut all_models: Vec<ModelInfo> = Vec::new();
    let mut after_id: Option<String> = None;

    loop {
        let mut url = format!("{}/v1/models?limit=100", base);
        if let Some(ref cursor) = after_id {
            url.push_str(&format!("&after_id={}", cursor));
        }

        let response = client
            .get(&url)
            .header("x-api-key", api_key)
            .header("anthropic-version", "2023-06-01")
            .send()
            .await
            .map_err(|e| format!("Failed to connect: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API error {}: {}", status, body));
        }

        let resp: AnthropicModelsResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse model list: {}", e))?;

        for m in resp.data {
            all_models.push(ModelInfo {
                name: m.display_name.unwrap_or_else(|| m.id.clone()),
                id: m.id,
                context_window: None,
            });
        }

        if resp.has_more == Some(true) {
            after_id = resp.last_id;
        } else {
            break;
        }
    }

    all_models.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(all_models)
}

/// Fetch Gemini models with pagination, filtering to chat-capable models
async fn fetch_gemini_models(config: &ProviderConfig) -> Result<Vec<ModelInfo>, String> {
    let client = reqwest::Client::new();
    let base = config.base_url.as_deref().unwrap_or("https://generativelanguage.googleapis.com");

    let api_key = config
        .api_key
        .as_deref()
        .ok_or_else(|| "API key not configured".to_string())?;

    let mut all_models: Vec<ModelInfo> = Vec::new();
    let mut page_token: Option<String> = None;

    loop {
        let mut url = format!("{}/v1beta/models?key={}&pageSize=100", base, api_key);
        if let Some(ref token) = page_token {
            url.push_str(&format!("&pageToken={}", token));
        }

        let response = client
            .get(&url)
            .send()
            .await
            .map_err(|e| format!("Failed to connect: {}", e))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(format!("API error {}: {}", status, body));
        }

        let resp: GeminiModelsResponse = response
            .json()
            .await
            .map_err(|e| format!("Failed to parse model list: {}", e))?;

        if let Some(models) = resp.models {
            for m in models {
                // Only include models that support generateContent (chat)
                let supports_chat = m
                    .supported_generation_methods
                    .as_ref()
                    .map(|methods| methods.iter().any(|method| method == "generateContent"))
                    .unwrap_or(false);

                if !supports_chat {
                    continue;
                }

                // Strip "models/" prefix from name
                let id = m.name.as_deref().unwrap_or_default();
                let id = id.strip_prefix("models/").unwrap_or(id).to_string();

                if id.is_empty() {
                    continue;
                }

                all_models.push(ModelInfo {
                    name: m.display_name.unwrap_or_else(|| id.clone()),
                    id,
                    context_window: m.input_token_limit,
                });
            }
        }

        page_token = resp.next_page_token;
        if page_token.is_none() {
            break;
        }
    }

    all_models.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(all_models)
}

/// Fetch locally available Ollama models
async fn fetch_ollama_models(config: &ProviderConfig) -> Result<Vec<ModelInfo>, String> {
    let client = reqwest::Client::new();
    let endpoint = config.get_models_endpoint();

    let response = client
        .get(&endpoint)
        .send()
        .await
        .map_err(|e| format!("Failed to connect to Ollama: {}. Is Ollama running?", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Ollama error {}: {}", status, body));
    }

    let resp: OllamaModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse model list: {}", e))?;

    let mut models: Vec<ModelInfo> = resp
        .models
        .unwrap_or_default()
        .into_iter()
        .filter_map(|m| {
            let id = m.model.or(m.name)?;
            Some(ModelInfo {
                name: id.clone(),
                id,
                context_window: None,
            })
        })
        .collect();

    models.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(models)
}

/// Fetch OpenRouter models with text output filtering
async fn fetch_openrouter_models(config: &ProviderConfig) -> Result<Vec<ModelInfo>, String> {
    let client = reqwest::Client::new();
    let endpoint = config.get_models_endpoint();

    let mut req = client.get(&endpoint);
    if let Some(api_key) = config.api_key.as_deref() {
        req = req.header("Authorization", format!("Bearer {}", api_key));
    }

    let response = req
        .send()
        .await
        .map_err(|e| format!("Failed to connect: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("OpenRouter API error {}: {}", status, body));
    }

    let resp: OpenRouterModelsResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse model list: {}", e))?;

    let mut models: Vec<ModelInfo> = resp
        .data
        .into_iter()
        .filter(|m| {
            // Only include models that can output text
            m.architecture
                .as_ref()
                .and_then(|a| a.output_modalities.as_ref())
                .map(|mods| mods.iter().any(|m| m == "text"))
                .unwrap_or(true)
        })
        .map(|m| ModelInfo {
            name: m.name.unwrap_or_else(|| m.id.clone()),
            id: m.id,
            context_window: m.context_length,
        })
        .collect();

    models.sort_by(|a, b| a.id.cmp(&b.id));
    Ok(models)
}

// ============================================
// GitHub Copilot Device OAuth Flow
// ============================================

const COPILOT_CLIENT_ID: &str = "Iv1.b507a08c87ecfe98";

/// Response from GitHub's device code endpoint (snake_case from GitHub API).
/// We use separate serde attributes: deserialize as snake_case, serialize as camelCase for the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DeviceCodeResponse {
    pub device_code: String,
    pub user_code: String,
    pub verification_uri: String,
    pub expires_in: i64,
    pub interval: i64,
}

#[derive(Deserialize)]
struct OAuthTokenResponse {
    access_token: Option<String>,
    error: Option<String>,
    error_description: Option<String>,
}

#[derive(Deserialize)]
struct CopilotTokenResponse {
    token: Option<String>,
    #[allow(dead_code)]
    expires_at: Option<i64>,
    endpoints: Option<CopilotEndpoints>,
}

#[derive(Deserialize)]
struct CopilotEndpoints {
    api: Option<String>,
}

/// Step 1: Start GitHub Device OAuth flow.
/// Returns device_code, user_code, and verification_uri for the user to complete in browser.
pub async fn copilot_start_device_flow() -> Result<DeviceCodeResponse, String> {
    let client = reqwest::Client::new();

    let response = client
        .post("https://github.com/login/device/code")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", COPILOT_CLIENT_ID),
            ("scope", "read:user"),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to start device flow: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("GitHub device flow error {}: {}", status, body));
    }

    response
        .json::<DeviceCodeResponse>()
        .await
        .map_err(|e| format!("Failed to parse device code response: {}", e))
}

/// Step 2: Poll GitHub for the OAuth access token after user completes browser auth.
/// Returns the GitHub access token on success, or an error describing the state.
pub async fn copilot_poll_auth(device_code: &str) -> Result<String, String> {
    let client = reqwest::Client::new();

    let response = client
        .post("https://github.com/login/oauth/access_token")
        .header("Accept", "application/json")
        .form(&[
            ("client_id", COPILOT_CLIENT_ID),
            ("device_code", device_code),
            ("grant_type", "urn:ietf:params:oauth:grant-type:device_code"),
        ])
        .send()
        .await
        .map_err(|e| format!("Failed to poll auth: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("GitHub OAuth error {}: {}", status, body));
    }

    let token_resp: OAuthTokenResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse token response: {}", e))?;

    if let Some(access_token) = token_resp.access_token {
        Ok(access_token)
    } else if let Some(error) = token_resp.error {
        // "authorization_pending" = user hasn't completed auth yet (keep polling)
        // "slow_down" = polling too fast
        // "expired_token" = device code expired
        // "access_denied" = user denied
        let desc = token_resp.error_description.unwrap_or_default();
        Err(format!("{}:{}", error, desc))
    } else {
        Err("Unknown error during OAuth polling".to_string())
    }
}

/// Step 3: Exchange the GitHub access token for a short-lived Copilot API token.
/// Returns (copilot_token, api_base_url).
pub async fn copilot_exchange_token(github_token: &str) -> Result<(String, String), String> {
    let client = reqwest::Client::new();

    let response = client
        .get("https://api.github.com/copilot_internal/v2/token")
        .header("Authorization", format!("token {}", github_token))
        .header("User-Agent", "Zitong/1.0")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to exchange token: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        return Err(format!("Copilot token exchange error {}: {}", status, body));
    }

    let token_resp: CopilotTokenResponse = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse Copilot token: {}", e))?;

    let token = token_resp
        .token
        .ok_or_else(|| "No Copilot token in response".to_string())?;

    // Derive API base URL from endpoints, or use default
    let base_url = token_resp
        .endpoints
        .and_then(|e| e.api)
        .unwrap_or_else(|| "https://api.individual.githubcopilot.com".to_string());

    Ok((token, base_url))
}

/// Stream chat for GitHub Copilot — exchanges token first, then uses OpenAI-compatible streaming.
async fn stream_github_copilot(
    config: &ProviderConfig,
    messages: &[ChatMessage],
    on_event: &mut impl FnMut(StreamEvent),
) -> Result<(), String> {
    // The api_key field stores the long-lived GitHub OAuth token
    let github_token = config
        .api_key
        .as_deref()
        .ok_or_else(|| "GitHub Copilot not authenticated. Sign in first.".to_string())?;

    // Exchange for a short-lived Copilot API token
    let (copilot_token, base_url) = copilot_exchange_token(github_token).await?;

    let client = reqwest::Client::new();
    let endpoint = format!("{}/chat/completions", base_url);

    let body = serde_json::json!({
        "model": config.model,
        "messages": messages,
        "stream": true,
    });

    let builder = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", copilot_token))
        .header("Copilot-Integration-Id", "vscode-chat")
        .header("Editor-Version", "Zitong/1.0")
        .json(&body);

    let mut es = EventSource::new(builder).map_err(|e| e.to_string())?;
    let mut total_tokens: i64 = 0;

    while let Some(event_result) = es.next().await {
        match event_result {
            Ok(Event::Open) => {}
            Ok(Event::Message(msg)) => {
                if msg.data == "[DONE]" {
                    break;
                }

                if let Ok(chunk) = serde_json::from_str::<OpenAIStreamChunk>(&msg.data) {
                    for choice in &chunk.choices {
                        if let Some(content) = &choice.delta.content {
                            on_event(StreamEvent::Delta {
                                content: content.clone(),
                            });
                        }
                        if choice.finish_reason.is_some() {
                            if let Some(usage) = &chunk.usage {
                                total_tokens = usage.total_tokens.unwrap_or(0);
                            }
                        }
                    }
                }
            }
            Err(err) => {
                on_event(StreamEvent::Error {
                    message: format!("Stream error: {}", err),
                });
                es.close();
                return Ok(());
            }
        }
    }

    on_event(StreamEvent::Done { total_tokens });
    Ok(())
}

/// Fetch models for GitHub Copilot — exchanges token first, then fetches models.
async fn fetch_copilot_models(config: &ProviderConfig) -> Result<Vec<ModelInfo>, String> {
    let github_token = config
        .api_key
        .as_deref()
        .ok_or_else(|| "GitHub Copilot not authenticated. Sign in first.".to_string())?;

    eprintln!("[Copilot] Exchanging GitHub token ({} chars) for Copilot token...", github_token.len());
    let (copilot_token, base_url) = copilot_exchange_token(github_token).await?;
    eprintln!("[Copilot] Token exchanged OK, base_url={}", base_url);

    let client = reqwest::Client::new();
    let endpoint = format!("{}/models", base_url);
    eprintln!("[Copilot] Fetching models from {}", endpoint);

    let response = client
        .get(&endpoint)
        .header("Authorization", format!("Bearer {}", copilot_token))
        .header("Copilot-Integration-Id", "vscode-chat")
        .header("User-Agent", "Zitong/1.0")
        .header("Accept", "application/json")
        .send()
        .await
        .map_err(|e| format!("Failed to fetch Copilot models: {}", e))?;

    let status = response.status();
    eprintln!("[Copilot] Models response status={}", status);

    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        eprintln!("[Copilot] Models error body: {}", body);
        return Err(format!("Copilot models error {}: {}", status, body));
    }

    // Try OpenAI-compatible format first
    let text = response.text().await.map_err(|e| e.to_string())?;
    eprintln!("[Copilot] Models response length: {} bytes", text.len());
    eprintln!("[Copilot] Models response (first 300 chars): {}", &text[..text.len().min(300)]);

    if let Ok(resp) = serde_json::from_str::<OpenAIModelsResponse>(&text) {
        eprintln!("[Copilot] Parsed as OpenAI format, {} models", resp.data.len());
        let mut models: Vec<ModelInfo> = resp
            .data
            .into_iter()
            .filter(|m| {
                let id = m.id.to_lowercase();
                !id.contains("embed") && !id.contains("inference")
            })
            .map(|m| ModelInfo {
                name: m.id.clone(),
                id: m.id,
                context_window: None,
            })
            .collect();
        models.sort_by(|a, b| a.id.cmp(&b.id));
        return Ok(models);
    }

    // Try as a JSON array
    if let Ok(entries) = serde_json::from_str::<Vec<serde_json::Value>>(&text) {
        let mut models: Vec<ModelInfo> = entries
            .into_iter()
            .filter_map(|v| {
                let id = v.get("id")?.as_str()?.to_string();
                Some(ModelInfo {
                    name: v
                        .get("name")
                        .and_then(|n| n.as_str())
                        .unwrap_or(&id)
                        .to_string(),
                    id,
                    context_window: v
                        .get("context_window")
                        .and_then(|c| c.as_i64()),
                })
            })
            .collect();
        models.sort_by(|a, b| a.id.cmp(&b.id));
        return Ok(models);
    }

    Err(format!("Unexpected Copilot models response format: {}", &text[..text.len().min(200)]))
}

// ============================================
// Streaming Chat Completion
// ============================================

pub async fn stream_chat(
    config: &ProviderConfig,
    messages: &[ChatMessage],
    mut on_event: impl FnMut(StreamEvent),
) -> Result<(), String> {
    let message_id = uuid::Uuid::new_v4().to_string();
    on_event(StreamEvent::Started {
        message_id: message_id.clone(),
    });

    match config.provider_type.as_str() {
        "anthropic" => stream_anthropic(config, messages, &mut on_event).await,
        "gemini" => stream_gemini(config, messages, &mut on_event).await,
        "ollama" => stream_ollama(config, messages, &mut on_event).await,
        "github_copilot" => stream_github_copilot(config, messages, &mut on_event).await,
        _ => stream_openai_compatible(config, messages, &mut on_event).await,
    }
}

// ============================================
// OpenAI-compatible streaming (OpenAI, GitHub, Mistral, Groq)
// ============================================

#[derive(Serialize)]
struct OpenAIRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    stream: bool,
}

#[derive(Deserialize)]
struct OpenAIStreamChunk {
    choices: Vec<OpenAIStreamChoice>,
    usage: Option<OpenAIUsage>,
}

#[derive(Deserialize)]
struct OpenAIStreamChoice {
    delta: OpenAIDelta,
    finish_reason: Option<String>,
}

#[derive(Deserialize)]
struct OpenAIDelta {
    content: Option<String>,
}

#[derive(Deserialize)]
struct OpenAIUsage {
    total_tokens: Option<i64>,
}

async fn stream_openai_compatible(
    config: &ProviderConfig,
    messages: &[ChatMessage],
    on_event: &mut impl FnMut(StreamEvent),
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let endpoint = config.get_endpoint();

    let api_key = config
        .api_key
        .as_deref()
        .ok_or_else(|| "API key not configured".to_string())?;

    let body = OpenAIRequest {
        model: &config.model,
        messages,
        stream: true,
    };

    let builder = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&body);

    let mut es = EventSource::new(builder).map_err(|e| e.to_string())?;

    let mut total_tokens: i64 = 0;

    while let Some(event_result) = es.next().await {
        match event_result {
            Ok(Event::Open) => {}
            Ok(Event::Message(msg)) => {
                if msg.data == "[DONE]" {
                    break;
                }

                if let Ok(chunk) = serde_json::from_str::<OpenAIStreamChunk>(&msg.data) {
                    for choice in &chunk.choices {
                        if let Some(content) = &choice.delta.content {
                            on_event(StreamEvent::Delta {
                                content: content.clone(),
                            });
                        }
                        if choice.finish_reason.is_some() {
                            if let Some(usage) = &chunk.usage {
                                total_tokens = usage.total_tokens.unwrap_or(0);
                            }
                        }
                    }
                }
            }
            Err(err) => {
                on_event(StreamEvent::Error {
                    message: format!("Stream error: {}", err),
                });
                es.close();
                return Ok(());
            }
        }
    }

    on_event(StreamEvent::Done { total_tokens });
    Ok(())
}

// ============================================
// Anthropic streaming
// ============================================

#[derive(Serialize)]
#[allow(dead_code)]
struct AnthropicRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    max_tokens: i64,
    stream: bool,
}

#[derive(Deserialize)]
struct AnthropicStreamEvent {
    #[serde(rename = "type")]
    event_type: String,
    delta: Option<AnthropicDelta>,
    usage: Option<AnthropicUsage>,
}

#[derive(Deserialize)]
struct AnthropicDelta {
    text: Option<String>,
}

#[derive(Deserialize)]
struct AnthropicUsage {
    output_tokens: Option<i64>,
    input_tokens: Option<i64>,
}

async fn stream_anthropic(
    config: &ProviderConfig,
    messages: &[ChatMessage],
    on_event: &mut impl FnMut(StreamEvent),
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let endpoint = config.get_endpoint();

    let api_key = config
        .api_key
        .as_deref()
        .ok_or_else(|| "API key not configured".to_string())?;

    // Filter out system messages and extract system prompt
    let system_messages: Vec<&ChatMessage> = messages.iter().filter(|m| m.role == "system").collect();
    let chat_messages: Vec<&ChatMessage> = messages.iter().filter(|m| m.role != "system").collect();

    let mut body = serde_json::json!({
        "model": config.model,
        "messages": chat_messages,
        "max_tokens": 4096,
        "stream": true,
    });

    if let Some(system_msg) = system_messages.first() {
        body["system"] = serde_json::Value::String(system_msg.content.clone());
    }

    let builder = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .header("x-api-key", api_key)
        .header("anthropic-version", "2023-06-01")
        .json(&body);

    let mut es = EventSource::new(builder).map_err(|e| e.to_string())?;
    let mut total_tokens: i64 = 0;

    while let Some(event_result) = es.next().await {
        match event_result {
            Ok(Event::Open) => {}
            Ok(Event::Message(msg)) => {
                if let Ok(event) = serde_json::from_str::<AnthropicStreamEvent>(&msg.data) {
                    match event.event_type.as_str() {
                        "content_block_delta" => {
                            if let Some(delta) = &event.delta {
                                if let Some(text) = &delta.text {
                                    on_event(StreamEvent::Delta {
                                        content: text.clone(),
                                    });
                                }
                            }
                        }
                        "message_delta" => {
                            if let Some(usage) = &event.usage {
                                total_tokens = usage.output_tokens.unwrap_or(0)
                                    + usage.input_tokens.unwrap_or(0);
                            }
                        }
                        "message_stop" => break,
                        _ => {}
                    }
                }
            }
            Err(err) => {
                on_event(StreamEvent::Error {
                    message: format!("Stream error: {}", err),
                });
                es.close();
                return Ok(());
            }
        }
    }

    on_event(StreamEvent::Done { total_tokens });
    Ok(())
}

// ============================================
// Gemini streaming
// ============================================

#[derive(Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
}

#[derive(Serialize)]
struct GeminiContent {
    role: String,
    parts: Vec<GeminiPart>,
}

#[derive(Serialize)]
struct GeminiPart {
    text: String,
}

#[derive(Deserialize)]
struct GeminiStreamChunk {
    candidates: Option<Vec<GeminiCandidate>>,
}

#[derive(Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiResponseContent>,
}

#[derive(Deserialize)]
struct GeminiResponseContent {
    parts: Option<Vec<GeminiResponsePart>>,
}

#[derive(Deserialize)]
struct GeminiResponsePart {
    text: Option<String>,
}

async fn stream_gemini(
    config: &ProviderConfig,
    messages: &[ChatMessage],
    on_event: &mut impl FnMut(StreamEvent),
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let api_key = config
        .api_key
        .as_deref()
        .ok_or_else(|| "API key not configured".to_string())?;

    let endpoint = format!("{}&key={}", config.get_endpoint(), api_key);

    // Convert messages to Gemini format
    let contents: Vec<GeminiContent> = messages
        .iter()
        .filter(|m| m.role != "system")
        .map(|m| GeminiContent {
            role: if m.role == "assistant" {
                "model".to_string()
            } else {
                "user".to_string()
            },
            parts: vec![GeminiPart {
                text: m.content.clone(),
            }],
        })
        .collect();

    let body = GeminiRequest { contents };

    let builder = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .json(&body);

    let mut es = EventSource::new(builder).map_err(|e| e.to_string())?;

    while let Some(event_result) = es.next().await {
        match event_result {
            Ok(Event::Open) => {}
            Ok(Event::Message(msg)) => {
                if let Ok(chunk) = serde_json::from_str::<GeminiStreamChunk>(&msg.data) {
                    if let Some(candidates) = &chunk.candidates {
                        for candidate in candidates {
                            if let Some(content) = &candidate.content {
                                if let Some(parts) = &content.parts {
                                    for part in parts {
                                        if let Some(text) = &part.text {
                                            on_event(StreamEvent::Delta {
                                                content: text.clone(),
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            Err(err) => {
                on_event(StreamEvent::Error {
                    message: format!("Stream error: {}", err),
                });
                es.close();
                return Ok(());
            }
        }
    }

    on_event(StreamEvent::Done { total_tokens: 0 });
    Ok(())
}

// ============================================
// Ollama streaming
// ============================================

#[derive(Serialize)]
struct OllamaRequest<'a> {
    model: &'a str,
    messages: &'a [ChatMessage],
    stream: bool,
}

#[derive(Deserialize)]
struct OllamaStreamChunk {
    message: Option<OllamaMessage>,
    done: Option<bool>,
}

#[derive(Deserialize)]
struct OllamaMessage {
    content: Option<String>,
}

async fn stream_ollama(
    config: &ProviderConfig,
    messages: &[ChatMessage],
    on_event: &mut impl FnMut(StreamEvent),
) -> Result<(), String> {
    let client = reqwest::Client::new();
    let endpoint = config.get_endpoint();

    let body = OllamaRequest {
        model: &config.model,
        messages,
        stream: true,
    };

    let response = client
        .post(&endpoint)
        .header("Content-Type", "application/json")
        .json(&body)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        on_event(StreamEvent::Error {
            message: format!("Ollama error {}: {}", status, body),
        });
        return Ok(());
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();

    while let Some(chunk_result) = stream.next().await {
        match chunk_result {
            Ok(bytes) => {
                buffer.push_str(&String::from_utf8_lossy(&bytes));
                // Ollama sends NDJSON (one JSON per line)
                while let Some(newline_pos) = buffer.find('\n') {
                    let line = buffer[..newline_pos].trim().to_string();
                    buffer = buffer[newline_pos + 1..].to_string();

                    if line.is_empty() {
                        continue;
                    }

                    if let Ok(chunk) = serde_json::from_str::<OllamaStreamChunk>(&line) {
                        if let Some(msg) = &chunk.message {
                            if let Some(content) = &msg.content {
                                on_event(StreamEvent::Delta {
                                    content: content.clone(),
                                });
                            }
                        }
                        if chunk.done == Some(true) {
                            on_event(StreamEvent::Done { total_tokens: 0 });
                            return Ok(());
                        }
                    }
                }
            }
            Err(err) => {
                on_event(StreamEvent::Error {
                    message: format!("Stream error: {}", err),
                });
                return Ok(());
            }
        }
    }

    on_event(StreamEvent::Done { total_tokens: 0 });
    Ok(())
}
