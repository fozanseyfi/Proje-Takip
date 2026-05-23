"use client";

import { Bell } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { NotificationsList } from "@/components/layout/notifications-list";

export default function NotificationsPage() {
  return (
    <>
      <PageHeader
        title="Bildirimler"
        description="Paylaşımlar, kritik kapatmalar, fatura ödemeleri ve teslim alımları"
        icon={Bell}
      />
      <NotificationsList />
    </>
  );
}
