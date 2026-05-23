"use client";

import { Building } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";

export default function CustomersPage() {
  return (
    <>
      <PageHeader
        title="Müşteriler"
        description="İşveren ve müşteri firmalarını tek yerde yönet"
        icon={Building}
      />
      <Card>
        <p className="text-sm text-text2">İçerik yakında.</p>
      </Card>
    </>
  );
}
