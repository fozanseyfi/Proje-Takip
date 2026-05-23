"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { isSandboxMode } from "@/lib/sandbox";

/**
 * Zustand persist client-side hydrate olur. İlk yükte boşsa seed ekle.
 * Hydration tamamlanana kadar children'ı render etme — flicker'ı önler.
 *
 * Sandbox modunda seed YOKTUR — kullanıcı kendi yedeğini Veri Yedeği ile yükler.
 */
export function SeedProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const sandbox = isSandboxMode();

    const unsub = useStore.persist.onFinishHydration(() => {
      if (!sandbox) useStore.getState().seedIfEmpty();
      setHydrated(true);
    });

    if (useStore.persist.hasHydrated()) {
      if (!sandbox) useStore.getState().seedIfEmpty();
      setHydrated(true);
    }

    return () => unsub();
    // Dependency array boş — bu effect sadece mount'ta çalışır
     
  }, []);

  if (!hydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-text3 text-sm font-mono tracking-wider animate-pulse">
          YÜKLENİYOR...
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
