"use server";

import nodemailer from "nodemailer";

const DEV_EMAIL = "fozanseyfi@gmail.com";
const PLATFORM_NAME = "Proje Yönetim Platformu";
const PLATFORM_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN ?? "localhost";

interface SendInput {
  topic: string;
  subject: string;
  message: string;
  senderName: string;
  senderEmail: string;
}

/**
 * NOT: Bu projede henüz Supabase yok (Faz 0 — Zustand+localStorage).
 * Oturum doğrulama client tarafında yapılır; sender bilgileri request payload'undan gelir.
 * Supabase eklendiğinde profile'dan üye doğrulaması yapılacak ve `feedbacks` tablosuna insert eklenecek.
 */
export async function sendContactMessage(input: SendInput) {
  const subject = (input.subject ?? "").trim();
  const message = (input.message ?? "").trim();
  const topic = (input.topic ?? "Geri Bildirim").trim();
  const senderName = (input.senderName ?? "").trim() || "Bilinmeyen";
  const senderEmail = (input.senderEmail ?? "").trim() || "bilinmiyor@example.com";

  if (!subject || message.length < 10) {
    throw new Error("Konu ve en az 10 karakterlik mesaj gerekli.");
  }

  const gmailUser = process.env.GMAIL_USER;
  const gmailPass = process.env.GMAIL_APP_PASSWORD;
  if (!gmailUser || !gmailPass) {
    console.error("[sendContactMessage] GMAIL_USER / GMAIL_APP_PASSWORD env yok");
    throw new Error(
      "E-posta gönderim ayarları eksik. Yöneticiyle iletişime geç: env'a GMAIL_USER ve GMAIL_APP_PASSWORD eklenmeli."
    );
  }

  const transporter = nodemailer.createTransport({
    host: "smtp.gmail.com",
    port: 465,
    secure: true,
    auth: { user: gmailUser, pass: gmailPass },
  });

  const html = buildHtml({ topic, subject, message, senderName, senderEmail });
  const text = buildText({ topic, subject, message, senderName, senderEmail });

  try {
    await transporter.sendMail({
      from: `"${PLATFORM_NAME}" <${gmailUser}>`,
      to: DEV_EMAIL,
      replyTo: senderEmail,
      subject: `[${PLATFORM_NAME} · ${topic}] ${subject}`,
      text,
      html,
    });
  } catch (err) {
    console.error("[sendContactMessage] SMTP send failed:", err);
    throw new Error("E-posta gönderilemedi. Lütfen birazdan tekrar deneyin.");
  }

  return { ok: true };
}

function escapeHtml(s: string) {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildHtml({
  topic,
  subject,
  message,
  senderName,
  senderEmail,
}: {
  topic: string;
  subject: string;
  message: string;
  senderName: string;
  senderEmail: string;
}) {
  return `
<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b;">
  <div style="background: linear-gradient(135deg, #1e293b, #0f172a); color: white; padding: 24px; border-radius: 12px 12px 0 0;">
    <div style="font-size: 11px; letter-spacing: 1.5px; text-transform: uppercase; opacity: 0.7;">${escapeHtml(PLATFORM_NAME)} — Yeni Mesaj</div>
    <div style="font-size: 18px; font-weight: 600; margin-top: 6px;">${escapeHtml(topic)}</div>
  </div>
  <div style="background: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
      <tr>
        <td style="padding: 6px 0; color: #64748b; font-size: 12px; width: 80px;">GÖNDEREN</td>
        <td style="padding: 6px 0; font-size: 14px;"><strong>${escapeHtml(senderName)}</strong></td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; font-size: 12px;">E-POSTA</td>
        <td style="padding: 6px 0; font-size: 14px;"><a href="mailto:${escapeHtml(senderEmail)}" style="color: #2563eb;">${escapeHtml(senderEmail)}</a></td>
      </tr>
      <tr>
        <td style="padding: 6px 0; color: #64748b; font-size: 12px;">KONU</td>
        <td style="padding: 6px 0; font-size: 14px; font-weight: 500;">${escapeHtml(subject)}</td>
      </tr>
    </table>
    <div style="background: #f8fafc; border-left: 3px solid #10b981; padding: 16px; border-radius: 6px; white-space: pre-wrap; font-size: 14px; line-height: 1.6;">${escapeHtml(message)}</div>
    <div style="margin-top: 20px; font-size: 11px; color: #94a3b8;">
      Bu e-posta ${escapeHtml(PLATFORM_DOMAIN)} üzerinden otomatik gönderildi. "Yanıtla" basarsanız doğrudan
      <strong>${escapeHtml(senderEmail)}</strong> adresine yanıt gider.
    </div>
  </div>
</body>
</html>`.trim();
}

function buildText({
  topic,
  subject,
  message,
  senderName,
  senderEmail,
}: {
  topic: string;
  subject: string;
  message: string;
  senderName: string;
  senderEmail: string;
}) {
  return [
    `${PLATFORM_NAME} — Yeni Mesaj`,
    `Konu Türü: ${topic}`,
    ``,
    `Gönderen: ${senderName} <${senderEmail}>`,
    `Konu: ${subject}`,
    ``,
    `--- MESAJ ---`,
    message,
    ``,
    `Yanıtla butonuyla doğrudan ${senderEmail} adresine yanıt verebilirsiniz.`,
  ].join("\n");
}
