"use client";

import { Users } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";

export default function UsersPage() {
  return (
    <>
      <PageHeader
        title="Kullanıcılar"
        description="Platforma erişimi olan tüm kullanıcılar"
        icon={Users}
      />
      <Card>
        <p className="text-sm text-text2">İçerik yakında.</p>
      </Card>
    </>
  );
}
