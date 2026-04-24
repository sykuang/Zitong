// User-facing update flow.
//
// The Rust side does the *check* and reports availability. Download +
// signature verification + install is handled here through the JS plugin
// so we can drive UI (confirm dialog, progress, errors) without bouncing
// state back to Rust.

import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask, message } from "@tauri-apps/plugin-dialog";
import type { UpdateInfo } from "@/commands";

export interface DownloadProgress {
  downloaded: number;
  total: number | null;
}

/**
 * Prompt the user to install an available update, then download + install
 * + relaunch on confirmation. Safe to call multiple times — `check()` is
 * idempotent and the dialog blocks until the user responds.
 */
export async function promptAndInstall(
  info: UpdateInfo,
  onProgress?: (p: DownloadProgress) => void
): Promise<void> {
  if (!info.available || !info.new_version) return;

  const confirmed = await ask(
    `Zitong ${info.new_version} is available (you have ${info.current_version}).\n\nInstall now? The app will restart.`,
    {
      title: "Update available",
      kind: "info",
      okLabel: "Install & restart",
      cancelLabel: "Later",
    }
  );
  if (!confirmed) return;

  // Re-fetch the Update handle from the plugin — Rust already validated
  // availability, but the install API lives on the JS side.
  const update = await check();
  if (!update) {
    await message("Update is no longer available.", {
      title: "Update",
      kind: "warning",
    });
    return;
  }

  let downloaded = 0;
  let total: number | null = null;

  try {
    await update.downloadAndInstall((event) => {
      switch (event.event) {
        case "Started":
          total = event.data.contentLength ?? null;
          downloaded = 0;
          onProgress?.({ downloaded, total });
          break;
        case "Progress":
          downloaded += event.data.chunkLength;
          onProgress?.({ downloaded, total });
          break;
        case "Finished":
          onProgress?.({ downloaded: total ?? downloaded, total });
          break;
      }
    });
    await relaunch();
  } catch (err) {
    await message(
      `Update failed: ${err instanceof Error ? err.message : String(err)}`,
      { title: "Update failed", kind: "error" }
    );
  }
}
