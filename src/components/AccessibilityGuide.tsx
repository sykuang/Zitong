import { useState, useEffect, useCallback } from "react";
import { Shield, ExternalLink, CheckCircle, RefreshCw, RotateCcw } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

interface AccessibilityGuideProps {
  onGranted: () => void;
}

export function AccessibilityGuide({ onGranted }: AccessibilityGuideProps) {
  const [checking, setChecking] = useState(false);
  const [granted, setGranted] = useState(false);

  const checkPermission = useCallback(async () => {
    setChecking(true);
    try {
      const hasAccess = await invoke<boolean>("check_accessibility", {
        prompt: false,
      });
      if (hasAccess) {
        setGranted(true);
        // Brief delay so user sees the success state
        setTimeout(() => onGranted(), 800);
      }
    } catch (err) {
      console.error("Failed to check accessibility:", err);
    } finally {
      setChecking(false);
    }
  }, [onGranted]);

  // Poll every 2 seconds to auto-detect when user grants permission
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const hasAccess = await invoke<boolean>("check_accessibility", {
          prompt: false,
        });
        if (hasAccess) {
          setGranted(true);
          clearInterval(interval);
          setTimeout(() => onGranted(), 800);
        }
      } catch {
        // ignore
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [onGranted]);

  const openAccessibilitySettings = async () => {
    try {
      await invoke("open_accessibility_settings");
    } catch (err) {
      console.error("Failed to open System Settings:", err);
    }
  };

  return (
    <div className="flex items-center justify-center h-screen w-screen bg-bg-primary">
      <div className="max-w-md w-full mx-4">
        <div className="text-center space-y-6">
          {/* Icon */}
          <div className="flex justify-center">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors duration-300 ${
                granted
                  ? "bg-green-500/15 text-green-500"
                  : "bg-primary/15 text-primary"
              }`}
            >
              {granted ? (
                <CheckCircle className="w-8 h-8" />
              ) : (
                <Shield className="w-8 h-8" />
              )}
            </div>
          </div>

          {/* Title & Description */}
          <div className="space-y-2">
            <h1 className="text-xl font-semibold text-text-primary">
              {granted ? "Permission Granted" : "Accessibility Permission"}
            </h1>
            <p className="text-sm text-text-secondary leading-relaxed">
              {granted
                ? "Zitong now has accessibility access. You're all set!"
                : "Zitong needs Accessibility permission to copy selected text from other apps when you use the Command Palette."}
            </p>
          </div>

          {/* Steps */}
          {!granted && (
            <div className="bg-bg-secondary/50 rounded-xl p-4 text-left space-y-3">
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-medium flex items-center justify-center mt-0.5">
                  1
                </span>
                <p className="text-sm text-text-secondary">
                  Click{" "}
                  <span className="text-text-primary font-medium">
                    Open System Settings
                  </span>{" "}
                  below
                </p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-medium flex items-center justify-center mt-0.5">
                  2
                </span>
                <p className="text-sm text-text-secondary">
                  Find{" "}
                  <span className="text-text-primary font-medium">Zitong</span>{" "}
                  in the list and toggle it{" "}
                  <span className="text-text-primary font-medium">on</span>
                </p>
              </div>
              <div className="flex gap-3">
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-primary/15 text-primary text-xs font-medium flex items-center justify-center mt-0.5">
                  3
                </span>
                <p className="text-sm text-text-secondary">
                  Come back here — it will be detected automatically
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          {!granted && (
            <div className="flex flex-col gap-2">
              <button
                onClick={openAccessibilitySettings}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary-hover transition-colors cursor-pointer"
              >
                Open System Settings
                <ExternalLink className="w-4 h-4" />
              </button>
              <button
                onClick={checkPermission}
                disabled={checking}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer disabled:opacity-50"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${checking ? "animate-spin" : ""}`}
                />
                Check again
              </button>
              <button
                onClick={() => invoke("relaunch_app")}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Restart Zitong
              </button>
              <button
                onClick={onGranted}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-xs text-text-secondary/60 hover:text-text-secondary transition-colors cursor-pointer"
              >
                Skip for now
              </button>
              <p className="text-xs text-text-secondary/50">
                If permission was just granted, restart the app for it to take effect.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
