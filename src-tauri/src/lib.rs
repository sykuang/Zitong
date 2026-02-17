mod commands;
mod db;
mod providers;

use db::Database;
use std::path::PathBuf;
use tauri::Manager;

fn get_db_path(app: &tauri::App) -> PathBuf {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_data_dir).expect("Failed to create app data dir");
    app_data_dir.join("zitong.db")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .setup(|app| {
            let db_path = get_db_path(app);
            let database =
                Database::new(&db_path).expect("Failed to initialize database");
            app.manage(database);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Conversations
            commands::create_conversation,
            commands::list_conversations,
            commands::get_conversation,
            commands::update_conversation_title,
            commands::delete_conversation,
            commands::archive_conversation,
            commands::search_conversations,
            // Messages
            commands::get_messages,
            commands::delete_message,
            commands::send_message,
            // Providers
            commands::list_providers,
            commands::save_provider,
            commands::delete_provider,
            commands::test_provider_connection,
            commands::list_models,
            // GitHub Copilot OAuth
            commands::copilot_start_device_flow,
            commands::copilot_poll_auth,
            commands::copilot_exchange_token,
            // Settings
            commands::get_settings,
            commands::save_settings,
            // Prompt Templates
            commands::list_prompt_templates,
            commands::save_prompt_template,
            commands::delete_prompt_template,
            // Folders
            commands::list_folders,
            commands::create_folder,
            commands::delete_folder,
            // AI Commands
            commands::list_ai_commands,
            commands::save_ai_command,
            commands::delete_ai_command,
            // Assistants
            commands::list_assistants,
            commands::save_assistant,
            commands::delete_assistant,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
