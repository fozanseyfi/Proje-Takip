"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Header } from "./header";
import { Sidebar, MobileDrawer } from "./sidebar";
import { BottomNav } from "./bottom-nav";
import { SeedProvider } from "./seed-provider";
import { AppFooter } from "./app-footer";
import { DemoProjectBanner } from "./demo-project-banner";
import { SandboxWelcome } from "./sandbox-welcome";
import { PageLoaderOverlay, NavigationLoader } from "./page-loader";
import { Toaster } from "@/components/ui/toast";
import { isSandboxMode } from "@/lib/sandbox";
import { cn } from "@/lib/utils";

// Bu rotalarda içerik tam genişlikte gösterilir — max-w sınırı uygulanmaz.
const FULL_WIDTH_ROUTES = ["/planning", "/timeline"];

const SIDEBAR_KEY = "ges-sidebar-collapsed";

export function AppShell({ children }: { children: React.ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const sandbox = isSandboxMode();
  const pathname = usePathname();
  const isFullWidth = FULL_WIDTH_ROUTES.some((r) => pathname?.startsWith(r));

  // localStorage'dan ilk yükle
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(SIDEBAR_KEY);
      if (stored === "1") setCollapsed(true);
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined") {
        localStorage.setItem(SIDEBAR_KEY, next ? "1" : "0");
      }
      return next;
    });
  }

  return (
    <SeedProvider>
      <div className="min-h-screen flex bg-bg-soft">
        <Sidebar collapsed={collapsed} onToggleCollapsed={toggleCollapsed} />
        <div className="flex-1 min-w-0 flex flex-col">
          <Header onMenuClick={() => setDrawerOpen(true)} />
          <DemoProjectBanner />
          <main className="flex-1 min-w-0 pb-20 md:pb-0">
            <div className={cn(
              "px-4 sm:px-6 lg:px-8 py-6 animate-fade-in",
              isFullWidth ? "w-full" : "max-w-[1600px] mx-auto"
            )}>
              {sandbox ? <SandboxWelcome>{children}</SandboxWelcome> : children}
            </div>
          </main>
          <AppFooter />
        </div>
        <BottomNav onMenuClick={() => setDrawerOpen(true)} />
        <MobileDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </div>
      <NavigationLoader />
      <PageLoaderOverlay />
      <Toaster />
    </SeedProvider>
  );
}
