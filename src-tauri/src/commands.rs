use crate::db::{self, Database};
use crate::providers::{self, ChatMessage, DeviceCodeResponse, ModelInfo, ProviderConfig, StreamEvent};
use serde::Deserialize;
use tauri::{ipc::Channel, State};

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
