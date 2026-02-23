import { lazy, Suspense, useEffect, useState, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { AppProvider, useApp } from "@/context/AppContext";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { PermissionGuide } from "@/components/PermissionGuide";
import type { PermissionsStatus } from "@/types";

const PERMISSION_GUIDE_DISMISSED_KEY = "zitong_permission_guide_dismissed";

const DevAudit = import.meta.env.DEV ? lazy(() => import("@/components/DevAudit")) : null;

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { settings } = useApp();

  useEffect(() => {
    const root = document.documentElement;
    if (settings?.theme === "dark") {
      root.classList.add("dark");
    } else if (settings?.theme === "light") {
      root.classList.remove("dark");
    } else {
      // system
      const mq = window.matchMedia("(prefers-color-scheme: dark)");
      const update = () => {
        if (mq.matches) root.classList.add("dark");
        else root.classList.remove("dark");
      };
      update();
      mq.addEventListener("change", update);
      return () => mq.removeEventListener("change", update);
    }
  }, [settings?.theme]);

  return <>{children}</>;
}

function AppShell() {
  const [showPermissionGuide, setShowPermissionGuide] = useState(false);

  useEffect(() => {
    // Only show the guide if it hasn't been dismissed before
    const dismissed = localStorage.getItem(PERMISSION_GUIDE_DISMISSED_KEY);
    if (dismissed) return;

    // Check if any permission is missing
    invoke<PermissionsStatus>("check_permissions")
      .then((status) => {
        if (!status.canCopy) setShowPermissionGuide(true);
      })
      .catch(() => {}); // If check fails, don't show the guide
  }, []);

  // Listen for "show-permission-guide" event from backend
  // (fired when user tries overlay shortcut but permissions are missing)
  useEffect(() => {
    const unlisten = listen("show-permission-guide", () => {
      setShowPermissionGuide(true);
    });
    return () => { unlisten.then((fn) => fn()); };
  }, []);

  const handlePermissionDone = useCallback(() => {
    localStorage.setItem(PERMISSION_GUIDE_DISMISSED_KEY, "true");
    setShowPermissionGuide(false);
  }, []);

  // Show permission guide (first launch, or when triggered by overlay shortcut)
  if (showPermissionGuide) {
    return (
      <ThemeProvider>
        <PermissionGuide onDone={handlePermissionDone} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div className="relative flex h-screen w-screen overflow-hidden">
        {/* Decorative orbs */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        {/* Main layout */}
        <Sidebar />
        <ChatArea />
        {DevAudit && (
          <Suspense fallback={null}>
            <DevAudit />
          </Suspense>
        )}
      </div>
    </ThemeProvider>
  );
}

function App() {
  return (
    <AppProvider>
      <AppShell />
    </AppProvider>
  );
}

export default App;
