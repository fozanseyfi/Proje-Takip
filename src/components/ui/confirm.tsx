"use client";

/**
 * Custom Confirm Dialog — window.confirm() yerine markaya uygun modal.
 *
 * Kullanım:
 *   import { confirmAction } from "@/components/ui/confirm";
 *
 *   if (await confirmAction({
 *     title: "Silme onayı",
 *     message: "Bu kayıt kalıcı olarak silinecek.",
 *     confirmText: "Sil",
 *     danger: true,
 *   })) {
 *     // ok
 *   }
 *
 * Zustand-based; her yerden import edilebilir, hook gerektirmez.
 * Root komponenti AppShell'e bir kere mount edilir (Toaster gibi).
 */

import { create } from "zustand";
import { AlertTriangle, Info, HelpCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ConfirmVariant = "info" | "warning" | "danger";

interface ConfirmOptions {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  /** danger = kırmızı buton (silme/yıkıcı işlemler için). */
  danger?: boolean;
  variant?: ConfirmVariant;
}

interface ConfirmState {
  open: boolean;
  opts: ConfirmOptions | null;
  resolver: ((ok: boolean) => void) | null;
  show: (opts: ConfirmOptions) => Promise<boolean>;
  resolve: (ok: boolean) => void;
}

const useConfirmStore = create<ConfirmState>((set, get) => ({
  open: false,
  opts: null,
  resolver: null,
  show: (opts) =>
    new Promise<boolean>((resolve) => {
      set({ open: true, opts, resolver: resolve });
    }),
  resolve: (ok) => {
    const r = get().resolver;
    set({ open: false, opts: null, resolver: null });
    if (r) r(ok);
  },
}));

/**
 * Async confirm — Promise<boolean> döner.
 * `await confirmAction({ title, message })` → kullanıcı Onayla → true, İptal → false.
 */
export function confirmAction(opts: ConfirmOptions): Promise<boolean> {
  return useConfirmStore.getState().show(opts);
}

/**
 * Modal komponenti — AppShell'e bir kere mount edilir.
 */
export function ConfirmRoot() {
  const open = useConfirmStore((s) => s.open);
  const opts = useConfirmStore((s) => s.opts);
  const resolve = useConfirmStore((s) => s.resolve);

  if (!open || !opts) return null;

  const variant: ConfirmVariant = opts.danger ? "danger" : (opts.variant ?? "warning");
  const palette = {
    info: { ring: "ring-blue/30", iconBg: "bg-blue/15 text-blue", confirmBtn: "bg-blue hover:bg-blue/90" },
    warning: { ring: "ring-yellow/40", iconBg: "bg-yellow/15 text-yellow-dark", confirmBtn: "bg-accent hover:bg-accent2" },
    danger: { ring: "ring-red/40", iconBg: "bg-red/15 text-red", confirmBtn: "bg-red hover:bg-red/90" },
  }[variant];
  const Icon = variant === "info" ? Info : variant === "danger" ? AlertTriangle : HelpCircle;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={() => resolve(false)}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={cn(
          "bg-white rounded-2xl shadow-large max-w-md w-full overflow-hidden ring-1",
          palette.ring
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start gap-3 px-5 py-4 border-b border-border">
          <span className={cn("inline-flex items-center justify-center w-10 h-10 rounded-xl shrink-0", palette.iconBg)}>
            <Icon size={20} />
          </span>
          <div className="flex-1 min-w-0">
            <h3 className="font-display font-extrabold text-base text-text tracking-tight">
              {opts.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={() => resolve(false)}
            className="text-text3 hover:text-text2 -mr-1 -mt-1 p-1"
            aria-label="Kapat"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 text-sm text-text2 leading-relaxed whitespace-pre-line">
          {opts.message}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 bg-bg2/40 border-t border-border">
          <button
            type="button"
            onClick={() => resolve(false)}
            className="px-4 h-9 rounded-md text-sm font-bold text-text2 hover:text-text hover:bg-bg3 transition-colors"
          >
            {opts.cancelText ?? "İptal"}
          </button>
          <button
            type="button"
            onClick={() => resolve(true)}
            autoFocus
            className={cn(
              "px-4 h-9 rounded-md text-sm font-bold text-white shadow-soft transition-colors",
              palette.confirmBtn
            )}
          >
            {opts.confirmText ?? "Onayla"}
          </button>
        </div>
      </div>
    </div>
  );
}
