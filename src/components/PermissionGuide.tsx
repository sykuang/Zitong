import { useState, useEffect, useCallback } from "react";
import { Shield, CheckCircle, RefreshCw, Check, X } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";
import type { PermissionsStatus } from "@/types";

interface PermissionGuideProps {
  onDone: () => void;
}

export function PermissionGuide({ onDone }: PermissionGuideProps) {
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<PermissionsStatus | null>(null);

  const recheck = useCallback(async () => {
    setChecking(true);
    try {
      const res = await invoke<PermissionsStatus>("check_permissions");
      setStatus(res);
      if (res.canCopy) {
        // All permissions granted — auto-dismiss after brief success display
        setTimeout(() => onDone(), 1000);
      }
    } catch (err) {
      console.error("Failed to check permissions:", err);
    } finally {
      setChecking(false);
    }
  }, [onDone]);

  // Initial check + trigger prompts on mount
  useEffect(() => {
    // Trigger the macOS permission prompts so the app appears in System Settings
    invoke("request_permissions").catch(() => {});
    void recheck();
  }, [recheck]);

  // Poll every 3 seconds to auto-detect when user grants permissions
  useEffect(() => {
    const interval = setInterval(() => void recheck(), 3000);
    return () => clearInterval(interval);
  }, [recheck]);

  const allGood = status?.canCopy ?? false;

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-bg-primary">
      <div className="max-w-md w-full mx-4">
        <div className="text-center space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                allGood
                  ? "bg-green-500/15 text-green-500"
                  : "bg-primary/15 text-primary"
              }`}
            >
              {allGood ? (
                <CheckCircle className="w-8 h-8" />
              ) : (
                <Shield className="w-8 h-8" />
              )}
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-text-primary">
              {allGood ? "All Set!" : "Finish Setup"}
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              {allGood
                ? "Zitong has all the permissions it needs. You're ready to go!"
                : "Zitong needs two macOS permissions to copy selected text from other apps when you use the Command Palette."}
            </p>
          </div>

          {/* Permission status */}
          {status && !allGood && (
            <div className="bg-bg-secondary/50 rounded-xl p-4 text-left space-y-3">
              {/* Accessibility status */}
              <div className="flex items-center gap-3">
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                    status.accessibilityOk
                      ? "bg-green-500/15 text-green-500"
                      : "bg-red-500/15 text-red-500"
                  }`}
                >
                  {status.accessibilityOk ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-primary font-medium">
                    Accessibility
                  </p>
                  <p className="text-xs text-text-secondary">
                    {status.accessibilityOk
                      ? "Granted"
                      : "Required to send keystrokes"}
                  </p>
                </div>
              </div>

              {/* Automation status */}
              <div className="flex items-center gap-3">
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                    status.automationOk
                      ? "bg-green-500/15 text-green-500"
                      : "bg-red-500/15 text-red-500"
                  }`}
                >
                  {status.automationOk ? (
                    <Check className="w-3 h-3" />
                  ) : (
                    <X className="w-3 h-3" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-text-primary font-medium">
                    Automation (System Events)
                  </p>
                  <p className="text-xs text-text-secondary">
                    {status.automationOk
                      ? "Granted"
                      : "Required to simulate ⌘C"}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Instructions */}
          {status && !allGood && (
            <div className="bg-bg-secondary/50 rounded-xl p-4 text-left space-y-3">
              {!status.isBundled ? (
                <>
                  <p className="text-xs text-amber-500 font-medium">
                    ⚠ Running in development mode
                  </p>
                  <p className="text-xs text-text-secondary">
                    You need to add the debug binary to permissions. Click +, press Cmd+Shift+G, paste the path:
                  </p>
                  <p className="text-xs text-text-secondary font-mono break-all bg-bg-primary/50 rounded-lg p-2">
                    {status.executablePath}
                  </p>
                </>
              ) : (
                <>
                  {!status.accessibilityOk && (
                    <div className="flex gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-medium flex items-center justify-center mt-0.5">
                        1
                      </span>
                      <p className="text-sm text-text-secondary">
                        Open{" "}
                        <span className="text-text-primary font-medium">
                          Accessibility
                        </span>{" "}
                        settings, find{" "}
                        <span className="text-text-primary font-medium">
                          Zitong
                        </span>
                        , and toggle it on
                      </p>
                    </div>
                  )}
                  {!status.automationOk && (
                    <div className="flex gap-3">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-medium flex items-center justify-center mt-0.5">
                        {status.accessibilityOk ? "1" : "2"}
                      </span>
                      <p className="text-sm text-text-secondary">
                        Open{" "}
                        <span className="text-text-primary font-medium">
                          Automation
                        </span>{" "}
                        settings, find{" "}
                        <span className="text-text-primary font-medium">
                          Zitong
                        </span>
                        , and enable{" "}
                        <span className="text-text-primary font-medium">
                          System Events
                        </span>
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Action buttons */}
          {!allGood && (
            <div className="flex flex-col gap-2">
              {/* Open settings buttons */}
              <div className="flex gap-2">
                {!status?.accessibilityOk && (
                  <button
                    onClick={() => invoke("open_accessibility_settings")}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors cursor-pointer"
                  >
                    Open Accessibility
                  </button>
                )}
                {!status?.automationOk && (
                  <button
                    onClick={() => invoke("open_automation_settings")}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors cursor-pointer"
                  >
                    Open Automation
                  </button>
                )}
              </div>

              {/* Re-trigger permission prompts */}
              <button
                onClick={async () => {
                  await invoke("request_permissions").catch(() => {});
                  void recheck();
                }}
                disabled={checking}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`}
                />
                Request permissions again
              </button>

              {/* Skip */}
              <button
                onClick={onDone}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs text-text-secondary/60 hover:text-text-secondary transition-colors cursor-pointer"
              >
                Skip for now
              </button>

              <p className="text-xs text-text-secondary/50">
                Permissions are detected automatically — no restart needed.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
