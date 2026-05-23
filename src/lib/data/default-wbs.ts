// GES Proje Varsayılan WBS Şablonu
// 4 seviye (0-3): Proje > Ana Başlık > Alt Başlık > İş Kalemi (Yaprak)

export type WbsLevel = 0 | 1 | 2 | 3;

export interface WbsTemplateItem {
  code: string;
  name: string;
  quantity: number;
  level: WbsLevel;
  isLeaf: boolean;
  unit: string;
  weight: number;
}

export const DEFAULT_WBS: WbsTemplateItem[] = [
  // ═══════════════ 1 PROJE KÖK ═══════════════
  { code: "1", name: "Proje", quantity: 0, level: 0, isLeaf: false, unit: "", weight: 0 },

  // ═══════════════ 1.1 UYGULAMA ÖNCESİ ═══════════════
  { code: "1.1", name: "Uygulama Öncesi", quantity: 0, level: 1, isLeaf: false, unit: "", weight: 0 },

  // 1.1.1 Sözleşme İmza ve Yer Teslim
  { code: "1.1.1", name: "Sözleşme İmza ve Yer Teslim", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.1.1.1", name: "Sözleşme İmzalanması", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.50 },
  { code: "1.1.1.2", name: "Yer Teslimi", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.50 },

  // 1.1.2 Mühendislik (Zemin / Elektrik / Mekanik disiplinleri ad ön ekiyle)
  { code: "1.1.2", name: "Mühendislik", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  // Zemin
  { code: "1.1.2.1", name: "Zemin · Topografik ölçüm (halihazır harita)", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.05 },
  { code: "1.1.2.2", name: "Zemin · Zemin etüdü (jeoteknik raporu)", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.20 },
  { code: "1.1.2.3", name: "Zemin · Hidrojeolojik Etüt", quantity: 1, level: 3, isLeaf: true, unit: "Nokta", weight: 0.05 },
  { code: "1.1.2.4", name: "Zemin · Saha tesviye (kazı-dolgu projeleri)", quantity: 113248, level: 3, isLeaf: true, unit: "m²", weight: 0.20 },
  { code: "1.1.2.5", name: "Zemin · Drenaj Projelendirme", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.10 },
  { code: "1.1.2.6", name: "Zemin · POT", quantity: 35, level: 3, isLeaf: true, unit: "Nokta", weight: 0.40 },
  // Elektrik
  { code: "1.1.2.7", name: "Elektrik · Genel Yerleşim - IFA", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.30 },
  { code: "1.1.2.8", name: "Elektrik · Tek Hat Şeması - IFA", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.10 },
  { code: "1.1.2.9", name: "Elektrik · İletişim - IFA", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.10 },
  { code: "1.1.2.10", name: "Elektrik · ENH Projelendirme - IFA", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.10 },
  { code: "1.1.2.11", name: "Elektrik · Pano Projeleri - IFA", quantity: 7, level: 3, isLeaf: true, unit: "Set", weight: 0.05 },
  { code: "1.1.2.12", name: "Elektrik · Röle Set Değerleri", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.05 },
  { code: "1.1.2.13", name: "Elektrik · AFC - Kurum Onayı", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.20 },
  // Mekanik
  { code: "1.1.2.14", name: "Mekanik · Statik Çizim - IFA", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.50 },
  { code: "1.1.2.15", name: "Mekanik · İnverter Askı - IFA", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.20 },
  { code: "1.1.2.16", name: "Mekanik · AFC - Üniversite Onayı", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.20 },

  // ═══════════════ 1.2 İNŞAAT (Projelendirme) ═══════════════
  { code: "1.2", name: "İnşaat", quantity: 0, level: 1, isLeaf: false, unit: "", weight: 0 },
  { code: "1.2.1", name: "İnşaat", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.2.1.1", name: "Trafo binaları betonarme projeleri", quantity: 7, level: 3, isLeaf: true, unit: "Set", weight: 0.20 },
  { code: "1.2.1.2", name: "İdari Bina Projeleri", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.30 },
  { code: "1.2.1.3", name: "Dağıtım Binası Projeleri", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.30 },
  { code: "1.2.1.4", name: "Saha İçi Yollar", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.10 },
  { code: "1.2.1.5", name: "Telçit Projelendirme", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.10 },

  // ═══════════════ 1.3 PROCUREMENT VE LOJİSTİK ═══════════════
  { code: "1.3", name: "Procurement ve Lojistik", quantity: 0, level: 1, isLeaf: false, unit: "", weight: 0 },

  // 1.3.1 Purchase Order
  { code: "1.3.1", name: "Purchase Order", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.3.1.1", name: "Solar Panel", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.20 },
  { code: "1.3.1.2", name: "İnverter", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.05 },
  { code: "1.3.1.3", name: "Taşıyıcı Sistem", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.05 },
  { code: "1.3.1.4", name: "Hafriyat İşleri", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.05 },
  { code: "1.3.1.5", name: "Trafo", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.03 },
  { code: "1.3.1.6", name: "OG Hücreler", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.05 },
  { code: "1.3.1.7", name: "AG / MV Kablolar", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.05 },
  { code: "1.3.1.8", name: "AC / MV Kablolar", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.05 },
  { code: "1.3.1.9", name: "DC Kablolar", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.02 },
  { code: "1.3.1.10", name: "Panolar", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.05 },
  { code: "1.3.1.11", name: "Topraklama Ekipmanları", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.03 },
  { code: "1.3.1.12", name: "Aydınlatma ve CCTV", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.10 },
  { code: "1.3.1.13", name: "SCADA", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.01 },
  { code: "1.3.1.14", name: "Telçit", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.02 },
  { code: "1.3.1.15", name: "Borular", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.03 },
  { code: "1.3.1.16", name: "Kum ve Bims", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.05 },
  { code: "1.3.1.17", name: "Konnektör ve Bağlantı Elemanları", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.03 },
  { code: "1.3.1.18", name: "Etiketleme", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.01 },

  // 1.3.2 Üretim ve Lojistik Operasyonları
  { code: "1.3.2", name: "Üretim ve Lojistik Operasyonları", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.3.2.1", name: "Solar Panel", quantity: 16992, level: 3, isLeaf: true, unit: "Adet", weight: 0.30 },
  { code: "1.3.2.2", name: "İnverter", quantity: 28, level: 3, isLeaf: true, unit: "Adet", weight: 0.30 },
  { code: "1.3.2.3", name: "Taşıyıcı Sistem", quantity: 9.94, level: 3, isLeaf: true, unit: "MWp", weight: 0.30 },
  { code: "1.3.2.4", name: "Hafriyat İşleri", quantity: 113248, level: 3, isLeaf: true, unit: "m²", weight: 0.01 },
  { code: "1.3.2.5", name: "Trafo", quantity: 7, level: 3, isLeaf: true, unit: "Adet", weight: 0.05 },
  { code: "1.3.2.6", name: "OG Hücreler", quantity: 29, level: 3, isLeaf: true, unit: "Adet", weight: 0.05 },
  { code: "1.3.2.7", name: "AC / LV Kablolar", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.01 },
  { code: "1.3.2.8", name: "AC / MV Kablolar", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.01 },
  { code: "1.3.2.9", name: "DC Kablolar", quantity: 108121, level: 3, isLeaf: true, unit: "m", weight: 0.01 },
  { code: "1.3.2.10", name: "Panolar", quantity: 7, level: 3, isLeaf: true, unit: "Adet", weight: 0.10 },
  { code: "1.3.2.11", name: "Topraklama Ekipmanları", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.01 },
  { code: "1.3.2.12", name: "Aydınlatma ve CCTV", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.01 },
  { code: "1.3.2.13", name: "SCADA", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.01 },
  { code: "1.3.2.14", name: "Telçit", quantity: 2205, level: 3, isLeaf: true, unit: "m", weight: 0.05 },
  { code: "1.3.2.15", name: "Borular", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.01 },
  { code: "1.3.2.16", name: "Kum ve Bims", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.01 },
  { code: "1.3.2.17", name: "Konnektör ve Bağlantı Elemanları", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.01 },
  { code: "1.3.2.18", name: "Etiketleme", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.01 },

  // ═══════════════ 1.4 İŞÇİLİK FAALİYETLERİ ═══════════════
  { code: "1.4", name: "İşçilik Faaliyetleri", quantity: 0, level: 1, isLeaf: false, unit: "", weight: 0 },

  // 1.4.1 İnşaat
  { code: "1.4.1", name: "İnşaat", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.4.1.1", name: "Mobilizasyon - Konteynerin Kurulumu", quantity: 2, level: 3, isLeaf: true, unit: "Set", weight: 0.10 },
  { code: "1.4.1.2", name: "Mobilizasyon - Geçici Elektrik ve Su Temini", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.10 },
  { code: "1.4.1.3", name: "Mobilizasyon - Şantiye Ulaşım Yolları", quantity: 113248, level: 3, isLeaf: true, unit: "m²", weight: 0.10 },
  { code: "1.4.1.4", name: "Hafriyat - toprak sıyırma", quantity: 113248, level: 3, isLeaf: true, unit: "m²", weight: 0.30 },
  { code: "1.4.1.5", name: "Drenaj", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.10 },
  { code: "1.4.1.6", name: "Temel İşleri", quantity: 7, level: 3, isLeaf: true, unit: "Set", weight: 0.15 },
  { code: "1.4.1.7", name: "Mıcır Serilmesi", quantity: 424, level: 3, isLeaf: true, unit: "Ton", weight: 0.05 },
  { code: "1.4.1.8", name: "İdari Bina Yapımı", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.10 },

  // 1.4.2 Taşıyıcı Sistem
  { code: "1.4.2", name: "Taşıyıcı Sistem", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.4.2.1", name: "Taşıyıcı Sistem - Delgi", quantity: 8496, level: 3, isLeaf: true, unit: "Delik", weight: 0.10 },
  { code: "1.4.2.2", name: "Taşıyıcı Sistem - Kolon Montajı", quantity: 8496, level: 3, isLeaf: true, unit: "Kolon", weight: 0.30 },
  { code: "1.4.2.3", name: "Taşıyıcı Sistem - Kirişleme", quantity: 5600, level: 3, isLeaf: true, unit: "Kiriş", weight: 0.30 },
  { code: "1.4.2.4", name: "Taşıyıcı Sistem - Aşıklama", quantity: 1328, level: 3, isLeaf: true, unit: "Aşık", weight: 0.20 },
  { code: "1.4.2.5", name: "Taşıyıcı Sistem - Payanda ve Çapraz", quantity: 8496, level: 3, isLeaf: true, unit: "Çapraz", weight: 0.10 },

  // 1.4.3 Panel Montaj
  { code: "1.4.3", name: "Panel Montaj", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.4.3.1", name: "Panellerin Dağıtılması", quantity: 549, level: 3, isLeaf: true, unit: "Palet", weight: 0.20 },
  { code: "1.4.3.2", name: "Panellerin Montajı", quantity: 16992, level: 3, isLeaf: true, unit: "Panel", weight: 0.80 },

  // 1.4.4 Topraklama
  { code: "1.4.4", name: "Topraklama", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.4.4.1", name: "Topraklama Kazılarının Açılması", quantity: 2326, level: 3, isLeaf: true, unit: "m", weight: 0.40 },
  { code: "1.4.4.2", name: "Topraklama Şerit Çekimi", quantity: 3742, level: 3, isLeaf: true, unit: "m", weight: 0.20 },
  { code: "1.4.4.3", name: "Topraklama Kazılarının Kapanması", quantity: 2326, level: 3, isLeaf: true, unit: "m", weight: 0.10 },
  { code: "1.4.4.4", name: "Topraklama Sonlandırma", quantity: 708, level: 3, isLeaf: true, unit: "Masa", weight: 0.30 },

  // 1.4.5 AC Kablolama
  { code: "1.4.5", name: "AC Kablolama", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.4.5.1", name: "AC / LV-MV Kanallarının Açılması", quantity: 1145, level: 3, isLeaf: true, unit: "m", weight: 0.20 },
  { code: "1.4.5.2", name: "AC / MV Kablo Çekimi", quantity: 930, level: 3, isLeaf: true, unit: "m", weight: 0.25 },
  { code: "1.4.5.3", name: "AC / LV - İnverter Kablo Çekimi", quantity: 5600, level: 3, isLeaf: true, unit: "m", weight: 0.15 },
  { code: "1.4.5.4", name: "AC / LV - TR-Pano Kablo Çekimi", quantity: 189, level: 3, isLeaf: true, unit: "m", weight: 0.10 },
  { code: "1.4.5.5", name: "Kabloların Sonlandırılması", quantity: 7, level: 3, isLeaf: true, unit: "Set", weight: 0.10 },
  { code: "1.4.5.6", name: "AC / LV-MV Kanallarının Kapatılması", quantity: 1145, level: 3, isLeaf: true, unit: "m", weight: 0.10 },
  { code: "1.4.5.7", name: "OG Bağlantılarının Yapılması", quantity: 108, level: 3, isLeaf: true, unit: "Adet", weight: 0.10 },

  // 1.4.6 DC Kablolama
  { code: "1.4.6", name: "DC Kablolama", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.4.6.1", name: "DC Kablo Kanallarının Açılması", quantity: 6300, level: 3, isLeaf: true, unit: "m", weight: 0.30 },
  { code: "1.4.6.2", name: "DC Kablo Çekimi ve Reglajı", quantity: 108121, level: 3, isLeaf: true, unit: "m", weight: 0.40 },
  { code: "1.4.6.3", name: "DC Masa Başı Konnektör Çakımı", quantity: 708, level: 3, isLeaf: true, unit: "Adet", weight: 0.20 },
  { code: "1.4.6.4", name: "DC İnverter Altı Konnektör Çakımı", quantity: 708, level: 3, isLeaf: true, unit: "Adet", weight: 0.10 },

  // 1.4.7 Trafo ve Hücre
  { code: "1.4.7", name: "Trafo ve Hücre", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.4.7.1", name: "Trafoların Yerine Konulması", quantity: 7, level: 3, isLeaf: true, unit: "Adet", weight: 0.30 },
  { code: "1.4.7.2", name: "Hücrelerin Yerine Konulması ve Montajı", quantity: 29, level: 3, isLeaf: true, unit: "Adet", weight: 0.30 },
  { code: "1.4.7.3", name: "Buholtz Role Bağlantısı", quantity: 7, level: 3, isLeaf: true, unit: "Adet", weight: 0.10 },
  { code: "1.4.7.4", name: "Köşk İç Tesisat Bağlantısı", quantity: 7, level: 3, isLeaf: true, unit: "Adet", weight: 0.10 },
  { code: "1.4.7.5", name: "BAR Bağlantısının Yapılması", quantity: 8, level: 3, isLeaf: true, unit: "Adet", weight: 0.10 },

  // 1.4.8 Haberleşme
  { code: "1.4.8", name: "Haberleşme", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.4.8.1", name: "Haberleşme Kanallarının Açılması", quantity: 850, level: 3, isLeaf: true, unit: "m", weight: 0.30 },
  { code: "1.4.8.2", name: "Haberleşme Kablolarının Serilmesi ve Reglajı", quantity: 1120, level: 3, isLeaf: true, unit: "m", weight: 0.50 },
  { code: "1.4.8.3", name: "Haberleşme Kanallarının Kapatılması", quantity: 850, level: 3, isLeaf: true, unit: "m", weight: 0.10 },
  { code: "1.4.8.4", name: "İnverter Haberleşme Bağlantıları", quantity: 28, level: 3, isLeaf: true, unit: "Adet", weight: 0.10 },

  // 1.4.9 Telçit
  { code: "1.4.9", name: "Telçit", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.4.9.1", name: "Telçit Direk Yerlerinin Delinmesi", quantity: 742, level: 3, isLeaf: true, unit: "Adet", weight: 0.20 },
  { code: "1.4.9.2", name: "Telçit Direklerinin Sabitlenmesi", quantity: 742, level: 3, isLeaf: true, unit: "Adet", weight: 0.35 },
  { code: "1.4.9.3", name: "Telçit Örülmesi", quantity: 2205, level: 3, isLeaf: true, unit: "m", weight: 0.30 },
  { code: "1.4.9.4", name: "Kayar Kapı Yapımı", quantity: 1, level: 3, isLeaf: true, unit: "Adet", weight: 0.10 },
  { code: "1.4.9.5", name: "Kayar Kapı Devreye Alınması", quantity: 1, level: 3, isLeaf: true, unit: "Lot", weight: 0.05 },

  // 1.4.10 Etiketleme
  { code: "1.4.10", name: "Etiketleme", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.4.10.1", name: "Konstrüksiyon Üzeri Etiketleme", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.30 },
  { code: "1.4.10.2", name: "İnverter Üzeri Etiketleme", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.10 },
  { code: "1.4.10.3", name: "Telçit Üzeri Etiketleme", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.10 },
  { code: "1.4.10.4", name: "Trafo Binaları ve Hücre Etiketlemeleri", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.15 },
  { code: "1.4.10.5", name: "String Etiketlemeleri", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.20 },
  { code: "1.4.10.6", name: "Kayar Kapı Devreye Alınması Etiketlemeleri", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.05 },

  // 1.4.11 Aydınlatma ve CCTV
  { code: "1.4.11", name: "Aydınlatma ve CCTV", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.4.11.1", name: "Aydınlatma Kazılarının Yapılması", quantity: 2300, level: 3, isLeaf: true, unit: "m", weight: 0.10 },
  { code: "1.4.11.2", name: "Aydınlatma ve CCTV Borularının Serilmesi", quantity: 4600, level: 3, isLeaf: true, unit: "m", weight: 0.10 },
  { code: "1.4.11.3", name: "Aydınlatma ve CCTV Kablolarının Çekilmesi", quantity: 4600, level: 3, isLeaf: true, unit: "m", weight: 0.20 },
  { code: "1.4.11.4", name: "Direklerin Dikilmesi", quantity: 47, level: 3, isLeaf: true, unit: "Adet", weight: 0.15 },
  { code: "1.4.11.5", name: "CCTV Dağıtım Boxlarının Montajı", quantity: 15, level: 3, isLeaf: true, unit: "Adet", weight: 0.10 },
  { code: "1.4.11.6", name: "CCTV Kablolarının Sonlandırılması", quantity: 47, level: 3, isLeaf: true, unit: "Adet", weight: 0.10 },
  { code: "1.4.11.7", name: "Aydınlatma Kablolarının Sonlandırılması", quantity: 47, level: 3, isLeaf: true, unit: "Adet", weight: 0.10 },

  // 1.4.12 SCADA
  { code: "1.4.12", name: "SCADA", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.4.12.1", name: "Scada Kurulumu", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.50 },
  { code: "1.4.12.2", name: "Veri okuma testleri", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.25 },
  { code: "1.4.12.3", name: "Uzaktan erişim kurulumu", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.25 },

  // ═══════════════ 1.5 TDAA (Test ve Devreye Alma) ═══════════════
  { code: "1.5", name: "TDAA", quantity: 0, level: 1, isLeaf: false, unit: "", weight: 0 },
  { code: "1.5.1", name: "Test ve Devreye Alma", quantity: 0, level: 2, isLeaf: false, unit: "", weight: 0 },
  { code: "1.5.1.1", name: "Galvaniz hasar kontrolü", quantity: 708, level: 3, isLeaf: true, unit: "Masa", weight: 0.03 },
  { code: "1.5.1.2", name: "Aks aralık kontrolü", quantity: 708, level: 3, isLeaf: true, unit: "Masa", weight: 0.05 },
  { code: "1.5.1.3", name: "Kablo megger testleri", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.10 },
  { code: "1.5.1.4", name: "Faz sırası kontrolü", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.02 },
  { code: "1.5.1.5", name: "Bara testleri", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.02 },
  { code: "1.5.1.6", name: "OG testleri (VLF / hipot)", quantity: 104, level: 3, isLeaf: true, unit: "Adet", weight: 0.10 },
  { code: "1.5.1.7", name: "String testleri (Voc - Isc ölçümü)", quantity: 708, level: 3, isLeaf: true, unit: "Masa", weight: 0.10 },
  { code: "1.5.1.8", name: "İnverter AC Taraf Polarite kontrolü", quantity: 28, level: 3, isLeaf: true, unit: "Adet", weight: 0.01 },
  { code: "1.5.1.9", name: "İnverter DC Taraf Polarite kontrolü", quantity: 28, level: 3, isLeaf: true, unit: "Adet", weight: 0.01 },
  { code: "1.5.1.10", name: "String continuity testleri", quantity: 28, level: 3, isLeaf: true, unit: "Adet", weight: 0.01 },
  { code: "1.5.1.11", name: "Topraklama ölçümü (ohm)", quantity: 28, level: 3, isLeaf: true, unit: "Adet", weight: 0.01 },
  { code: "1.5.1.12", name: "Eşpotansiyel baraların devamlılık kontrolü", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.01 },
  { code: "1.5.1.13", name: "Trafo yağ kontrolü", quantity: 7, level: 3, isLeaf: true, unit: "Adet", weight: 0.05 },
  { code: "1.5.1.14", name: "Buchholtz rölesi kontrolü", quantity: 7, level: 3, isLeaf: true, unit: "Adet", weight: 0.05 },
  { code: "1.5.1.15", name: "OG hücre testleri", quantity: 29, level: 3, isLeaf: true, unit: "Adet", weight: 0.05 },
  { code: "1.5.1.16", name: "Koruma rölesi ayarlarının yapılması", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.05 },
  { code: "1.5.1.17", name: "Termal drone kontrolü", quantity: 1, level: 3, isLeaf: true, unit: "Set", weight: 0.05 },
  { code: "1.5.1.18", name: "Cold commissioning", quantity: 28, level: 3, isLeaf: true, unit: "Adet", weight: 0.05 },
  { code: "1.5.1.19", name: "Hot commissioning", quantity: 28, level: 3, isLeaf: true, unit: "Adet", weight: 0.10 },
];
