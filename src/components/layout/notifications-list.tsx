"use client";

import Link from "next/link";
import {
  Bell,
  Check,
  CheckCheck,
  Share2,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  RefreshCw,
} from "lucide-react";
import { useStore, useMyNotifications } from "@/lib/store";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const TYPE_STYLES: Record<string, { icon: React.ComponentType<{ className?: string }>; bg: string; text: string; label: string }> = {
  share:         { icon: Share2,        bg: "bg-purple/15", text: "text-purple", label: "Paylaşım" },
  decision:      { icon: CheckCircle2,  bg: "bg-accent/15", text: "text-accent", label: "Karar" },
  status_change: { icon: RefreshCw,     bg: "bg-blue/15",   text: "text-blue",   label: "Durum" },
  comment:       { icon: MessageSquare, bg: "bg-yellow/15", text: "text-yellow", label: "Yorum" },
  alert:         { icon: AlertCircle,   bg: "bg-red/15",    text: "text-red",    label: "Uyarı" },
};

function getStyle(type: string) {
  return TYPE_STYLES[type] ?? { icon: Bell, bg: "bg-bg2", text: "text-text2", label: type };
}

function formatTr(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationsList() {
  const items = useMyNotifications();
  const markRead = useStore((s) => s.markNotificationRead);
  const markAllRead = useStore((s) => s.markAllNotificationsRead);
  const toast = useToast((s) => s.push);

  const unread = items.filter((n) => !n.readAt);

  function handleMarkAll() {
    if (unread.length === 0) return;
    markAllRead();
    toast(`${unread.length} bildirim okundu olarak işaretlendi.`, "success");
  }

  if (items.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white py-14 flex flex-col items-center gap-3 text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-2xl bg-bg2 text-text3">
          <Bell className="size-7" />
        </span>
        <div>
          <div className="font-display text-base font-bold text-text">Bildirim yok</div>
          <p className="text-sm text-text2 mt-1 max-w-sm">
            Paylaşım, kritik iş kapatma ve önemli sistem olayları burada görünür.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Üst şerit */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-white px-4 py-3">
        <div className="flex items-center gap-2.5">
          <span
            className={cn(
              "inline-flex items-center justify-center size-8 rounded-lg",
              unread.length > 0 ? "bg-accent/15 text-accent" : "bg-bg2 text-text3"
            )}
          >
            <Bell className="size-4" />
          </span>
          <div className="text-sm">
            {unread.length > 0 ? (
              <span>
                <strong className="text-text font-bold">{unread.length}</strong>
                <span className="text-text2"> okunmamış bildirim</span>
              </span>
            ) : (
              <span className="text-text2">Hepsi okundu.</span>
            )}
            <div className="text-[11px] text-text3 mt-0.5">
              Toplam {items.length} kayıt
            </div>
          </div>
        </div>
        {unread.length > 0 && (
          <Button size="sm" variant="outline" onClick={handleMarkAll}>
            <CheckCheck className="size-3.5" />
            Hepsini Okundu İşaretle
          </Button>
        )}
      </div>

      {/* Liste */}
      <div className="space-y-2">
        {items.map((n) => {
          const s = getStyle(n.type);
          const Icon = s.icon;
          const isUnread = !n.readAt;
          return (
            <div
              key={n.id}
              className={cn(
                "rounded-xl border bg-white px-4 py-3 transition-colors",
                isUnread ? "border-blue/30 bg-blue/4" : "border-border"
              )}
            >
              <div className="flex items-start gap-3">
                <span className={cn("inline-flex items-center justify-center size-9 rounded-lg shrink-0", s.bg, s.text)}>
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={cn("text-[9px] font-bold uppercase tracking-wider", s.text)}>
                      {s.label}
                    </span>
                    {isUnread && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-blue/15 text-blue text-[9px] font-bold uppercase tracking-wider">
                        Yeni
                      </span>
                    )}
                  </div>
                  <div className="text-[13.5px] font-bold text-text mt-1 leading-tight">{n.title}</div>
                  {n.body && (
                    <p className="text-[12.5px] text-text2 mt-1 leading-relaxed">{n.body}</p>
                  )}
                  <div className="flex items-center gap-3 mt-2 text-[11px] text-text3">
                    <span className="font-mono">{formatTr(n.createdAt)}</span>
                    {n.link && (
                      <Link href={n.link} className="text-accent font-bold hover:underline">
                        Görüntüle →
                      </Link>
                    )}
                  </div>
                </div>
                {isUnread && (
                  <button
                    onClick={() => markRead(n.id)}
                    title="Okundu olarak işaretle"
                    aria-label="Okundu olarak işaretle"
                    className="shrink-0 inline-flex items-center justify-center size-8 rounded-lg text-text3 hover:text-accent hover:bg-accent/8 transition-colors"
                  >
                    <Check className="size-4" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
