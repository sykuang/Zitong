//! macOS clipboard helpers — direct NSPasteboard access and CGEvent-based ⌘C simulation.

use objc2_app_kit::NSPasteboard;
use objc2_foundation::NSString;

// FFI binding for macOS Accessibility API
extern "C" {
    fn AXIsProcessTrustedWithOptions(options: *const std::ffi::c_void) -> bool;
}

/// Check if the app has Accessibility permissions.
/// If `prompt` is true, shows the macOS system dialog asking the user to grant access.
pub fn check_accessibility_permission(prompt: bool) -> bool {
    use core_foundation::base::TCFType;
    use core_foundation::boolean::CFBoolean;
    use core_foundation::dictionary::CFDictionary;
    use core_foundation::string::CFString;

    if prompt {
        let key = CFString::new("AXTrustedCheckOptionPrompt");
        let value = CFBoolean::true_value();
        let options = CFDictionary::from_CFType_pairs(&[(key, value)]);
        unsafe { AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef() as *const _) }
    } else {
        unsafe { AXIsProcessTrustedWithOptions(std::ptr::null()) }
    }
}

/// Tauri command to check accessibility permission from the frontend.
/// Returns true if granted, false if not (and optionally prompts the user).
#[tauri::command]
pub fn check_accessibility(prompt: bool) -> bool {
    check_accessibility_permission(prompt)
}

/// Read plain text directly from the system clipboard (NSPasteboard).
/// Bypasses the Tauri clipboard-manager plugin for reliability.
#[tauri::command]
pub fn read_clipboard_text() -> Result<String, String> {
    let pb = NSPasteboard::generalPasteboard();
    // NSPasteboardTypeString = "public.utf8-plain-text"
    let pasteboard_type = NSString::from_str("public.utf8-plain-text");
    match pb.stringForType(&pasteboard_type) {
        Some(s) => {
            let text = s.to_string();
            eprintln!("[clipboard] read_clipboard_text: {} chars", text.len());
            Ok(text)
        }
        None => {
            eprintln!("[clipboard] read_clipboard_text: no text in clipboard");
            Err("No text in clipboard".to_string())
        }
    }
}

/// Write plain text to the system clipboard (NSPasteboard).
#[tauri::command]
pub fn write_clipboard_text(text: String) -> Result<(), String> {
    let pb = NSPasteboard::generalPasteboard();
    pb.clearContents();
    let pasteboard_type = NSString::from_str("public.utf8-plain-text");
    let ns_string = NSString::from_str(&text);
    let ok = pb.setString_forType(&ns_string, &pasteboard_type);
    if ok {
        Ok(())
    } else {
        Err("Failed to write text to clipboard".to_string())
    }
}

/// Simulate ⌘C by sending a keystroke via AppleScript / System Events.
/// This copies the currently selected text in the **frontmost** app.
/// Requires Accessibility permission on macOS (for CGEvent posting).
/// Call this BEFORE showing the overlay panel, while the frontmost app still has focus.
/// Returns Ok(()) on success, or Err with a message on failure.
pub fn simulate_copy_sync() -> Result<(), String> {
    // Wait for user to release shortcut keys (Cmd+Shift+Space)
    // before we send our own ⌘C, to avoid modifier interference.
    std::thread::sleep(std::time::Duration::from_millis(80));

    // Snapshot clipboard before ⌘C to detect if copy actually worked
    let change_count_before = NSPasteboard::generalPasteboard().changeCount();

    // Use CGEvent to send ⌘C at the HID level.
    // This is more reliable than osascript because:
    // 1. It doesn't launch a subprocess (faster, no System Events dependency)
    // 2. CGEvent posts directly to the event stream — reaches the focused app
    // 3. We can explicitly set only the Command flag (no Shift bleed-through)
    use core_graphics::event::{CGEvent, CGEventFlags, CGEventTapLocation, CGKeyCode};
    use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};

    let source = CGEventSource::new(CGEventSourceStateID::HIDSystemState)
        .map_err(|_| "Failed to create CGEventSource")?;

    // Key code 8 = 'C' on macOS
    let key_c: CGKeyCode = 8;

    let key_down = CGEvent::new_keyboard_event(source.clone(), key_c, true)
        .map_err(|_| "Failed to create key down event")?;
    let key_up = CGEvent::new_keyboard_event(source, key_c, false)
        .map_err(|_| "Failed to create key up event")?;

    // Set ONLY Command flag — no Shift, no Option, no Control
    key_down.set_flags(CGEventFlags::CGEventFlagCommand);
    key_up.set_flags(CGEventFlags::CGEventFlagCommand);

    // Post to HID (reaches the frontmost application)
    key_down.post(CGEventTapLocation::HID);
    key_up.post(CGEventTapLocation::HID);

    // Give the target app time to process the copy
    std::thread::sleep(std::time::Duration::from_millis(200));

    // Check if clipboard actually changed
    let change_count_after = NSPasteboard::generalPasteboard().changeCount();
    eprintln!("[clipboard] ⌘C via CGEvent: changeCount {} -> {} (changed={})",
        change_count_before, change_count_after,
        change_count_after != change_count_before,
    );

    Ok(())
}

