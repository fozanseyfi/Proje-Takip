/**
 * HR şablonları — Özlük + İSG belgeleri.
 * Boş, doldurulabilir PDF formları. Master-list PDF stiliyle aynı html2canvas-pro + jsPDF mantığı.
 */

import { formatDate, toISODate } from "@/lib/utils";
import { renderHtmlToPdf } from "./html-to-pdf";

export type HRCategory = "ozluk" | "isg";

export interface HRTemplate {
  id: string;
  category: HRCategory;
  title: string;
  description: string;
  body: () => string;
}

function escapeHtml(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FIELD_LABEL = "font-size:10.5px;font-weight:600;color:#374151;min-width:130px;";
const FIELD_LINE = "flex:1;border-bottom:1px solid #1f2937;height:14px;";
const HINT = "font-size:8.5px;color:#9ca3af;";

function fieldRow(label: string, hint?: string, width = "100%"): string {
  return `<div style="display:flex;align-items:flex-end;gap:8px;margin:6px 0;width:${width};">
    <span style="${FIELD_LABEL}">${escapeHtml(label)}</span>
    <span style="${FIELD_LINE}"></span>
    ${hint ? `<span style="${HINT}">${escapeHtml(hint)}</span>` : ""}
  </div>`;
}

function fieldGrid2(rows: Array<{ label: string; hint?: string }>): string {
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:0 28px;">
    ${rows.map((r) => fieldRow(r.label, r.hint)).join("")}
  </div>`;
}

function checkboxRow(label: string): string {
  return `<div style="display:flex;align-items:center;gap:8px;margin:5px 0;">
    <span style="width:12px;height:12px;border:1.5px solid #1f2937;display:inline-block;flex-shrink:0;"></span>
    <span style="font-size:10.5px;">${escapeHtml(label)}</span>
  </div>`;
}

function section(heading: string, inner: string): string {
  return `<div style="margin:14px 0;">
    <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#6b7280;border-bottom:2px solid #e5e7eb;padding-bottom:4px;margin-bottom:8px;">${escapeHtml(heading)}</div>
    ${inner}
  </div>`;
}

function personnelInfoSection(): string {
  return `<div style="border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin:12px 0;background:#fafafa;">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;margin-bottom:8px;">Personel Bilgileri</div>
    ${fieldGrid2([
      { label: "Ad Soyad" },
      { label: "TC Kimlik No", hint: "11 hane" },
      { label: "Firma" },
      { label: "Görev / Disiplin" },
      { label: "İşe Giriş Tarihi", hint: "GG/AA/YYYY" },
      { label: "Telefon" },
    ])}
  </div>`;
}

function signatureBlocks(leftLabel: string, rightLabel: string): string {
  return `<div style="margin-top:28px;display:flex;justify-content:space-between;gap:24px;font-size:10px;">
    <div style="flex:1;">
      <div style="font-weight:600;color:#374151;">${escapeHtml(leftLabel)}</div>
      <div style="margin-top:6px;font-size:9px;color:#9ca3af;">Tarih: ____________________</div>
      <div style="margin-top:48px;border-top:1px solid #1f2937;font-size:9px;color:#6b7280;padding-top:3px;">Ad-Soyad / İmza</div>
    </div>
    <div style="flex:1;">
      <div style="font-weight:600;color:#374151;">${escapeHtml(rightLabel)}</div>
      <div style="margin-top:6px;font-size:9px;color:#9ca3af;">Tarih: ____________________</div>
      <div style="margin-top:48px;border-top:1px solid #1f2937;font-size:9px;color:#6b7280;padding-top:3px;">Ad-Soyad / İmza</div>
    </div>
  </div>`;
}

function paragraph(text: string): string {
  return `<p style="font-size:10.5px;line-height:1.55;color:#1f2937;margin:6px 0;">${text}</p>`;
}

export const HR_TEMPLATES: HRTemplate[] = [
  // ───────────────── ÖZLÜK ─────────────────
  {
    id: "ozluk-belge-teslim",
    category: "ozluk",
    title: "Özlük Dosyası Belge Teslim Tutanağı",
    description: "Özlük belgelerinin kontrol listesi ve teslim tutanağı",
    body: () =>
      personnelInfoSection() +
      section(
        "Teslim Alınan Belgeler",
        [
          "Nüfus cüzdanı / kimlik fotokopisi",
          "İkametgah belgesi (e-Devlet)",
          "Adli sicil kaydı",
          "Diploma / öğrenim belgesi fotokopisi",
          "4 adet vesikalık fotoğraf",
          "İşe başlama sağlık raporu",
          "AGİ (Aile Durumu Bildirim Formu)",
          "İş sözleşmesi (imzalı 2 nüsha)",
          "SGK işe giriş bildirgesi",
          "Banka bilgileri / IBAN",
          "KVKK aydınlatma metni & açık rıza beyanı",
          "İSG genel eğitim katılım belgesi",
          "KKD zimmet formu",
          "Periyodik sağlık raporu (yıllık)",
        ]
          .map(checkboxRow)
          .join("")
      ) +
      signatureBlocks("Teslim Eden (Personel)", "Teslim Alan (İK / İdari)"),
  },
  {
    id: "ozluk-is-basvuru",
    category: "ozluk",
    title: "İş Başvuru Formu",
    description: "Yeni personel başvuru bilgileri",
    body: () =>
      section(
        "Kimlik Bilgileri",
        fieldGrid2([
          { label: "Ad Soyad" },
          { label: "TC Kimlik No", hint: "11 hane" },
          { label: "Doğum Tarihi", hint: "GG/AA/YYYY" },
          { label: "Doğum Yeri" },
          { label: "Medeni Hal" },
          { label: "Askerlik Durumu" },
          { label: "Telefon" },
          { label: "E-posta" },
        ])
      ) +
      section("İkametgah", fieldRow("Adres", "Açık adres")) +
      section(
        "Öğrenim",
        fieldGrid2([
          { label: "En Son Mezuniyet" },
          { label: "Okul / Bölüm" },
          { label: "Mezuniyet Yılı" },
          { label: "Yabancı Dil" },
        ])
      ) +
      section(
        "İş Tecrübesi",
        ["Önceki İşveren 1", "Görev / Süre", "Önceki İşveren 2", "Görev / Süre"]
          .map((l) => fieldRow(l))
          .join("")
      ) +
      section(
        "Başvurulan Pozisyon",
        fieldGrid2([
          { label: "Pozisyon" },
          { label: "Beklenen Ücret" },
          { label: "Başlayabilir Tarih" },
          { label: "Referans (varsa)" },
        ])
      ) +
      paragraph(
        "Yukarıdaki bilgilerin doğru olduğunu, yanlış beyan halinde sözleşmenin tek taraflı feshedilebileceğini kabul ederim."
      ) +
      signatureBlocks("Başvuran", "İK Sorumlusu"),
  },
  {
    id: "ozluk-agi",
    category: "ozluk",
    title: "Aile Durumu Bildirim Formu (AGİ)",
    description: "Asgari Geçim İndirimi için aile bilgileri",
    body: () =>
      personnelInfoSection() +
      section(
        "Eş Bilgileri",
        fieldGrid2([
          { label: "Eşin Adı Soyadı" },
          { label: "Eşin TC No" },
          { label: "Eşin Çalışma Durumu", hint: "Çalışıyor/Çalışmıyor" },
          { label: "Çalışıyorsa Firma" },
        ])
      ) +
      section(
        "Çocuk Bilgileri",
        `<table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:4px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:left;">#</th>
              <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:left;">Ad Soyad</th>
              <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:left;">TC Kimlik No</th>
              <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:left;">Doğum Tarihi</th>
              <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:left;">Öğrenim Durumu</th>
            </tr>
          </thead>
          <tbody>
            ${[1, 2, 3, 4]
              .map(
                (i) =>
                  `<tr><td style="padding:6px 8px;border:1px solid #d4d4d8;height:22px;">${i}</td><td style="border:1px solid #d4d4d8;"></td><td style="border:1px solid #d4d4d8;"></td><td style="border:1px solid #d4d4d8;"></td><td style="border:1px solid #d4d4d8;"></td></tr>`
              )
              .join("")}
          </tbody>
        </table>`
      ) +
      paragraph(
        "AGİ talebimde belirttiğim bilgilerin doğru olduğunu, bu bilgilerde değişiklik olması halinde derhal işverenime bildireceğimi taahhüt ederim."
      ) +
      signatureBlocks("Personel", "İK Sorumlusu"),
  },
  {
    id: "ozluk-banka",
    category: "ozluk",
    title: "Banka Bilgileri / IBAN Beyanı",
    description: "Maaş ödemesi için banka hesap bilgileri",
    body: () =>
      personnelInfoSection() +
      section(
        "Banka Hesabı",
        fieldGrid2([
          { label: "Banka Adı" },
          { label: "Şube" },
          { label: "Hesap Sahibi" },
          { label: "Hesap No" },
        ]) + fieldRow("IBAN", "TR ile başlayan 26 hane")
      ) +
      paragraph(
        "Yukarıda bildirdiğim banka hesabıma maaş yatırılmasını kabul ediyorum. Hesap değişikliği halinde yazılı olarak bildireceğimi taahhüt ederim."
      ) +
      signatureBlocks("Personel", "İK Sorumlusu"),
  },
  {
    id: "ozluk-kvkk",
    category: "ozluk",
    title: "KVKK Aydınlatma & Açık Rıza Beyanı",
    description: "Kişisel verilerin işlenmesi onayı",
    body: () =>
      personnelInfoSection() +
      paragraph(
        "6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, işveren tarafından kimlik, iletişim, özlük, sağlık, finansal, mesleki deneyim, görsel/işitsel kayıt ve fiziksel mekan güvenliği verilerimin; iş sözleşmesinin kurulması ve ifası, SGK ve resmi makamlara bildirim, ücret ödeme, performans değerlendirme, İSG yükümlülüklerinin yerine getirilmesi ve hukuki yükümlülüklerin ifası amaçlarıyla işlenmesine bilgilendirildim."
      ) +
      paragraph(
        "Verilerimin yukarıdaki amaçlar dışında üçüncü kişilerle paylaşılmayacağı; yasal saklama süreleri sonunda imha edileceği; KVKK 11. madde kapsamındaki haklarımı (bilgi talep etme, düzeltme, silme, itiraz vb.) kullanabileceğim tarafıma anlatılmıştır."
      ) +
      section(
        "Açık Rıza",
        checkboxRow("Sağlık verilerimin SGK ve İSG uzmanı ile paylaşılmasına onay veriyorum.") +
          checkboxRow("Saha güvenliği için fotoğraf/video kayıtlarımın işlenmesine onay veriyorum.") +
          checkboxRow("Eğitim ve sertifika bilgilerimin müşteri/işveren denetimlerinde paylaşılmasına onay veriyorum.")
      ) +
      signatureBlocks("Personel", "İşveren / İK"),
  },
  {
    id: "ozluk-kart",
    category: "ozluk",
    title: "Kişisel Bilgi Kartı (Özlük Kartı)",
    description: "Personel kimlik özet kartı",
    body: () =>
      section(
        "Kimlik",
        fieldGrid2([
          { label: "Ad Soyad" },
          { label: "TC Kimlik No" },
          { label: "Doğum Tarihi/Yeri" },
          { label: "Cinsiyet" },
          { label: "Kan Grubu" },
          { label: "Medeni Hal" },
        ])
      ) +
      section(
        "İletişim & Acil Durum",
        fieldGrid2([
          { label: "Telefon" },
          { label: "Acil Durum İletişim" },
          { label: "Adres" },
          { label: "Yakınlık / Telefon" },
        ])
      ) +
      section(
        "İş Bilgileri",
        fieldGrid2([
          { label: "Firma" },
          { label: "SGK No" },
          { label: "İşe Giriş Tarihi" },
          { label: "Görev / Pozisyon" },
          { label: "Disiplin" },
          { label: "Çalışma Yeri / Şantiye" },
        ])
      ) +
      section(
        "Sağlık",
        fieldGrid2([
          { label: "Kronik Hastalık" },
          { label: "Düzenli İlaç" },
          { label: "Alerji" },
          { label: "Engel / Rapor" },
        ])
      ) +
      signatureBlocks("Personel", "İK Sorumlusu"),
  },

  // ───────────────── İSG ─────────────────
  {
    id: "isg-genel-egitim",
    category: "isg",
    title: "İSG Genel Eğitim Katılım Tutanağı",
    description: "6331 sayılı kanun kapsamında zorunlu temel eğitim",
    body: () =>
      personnelInfoSection() +
      section(
        "Eğitim Bilgileri",
        fieldGrid2([
          { label: "Eğitim Tarihi", hint: "GG/AA/YYYY" },
          { label: "Eğitim Süresi", hint: "saat" },
          { label: "Eğitmen Ad Soyad" },
          { label: "Eğitmen Belge No" },
          { label: "Eğitim Yeri" },
          { label: "Tehlike Sınıfı", hint: "Az/Tehlikeli/Çok Tehlikeli" },
        ])
      ) +
      section(
        "Konular (Asgari)",
        [
          "Genel İSG kuralları ve mevzuat",
          "İş kazaları ve meslek hastalıkları",
          "Kullanılan ekipmanların güvenli kullanımı",
          "Kimyasal, fiziksel, biyolojik tehlikeler",
          "KKD seçimi, kullanımı ve bakımı",
          "Acil durum, yangın ve tahliye prosedürleri",
          "Sağlık ve hijyen kuralları",
          "Ergonomi ve duruş bozuklukları",
        ]
          .map(checkboxRow)
          .join("")
      ) +
      paragraph(
        "Yukarıda belirtilen konularda İSG eğitimini aldığımı, içeriği anladığımı ve uygulayacağımı beyan ederim."
      ) +
      signatureBlocks("Personel (Katılımcı)", "Eğitmen / İSG Uzmanı"),
  },
  {
    id: "isg-kkd-zimmet",
    category: "isg",
    title: "KKD Zimmet Formu",
    description: "Kişisel Koruyucu Donanım teslim/iade kaydı",
    body: () =>
      personnelInfoSection() +
      `<table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:8px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:left;">Donanım</th>
            <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:center;">Marka / Model</th>
            <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:center;">Adet</th>
            <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:center;">Teslim Tarihi</th>
            <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:center;">İmza</th>
          </tr>
        </thead>
        <tbody>
          ${[
            "Baret (kask)",
            "İş ayakkabısı (çelik burunlu)",
            "İş tulumu / yelek",
            "Koruyucu gözlük",
            "Kulak tıkacı / kulaklık",
            "İş eldiveni",
            "Toz maskesi / FFP2",
            "Emniyet kemeri (yüksekte)",
            "Reflektif yelek",
            "Diğer: ____________",
          ]
            .map(
              (item) =>
                `<tr><td style="padding:6px 8px;border:1px solid #d4d4d8;">${escapeHtml(
                  item
                )}</td><td style="border:1px solid #d4d4d8;height:24px;"></td><td style="border:1px solid #d4d4d8;"></td><td style="border:1px solid #d4d4d8;"></td><td style="border:1px solid #d4d4d8;"></td></tr>`
            )
            .join("")}
        </tbody>
      </table>` +
      paragraph(
        "Yukarıda belirtilen KKD'leri sağlam ve eksiksiz teslim aldım. İş süresince kullanacağımı, kayıp/hasar durumunda işverene bildireceğimi taahhüt ederim."
      ) +
      signatureBlocks("Personel", "İSG / Depo Sorumlusu"),
  },
  {
    id: "isg-kurallari",
    category: "isg",
    title: "İSG Kuralları Bilgilendirme & İmza Belgesi",
    description: "Saha İSG kurallarının tebliği",
    body: () =>
      personnelInfoSection() +
      section(
        "Aşağıdaki kuralları okudum, anladım ve uygulayacağımı kabul ediyorum",
        [
          "Sahaya girişte mutlaka baret, iş ayakkabısı ve reflektif yelek giyilecektir.",
          "Yüksekte (≥ 2 m) çalışmalarda emniyet kemeri ve yetki belgesi zorunludur.",
          "Elektrik panolarına yetkisiz müdahale yasaktır.",
          "Vinç altında ve manevra alanında durulmaz.",
          "Alkol veya uyuşturucu maddelerle sahaya giriş kesinlikle yasaktır.",
          "Sigara sadece belirlenmiş alanlarda içilir.",
          "Tehlikeli durum/davranış görüldüğünde derhal İSG uzmanına bildirilir.",
          "İş kazası ve ramak kala olayları derhal raporlanır.",
          "Yangın halinde tahliye planına uyulur, asansör kullanılmaz.",
          "Verilen KKD'ler hiçbir koşulda çıkarılmaz, başka kimseye verilmez.",
        ]
          .map(
            (line, i) =>
              `<div style="display:flex;align-items:flex-start;gap:8px;margin:5px 0;">
                <span style="font-size:10px;font-weight:700;color:#6b7280;min-width:18px;">${i + 1}.</span>
                <span style="width:12px;height:12px;border:1.5px solid #1f2937;display:inline-block;flex-shrink:0;margin-top:1px;"></span>
                <span style="font-size:10.5px;line-height:1.45;flex:1;">${escapeHtml(line)}</span>
              </div>`
          )
          .join("")
      ) +
      signatureBlocks("Personel", "İSG Uzmanı"),
  },
  {
    id: "isg-saglik-takip",
    category: "isg",
    title: "Periyodik Sağlık Muayene Takip Formu",
    description: "Yıllık periyodik muayene kayıtları",
    body: () =>
      personnelInfoSection() +
      `<table style="width:100%;border-collapse:collapse;font-size:10px;margin-top:8px;">
        <thead>
          <tr style="background:#f3f4f6;">
            <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:center;">Yıl</th>
            <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:left;">Muayene Tarihi</th>
            <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:left;">İşyeri Hekimi</th>
            <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:center;">Sonuç</th>
            <th style="padding:6px 8px;border:1px solid #d4d4d8;text-align:left;">Notlar / Kısıt</th>
          </tr>
        </thead>
        <tbody>
          ${Array.from({ length: 6 })
            .map(
              () =>
                `<tr><td style="border:1px solid #d4d4d8;height:28px;"></td><td style="border:1px solid #d4d4d8;"></td><td style="border:1px solid #d4d4d8;"></td><td style="border:1px solid #d4d4d8;"></td><td style="border:1px solid #d4d4d8;"></td></tr>`
            )
            .join("")}
        </tbody>
      </table>` +
      section(
        "Tehlikeli iş yapanlar için ek tetkikler",
        [
          "Akciğer grafisi (tozlu ortam)",
          "Odyometri (gürültülü ortam)",
          "Görme keskinliği testi",
          "Solunum fonksiyon testi (SFT)",
          "Hemogram / kan testleri",
        ]
          .map(checkboxRow)
          .join("")
      ) +
      signatureBlocks("Personel", "İşyeri Hekimi"),
  },
  {
    id: "isg-yuksekte-calisma",
    category: "isg",
    title: "Yüksekte Çalışma Yetki Belgesi",
    description: "2 m ve üzeri çalışma yetki belgesi",
    body: () =>
      personnelInfoSection() +
      section(
        "Yetki Bilgileri",
        fieldGrid2([
          { label: "Eğitim Tarihi" },
          { label: "Eğitim Süresi (saat)" },
          { label: "Eğitmen / Belge No" },
          { label: "Geçerlilik Süresi", hint: "Genelde 3 yıl" },
        ])
      ) +
      section(
        "Yetkili Olduğu Çalışmalar",
        [
          "İskele üzerinde çalışma",
          "Çatı işleri",
          "Cephe işleri (asma iskele)",
          "Halat erişimli çalışma",
          "Sepetli platform / makaslı liftler",
          "Direk tırmanma (telekom/enerji)",
        ]
          .map(checkboxRow)
          .join("")
      ) +
      section(
        "Sağlık Beyanı",
        checkboxRow("Yüksekte çalışmaya engel sağlık sorunum yoktur.") +
          checkboxRow("Baş dönmesi, denge bozukluğu, epilepsi vb. rahatsızlıklarım yoktur.") +
          checkboxRow("Yüksek tansiyon, kalp rahatsızlığı bulunmamaktadır.")
      ) +
      paragraph(
        "Yüksekte çalışma kuralları hakkında eğitim aldığımı, paraşüt tipi emniyet kemerimi doğru kullanacağımı ve TS EN 363'e uygun düşme durdurma sistemini takip edeceğimi beyan ederim."
      ) +
      signatureBlocks("Personel", "İSG Uzmanı / İşveren"),
  },
  {
    id: "isg-toolbox",
    category: "isg",
    title: "Günlük Saha Brifingi (Toolbox Talk) Tutanağı",
    description: "İşbaşı öncesi günlük güvenlik konuşması",
    body: () =>
      section(
        "Brifing Bilgileri",
        fieldGrid2([
          { label: "Tarih" },
          { label: "Saat" },
          { label: "Saha / Lokasyon" },
          { label: "Brifing Veren" },
        ])
      ) +
      section("Konu", fieldRow("Bugünün ana konusu") + fieldRow("Tehlike / önlem")) +
      section(
        "Katılımcılar",
        `<table style="width:100%;border-collapse:collapse;font-size:9.5px;margin-top:4px;">
          <thead>
            <tr style="background:#f3f4f6;">
              <th style="padding:5px 6px;border:1px solid #d4d4d8;text-align:center;width:24px;">#</th>
              <th style="padding:5px 6px;border:1px solid #d4d4d8;text-align:left;">Ad Soyad</th>
              <th style="padding:5px 6px;border:1px solid #d4d4d8;text-align:left;">Firma</th>
              <th style="padding:5px 6px;border:1px solid #d4d4d8;text-align:left;">Görev</th>
              <th style="padding:5px 6px;border:1px solid #d4d4d8;text-align:center;width:80px;">İmza</th>
            </tr>
          </thead>
          <tbody>
            ${Array.from({ length: 14 })
              .map(
                (_, i) =>
                  `<tr><td style="padding:4px 6px;border:1px solid #d4d4d8;text-align:center;height:22px;">${
                    i + 1
                  }</td><td style="border:1px solid #d4d4d8;"></td><td style="border:1px solid #d4d4d8;"></td><td style="border:1px solid #d4d4d8;"></td><td style="border:1px solid #d4d4d8;"></td></tr>`
              )
              .join("")}
          </tbody>
        </table>`
      ) +
      signatureBlocks("Brifing Veren", "Şantiye Şefi / İSG Uzmanı"),
  },
  {
    id: "isg-kaza-bildirim",
    category: "isg",
    title: "İş Kazası / Ramak Kala Bildirim Formu",
    description: "Kaza / olay raporu",
    body: () =>
      personnelInfoSection() +
      section(
        "Olay Bilgileri",
        fieldGrid2([
          { label: "Olay Tarihi" },
          { label: "Olay Saati" },
          { label: "Lokasyon" },
          { label: "Olay Türü", hint: "Kaza / Ramak Kala" },
        ])
      ) +
      section(
        "Olay Sınıfı",
        checkboxRow("İş Kazası — Yaralanmalı") +
          checkboxRow("İş Kazası — Yaralanmasız (Hasar)") +
          checkboxRow("Ramak Kala (yaralanma ve hasar yok)") +
          checkboxRow("Meslek Hastalığı Şüphesi")
      ) +
      section(
        "Olayın Anlatımı",
        `<div style="border:1px solid #1f2937;height:90px;padding:6px;font-size:10px;color:#9ca3af;">Olayın nasıl gerçekleştiği — kronolojik...</div>`
      ) +
      section(
        "Müdahale ve Sonuç",
        `<div style="border:1px solid #1f2937;height:60px;padding:6px;font-size:10px;color:#9ca3af;">İlk müdahale, sevk durumu, hastane vb.</div>`
      ) +
      section(
        "Kök Neden ve Önlem",
        `<div style="border:1px solid #1f2937;height:60px;padding:6px;font-size:10px;color:#9ca3af;">Kök neden analizi ve tekrarını önleyici aksiyon.</div>`
      ) +
      signatureBlocks("Bildiren / Personel", "İSG Uzmanı"),
  },
  {
    id: "isg-acil-durum",
    category: "isg",
    title: "Acil Durum & Yangın Eğitimi Katılım Belgesi",
    description: "Tahliye planı ve yangın eğitimi tebliği",
    body: () =>
      personnelInfoSection() +
      section(
        "Eğitim",
        fieldGrid2([
          { label: "Tarih" },
          { label: "Süre (saat)" },
          { label: "Eğitmen" },
          { label: "Yer" },
        ])
      ) +
      section(
        "Konular",
        [
          "Yangın türleri ve söndürme yöntemleri",
          "Yangın söndürme cihazı (YSC) kullanımı",
          "Tahliye planı ve toplanma yerleri",
          "Acil durum sinyalleri",
          "İlk yardım temel bilgiler",
          "Kimyasal döküntü ve sızıntı müdahalesi",
          "Deprem güvenliği",
        ]
          .map(checkboxRow)
          .join("")
      ) +
      paragraph(
        "Yukarıdaki konularda eğitim aldığımı, acil durum planını anladığımı ve gerektiğinde uygulayacağımı beyan ederim."
      ) +
      signatureBlocks("Personel", "İSG Uzmanı"),
  },
];

// ─── İstenen Belgeler Listesi (tek sayfa, personele verilecek checklist) ────
export interface DocChecklistItem {
  label: string;
  note?: string; // küçük açıklama / not
}
export interface DocChecklistSection {
  title: string;
  color: string; // hex
  items: DocChecklistItem[];
}

export const DOC_CHECKLIST: DocChecklistSection[] = [
  {
    title: "ÖZLÜK BELGELERİ",
    color: "#7c3aed",
    items: [
      { label: "Nüfus cüzdanı / yeni kimlik kartı fotokopisi (önlü-arkalı)" },
      { label: "Nüfus kayıt örneği", note: "e-Devlet'ten alınabilir" },
      { label: "İkametgah belgesi", note: "e-Devlet'ten alınabilir" },
      { label: "Adli sicil kaydı", note: "e-Devlet'ten alınabilir" },
      { label: "MYK belgesi · Diploma · Mezuniyet belgesi", note: "Üçü birden — yan yana" },
      { label: "Vesikalık fotoğraf", note: "4 adet, son 6 ay içinde çekilmiş" },
      { label: "İşe başlama sağlık raporu", note: "İşyeri hekimi veya aile hekimi" },
      { label: "AGİ (Aile Durumu Bildirim Formu)", note: "Eş ve çocuk bilgileri" },
      { label: "KVKK aydınlatma metni & açık rıza beyanı", note: "İmzalı" },
      { label: "SGK işe giriş bildirimi" },
      { label: "SGK hizmet dökümü", note: "Önceki çalışma kayıtları" },
      { label: "Alt yüklenici ise yüklenici ile olan sözleşme" },
      { label: "Geçici görevlendirme formu", note: "Başka şantiye/şubeden geliyorsa" },
      { label: "Banka hesap bilgileri / IBAN" },
      { label: "Askerlik durum belgesi", note: "Erkek personel için" },
      { label: "Ehliyet fotokopisi", note: "Varsa, araç kullanılacaksa zorunlu" },
    ],
  },
  {
    title: "İSG (İŞ SAĞLIĞI VE GÜVENLİĞİ) BELGELERİ",
    color: "#dc2626",
    items: [
      {
        label: "İSG genel eğitim katılım belgesi",
        note: "Az tehlikeli 8 saat · Tehlikeli 12 saat · Çok tehlikeli 16 saat",
      },
      { label: "KKD (Kişisel Koruyucu Donanım) zimmet imzası" },
      { label: "İSG kuralları okudum-anladım imza belgesi" },
      { label: "Yüksekte çalışma yetki belgesi", note: "≥ 2 m yüksekte çalışacaksa zorunlu" },
      { label: "Operatör belgesi", note: "Vinç, forklift, iş makinesi vb. kullanıcı ise" },
      { label: "İlk yardım eğitim belgesi", note: "Şantiyede ilk yardımcı atanıyorsa" },
      { label: "Periyodik sağlık muayene formu", note: "Yıllık — tehlike sınıfına göre" },
      { label: "Tetanos aşı kartı", note: "Kaynak/inşaat işlerinde önerilir" },
    ],
  },
];

// ─── Makine için belge listesi ───
export const MACHINE_DOC_CHECKLIST: DocChecklistSection[] = [
  {
    title: "RUHSAT & SİGORTA BELGELERİ",
    color: "#7c3aed",
    items: [
      {
        label: "İş Makinesi Tescil Belgesi (Ruhsat)",
        note: "Belediye veya Karayolları tarafından düzenlenir",
      },
      {
        label: "Zorunlu Mali Sorumluluk (Trafik) Sigortası",
        note: "Geçerlilik tarihi içinde olmalı",
      },
      {
        label: "Makine Kasko Sigortası",
        note: "Opsiyonel ama kuvvetle önerilir",
      },
      {
        label: "İMM (İhtiyari Mali Mesuliyet) Sigortası",
        note: "Yüksek tutarda hasar riski için",
      },
      {
        label: "Plaka Tescil Belgesi",
        note: "Karayolu kullanımı varsa",
      },
      {
        label: "Egzoz Emisyon Belgesi",
        note: "Yıllık — emisyon ölçüm raporu",
      },
    ],
  },
  {
    title: "PERİYODİK KONTROL & BAKIM",
    color: "#0ea5e9",
    items: [
      {
        label: "Periyodik Kontrol / Muayene Raporu",
        note: "İSG Yön. — yıllık · A tipi muayene kuruluşu",
      },
      {
        label: "TS EN ISO standartlarına uygunluk belgesi",
        note: "Vinç/forklift vb. için ilgili standart",
      },
      {
        label: "Yıllık Bakım / Servis Raporu",
        note: "Yetkili servis veya iç bakım kaydı",
      },
      {
        label: "Yağ değişim ve yağlama takip formu",
        note: "Periyodik bakım kaydı",
      },
      {
        label: "Hidrolik/pnömatik sistem kontrol raporu",
        note: "Sızıntı, basınç testi",
      },
      {
        label: "Yangın söndürücü kontrolü (varsa)",
        note: "TS 11827 — kabin içi YSC",
      },
    ],
  },
  {
    title: "OPERATÖR & İSG BELGELERİ",
    color: "#dc2626",
    items: [
      {
        label: "İş Makinesi Operatör Belgesi (G Sınıfı Ehliyet)",
        note: "MEB onaylı operatörlük kursu sertifikası",
      },
      {
        label: "Operatör psikoteknik raporu",
        note: "Ağır vasıta operatörleri için zorunlu",
      },
      {
        label: "Operatör sağlık raporu",
        note: "İşyeri hekimi onaylı",
      },
      {
        label: "Operatör İSG eğitim belgesi",
        note: "6331 sayılı kanun · tehlike sınıfına göre",
      },
      {
        label: "Makine Kullanım Kılavuzu (Üretici Manuali)",
        note: "Türkçe — kabin/yanında bulunmalı",
      },
      {
        label: "Acil durdurma & güvenlik talimatları",
        note: "Kabinde okunabilir yerde asılı",
      },
      {
        label: "Kalibrasyon belgesi (varsa)",
        note: "Yük göstergesi, terazi vb. ölçüm cihazları",
      },
    ],
  },
];

export async function downloadMachineDocumentChecklistPDF(
  context: HRDownloadContext = {}
): Promise<void> {
  return downloadChecklistPDF({
    context,
    sections: MACHINE_DOC_CHECKLIST,
    documentTitle: "Makine Saha Giriş Evrak Listesi",
    chipText: "İSTENEN MAKİNE BELGELERİ",
    infoFields: [
      { label: "Makine", placeholder: "Komatsu PC200 vb." },
      { label: "Plaka / Seri No" },
      { label: "Tip" },
      { label: "Firma" },
      { label: "Operatör" },
      { label: "Saha Giriş Tarihi" },
    ],
    warning: {
      title: "Beyan ve Sahte Belge Uyarısı",
      intro:
        "Bu makineye ait sunduğum tüm belgelerin gerçek, geçerli ve kendi makineme/firmama ait olduğunu beyan ederim. " +
        "<strong>Sahte, süresi geçmiş veya başkasına ait belge sunulması</strong> halinde aşağıdaki yaptırımlar uygulanır:",
      bullets: [
        "<strong>TCK Md. 204 — Resmi Belgede Sahtecilik:</strong> 2 yıldan 5 yıla kadar hapis.",
        "<strong>TCK Md. 206 — Yalan Beyan:</strong> 3 aydan 2 yıla kadar hapis veya adli para cezası.",
        "<strong>2918 Karayolları Trafik Kanunu Md. 36:</strong> Tescilsiz/sigortasız iş makinesi trafiğe çıkarılamaz; yüksek tutarda idari para cezası ve makinenin trafikten men edilmesi.",
        "<strong>6331 İSG Kanunu Md. 30:</strong> Periyodik kontrolü yapılmamış iş ekipmanı çalıştırılamaz; yasak ve idari para cezası.",
        "<strong>Saha girişi reddedilir</strong>, sözleşme feshedilir, yapılan tüm masraflar tahsil edilir.",
        "İş kazası halinde <strong>tüm sorumluluk operatör ve makine sahibinde</strong>; rücu hakkı kaybolur.",
      ],
      conclusion:
        "Belgelerin tamamının eksiksiz, gerçek ve süresi geçerli olarak teslim edildiğini imzamla onaylıyorum.",
    },
    signers: [
      { label: "Operatör" },
      { label: "Makine Sahibi / Firma", sub: "Yetkili — Kaşe-İmza" },
      { label: "Teslim Alan (Şantiye/İSG)" },
    ],
    fileName: `istenen-makine-belgeleri-${toISODate(new Date())}`,
  });
}

interface ChecklistConfig {
  context: HRDownloadContext;
  sections: DocChecklistSection[];
  documentTitle: string;
  chipText: string;
  infoFields: Array<{ label: string; placeholder?: string }>;
  warning: {
    title: string;
    intro: string;
    bullets: string[];
    conclusion: string;
  };
  signers: Array<{ label: string; sub?: string }>;
  fileName: string;
}

async function downloadChecklistPDF(config: ChecklistConfig): Promise<void> {
  const { context, sections, documentTitle, chipText, infoFields, warning, signers, fileName } =
    config;
  const today = formatDate(toISODate(new Date()));
  const A4_PX_W = 794;

  // Geist font
  const fontResp = await fetch("/fonts/Geist-Regular.ttf");
  if (!fontResp.ok) throw new Error("Font yüklenemedi");
  const fontBuf = await fontResp.arrayBuffer();
  const fontB64 = (() => {
    const bytes = new Uint8Array(fontBuf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + chunk))
      );
    }
    return btoa(binary);
  })();

  const root = document.createElement("div");
  root.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: ${A4_PX_W}px;
    background: #ffffff;
    color: #0a0a0a;
    font-family: Inter, -apple-system, "Segoe UI", system-ui, sans-serif;
    font-size: 11px;
    line-height: 1.4;
  `;

  function twoColumnList(items: DocChecklistItem[], color: string): string {
    const half = Math.ceil(items.length / 2);
    const col1 = items.slice(0, half);
    const col2 = items.slice(half);
    const itemHtml = (item: DocChecklistItem) => `
      <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;break-inside:avoid;">
        <span style="width:14px;height:14px;border:1.5px solid ${color};display:inline-block;flex-shrink:0;margin-top:1px;border-radius:2px;"></span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:10.5px;font-weight:600;color:#111827;line-height:1.4;">${escapeHtml(item.label)}</div>
          ${item.note ? `<div style="font-size:9px;color:#6b7280;line-height:1.35;margin-top:2px;">${escapeHtml(item.note)}</div>` : ""}
        </div>
      </div>
    `;
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 22px;">
        <div>${col1.map(itemHtml).join("")}</div>
        <div>${col2.map(itemHtml).join("")}</div>
      </div>
    `;
  }

  const sectionsHtml = sections
    .map(
      (sec) => `
    <div style="margin-top:14px;border:1px solid ${sec.color};border-radius:8px;overflow:hidden;break-inside:avoid;">
      <div style="background:${sec.color};color:white;padding:8px 14px;font-size:11px;font-weight:800;letter-spacing:0.5px;">
        ${escapeHtml(sec.title)}
      </div>
      <div style="padding:6px 14px 10px;">
        ${twoColumnList(sec.items, sec.color)}
      </div>
    </div>
  `
    )
    .join("");

  // Info grid: max 3 columns
  const cols = Math.min(3, infoFields.length);
  const infoFieldHtml = infoFields
    .map(
      (f) => `
    <div style="display:flex;align-items:flex-end;gap:6px;">
      <span style="font-size:10px;font-weight:600;color:#374151;min-width:88px;">${escapeHtml(f.label)}:</span>
      <span style="flex:1;border-bottom:1px solid #1f2937;height:14px;"></span>
    </div>
  `
    )
    .join("");

  const bulletsHtml = warning.bullets
    .map((b) => `<div>• ${b}</div>`)
    .join("");

  const signersHtml = signers
    .map(
      (s) => `
    <div>
      <div style="font-weight:700;color:#374151;">${escapeHtml(s.label)}</div>
      <div style="font-size:9px;color:#9ca3af;margin-top:4px;">Tarih: ___________________</div>
      <div style="margin-top:32px;border-top:1px solid #1f2937;font-size:9px;color:#6b7280;padding-top:3px;">${escapeHtml(s.sub ?? "Ad-Soyad / İmza")}</div>
    </div>
  `
    )
    .join("");

  root.innerHTML = `
    <div style="padding: 0;">
      <div style="padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;">
        <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;margin-bottom:8px;">${escapeHtml(infoFields.length > 4 ? "Makine Bilgileri" : "Personel Bilgileri")}</div>
        <div style="display:grid;grid-template-columns:repeat(${cols}, 1fr);gap:10px 22px;">
          ${infoFieldHtml}
        </div>
      </div>

      <div style="margin-top:12px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:0 6px 6px 0;">
        <div style="font-size:10px;font-weight:800;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">
          ⚠ ${escapeHtml(warning.title)}
        </div>
        <div style="font-size:9.5px;line-height:1.55;color:#7f1d1d;">
          ${warning.intro}
        </div>
        <div style="margin-top:6px;font-size:9px;line-height:1.55;color:#7f1d1d;padding-left:8px;">
          ${bulletsHtml}
        </div>
        <div style="margin-top:6px;font-size:9px;line-height:1.55;color:#991b1b;font-weight:600;">
          ${warning.conclusion}
        </div>
      </div>

      ${sectionsHtml}

      <div style="margin-top:18px;padding-top:12px;border-top:1px dashed #d4d4d8;display:grid;grid-template-columns:repeat(${signers.length}, 1fr);gap:16px;font-size:10px;break-inside:avoid;">
        ${signersHtml}
      </div>
    </div>
  `;

  document.body.appendChild(root);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas-pro"),
    ]);

    const canvas = await html2canvas(root, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: A4_PX_W,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    pdf.addFileToVFS("Geist-Regular.ttf", fontB64);
    pdf.addFont("Geist-Regular.ttf", "Geist", "normal");
    pdf.addFont("Geist-Regular.ttf", "Geist", "bold");

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();
    const marginX = 10;
    const headerH = 22;
    const footerH = 10;
    const bodyTop = headerH + 4;
    const bodyBottom = pageH - footerH - 3;
    const bodyMaxH = bodyBottom - bodyTop;
    const contentW = pageW - marginX * 2;
    const pxPerMm = canvas.width / contentW;
    const bodyMaxHpx = bodyMaxH * pxPerMm;

    const ctx = canvas.getContext("2d");
    function isRowMostlyWhite(y: number): boolean {
      if (!ctx) return false;
      const data = ctx.getImageData(0, y, canvas.width, 1).data;
      let whiteCount = 0;
      const total = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 4 || (r > 240 && g > 240 && b > 240)) whiteCount++;
      }
      return whiteCount / total >= 0.985;
    }
    function findSafeBreak(yStart: number, naturalEnd: number): number {
      const minBreak = yStart + (naturalEnd - yStart) * 0.7;
      for (let y = naturalEnd - 1; y >= minBreak; y--) {
        if (isRowMostlyWhite(y)) return y + 1;
      }
      return naturalEnd;
    }

    let yOffset = 0;
    let pageNo = 0;
    while (yOffset < canvas.height) {
      const naturalEnd = Math.min(yOffset + bodyMaxHpx, canvas.height);
      const isLast = naturalEnd >= canvas.height;
      const safeEnd = isLast ? naturalEnd : findSafeBreak(yOffset, naturalEnd);
      const sliceH = safeEnd - yOffset;
      if (sliceH <= 0) break;

      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const sctx = slice.getContext("2d");
      if (!sctx) break;
      sctx.fillStyle = "#ffffff";
      sctx.fillRect(0, 0, slice.width, slice.height);
      sctx.drawImage(canvas, 0, -yOffset);
      const imgData = slice.toDataURL("image/png");

      if (pageNo > 0) pdf.addPage();
      const imgMmH = sliceH / pxPerMm;
      pdf.addImage(imgData, "PNG", marginX, bodyTop, contentW, imgMmH);

      // Slice canvas'ı bellekten serbest bırak
      sctx.clearRect(0, 0, slice.width, slice.height);
      slice.width = 0;
      slice.height = 0;

      yOffset = safeEnd;
      pageNo++;
      if (pageNo > 20) break;
    }

    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);

      pdf.setFillColor(4, 120, 87);
      pdf.rect(0, 0, pageW, headerH, "F");
      pdf.setFillColor(16, 185, 129);
      pdf.rect(0, headerH - 1.2, pageW, 1.2, "F");

      pdf.setFont("Geist", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(220, 252, 231);
      pdf.text(chipText, marginX, 7);

      pdf.setFont("Geist", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(255, 255, 255);
      pdf.text(documentTitle, marginX, 13.5);

      if (context.projectName) {
        pdf.setFont("Geist", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(209, 250, 229);
        pdf.text(context.projectName, marginX, 18.5);
      }

      pdf.setFont("Geist", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text(today, pageW - marginX, 8.5, { align: "right" });
      if (totalPages > 1) {
        pdf.setFont("Geist", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(209, 250, 229);
        pdf.text(`Sayfa ${i} / ${totalPages}`, pageW - marginX, 14, { align: "right" });
      }

      pdf.setDrawColor(212, 212, 216);
      pdf.setLineWidth(0.2);
      pdf.line(marginX, pageH - footerH + 2, pageW - marginX, pageH - footerH + 2);
      pdf.setFont("Geist", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(140, 140, 140);
      const leftFooter = `${context.projectName ?? ""}${context.projectName ? "  ·  " : ""}proje-yonetim-platformu`;
      pdf.text(leftFooter, marginX, pageH - 4);
      pdf.text(`${today}  ·  ${fileName}  ·  ${i}/${totalPages}`, pageW - marginX, pageH - 4, { align: "right" });
    }

    pdf.save(`${fileName}.pdf`);
  } finally {
    document.body.removeChild(root);
  }
}

export async function downloadDocumentChecklistPDF(
  context: HRDownloadContext = {}
): Promise<void> {
  const today = formatDate(toISODate(new Date()));
  const A4_PX_W = 794;

  // ─── Geist font yükle (Türkçe karakterler için) ───
  const fontResp = await fetch("/fonts/Geist-Regular.ttf");
  if (!fontResp.ok) throw new Error("Font yüklenemedi");
  const fontBuf = await fontResp.arrayBuffer();
  const fontB64 = (() => {
    const bytes = new Uint8Array(fontBuf);
    let binary = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      binary += String.fromCharCode.apply(
        null,
        Array.from(bytes.subarray(i, i + chunk))
      );
    }
    return btoa(binary);
  })();

  // ─── Body HTML (brand header BURADA YOK — her sayfaya jsPDF ile ayrı çizilir) ───
  const root = document.createElement("div");
  root.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: ${A4_PX_W}px;
    background: #ffffff;
    color: #0a0a0a;
    font-family: Inter, -apple-system, "Segoe UI", system-ui, sans-serif;
    font-size: 11px;
    line-height: 1.4;
  `;

  // Her sekmedeki öğeleri iki sütuna böl — ferahlatılmış padding
  function twoColumnList(items: DocChecklistItem[], color: string): string {
    const half = Math.ceil(items.length / 2);
    const col1 = items.slice(0, half);
    const col2 = items.slice(half);
    const itemHtml = (item: DocChecklistItem) => `
      <div style="display:flex;align-items:flex-start;gap:9px;padding:8px 0;break-inside:avoid;">
        <span style="width:14px;height:14px;border:1.5px solid ${color};display:inline-block;flex-shrink:0;margin-top:1px;border-radius:2px;"></span>
        <div style="flex:1;min-width:0;">
          <div style="font-size:10.5px;font-weight:600;color:#111827;line-height:1.4;">${escapeHtml(item.label)}</div>
          ${item.note ? `<div style="font-size:9px;color:#6b7280;line-height:1.35;margin-top:2px;">${escapeHtml(item.note)}</div>` : ""}
        </div>
      </div>
    `;
    return `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:0 22px;">
        <div>${col1.map(itemHtml).join("")}</div>
        <div>${col2.map(itemHtml).join("")}</div>
      </div>
    `;
  }

  const sectionsHtml = DOC_CHECKLIST.map((sec) => `
    <div style="margin-top:14px;border:1px solid ${sec.color};border-radius:8px;overflow:hidden;break-inside:avoid;">
      <div style="background:${sec.color};color:white;padding:8px 14px;font-size:11px;font-weight:800;letter-spacing:0.5px;">
        ${escapeHtml(sec.title)}
      </div>
      <div style="padding:6px 14px 10px;">
        ${twoColumnList(sec.items, sec.color)}
      </div>
    </div>
  `).join("");

  root.innerHTML = `
    <div style="padding: 0;">
      <!-- Personel bilgi şeridi — 3x2 grid -->
      <div style="padding:12px 16px;border:1px solid #e5e7eb;border-radius:8px;background:#fafafa;">
        <div style="font-size:9.5px;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;color:#6b7280;margin-bottom:8px;">Personel Bilgileri</div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px 22px;">
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span style="font-size:10px;font-weight:600;color:#374151;min-width:68px;">Ad Soyad:</span>
            <span style="flex:1;border-bottom:1px solid #1f2937;height:14px;"></span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span style="font-size:10px;font-weight:600;color:#374151;min-width:68px;">TC No:</span>
            <span style="flex:1;border-bottom:1px solid #1f2937;height:14px;"></span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span style="font-size:10px;font-weight:600;color:#374151;min-width:68px;">Telefon:</span>
            <span style="flex:1;border-bottom:1px solid #1f2937;height:14px;"></span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span style="font-size:10px;font-weight:600;color:#374151;min-width:68px;">Firma:</span>
            <span style="flex:1;border-bottom:1px solid #1f2937;height:14px;"></span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span style="font-size:10px;font-weight:600;color:#374151;min-width:68px;">Görev:</span>
            <span style="flex:1;border-bottom:1px solid #1f2937;height:14px;"></span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:6px;">
            <span style="font-size:10px;font-weight:600;color:#374151;min-width:68px;">İşe Giriş:</span>
            <span style="flex:1;border-bottom:1px solid #1f2937;height:14px;"></span>
          </div>
        </div>
      </div>

      <!-- İŞÇİ-TARAFI BEYAN UYARISI (sahte belge → cezai sorumluluk) -->
      <div style="margin-top:12px;padding:10px 14px;background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:0 6px 6px 0;">
        <div style="font-size:10px;font-weight:800;color:#991b1b;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:5px;">
          ⚠ Beyan ve Sahte Belge Uyarısı
        </div>
        <div style="font-size:9.5px;line-height:1.55;color:#7f1d1d;">
          Sunduğum tüm belgelerin gerçeğe uygun ve kendime ait olduğunu beyan ederim.
          <strong>Sahte, tahrif edilmiş veya başkasına ait belge sunulması</strong> halinde
          aşağıdaki yaptırımlar tarafıma uygulanır:
        </div>
        <div style="margin-top:6px;font-size:9px;line-height:1.55;color:#7f1d1d;padding-left:8px;">
          • <strong>TCK Md. 204 — Resmi Belgede Sahtecilik:</strong> 2 yıldan 5 yıla kadar hapis cezası.<br/>
          • <strong>TCK Md. 206 — Yalan Beyan:</strong> 3 aydan 2 yıla kadar hapis veya adli para cezası.<br/>
          • <strong>4857 İş Kanunu Md. 25/II-a:</strong> İş sözleşmesinin <strong>haklı sebeple feshi</strong> — kıdem ve ihbar tazminatı alamam, işsizlik maaşından yararlanamam.<br/>
          • Tarafıma yapılan tüm ödemeler işveren tarafından iade istenebilir.<br/>
          • Hakkımda <strong>Cumhuriyet Savcılığına suç duyurusu</strong> yapılır.
        </div>
        <div style="margin-top:6px;font-size:9px;line-height:1.55;color:#991b1b;font-weight:600;">
          Belgeleri eksiksiz, gerçeğe uygun ve kendi adıma teslim ettiğimi imzamla onaylıyorum.
        </div>
      </div>

      <!-- Listeler (her biri 2 sütun) -->
      ${sectionsHtml}

      <!-- İmza bloğu — 3 imza: Personel + Çalıştığı Firma + Teslim Alan (İK) -->
      <div style="margin-top:18px;padding-top:12px;border-top:1px dashed #d4d4d8;display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;font-size:10px;break-inside:avoid;">
        <div>
          <div style="font-weight:700;color:#374151;">Personel</div>
          <div style="font-size:9px;color:#9ca3af;margin-top:4px;">Tarih: ___________________</div>
          <div style="margin-top:32px;border-top:1px solid #1f2937;font-size:9px;color:#6b7280;padding-top:3px;">Ad-Soyad / İmza</div>
        </div>
        <div>
          <div style="font-weight:700;color:#374151;">Çalıştığı Firma</div>
          <div style="font-size:9px;color:#9ca3af;margin-top:4px;">Yetkili — Tarih: __________</div>
          <div style="margin-top:32px;border-top:1px solid #1f2937;font-size:9px;color:#6b7280;padding-top:3px;">Ad-Soyad · Unvan / Kaşe-İmza</div>
        </div>
        <div>
          <div style="font-weight:700;color:#374151;">Teslim Alan (İK)</div>
          <div style="font-size:9px;color:#9ca3af;margin-top:4px;">Tarih: ___________________</div>
          <div style="margin-top:32px;border-top:1px solid #1f2937;font-size:9px;color:#6b7280;padding-top:3px;">Ad-Soyad / İmza</div>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(root);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas-pro"),
    ]);

    const canvas = await html2canvas(root, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      logging: false,
      windowWidth: A4_PX_W,
    });

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    pdf.addFileToVFS("Geist-Regular.ttf", fontB64);
    pdf.addFont("Geist-Regular.ttf", "Geist", "normal");
    pdf.addFont("Geist-Regular.ttf", "Geist", "bold");

    const pageW = pdf.internal.pageSize.getWidth();
    const pageH = pdf.internal.pageSize.getHeight();

    // Her sayfa düzeni:
    //   [Brand Header (jsPDF ile)] — 22mm
    //   [Body slice (HTML canvas)] — kalan alan
    //   [Footer (jsPDF ile)] — 8mm
    const marginX = 10;
    const headerH = 22;
    const footerH = 10;
    const bodyTopGap = 4; // header'dan sonra body öncesi boşluk
    const bodyBottomGap = 3; // body sonrası footer öncesi boşluk
    const bodyTop = headerH + bodyTopGap;
    const bodyBottom = pageH - footerH - bodyBottomGap;
    const bodyMaxH = bodyBottom - bodyTop; // mm
    const contentW = pageW - marginX * 2;
    const pxPerMm = canvas.width / contentW;
    const bodyMaxHpx = bodyMaxH * pxPerMm;

    const ctx = canvas.getContext("2d");

    // Güvenli kırılım yardımcısı — body içinde içerik ortasından kesmesin
    function isRowMostlyWhite(y: number): boolean {
      if (!ctx) return false;
      const data = ctx.getImageData(0, y, canvas.width, 1).data;
      let whiteCount = 0;
      const total = data.length / 4;
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 4 || (r > 240 && g > 240 && b > 240)) whiteCount++;
      }
      return whiteCount / total >= 0.985;
    }
    function findSafeBreak(yStart: number, naturalEnd: number): number {
      const minBreak = yStart + (naturalEnd - yStart) * 0.7;
      for (let y = naturalEnd - 1; y >= minBreak; y--) {
        if (isRowMostlyWhite(y)) return y + 1;
      }
      return naturalEnd;
    }

    // ─── Body'yi sayfalara böl ───
    let yOffset = 0;
    let pageNo = 0;
    while (yOffset < canvas.height) {
      const naturalEnd = Math.min(yOffset + bodyMaxHpx, canvas.height);
      const isLast = naturalEnd >= canvas.height;
      const safeEnd = isLast ? naturalEnd : findSafeBreak(yOffset, naturalEnd);
      const sliceH = safeEnd - yOffset;
      if (sliceH <= 0) break;

      const slice = document.createElement("canvas");
      slice.width = canvas.width;
      slice.height = sliceH;
      const sctx = slice.getContext("2d");
      if (!sctx) break;
      sctx.fillStyle = "#ffffff";
      sctx.fillRect(0, 0, slice.width, slice.height);
      sctx.drawImage(canvas, 0, -yOffset);
      const imgData = slice.toDataURL("image/png");

      if (pageNo > 0) pdf.addPage();
      const imgMmH = sliceH / pxPerMm;
      pdf.addImage(imgData, "PNG", marginX, bodyTop, contentW, imgMmH);

      // Slice canvas'ı bellekten serbest bırak
      sctx.clearRect(0, 0, slice.width, slice.height);
      slice.width = 0;
      slice.height = 0;

      yOffset = safeEnd;
      pageNo++;
      if (pageNo > 20) break;
    }

    // ─── Her sayfaya brand header + footer çiz ───
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);

      // HEADER — brand-700 düz dolgu + sağda emerald-500 vurgu şeridi
      pdf.setFillColor(4, 120, 87); // brand-700
      pdf.rect(0, 0, pageW, headerH, "F");
      pdf.setFillColor(16, 185, 129); // brand-500
      pdf.rect(0, headerH - 1.2, pageW, 1.2, "F");

      pdf.setFont("Geist", "bold");
      pdf.setFontSize(7);
      pdf.setTextColor(220, 252, 231);
      pdf.text("İSTENEN BELGELER", marginX, 7);

      pdf.setFont("Geist", "bold");
      pdf.setFontSize(13);
      pdf.setTextColor(255, 255, 255);
      pdf.text("Personel İşe Giriş Evrak Listesi", marginX, 13.5);

      if (context.projectName) {
        pdf.setFont("Geist", "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(209, 250, 229);
        pdf.text(context.projectName, marginX, 18.5);
      }

      // Sağ blok — tarih + sayfa
      pdf.setFont("Geist", "bold");
      pdf.setFontSize(9.5);
      pdf.setTextColor(255, 255, 255);
      pdf.text(today, pageW - marginX, 8.5, { align: "right" });
      if (totalPages > 1) {
        pdf.setFont("Geist", "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(209, 250, 229);
        pdf.text(`Sayfa ${i} / ${totalPages}`, pageW - marginX, 14, { align: "right" });
      }

      // FOOTER
      pdf.setDrawColor(212, 212, 216);
      pdf.setLineWidth(0.2);
      pdf.line(marginX, pageH - footerH + 2, pageW - marginX, pageH - footerH + 2);
      pdf.setFont("Geist", "normal");
      pdf.setFontSize(7);
      pdf.setTextColor(140, 140, 140);
      const leftFooter = `${context.projectName ?? ""}${context.projectName ? "  ·  " : ""}proje-yonetim-platformu`;
      pdf.text(leftFooter, marginX, pageH - 4);
      pdf.text(`${today}  ·  istenen-belgeler-listesi  ·  ${i}/${totalPages}`, pageW - marginX, pageH - 4, { align: "right" });
    }

    pdf.save(`istenen-belgeler-listesi-${toISODate(new Date())}.pdf`);
  } finally {
    document.body.removeChild(root);
  }
}

const TONE_GRADIENT: Record<HRCategory, { from: string; to: string; chip: string }> = {
  ozluk: { from: "#7c3aed", to: "#5b21b6", chip: "ÖZLÜK BELGESİ" },
  isg: { from: "#dc2626", to: "#991b1b", chip: "İSG BELGESİ" },
};

export interface HRDownloadContext {
  projectName?: string;
  companyName?: string;
}

export async function downloadHRTemplatePDF(
  template: HRTemplate,
  context: HRDownloadContext = {}
): Promise<void> {
  const palette = TONE_GRADIENT[template.category];
  const today = formatDate(toISODate(new Date()));
  const A4_PX_W = 794;
  const root = document.createElement("div");
  root.style.cssText = `
    position: fixed;
    left: -10000px;
    top: 0;
    width: ${A4_PX_W}px;
    background: #ffffff;
    color: #0a0a0a;
    font-family: Inter, -apple-system, "Segoe UI", system-ui, sans-serif;
    font-size: 11px;
    line-height: 1.4;
  `;

  root.innerHTML = `
    <div style="padding: 22px;">
      <div style="
        background: linear-gradient(135deg, ${palette.from} 0%, ${palette.to} 100%);
        color: white;
        padding: 14px 18px;
        border-radius: 10px;
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: 6px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.06);
      ">
        <div>
          <div style="font-size: 9px; font-weight: 700; letter-spacing: 1.2px; opacity: 0.85;">${palette.chip}</div>
          <div style="font-size: 17px; font-weight: 800; letter-spacing: -0.3px; line-height: 1.15; margin-top: 3px;">${escapeHtml(template.title)}</div>
          ${context.projectName ? `<div style="font-size: 10px; opacity: 0.85; margin-top: 2px;">${escapeHtml(context.projectName)}</div>` : ""}
          ${context.companyName ? `<div style="font-size: 9.5px; opacity: 0.75; margin-top: 1px;">${escapeHtml(context.companyName)}</div>` : ""}
        </div>
        <div style="text-align: right; font-family: 'JetBrains Mono', ui-monospace, monospace;">
          <div style="font-size: 12px; font-weight: 700;">${today}</div>
          <div style="font-size: 8.5px; opacity: 0.85; margin-top: 2px;">DOC-${template.id}</div>
        </div>
      </div>

      <div style="padding: 4px 2px;">
        ${template.body()}
      </div>

      <div style="
        margin-top: 22px;
        padding-top: 8px;
        border-top: 1px dashed #d4d4d8;
        display: flex;
        justify-content: space-between;
        font-size: 8.5px;
        color: #a1a1aa;
        font-family: 'JetBrains Mono', ui-monospace, monospace;
      ">
        <span>${escapeHtml(context.projectName ?? "")} · proje-yonetim-platformu</span>
        <span>${today} · ${template.id}</span>
      </div>
    </div>
  `;

  document.body.appendChild(root);
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

  try {
    await renderHtmlToPdf({
      element: root,
      fileName: `${template.id}-${toISODate(new Date())}`,
      pxWidth: A4_PX_W,
    });
  } finally {
    document.body.removeChild(root);
  }
}
