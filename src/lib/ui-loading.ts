"use client";

/**
 * Global UI loading store — overlay'i kontrol eder.
 *
 * Sayaç-tabanlı: birden fazla async iş aynı anda çalışıyorsa hepsi bitene kadar
 * overlay açık kalır. `start()` çağıran her tüketici `stop()` ile dengelemeli.
 *
 * Race-safe için: aynı `id` ile birden fazla start çağırılırsa sayaç birikir;
 * id'siz çağrılar anonim olarak sayılır.
 *
 * Tipik kullanım:
 *   const start = useUiLoading((s) => s.start);
 *   const stop  = useUiLoading((s) => s.stop);
 *   await pdf(); // start("pdf-export", "PDF hazırlanıyor")
 *
 * Veya kolay helper:
 *   const overlay = useLoadingOverlay();
 *   await overlay.run(async () => { ... }, "PDF hazırlanıyor");
 */

import { create } from "zustand";

interface UiLoadingState {
  /** Aktif loading iş sayısı; >0 ise overlay görünür. */
  count: number;
  /** Görünür mesaj — son ayarlananı kazanır. */
  label: string | null;
  start: (label?: string) => void;
  stop: () => void;
  /** Tüm sayacı zorla sıfırla (timeout safety için). */
  reset: () => void;
}

export const useUiLoading = create<UiLoadingState>((set) => ({
  count: 0,
  label: null,
  start: (label) =>
    set((s) => ({
      count: s.count + 1,
      label: label ?? s.label ?? null,
    })),
  stop: () =>
    set((s) => {
      const next = Math.max(0, s.count - 1);
      return {
        count: next,
        label: next === 0 ? null : s.label,
      };
    }),
  reset: () => set({ count: 0, label: null }),
}));

/**
 * Promise-tabanlı kolay yardımcı. `run()` async işi sarar, başında start,
 * bitiminde (hata olsa bile) stop çağırır.
 *
 * Bu hook değil — herhangi bir yerden (server action callback, button onClick)
 * import edilip çağrılabilir.
 */
export const loadingOverlay = {
  start(label?: string) {
    useUiLoading.getState().start(label);
  },
  stop() {
    useUiLoading.getState().stop();
  },
  async run<T>(fn: () => Promise<T>, label?: string): Promise<T> {
    useUiLoading.getState().start(label);
    try {
      return await fn();
    } finally {
      useUiLoading.getState().stop();
    }
  },
};
