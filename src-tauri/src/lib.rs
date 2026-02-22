mod commands;
mod db;
mod providers;

use db::Database;
use std::path::PathBuf;
use tauri::{Emitter, Manager};
use tauri::menu::{MenuBuilder, MenuItemBuilder};
use tauri::tray::TrayIconBuilder;

#[cfg(desktop)]
use tauri_plugin_autostart::ManagerExt as AutostartManagerExt;

#[cfg(target_os = "macos")]
#[allow(clippy::unused_unit)]
mod panel;

mod clipboard;

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
    let mut builder = tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::AppleScript,
            Some(vec!["--hidden"]),
        ));
    }

    // Register tauri-nspanel plugin on macOS
    #[cfg(target_os = "macos")]
    {
        builder = builder.plugin(tauri_nspanel::init());
    }

    builder
        .setup(|app| {
            let db_path = get_db_path(app);
            let database =
                Database::new(&db_path).expect("Failed to initialize database");

            // Check if launched with --hidden (e.g. from login item autostart)
            let launched_hidden = std::env::args().any(|a| a == "--hidden");

            app.manage(database);

            // --- macOS application menu (menu bar) ---
            #[cfg(target_os = "macos")]
            {
                use tauri::menu::{AboutMetadataBuilder, PredefinedMenuItem, SubmenuBuilder};

                let app_menu = SubmenuBuilder::new(app, "Zitong")
                    .item(&PredefinedMenuItem::about(
                        app,
                        Some("About Zitong"),
                        Some(AboutMetadataBuilder::new().build()),
                    )?)
                    .separator()
                    .item(
                        &MenuItemBuilder::with_id("settings", "Settings...")
                            .accelerator("CommandOrControl+,")
                            .build(app)?,
                    )
                    .separator()
                    .item(&PredefinedMenuItem::hide(app, Some("Hide Zitong"))?)
                    .item(&PredefinedMenuItem::hide_others(app, Some("Hide Others"))?)
                    .item(&PredefinedMenuItem::show_all(app, Some("Show All"))?)
                    .separator()
                    .item(&PredefinedMenuItem::quit(app, Some("Quit Zitong"))?)
                    .build()?;

                let edit_menu = SubmenuBuilder::new(app, "Edit")
                    .item(&PredefinedMenuItem::undo(app, None)?)
                    .item(&PredefinedMenuItem::redo(app, None)?)
                    .separator()
                    .item(&PredefinedMenuItem::cut(app, None)?)
                    .item(&PredefinedMenuItem::copy(app, None)?)
                    .item(&PredefinedMenuItem::paste(app, None)?)
                    .item(&PredefinedMenuItem::select_all(app, None)?)
                    .build()?;

                let window_menu = SubmenuBuilder::new(app, "Window")
                    .item(&PredefinedMenuItem::minimize(app, None)?)
                    .item(&PredefinedMenuItem::maximize(app, None)?)
                    .item(&PredefinedMenuItem::close_window(app, None)?)
                    .build()?;

                let menu = MenuBuilder::new(app)
                    .items(&[&app_menu, &edit_menu, &window_menu])
                    .build()?;

                app.set_menu(menu)?;

                let handle = app.handle().clone();
                app.on_menu_event(move |_app, event| {
                    if event.id().as_ref() == "settings" {
                        let _ = handle.emit("open-settings", ());
                    }
                });
            }

            // Convert the overlay window to an NSPanel on macOS.
            // Must run on main thread (Cocoa requirement — cannot use async spawn).
            #[cfg(target_os = "macos")]
            {
                if let Err(e) = panel::setup_overlay_panel(app.handle()) {
                    eprintln!("[zitong] Failed to set up overlay panel: {}", e);
                }
            }

            // --- System tray icon ---
            let show_main = MenuItemBuilder::with_id("show_main", "Show Zitong")
                .build(app)?;
            let command_palette = MenuItemBuilder::with_id("command_palette", "Command Palette")
                .accelerator("CommandOrControl+Shift+Space")
                .build(app)?;
            let separator = tauri::menu::PredefinedMenuItem::separator(app)?;
            let quit = MenuItemBuilder::with_id("quit", "Quit Zitong")
                .accelerator("CommandOrControl+Q")
                .build(app)?;

            let tray_menu = MenuBuilder::new(app)
                .items(&[&show_main, &command_palette, &separator, &quit])
                .build()?;

            let _tray = TrayIconBuilder::new()
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray-icon.png")).expect("tray icon"))
                .icon_as_template(true)
                .menu(&tray_menu)
                .tooltip("Zitong")
                .on_menu_event(|app, event| {
                    match event.id().as_ref() {
                        "show_main" => {
                            if let Some(win) = app.get_webview_window("main") {
                                // Restore Dock icon before showing window
                                #[cfg(target_os = "macos")]
                                {
                                    use objc2_app_kit::{NSApplication, NSApplicationActivationPolicy};
                                    use objc2::MainThreadMarker;
                                    if let Some(mtm) = MainThreadMarker::new() {
                                        let ns_app = NSApplication::sharedApplication(mtm);
                                        ns_app.setActivationPolicy(NSApplicationActivationPolicy::Regular);
                                    }
                                }
                                let _ = win.show();
                                let _ = win.set_focus();
                            }
                        }
                        "command_palette" => {
                            #[cfg(target_os = "macos")]
                            {
                                let handle = app.clone();
                                let _ = app.run_on_main_thread(move || {
                                    if let Err(e) = panel::toggle_overlay_panel(&handle) {
                                        eprintln!("[tray] toggle overlay failed: {}", e);
                                    }
                                });
                            }
                            #[cfg(not(target_os = "macos"))]
                            {
                                if let Some(win) = app.get_webview_window("overlay") {
                                    if win.is_visible().unwrap_or(false) {
                                        let _ = win.hide();
                                    } else {
                                        let _ = win.center();
                                        let _ = win.show();
                                        let _ = win.set_focus();
                                    }
                                }
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // --- Hide main window on close instead of quitting (run in background) ---
            let main_window = app.get_webview_window("main").expect("no main window");
            main_window.on_window_event({
                let win = main_window.clone();
                move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        let _ = win.hide();
                        // Hide Dock icon when running in background
                        #[cfg(target_os = "macos")]
                        {
                            use objc2_app_kit::{NSApplication, NSApplicationActivationPolicy};
                            use objc2::MainThreadMarker;
                            if let Some(mtm) = MainThreadMarker::new() {
                                let ns_app = NSApplication::sharedApplication(mtm);
                                ns_app.setActivationPolicy(NSApplicationActivationPolicy::Accessory);
                            }
                        }
                    }
                }
            });

            // --- Start hidden when launched at login (--hidden flag) ---
            if launched_hidden {
                let _ = main_window.hide();
                #[cfg(target_os = "macos")]
                {
                    use objc2_app_kit::{NSApplication, NSApplicationActivationPolicy};
                    use objc2::MainThreadMarker;
                    if let Some(mtm) = MainThreadMarker::new() {
                        let ns_app = NSApplication::sharedApplication(mtm);
                        ns_app.setActivationPolicy(NSApplicationActivationPolicy::Accessory);
                    }
                }
            }

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
            commands::execute_ai_command,
            commands::open_in_new_chat,
            // Assistants
            commands::list_assistants,
            commands::save_assistant,
            commands::delete_assistant,
            // Clipboard (direct macOS)
            clipboard::read_clipboard_text,
            clipboard::write_clipboard_text,
            clipboard::simulate_copy,
            clipboard::check_accessibility,
            clipboard::check_permissions,
            clipboard::request_permissions,
            clipboard::open_accessibility_settings,
            clipboard::open_automation_settings,
            clipboard::relaunch_app,
            // Overlay panel
            toggle_overlay,
            hide_overlay,
            // Autostart
            set_launch_at_login,
            get_launch_at_login,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Toggle the overlay command palette panel.
/// On macOS, this uses NSPanel to show above fullscreen apps.
/// On other platforms, falls back to standard window show/hide.
#[tauri::command]
async fn hide_overlay(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let handle = app.clone();
        app.run_on_main_thread(move || {
            if let Err(e) = panel::hide_overlay_panel(&handle) {
                eprintln!("[hide_overlay] panel hide failed: {}", e);
            }
        })
        .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        if let Some(win) = app.get_webview_window("overlay") {
            win.hide().map_err(|e| e.to_string())?;
        }
        Ok(())
    }
}

#[tauri::command]
async fn toggle_overlay(app: tauri::AppHandle) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        let handle = app.clone();
        app.run_on_main_thread(move || {
            if let Err(e) = panel::toggle_overlay_panel(&handle) {
                eprintln!("[toggle_overlay] panel toggle failed: {}", e);
            }
        })
        .map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        // Fallback for non-macOS: use standard window show/hide
        if let Some(win) = app.get_webview_window("overlay") {
            if win.is_visible().unwrap_or(false) {
                win.hide().map_err(|e| e.to_string())?;
            } else {
                win.center().map_err(|e| e.to_string())?;
                win.show().map_err(|e| e.to_string())?;
                win.set_focus().map_err(|e| e.to_string())?;
            }
        }
        Ok(())
    }
}

#[cfg(desktop)]
#[tauri::command]
fn set_launch_at_login(app: tauri::AppHandle, enabled: bool) -> Result<(), String> {
    let manager = app.autolaunch();
    if enabled {
        manager.enable().map_err(|e| format!("Failed to enable autostart: {e}"))?;
    } else {
        manager.disable().map_err(|e| format!("Failed to disable autostart: {e}"))?;
    }
    Ok(())
}

#[cfg(desktop)]
#[tauri::command]
fn get_launch_at_login(app: tauri::AppHandle) -> Result<bool, String> {
    let manager = app.autolaunch();
    manager.is_enabled().map_err(|e| format!("Failed to check autostart: {e}"))
}
