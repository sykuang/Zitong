//! macOS NSPanel support for the overlay command palette.
//!
//! Converts the Tauri "overlay" webview window into an NSPanel so it can
//! appear above fullscreen apps, Spaces, and the Dock.

use std::sync::Arc;
use tauri::{Emitter, Manager};
use tauri_nspanel::{
    tauri_panel, CollectionBehavior, ManagerExt as NspanelManagerExt, PanelLevel, StyleMask,
    WebviewWindowExt as NspanelWebviewWindowExt, Panel,
};

// Define our custom NSPanel subclass
tauri_panel! {
    panel!(ZitongPanel {
        config: {
            can_become_key_window: true,
            can_become_main_window: false,
            is_floating_panel: true
        }
    })

    panel_event!(ZitongPanelEventHandler {
        window_did_become_key(notification: &NSNotification) -> (),
        window_did_resign_key(notification: &NSNotification) -> ()
    })
}

fn configure_panel<R: tauri::Runtime>(panel: &Arc<dyn Panel<R>>) {
    // ScreenSaver level = highest, shows above everything including fullscreen
    panel.set_level(PanelLevel::ScreenSaver.value());

    // Don't hide when the app deactivates
    panel.set_hides_on_deactivate(false);

    // Work even when a modal dialog is open
    panel.set_works_when_modal(true);

    // NonactivatingPanel: doesn't steal focus from the previous app
    panel.set_style_mask(
        StyleMask::empty()
            .nonactivating_panel()
            .resizable()
            .into(),
    );

    // Collection behavior: show on all Spaces including fullscreen
    panel.set_collection_behavior(
        CollectionBehavior::new()
            .full_screen_auxiliary()
            .can_join_all_spaces()
            .into(),
    );
}

/// Convert the "overlay" webview window into an NSPanel with the right
/// collection behavior to appear above fullscreen apps.
pub fn setup_overlay_panel(handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let Some(window) = handle.get_webview_window("overlay") else {
        return Err("overlay window not found".into());
    };

    // Convert to our custom panel type
    let panel = window
        .to_panel::<ZitongPanel>()
        .map_err(|e| format!("failed to convert to panel: {e}"))?;

    configure_panel(&panel);

    Ok(())
}

/// Hide the overlay panel.
pub fn hide_overlay_panel(handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let panel = handle
        .get_webview_panel("overlay")
        .map_err(|e| format!("overlay panel not found: {:?}", e))?;

    if panel.is_visible() {
        panel.hide();
    }
    Ok(())
}

/// Toggle the overlay panel visibility.
/// When showing, first checks permissions — if missing, shows the main window
/// with a permission guide instead of the overlay (to avoid covering system dialogs).
/// If permissions are OK, simulates ⌘C to copy selected text from the frontmost app
/// (while it still has focus), then shows the panel.
pub fn toggle_overlay_panel(handle: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let panel = handle
        .get_webview_panel("overlay")
        .map_err(|e| format!("overlay panel not found: {:?}", e))?;

    if panel.is_visible() {
        panel.hide();
    } else {
        // Quick permission check — only use the instant AXIsProcessTrusted API.
        // DO NOT run osascript here: it blocks the main thread and can interfere
        // with app focus, causing ⌘C to be sent to the wrong app.
        let has_accessibility = crate::clipboard::check_accessibility_permission(false);
        if !has_accessibility {
            eprintln!("[panel] accessibility missing, showing permission guide");
            // Emit event to main window so frontend can show permission guide
            let _ = handle.emit("show-permission-guide", ());
            // Show and focus the main window
            if let Some(win) = handle.get_webview_window("main") {
                // Restore Dock icon
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
            return Ok(());
        }

        // Simulate ⌘C BEFORE showing the panel via CGEvent.
        // The frontmost app still has keyboard focus at this point,
        // so the keystroke reaches it and copies the selected text.
        if let Err(e) = crate::clipboard::simulate_copy_sync() {
            eprintln!("[panel] simulate_copy_sync failed: {}", e);
            // Still show the panel — the frontend will display an appropriate error
        }

        // Re-apply level + behavior in case they were reset
        configure_panel(&panel);

        panel.show();
        panel.make_key_window();
    }

    Ok(())
}
