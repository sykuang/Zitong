mod commands;
mod db;
mod providers;

use db::Database;
use std::path::PathBuf;
use tauri::Manager;
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
                        let h = handle.clone();
                        tauri::async_runtime::spawn(async move {
                            if let Err(e) = open_settings(h).await {
                                eprintln!("[menu] Failed to open settings: {}", e);
                            }
                        });
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
                            #[cfg(target_os = "windows")]
                            {
                                if let Some(win) = app.get_webview_window("overlay") {
                                    if win.is_visible().unwrap_or(false) {
                                        let _ = win.hide();
                                    } else {
                                        // Simulate Ctrl+C to copy selected text before showing
                                        if let Err(e) = clipboard::simulate_copy_sync() {
                                            eprintln!("[tray] simulate_copy_sync failed: {}", e);
                                        }
                                        let _ = win.center();
                                        let _ = win.show();
                                        let _ = win.set_focus();
                                    }
                                }
                            }
                        }
                        "quit" => {
                            // Save window position before quitting
                            if let Some(win) = app.get_webview_window("main") {
                                let db: tauri::State<'_, Database> = app.state();
                                if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
                                    let _ = db.save_window_state(pos.x, pos.y, size.width, size.height);
                                }
                            }
                            app.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            // --- Restore saved window position & size ---
            let main_window = app.get_webview_window("main").expect("no main window");
            {
                let db: tauri::State<'_, Database> = app.state();
                if let Some((x, y, w, h)) = db.get_window_state() {
                    eprintln!("[window] restoring position: x={}, y={}, w={}, h={}", x, y, w, h);
                    let _ = main_window.set_position(tauri::PhysicalPosition::new(x, y));
                    let _ = main_window.set_size(tauri::PhysicalSize::new(w, h));
                } else {
                    eprintln!("[window] no saved position found, using default");
                }
            }

            // --- Hide main window on close instead of quitting (run in background) ---
            // Also save window position/size on move/resize (debounced to 1s).
            let app_handle = app.handle().clone();
            let last_save = std::sync::Arc::new(std::sync::Mutex::new(std::time::Instant::now()));
            main_window.on_window_event({
                let win = main_window.clone();
                move |event| {
                    match event {
                        tauri::WindowEvent::CloseRequested { api, .. } => {
                            // Always save final position before hiding
                            let db: tauri::State<'_, Database> = app_handle.state();
                            if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
                                let _ = db.save_window_state(pos.x, pos.y, size.width, size.height);
                            }
                            api.prevent_close();
                            let _ = win.hide();
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
                        tauri::WindowEvent::Moved(_) | tauri::WindowEvent::Resized(_) => {
                            // Throttle: save at most once per second during drag
                            let mut last = last_save.lock().unwrap();
                            let now = std::time::Instant::now();
                            if now.duration_since(*last).as_secs() >= 1 {
                                *last = now;
                                let db: tauri::State<'_, Database> = app_handle.state();
                                if let (Ok(pos), Ok(size)) = (win.outer_position(), win.outer_size()) {
                                    let _ = db.save_window_state(pos.x, pos.y, size.width, size.height);
                                }
                            }
                        }
                        _ => {}
                    }
                }
            });

            // --- Start hidden when launched at login (--hidden flag) ---
            if launched_hidden {
                // Window is already invisible (visible: false in config).
                // Switch to Accessory mode so the Dock icon is also hidden.
                #[cfg(target_os = "macos")]
                {
                    use objc2_app_kit::{NSApplication, NSApplicationActivationPolicy};
                    use objc2::MainThreadMarker;
                    if let Some(mtm) = MainThreadMarker::new() {
                        let ns_app = NSApplication::sharedApplication(mtm);
                        ns_app.setActivationPolicy(NSApplicationActivationPolicy::Accessory);
                    }
                }
            } else {
                // Normal launch — show the main window
                let _ = main_window.show();
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
            commands::generate_conversation_title,
            commands::open_in_new_chat,
            // Assistants
            commands::list_assistants,
            commands::save_assistant,
            commands::delete_assistant,
            // Clipboard (direct macOS)
            clipboard::read_clipboard_text,
            clipboard::write_clipboard_text,
            clipboard::simulate_copy,
            clipboard::simulate_paste,
            clipboard::check_accessibility,
            clipboard::check_permissions,
            clipboard::request_permissions,
            clipboard::open_accessibility_settings,
            clipboard::open_automation_settings,
            clipboard::relaunch_app,
            // Overlay panel
            toggle_overlay,
            hide_overlay,
            // Settings window
            open_settings,
            // Autostart
            set_launch_at_login,
            get_launch_at_login,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run({
            // Skip the first Reopen event — macOS fires one at launch which
            // would undo the --hidden flag.
            let first_reopen = std::sync::atomic::AtomicBool::new(true);
            move |app, event| {
                // Handle macOS Dock icon click (reopen)
                #[cfg(target_os = "macos")]
                if let tauri::RunEvent::Reopen { has_visible_windows, .. } = &event {
                    if first_reopen.swap(false, std::sync::atomic::Ordering::Relaxed) {
                        return;
                    }
                    if !has_visible_windows {
                        if let Some(win) = app.get_webview_window("main") {
                            // Restore Dock icon and show window
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
                }
            }
        });
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
    #[cfg(target_os = "windows")]
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
    #[cfg(target_os = "windows")]
    {
        if let Some(win) = app.get_webview_window("overlay") {
            if win.is_visible().unwrap_or(false) {
                win.hide().map_err(|e| e.to_string())?;
            } else {
                // Simulate Ctrl+C on a blocking thread to avoid blocking the async runtime
                if let Err(e) = tokio::task::spawn_blocking(clipboard::simulate_copy_sync)
                    .await
                    .map_err(|e| e.to_string())?
                {
                    eprintln!("[toggle_overlay] simulate_copy_sync failed: {}", e);
                }
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

#[cfg(not(desktop))]
#[tauri::command]
fn set_launch_at_login(_enabled: bool) -> Result<(), String> {
    Err("Launch at login is not supported on this platform".into())
}

#[cfg(desktop)]
#[tauri::command]
fn get_launch_at_login(app: tauri::AppHandle) -> Result<bool, String> {
    let manager = app.autolaunch();
    manager.is_enabled().map_err(|e| format!("Failed to check autostart: {e}"))
}

#[cfg(not(desktop))]
#[tauri::command]
fn get_launch_at_login() -> Result<bool, String> {
    Ok(false)
}

/// Open the settings window. Creates it on demand; if it already exists, just focuses it.
#[tauri::command]
async fn open_settings(app: tauri::AppHandle) -> Result<(), String> {
    // If the window already exists, make sure it is visible and focused
    if let Some(win) = app.get_webview_window("settings") {
        win.show().map_err(|e| e.to_string())?;
        win.unminimize().map_err(|e| e.to_string())?;
        win.set_focus().map_err(|e| e.to_string())?;
        return Ok(());
    }

    // Create a new settings window
    use tauri::WebviewWindowBuilder;
    let _win = WebviewWindowBuilder::new(&app, "settings", tauri::WebviewUrl::App("/settings.html".into()))
        .title("Settings")
        .inner_size(800.0, 600.0)
        .min_inner_size(600.0, 400.0)
        .center()
        .resizable(true)
        .decorations(true)
        .visible(true)
        .build()
        .map_err(|e| e.to_string())?;

    Ok(())
}
