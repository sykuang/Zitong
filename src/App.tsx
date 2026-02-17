import { lazy, Suspense, useEffect } from "react";
import { AppProvider, useApp } from "@/context/AppContext";
import { Sidebar } from "@/components/Sidebar";
import { ChatArea } from "@/components/ChatArea";
import { SettingsPanel } from "@/components/settings/SettingsPanel";

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
  return (
    <ThemeProvider>
      <div className="relative flex h-screen w-screen overflow-hidden">
        {/* Decorative orbs */}
        <div className="orb orb-1" />
        <div className="orb orb-2" />

        {/* Main layout */}
        <Sidebar />
        <ChatArea />
        <SettingsPanel />
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
