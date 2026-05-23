"use client";

import { useMemo, useState } from "react";
import { Users, UserPlus, Trash2, Copy, Check } from "lucide-react";
import { useStore, useCurrentProject, useCurrentUser } from "@/lib/store";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogFooter } from "@/components/ui/dialog";
import { Field, Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { confirmAction } from "@/components/ui/confirm";
import { TableWrap, Table, THead, TBody, TR, TH, TD, Empty } from "@/components/ui/table";
import { formatDate } from "@/lib/utils";
import type { Role } from "@/lib/store/types";

const ROLE_LABEL: Record<Role, string> = {
  super_admin: "Süper Admin",
  project_manager: "Proje Yöneticisi",
  field_engineer: "Saha Mühendisi",
  viewer: "Görüntüleyici",
};

const ROLE_VARIANT: Record<Role, "purple" | "accent" | "blue" | "gray"> = {
  super_admin: "purple",
  project_manager: "accent",
  field_engineer: "blue",
  viewer: "gray",
};

export default function TeamPage() {
  const project = useCurrentProject();
  const currentUser = useCurrentUser();
  const users = useStore((s) => s.users);
  const members = useStore((s) => s.members).filter((m) => m.projectId === project?.id);
  const invitations = useStore((s) => s.invitations).filter((i) => i.projectId === project?.id);
  const updateMemberRole = useStore((s) => s.updateMemberRole);
  const removeMember = useStore((s) => s.removeMember);
  const createInvitation = useStore((s) => s.createInvitation);
  const cancelInvitation = useStore((s) => s.cancelInvitation);

  const [inviteOpen, setInviteOpen] = useState(false);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const memberRows = useMemo(() => {
    return members.map((m) => ({
      member: m,
      user: users.find((u) => u.id === m.userId),
    }));
  }, [members, users]);

  if (!project)
    return (
      <Card>
        <CardTitle>Proje Yok</CardTitle>
      </Card>
    );

  function copyInviteLink(token: string) {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  }

  return (
    <>
      <PageHeader
        title="Ekip & Davet"
        description={`${memberRows.length} üye · ${invitations.filter((i) => !i.acceptedAt).length} bekleyen davet`}
        icon={Users}
        actions={
          <Button variant="accent" onClick={() => setInviteOpen(true)}>
            <UserPlus size={14} /> Davet Et
          </Button>
        }
      />

      <Card className="mb-4">
        <CardTitle>Üyeler</CardTitle>
        <TableWrap>
          <Table>
            <THead>
              <TR>
                <TH>Kullanıcı</TH>
                <TH>E-posta</TH>
                <TH>Rol</TH>
                <TH>Katıldı</TH>
                <TH></TH>
              </TR>
            </THead>
            <TBody>
              {memberRows.length === 0 ? (
                <Empty colSpan={5}>Henüz üye yok.</Empty>
              ) : (
                memberRows.map(({ member, user }) => (
                  <TR key={member.id}>
                    <TD>
                      <div className="font-medium">{user?.fullName ?? "—"}</div>
                      {user?.isSuperAdmin && (
                        <Badge variant="purple" className="mt-0.5">
                          Süper Admin
                        </Badge>
                      )}
                    </TD>
                    <TD className="text-xs text-text2">{user?.email ?? "—"}</TD>
                    <TD>
                      <Select
                        value={member.role}
                        onChange={(e) => updateMemberRole(member.id, e.target.value as Role)}
                        disabled={user?.isSuperAdmin}
                        className="!py-1 !px-2 !text-xs"
                      >
                        <option value="project_manager">Proje Yöneticisi</option>
                        <option value="field_engineer">Saha Mühendisi</option>
                        <option value="viewer">Görüntüleyici</option>
                      </Select>
                    </TD>
                    <TD className="text-xs text-text3">
                      {member.acceptedAt ? formatDate(member.acceptedAt) : "Beklemede"}
                    </TD>
                    <TD>
                      <div className="flex justify-end">
                        {!user?.isSuperAdmin && member.userId !== currentUser?.id && (
                          <button
                            onClick={async () => {
                              if (await confirmAction({
                                title: "Üye çıkarılsın mı?",
                                message: "Bu üye projeden çıkarılır. Hesabı silinmez, tekrar davet edilebilir.",
                                confirmText: "Çıkart",
                              })) {
                                removeMember(member.id);
                              }
                            }}
                            className="p-1 text-text3 hover:text-red rounded"
                          >
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </TD>
                  </TR>
                ))
              )}
            </TBody>
          </Table>
        </TableWrap>
      </Card>

      {invitations.length > 0 && (
        <Card>
          <CardTitle>Bekleyen Davetler</CardTitle>
          <TableWrap>
            <Table>
              <THead>
                <TR>
                  <TH>E-posta</TH>
                  <TH>Rol</TH>
                  <TH>Son Geçerlilik</TH>
                  <TH>Durum</TH>
                  <TH>Davet Linki</TH>
                  <TH></TH>
                </TR>
              </THead>
              <TBody>
                {invitations.map((i) => (
                  <TR key={i.id}>
                    <TD className="text-xs">{i.email}</TD>
                    <TD>
                      <Badge variant={ROLE_VARIANT[i.role]}>{ROLE_LABEL[i.role]}</Badge>
                    </TD>
                    <TD className="text-xs text-text3">{formatDate(i.expiresAt)}</TD>
                    <TD>
                      {i.acceptedAt ? (
                        <Badge variant="green">Kabul edildi</Badge>
                      ) : new Date(i.expiresAt) < new Date() ? (
                        <Badge variant="red">Süresi doldu</Badge>
                      ) : (
                        <Badge variant="yellow">Beklemede</Badge>
                      )}
                    </TD>
                    <TD>
                      <button
                        onClick={() => copyInviteLink(i.token)}
                        className="flex items-center gap-1.5 text-xs text-accent hover:underline"
                      >
                        {copiedToken === i.token ? (
                          <>
                            <Check size={11} /> Kopyalandı
                          </>
                        ) : (
                          <>
                            <Copy size={11} /> Linki Kopyala
                          </>
                        )}
                      </button>
                    </TD>
                    <TD>
                      <div className="flex justify-end">
                        <button
                          onClick={() => cancelInvitation(i.id)}
                          className="p-1 text-text3 hover:text-red rounded"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </TD>
                  </TR>
                ))}
              </TBody>
            </Table>
          </TableWrap>
        </Card>
      )}

      <Alert variant="info" className="mt-4">
        <strong>Lokal mod:</strong> Davet e-postası gönderilmez. Davet linkini kopyalayıp manuel paylaşabilirsin.
        Supabase entegrasyonu sonrası Resend ile otomatik e-posta gönderilir.
      </Alert>

      <InviteDialog
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        onSubmit={(email, role) => {
          if (!currentUser || !project) return;
          createInvitation({
            projectId: project.id,
            email,
            role,
            invitedBy: currentUser.id,
          });
          setInviteOpen(false);
        }}
      />
    </>
  );
}

function InviteDialog({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (email: string, role: Role) => void;
}) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("field_engineer");

  return (
    <Dialog open={open} onClose={onClose} title="Yeni Davet" size="sm">
      <div className="space-y-3">
        <Field label="E-posta">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="ornek@firma.com"
          />
        </Field>
        <Field label="Rol">
          <Select value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="project_manager">Proje Yöneticisi (tam yetki)</option>
            <option value="field_engineer">Saha Mühendisi (puantaj/rapor)</option>
            <option value="viewer">Görüntüleyici (sadece okuma)</option>
          </Select>
        </Field>
      </div>
      <DialogFooter>
        <Button variant="ghost" onClick={onClose}>İptal</Button>
        <Button variant="accent" onClick={() => email && onSubmit(email, role)}>
          Davet Oluştur
        </Button>
      </DialogFooter>
    </Dialog>
  );
}