/// Tauri command wrapper (kept for potential future use from frontend)
#[tauri::command]
pub async fn simulate_copy() -> Result<(), String> {
    tokio::task::spawn_blocking(|| {
        simulate_copy_sync()
    })
    .await
    .map_err(|e| format!("spawn_blocking failed: {}", e))?
}

/// Combined permissions check — returns detailed status for the frontend.
#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionsStatus {
    pub accessibility_ok: bool,
    pub automation_ok: bool,
    pub can_copy: bool,
    pub details: Option<String>,
    pub is_bundled: bool,
    pub executable_path: String,
}

#[tauri::command]
pub fn check_permissions() -> PermissionsStatus {
    let exe_path = std::env::current_exe()
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_default();
    let is_bundled = exe_path.contains(".app/Contents/MacOS/");

    // Check Accessibility
    let accessibility_ok = check_accessibility_permission(false);
    eprintln!("[permissions] accessibility_ok: {}", accessibility_ok);

    // Check Automation (System Events) by running a harmless osascript
    let automation = std::process::Command::new("osascript")
        .args([
            "-e",
            "tell application \"System Events\" to get name of first application process whose frontmost is true",
        ])
        .output();

    let (automation_ok, details) = match automation {
        Ok(out) if out.status.success() => (true, None),
        Ok(out) => {
            let msg = String::from_utf8_lossy(&out.stderr).trim().to_string();
            (false, Some(if msg.is_empty() { "Automation check failed".to_string() } else { msg }))
        }
        Err(e) => (false, Some(format!("Automation check failed: {e}"))),
    };
    eprintln!("[permissions] automation_ok: {}, is_bundled: {}", automation_ok, is_bundled);

    let can_copy = accessibility_ok && automation_ok;
    let final_details = if !accessibility_ok && !automation_ok {
        Some("Both Accessibility and Automation permissions are required.".to_string())
    } else if !accessibility_ok {
        Some("Accessibility permission is required.".to_string())
    } else if !automation_ok {
        details
    } else {
        None
    };

    PermissionsStatus {
        accessibility_ok,
        automation_ok,
        can_copy,
        details: final_details,
        is_bundled,
        executable_path: exe_path,
    }
}

/// Trigger macOS permission prompts so the app appears in System Settings.
/// - Accessibility: calls AXIsProcessTrustedWithOptions(prompt: true) which
///   adds the app to the Accessibility list and shows the system dialog.
/// - Automation: runs a harmless osascript to trigger the "allow to control
///   System Events" dialog.
#[tauri::command]
pub fn request_permissions() {
    eprintln!("[permissions] triggering Accessibility prompt...");
    // This adds the app to the Accessibility list with a prompt dialog
    let _ = check_accessibility_permission(true);

    eprintln!("[permissions] triggering Automation (System Events) prompt...");
    // This triggers the "Zitong wants to control System Events" dialog
    let _ = std::process::Command::new("osascript")
        .args([
            "-e",
            "tell application \"System Events\" to get name of first application process whose frontmost is true",
        ])
        .output();
}

/// Open macOS System Settings to the Accessibility pane.
#[tauri::command]
pub fn open_accessibility_settings() -> Result<(), String> {
    std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .spawn()
        .map_err(|e| format!("Failed to open System Settings: {}", e))?;
    Ok(())
}

/// Open macOS System Settings to the Automation pane.
#[tauri::command]
pub fn open_automation_settings() -> Result<(), String> {
    std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Automation")
        .spawn()
        .map_err(|e| format!("Failed to open System Settings: {}", e))?;
    Ok(())
}

/// Relaunch the app by spawning a new instance and exiting the current one.
#[tauri::command]
pub fn relaunch_app(app: tauri::AppHandle) -> Result<(), String> {
    // Get the path to the current executable's bundle
    let exe = std::env::current_exe().map_err(|e| format!("Failed to get exe path: {}", e))?;
    // Walk up to find the .app bundle (exe is at Zitong.app/Contents/MacOS/zitong)
    let app_bundle = exe
        .parent() // MacOS/
        .and_then(|p| p.parent()) // Contents/
        .and_then(|p| p.parent()); // Zitong.app/

    if let Some(bundle) = app_bundle {
        if bundle.extension().map_or(false, |ext| ext == "app") {
            // Use 'open -n' to launch a new instance of the bundle
            let _ = std::process::Command::new("open")
                .arg("-n")
                .arg(bundle)
                .spawn();
        } else {
            // Dev mode: just relaunch the binary directly
            let _ = std::process::Command::new(&exe).spawn();
        }
    } else {
        let _ = std::process::Command::new(&exe).spawn();
    }

    // Exit current instance
    app.exit(0);
    Ok(())
}
