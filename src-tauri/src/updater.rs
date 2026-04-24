// Tauri updater commands.
//
// Two entry points:
//   - check_for_updates_manual: always pings the endpoint; returns status
//     payload to the UI so the user sees a result.
//   - check_for_updates_silent: rate-limited (in-process + persisted via the
//     `settings` table) so we don't hammer GitHub on every launch. Used by
//     the post-startup background task. Returns Ok(None) when skipped.
//
// Actual downloading + signature verification + install is delegated to
// the JS side via the `@tauri-apps/plugin-updater` plugin so the user can
// see progress in the existing toast/notification UI before committing.

use crate::db::Database;
use serde::Serialize;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::OnceLock;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Manager};
use tauri_plugin_updater::UpdaterExt;

const LAST_CHECK_KEY: &str = "updater_last_check_unix";
// Don't auto-check more often than once every 6 hours.
const SILENT_CHECK_INTERVAL_SECS: u64 = 6 * 60 * 60;

static SILENT_CHECK_DONE: OnceLock<AtomicBool> = OnceLock::new();

#[derive(Serialize, Clone)]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub new_version: Option<String>,
    pub notes: Option<String>,
    pub date: Option<String>,
}

fn now_unix() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

async fn do_check(app: &AppHandle) -> Result<UpdateInfo, String> {
    let current_version = app.package_info().version.to_string();

    let updater = app
        .updater()
        .map_err(|e| format!("updater unavailable: {e}"))?;

    match updater.check().await {
        Ok(Some(update)) => Ok(UpdateInfo {
            available: true,
            current_version,
            new_version: Some(update.version.clone()),
            notes: update.body.clone(),
            date: update.date.map(|d| d.to_string()),
        }),
        Ok(None) => Ok(UpdateInfo {
            available: false,
            current_version,
            new_version: None,
            notes: None,
            date: None,
        }),
        Err(e) => Err(format!("update check failed: {e}")),
    }
}

#[tauri::command]
pub async fn check_for_updates_manual(app: AppHandle) -> Result<UpdateInfo, String> {
    let info = do_check(&app).await?;
    // Record the check so the silent path defers next time.
    if let Some(db) = app.try_state::<Database>() {
        let _ = db.set_setting_raw(LAST_CHECK_KEY, &now_unix().to_string());
    }
    Ok(info)
}

#[tauri::command]
pub async fn check_for_updates_silent(app: AppHandle) -> Result<Option<UpdateInfo>, String> {
    // Once per process, regardless of timing — guarantees we don't double-check
    // if the front-end ever invokes this directly.
    let done = SILENT_CHECK_DONE.get_or_init(|| AtomicBool::new(false));
    if done.swap(true, Ordering::SeqCst) {
        return Ok(None);
    }

    if let Some(db) = app.try_state::<Database>() {
        if let Ok(Some(last)) = db.get_setting_raw(LAST_CHECK_KEY) {
            if let Ok(last_unix) = last.parse::<u64>() {
                if now_unix().saturating_sub(last_unix) < SILENT_CHECK_INTERVAL_SECS {
                    return Ok(None);
                }
            }
        }
    }

    let info = do_check(&app).await?;
    if let Some(db) = app.try_state::<Database>() {
        let _ = db.set_setting_raw(LAST_CHECK_KEY, &now_unix().to_string());
    }
    Ok(Some(info))
}

#[tauri::command]
pub async fn get_last_update_check(app: AppHandle) -> Result<Option<u64>, String> {
    let db = app
        .try_state::<Database>()
        .ok_or_else(|| "database not ready".to_string())?;
    match db.get_setting_raw(LAST_CHECK_KEY).map_err(|e| e.to_string())? {
        Some(s) => Ok(s.parse().ok()),
        None => Ok(None),
    }
}
