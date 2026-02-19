use crate::db::{self, Database};
use crate::providers::{self, ChatMessage, DeviceCodeResponse, ModelInfo, ProviderConfig, StreamEvent};
use serde::{Deserialize, Serialize};
use tauri::{ipc::Channel, Emitter, Manager, State};

// ============================================
// Request types
// ============================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateConversationRequest {
    pub title: Option<String>,
    pub model: String,
    pub provider_id: String,
    pub system_prompt: Option<String>,
    pub folder_id: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageRequest {
    pub conversation_id: String,
    pub content: String,
    pub model: String,
    pub provider_id: String,
    pub system_prompt: Option<String>,
}

// ============================================
// Conversation Commands
// ============================================

#[tauri::command]
pub fn create_conversation(
    db: State<'_, Database>,
    req: CreateConversationRequest,
) -> Result<db::Conversation, String> {
    let id = uuid::Uuid::new_v4().to_string();
    let title = req.title.as_deref().unwrap_or("New Chat");
    db.create_conversation(
        &id,
        title,
        &req.model,
        &req.provider_id,
        req.system_prompt.as_deref(),
        req.folder_id.as_deref(),
    )
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn list_conversations(db: State<'_, Database>) -> Result<Vec<db::Conversation>, String> {
    db.list_conversations().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_conversation(db: State<'_, Database>, id: String) -> Result<db::Conversation, String> {
    db.get_conversation(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn update_conversation_title(
    db: State<'_, Database>,
    id: String,
    title: String,
) -> Result<(), String> {
    db.update_conversation_title(&id, &title)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_conversation(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_conversation(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn archive_conversation(
    db: State<'_, Database>,
    id: String,
    archived: bool,
) -> Result<(), String> {
    db.archive_conversation(&id, archived)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn search_conversations(
    db: State<'_, Database>,
    query: String,
) -> Result<Vec<db::Conversation>, String> {
    db.search_conversations(&query).map_err(|e| e.to_string())
}

// ============================================
// Message Commands
// ============================================

#[tauri::command]
pub fn get_messages(
    db: State<'_, Database>,
    conversation_id: String,
) -> Result<Vec<db::Message>, String> {
    db.get_messages(&conversation_id)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_message(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_message(&id).map_err(|e| e.to_string())
}

// ============================================
// Send Message with Streaming
// ============================================

#[tauri::command]
pub async fn send_message(
    db: State<'_, Database>,
    req: SendMessageRequest,
    on_event: Channel<StreamEvent>,
) -> Result<(), String> {
    // Save user message to DB
    let user_msg_id = uuid::Uuid::new_v4().to_string();
    let sort_order = db
        .get_message_count(&req.conversation_id)
        .unwrap_or(0);

    db.create_message(
        &user_msg_id,
        &req.conversation_id,
        "user",
        &req.content,
        None,
        None,
        sort_order,
    )
    .map_err(|e| e.to_string())?;

    // Get all messages for context
    let all_messages = db
        .get_messages(&req.conversation_id)
        .map_err(|e| e.to_string())?;

    // Build chat messages for provider
    let mut chat_messages: Vec<ChatMessage> = Vec::new();

    // Add system prompt if available
    if let Some(system_prompt) = &req.system_prompt {
        if !system_prompt.is_empty() {
            chat_messages.push(ChatMessage {
                role: "system".to_string(),
                content: system_prompt.clone(),
            });
        }
    }

    // Add conversation history
    for msg in &all_messages {
        chat_messages.push(ChatMessage {
            role: msg.role.clone(),
            content: msg.content.clone(),
        });
    }

    // Get provider config from DB
    let provider = db
        .get_provider(&req.provider_id)
        .map_err(|e| format!("Provider not found: {}", e))?;

    let config = ProviderConfig {
        provider_type: provider.provider_type,
        api_key: provider.api_key,
        base_url: provider.base_url,
        model: req.model.clone(),
    };

    // Stream the response
    let accumulated = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
    let accumulated_clone = accumulated.clone();
    let total_tokens = std::sync::Arc::new(std::sync::Mutex::new(0i64));
    let total_tokens_clone = total_tokens.clone();

    providers::stream_chat(&config, &chat_messages, |event| {
        match &event {
            StreamEvent::Delta { content } => {
                accumulated_clone.lock().unwrap().push_str(content);
            }
            StreamEvent::Done { total_tokens: tokens } => {
                *total_tokens_clone.lock().unwrap() = *tokens;
            }
            _ => {}
        }
        let _ = on_event.send(event);
    })
    .await?;

    // Save assistant message to DB
    let assistant_msg_id = uuid::Uuid::new_v4().to_string();
    let final_content = accumulated.lock().unwrap().clone();
    let final_tokens = *total_tokens.lock().unwrap();

    db.create_message(
        &assistant_msg_id,
        &req.conversation_id,
        "assistant",
        &final_content,
        Some(&req.model),
        if final_tokens > 0 {
            Some(final_tokens)
        } else {
            None
        },
        sort_order + 1,
    )
    .map_err(|e| e.to_string())?;

    // Auto-generate title from first user message if it's "New Chat"
    if sort_order == 0 {
        let title = if req.content.len() > 50 {
            format!("{}...", &req.content[..47])
        } else {
            req.content.clone()
        };
        let _ = db.update_conversation_title(&req.conversation_id, &title);
    }

    Ok(())
}

// ============================================
// Provider Commands
// ============================================

#[tauri::command]
pub fn list_providers(db: State<'_, Database>) -> Result<Vec<db::Provider>, String> {
    db.list_providers().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_provider(db: State<'_, Database>, provider: db::Provider) -> Result<(), String> {
    db.save_provider(&provider).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_provider(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_provider(&id).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn test_provider_connection(
    db: State<'_, Database>,
    id: String,
) -> Result<serde_json::Value, String> {
    let provider = db.get_provider(&id).map_err(|e| e.to_string())?;

    let config = ProviderConfig {
        provider_type: provider.provider_type,
        api_key: provider.api_key,
        base_url: provider.base_url,
        model: "gpt-4o-mini".to_string(), // Use a cheap model for testing
    };

    let test_messages = vec![ChatMessage {
        role: "user".to_string(),
        content: "Hello".to_string(),
    }];

    let mut got_response = false;
    providers::stream_chat(&config, &test_messages, |event| {
        if matches!(event, StreamEvent::Delta { .. }) {
            got_response = true;
        }
    })
    .await?;

    if got_response {
        Ok(serde_json::json!({"success": true}))
    } else {
        Ok(serde_json::json!({"success": false, "error": "No response received"}))
    }
}

#[tauri::command]
pub async fn list_models(
    db: State<'_, Database>,
    provider_id: String,
) -> Result<Vec<ModelInfo>, String> {
    eprintln!("[list_models] Called for provider_id={}", provider_id);

    // Write debug early
    let _ = std::fs::write("/tmp/zitong_debug.txt", format!("list_models called: provider_id={}", provider_id));

    let provider = db
        .get_provider(&provider_id)
        .map_err(|e| {
            let msg = format!("Provider not found: {}", e);
            eprintln!("[list_models] {}", msg);
            let _ = std::fs::write("/tmp/zitong_debug.txt", format!("ERR at get_provider: {}", msg));
            msg
        })?;

    eprintln!("[list_models] Found provider type={}, has_key={}", provider.provider_type, provider.api_key.is_some());
    let config = ProviderConfig {
        provider_type: provider.provider_type,
        api_key: provider.api_key,
        base_url: provider.base_url,
        model: String::new(),
    };

    let result = providers::list_provider_models(&config).await;
    match &result {
        Ok(models) => {
            let msg = format!("OK: {} models: {:?}", models.len(), models.iter().map(|m| &m.id).collect::<Vec<_>>());
            eprintln!("[list_models] {}", msg);
            let _ = std::fs::write("/tmp/zitong_debug.txt", msg);
        }
        Err(e) => {
            eprintln!("[list_models] Error: {}", e);
            let _ = std::fs::write("/tmp/zitong_debug.txt", format!("ERR: {}", e));
        }
    }
    result
}

// ============================================
// GitHub Copilot OAuth Commands
// ============================================

#[tauri::command]
pub async fn copilot_start_device_flow() -> Result<DeviceCodeResponse, String> {
    providers::copilot_start_device_flow().await
}

#[tauri::command]
pub async fn copilot_poll_auth(device_code: String) -> Result<String, String> {
    providers::copilot_poll_auth(&device_code).await
}

#[tauri::command]
pub async fn copilot_exchange_token(github_token: String) -> Result<serde_json::Value, String> {
    let (copilot_token, base_url) = providers::copilot_exchange_token(&github_token).await?;
    Ok(serde_json::json!({
        "token": copilot_token,
        "baseUrl": base_url,
    }))
}

// ============================================
// Settings Commands
// ============================================

#[tauri::command]
pub fn get_settings(db: State<'_, Database>) -> Result<db::AppSettings, String> {
    db.get_settings().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_settings(db: State<'_, Database>, settings: db::AppSettings) -> Result<(), String> {
    db.save_settings(&settings).map_err(|e| e.to_string())
}

// ============================================
// Prompt Template Commands
// ============================================

#[tauri::command]
pub fn list_prompt_templates(
    db: State<'_, Database>,
) -> Result<Vec<db::PromptTemplate>, String> {
    db.list_prompt_templates().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_prompt_template(
    db: State<'_, Database>,
    template: db::PromptTemplate,
) -> Result<(), String> {
    db.save_prompt_template(&template)
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_prompt_template(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_prompt_template(&id).map_err(|e| e.to_string())
}

// ============================================
// Folder Commands
// ============================================

#[tauri::command]
pub fn list_folders(db: State<'_, Database>) -> Result<Vec<db::Folder>, String> {
    db.list_folders().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_folder(db: State<'_, Database>, name: String) -> Result<db::Folder, String> {
    let id = uuid::Uuid::new_v4().to_string();
    db.create_folder(&id, &name).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_folder(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_folder(&id).map_err(|e| e.to_string())
}

// ============================================
// AI Command Commands
// ============================================

#[tauri::command]
pub fn list_ai_commands(db: State<'_, Database>) -> Result<Vec<db::AiCommand>, String> {
    db.list_ai_commands().map_err(|e| e.to_string())
}

/// Execute an AI command on the given selected text.
/// Resolves provider/model from the command overrides or falls back to default settings.
/// Returns the AI-generated result text.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExecuteAiCommandRequest {
    pub selected_text: String,
    pub system_prompt: String,
    pub provider_id: Option<String>,
    pub model: Option<String>,
}

#[tauri::command]
pub async fn execute_ai_command(
    db: State<'_, Database>,
    req: ExecuteAiCommandRequest,
) -> Result<String, String> {
    // Resolve provider & model — use command overrides or fall back to defaults
    let settings = db.get_settings().map_err(|e| e.to_string())?;
    let provider_id = req
        .provider_id
        .filter(|s| !s.is_empty())
        .unwrap_or(settings.default_provider_id);
    let provider = db
        .get_provider(&provider_id)
        .map_err(|e| format!("Provider not found: {}", e))?;

    // Fallback chain: command-level model → provider default_model → global default_model
    let model = req
        .model
        .filter(|s| !s.is_empty())
        .or_else(|| provider.default_model.clone().filter(|s| !s.is_empty()))
        .unwrap_or(settings.default_model);

    let config = ProviderConfig {
        provider_type: provider.provider_type,
        api_key: provider.api_key,
        base_url: provider.base_url,
        model: model.clone(),
    };

    // Build messages: system prompt + user message containing the selected text
    let mut chat_messages: Vec<ChatMessage> = Vec::new();
    if !req.system_prompt.is_empty() {
        chat_messages.push(ChatMessage {
            role: "system".to_string(),
            content: req.system_prompt,
        });
    }
    chat_messages.push(ChatMessage {
        role: "user".to_string(),
        content: req.selected_text,
    });

    // Stream the response and accumulate
    let accumulated = std::sync::Arc::new(std::sync::Mutex::new(String::new()));
    let accumulated_clone = accumulated.clone();

    providers::stream_chat(&config, &chat_messages, |event| {
        if let StreamEvent::Delta { content } = &event {
            accumulated_clone.lock().unwrap().push_str(content);
        }
    })
    .await?;

    let result = accumulated.lock().unwrap().clone();
    if result.is_empty() {
        return Err("AI returned an empty response".to_string());
    }
    Ok(result)
}

/// Create a new conversation containing the user query and AI response,
/// then emit "open-conversation" to the main window so it navigates there.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenInNewChatRequest {
    pub user_text: String,
    pub ai_response: String,
    pub provider_id: String,
    pub model: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpenConversationEvent {
    pub conversation_id: String,
}

#[tauri::command]
pub fn open_in_new_chat(
    app: tauri::AppHandle,
    db: State<'_, Database>,
    req: OpenInNewChatRequest,
) -> Result<String, String> {
    // Create conversation
    let convo_id = uuid::Uuid::new_v4().to_string();
    let title = if req.user_text.len() > 50 {
        format!("{}...", &req.user_text[..47])
    } else {
        req.user_text.clone()
    };

    db.create_conversation(&convo_id, &title, &req.model, &req.provider_id, None, None)
        .map_err(|e| e.to_string())?;

    // Save user message
    let user_msg_id = uuid::Uuid::new_v4().to_string();
    db.create_message(&user_msg_id, &convo_id, "user", &req.user_text, None, None, 0)
        .map_err(|e| e.to_string())?;

    // Save assistant message
    let assistant_msg_id = uuid::Uuid::new_v4().to_string();
    db.create_message(
        &assistant_msg_id,
        &convo_id,
        "assistant",
        &req.ai_response,
        Some(&req.model),
        None,
        1,
    )
    .map_err(|e| e.to_string())?;

    // Emit event so the main window can navigate to the new conversation
    let _ = app.emit_to(
        "main",
        "open-conversation",
        OpenConversationEvent {
            conversation_id: convo_id.clone(),
        },
    );

    // Hide the overlay panel first so it doesn't block the main window
    let _ = crate::panel::hide_overlay_panel(&app);

    // Show the main window and activate the app so it comes to front
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.show();
        let _ = win.set_focus();
    }

    // Activate the app (needed on macOS so the main window actually comes to front)
    #[cfg(target_os = "macos")]
    {
        use objc2_app_kit::NSApplication;
        use objc2::MainThreadMarker;
        // IPC commands run on the main thread in Tauri
        if let Some(mtm) = MainThreadMarker::new() {
            let ns_app = NSApplication::sharedApplication(mtm);
            #[allow(deprecated)]
            ns_app.activateIgnoringOtherApps(true);
        }
    }

    Ok(convo_id)
}

#[tauri::command]
pub fn save_ai_command(db: State<'_, Database>, command: db::AiCommand) -> Result<(), String> {
    db.save_ai_command(&command).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_ai_command(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_ai_command(&id).map_err(|e| e.to_string())
}

// ============================================
// Assistant Commands
// ============================================

#[tauri::command]
pub fn list_assistants(db: State<'_, Database>) -> Result<Vec<db::Assistant>, String> {
    db.list_assistants().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn save_assistant(db: State<'_, Database>, assistant: db::Assistant) -> Result<(), String> {
    db.save_assistant(&assistant).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn delete_assistant(db: State<'_, Database>, id: String) -> Result<(), String> {
    db.delete_assistant(&id).map_err(|e| e.to_string())
}
