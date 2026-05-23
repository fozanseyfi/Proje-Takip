/**
 * GES Teslim Alma Detaylı Kontrol Listesi — şablon verisi.
 *
 * Kaynak: GES_Teslim_Alma_Detayli_Checklist_v1.0.pdf
 * - 13 ana bölüm (A → M)
 * - Her ana bölüm 2-6 alt bölüm
 * - Alt bölüm başına 3-15 madde
 *
 * Severity ("major" / "minor"):
 *   Major  → kapatılmadan geçici kabul yapılamaz (can güvenliği, OG, topraklama,
 *            elektriksel test, izin belgeleri, performans)
 *   Minor  → punch-list'e alınır (estetik, etiketleme detayları, çevre düzenleme,
 *            küçük eksiklikler)
 *
 * Her madde için stabil bir `id` (A1-1, A1-2, ... A2-1, ...). Bu id'ler
 * persistente kullanılır; checklist güncellense bile eski projeler etkilenmemeli.
 */

export type TeslimAlmaSeverity = "major" | "minor";

export interface TeslimAlmaItem {
  id: string;
  text: string;
  severity: TeslimAlmaSeverity;
}

export interface TeslimAlmaSubsection {
  id: string;        // örn "A.1"
  title: string;     // örn "Saha Genel Durumu"
  items: TeslimAlmaItem[];
}

export interface TeslimAlmaSection {
  id: string;        // örn "A"
  title: string;     // örn "Saha Hazırlığı & Genel Kontroller"
  description: string;
  /** UI renk tonu — collapsible card */
  tone: "accent" | "blue" | "yellow" | "purple" | "green" | "red" | "gray";
  subsections: TeslimAlmaSubsection[];
}

// ─────────────────────────────────────────────────────────────────
// Bölüm A — SAHA HAZIRLIĞI & GENEL KONTROLLER
// ─────────────────────────────────────────────────────────────────
const A: TeslimAlmaSection = {
  id: "A",
  title: "Saha Hazırlığı & Genel Kontroller",
  description: "Saha genel durumu, çevresel önlemler ve proje dokümantasyonu ile sahanın örtüşmesi.",
  tone: "accent",
  subsections: [
    {
      id: "A.1",
      title: "Saha Genel Durumu",
      items: [
        { id: "A1-1", text: "Saha sınırları proje paftası ile uyumlu mu? Sınır kazıkları/koordinatları yerinde mi?", severity: "major" },
        { id: "A1-2", text: "Saha içi hafriyat, tesviye ve drenaj projeye uygun yapılmış mı?", severity: "major" },
        { id: "A1-3", text: "Yağmur suyu drenaj kanalları açık ve fonksiyonel mi?", severity: "major" },
        { id: "A1-4", text: "Saha içi servis yolları (stabilize) projeye uygun ve araç geçişine elverişli mi?", severity: "minor" },
        { id: "A1-5", text: "Erozyon/sel riski olan bölgelerde gerekli önlemler (taş duvar, drenaj) alınmış mı?", severity: "major" },
        { id: "A1-6", text: "Saha içinde ot, çalı ve yabani bitki temizliği yapılmış mı?", severity: "minor" },
        { id: "A1-7", text: "Bitki örtüsü kontrolü için zemin işlemi (jeotekstil, çakıl, herbisit vb.) uygulanmış mı?", severity: "minor" },
        { id: "A1-8", text: "Saha içinde inşaat artığı, ambalaj, atık malzeme kalmış mı? Temizlik tamamlanmış mı?", severity: "minor" },
      ],
    },
    {
      id: "A.2",
      title: "Çevre Güvenliği ve Çit / Telçit",
      items: [
        { id: "A2-1", text: "Çevre çiti projeye uygun yükseklik (genelde min. 2m) ve malzeme ile yapılmış mı?", severity: "major" },
        { id: "A2-2", text: "Çit dikenli tel / üst koruma profili uygun mu?", severity: "major" },
        { id: "A2-3", text: "Çit direkleri sağlam betona oturtulmuş, eğrilik/sarkma var mı?", severity: "minor" },
        { id: "A2-4", text: "Ana giriş kapısı (sürgülü/kanat), kilit sistemi ve ikinci kapı (acil çıkış) mevcut mu?", severity: "major" },
        { id: "A2-5", text: "Çit dış çevresinden topraklama (her köşede ve düzenli aralıklarla) yapılmış mı?", severity: "major" },
        { id: "A2-6", text: "Çit üzerindeki uyarı ve ikaz levhaları (yüksek gerilim, yetkisiz giriş yasak, ölüm tehlikesi) mevcut mu?", severity: "major" },
        { id: "A2-7", text: "Kapılarda elektrik panosu, kilit ve kart okuyucu (varsa) çalışır durumda mı?", severity: "minor" },
      ],
    },
    {
      id: "A.3",
      title: "İklimlendirme ve Çevresel Faktörler",
      items: [
        { id: "A3-1", text: "Saha rüzgar yüküne uygun tasarlanmış mı? (Bölgenin rüzgar haritası ile karşılaştır)", severity: "major" },
        { id: "A3-2", text: "Kar yükü hesabı yapılmış ve konstrüksiyon buna uygun mu?", severity: "major" },
        { id: "A3-3", text: "Sel/su baskını risk değerlendirmesi yapılmış mı? Ekipmanlar yeterli yükseklikte mi?", severity: "major" },
        { id: "A3-4", text: "Gölgeleme yapan ağaç, yapı, baca vb. tespit edilip raporlandı mı?", severity: "minor" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Bölüm B — MEKANİK BÖLÜM (Çelik Konstrüksiyon & Panel)
// ─────────────────────────────────────────────────────────────────
const B: TeslimAlmaSection = {
  id: "B",
  title: "Mekanik Bölüm (Çelik Konstrüksiyon & Panel)",
  description: "Konstrüksiyon dayanımı santralin 25+ yıllık ömrünün temelidir. Tork, galvaniz ve panel kalite kontrolü.",
  tone: "blue",
  subsections: [
    {
      id: "B.1",
      title: "Kazık ve Temel",
      items: [
        { id: "B1-1", text: "Sıra başları, ortaları ve sonları doğru tespit edilmiş mi? (GPS koordinat doğrulaması)", severity: "major" },
        { id: "B1-2", text: "Sıralar arası mesafeler (pitch) projeye uygun mu? Gölgeleme hesabı ile uyumlu mu?", severity: "major" },
        { id: "B1-3", text: "Burgu / vidalı kazık derinliği projeye uygun mu? (Genelde min. 1.5-2.5m)", severity: "major" },
        { id: "B1-4", text: "Kazık çekme/itme testi (pull-out test) yapılmış ve raporlanmış mı?", severity: "major" },
        { id: "B1-5", text: "Beton atılmayan / eksik bırakılan kazık var mı?", severity: "major" },
        { id: "B1-6", text: "Beton kazıklarda C25/30 veya proje gereği beton sınıfı kullanılmış mı?", severity: "major" },
        { id: "B1-7", text: "Kazık sabitleme sonrası yükseklik (z kotu) projeye uygun mu? (±5mm tolerans)", severity: "minor" },
        { id: "B1-8", text: "Kazıklar arası mesafeler projeye uygun mu? Diyagonal ölçüm doğru mu?", severity: "minor" },
        { id: "B1-9", text: "Kazık yön açısı (azimut) projeye uygun mu? (Genelde tam Güney, ±5°)", severity: "major" },
        { id: "B1-10", text: "Kazıklar teraziye alındı mı? (Eğim toleransı dikkate alınarak)", severity: "minor" },
      ],
    },
    {
      id: "B.2",
      title: "Çelik Konstrüksiyon Kalitesi",
      items: [
        { id: "B2-1", text: "Çelik profillerde sıcak daldırma galvaniz kaplaması (min. 70-85 µm) uygun mu?", severity: "major" },
        { id: "B2-2", text: "Çeliklerde çapak, paslanma, küllenme, deforme, eğrilik var mı?", severity: "minor" },
        { id: "B2-3", text: "Kesim noktalarında galvaniz tamiri (zinc spray) yapılmış mı?", severity: "minor" },
        { id: "B2-4", text: "Üretici çelik sertifikaları (kalite belgesi, malzeme test raporu) sahaya getirilmiş mi?", severity: "major" },
        { id: "B2-5", text: "Kullanılan cıvata-somun-pul takımı paslanmaz veya galvaniz mi? (DIN 7989 / ISO 4014)", severity: "major" },
      ],
    },
    {
      id: "B.3",
      title: "Kolon, Kiriş, Aşık Montajı",
      items: [
        { id: "B3-1", text: "Kolon-Kiriş bağlantı noktaları projeye uygun montajlanmış mı?", severity: "major" },
        { id: "B3-2", text: "Kirişler projeye uygun derecede (eğim açısı) montajlanmış mı? Tilt açısı uyumlu mu?", severity: "major" },
        { id: "B3-3", text: "Aşık ek bağlantı noktalarında ek aparatı (splice) kullanılmış mı?", severity: "minor" },
        { id: "B3-4", text: "Kiriş-Aşık bağlantı aparatı (Pokemon/L-bracket) projeye uygun mu?", severity: "minor" },
        { id: "B3-5", text: "Tüm bağlantı noktalarında uygun sırada ve doğru metrikte (M8/M10/M12) somun, pul, rondela, cıvata kullanılmış mı?", severity: "major" },
        { id: "B3-6", text: "Tüm bağlantılar uygun tork değerinde sıkılmış mı? Tork işaretlemesi (marker pen) yapılmış mı?", severity: "major" },
        { id: "B3-7", text: "Çapraz (diagonal brace) montajı projeye uygun mu? (Rüzgar yüküne karşı)", severity: "major" },
        { id: "B3-8", text: "Her masada olması gereken adette çapraz montajı tamamlanmış mı?", severity: "major" },
        { id: "B3-9", text: "Konstrüksiyon paslanmış / soyulmuş kısımlar boya/galvaniz spray ile onarılmış mı?", severity: "minor" },
      ],
    },
    {
      id: "B.4",
      title: "Panel (Modül) Montajı",
      items: [
        { id: "B4-1", text: "Panel marka, model ve seri numaraları teslim listesi ile uyumlu mu? (Bin-class / power class)", severity: "major" },
        { id: "B4-2", text: "Panel yönleri projeye uygun mu? (Güney / SW / SE konfigürasyonu)", severity: "major" },
        { id: "B4-3", text: "Panel hizaları (yatay/dikey) düzgün ve estetik mi? Sıra içinde sapma var mı?", severity: "minor" },
        { id: "B4-4", text: "Panel - zemin arası minimum mesafe projeye uygun mu? (Min. 50-80cm, kar bölgelerinde daha fazla)", severity: "major" },
        { id: "B4-5", text: "Panel yüzeyinde herhangi bir kırık, çizik, çatlak, hot-spot izi, sızıntı var mı?", severity: "major" },
        { id: "B4-6", text: "Panel arka yüzeyinde (back-sheet) yanma, kabarma, böcek ısırığı, delik var mı?", severity: "major" },
        { id: "B4-7", text: "Panel junction box (jonksiyon kutusu) ve by-pass diyot fonksiyonel mi?", severity: "major" },
        { id: "B4-8", text: "Panel çerçevelerinde galvaniz/anodize hasarı var mı?", severity: "minor" },
        { id: "B4-9", text: "Clamp (orta ve uç) projeye uygun konumda sıkılmış mı?", severity: "major" },
        { id: "B4-10", text: "Mid-clamp ve end-clamp çaplık (eşit boşluk) bırakılmış mı?", severity: "minor" },
        { id: "B4-11", text: "Clampler uygun torkla (genelde 12-15 Nm) sıkılmış mı?", severity: "major" },
        { id: "B4-12", text: "Panel üzerinde geçici koruma folyoları çıkarılmış mı?", severity: "minor" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Bölüm C — DC BÖLÜMÜ
// ─────────────────────────────────────────────────────────────────
const C: TeslimAlmaSection = {
  id: "C",
  title: "DC Bölümü (Kablo, Konnektör, String)",
  description: "DC tarafı arıza halinde ark riski ve yangın tehlikesi en yüksek bölümdür.",
  tone: "yellow",
  subsections: [
    {
      id: "C.1",
      title: "DC Kablo Kesiti, Tipi ve Sertifikası",
      items: [
        { id: "C1-1", text: "DC kablo kesitleri projeye uygun mu? (Genelde 4mm² veya 6mm²)", severity: "major" },
        { id: "C1-2", text: "Kablolar TÜV/EN 50618 sertifikalı PV solar kablosu mu? (H1Z2Z2-K)", severity: "major" },
        { id: "C1-3", text: "Kablolarda UV dayanımı ve sıcaklık aralığı (-40°C / +90°C veya üstü) uygun mu?", severity: "major" },
        { id: "C1-4", text: "Polariteler (+/−) renk kodlaması ile (kırmızı/siyah veya etiket) belirgin mi?", severity: "major" },
        { id: "C1-5", text: "Voltaj düşümü hesabı yapılmış mı? (Toplam DC tarafında %1.5'i aşmamalı)", severity: "major" },
      ],
    },
    {
      id: "C.2",
      title: "Kablo Rotalama ve Koruma",
      items: [
        { id: "C2-1", text: "Yer altı geçişlerde koruge boru içine alındı mı ve izole edildi mi?", severity: "major" },
        { id: "C2-2", text: "Kolon çıkış noktalarında UV dayanımlı spiral / koruge boru kullanıldı mı?", severity: "major" },
        { id: "C2-3", text: "Kablolar masa altında düzgün taranmış, sarkma yok mu?", severity: "minor" },
        { id: "C2-4", text: "Kablo tavası (cable tray) içi reglajı yapıldı mı? Her 1-2 metrede klips/zip-tie ile sabitlenmiş mi?", severity: "minor" },
        { id: "C2-5", text: "Tava çıkışlarında rakor (cable gland) kullanıldı mı?", severity: "major" },
        { id: "C2-6", text: "Tava birleşim noktalarında bağlantı aparatı (jumper) kullanıldı mı?", severity: "minor" },
        { id: "C2-7", text: "Tava kapakları tutucu (cover holder) ile sabitlendi mi? Rüzgarda açılma riski var mı?", severity: "minor" },
        { id: "C2-8", text: "Tavalar topraklanmış mı? (Eş potansiyel)", severity: "major" },
        { id: "C2-9", text: "Kablo bağı (cable tie) UV dayanımlı siyah tip mi? Standart beyaz tie kullanılmamış mı?", severity: "minor" },
        { id: "C2-10", text: "Aynı tava içinde DC, AC, haberleşme kabloları ayrı bölmelerde mi?", severity: "major" },
      ],
    },
    {
      id: "C.3",
      title: "Konnektör Montajı (MC4 / Stäubli)",
      items: [
        { id: "C3-1", text: "Konnektör marka/model projeye uygun mu? (MC4 ile MC4 uyumlu — farklı markaların karışmaması)", severity: "major" },
        { id: "C3-2", text: "Konnektör montajı üretici kullanım kılavuzuna ve aletine uygun yapıldı mı? (Crimping)", severity: "major" },
        { id: "C3-3", text: "Pull-out test (10-15 kg çekme) yapılarak fiziksel sağlamlık doğrulandı mı?", severity: "major" },
        { id: "C3-4", text: "MPPT girişlerinde konnektör deforme, eriği, ısı izi var mı?", severity: "major" },
        { id: "C3-5", text: "Konnektörler kuru ve temiz mi? Kir/çamur/su girişi var mı?", severity: "major" },
        { id: "C3-6", text: "Konnektörler doğrudan zemine temas etmiyor mu? (Asılı veya kanal içinde)", severity: "major" },
        { id: "C3-7", text: "Toprağa gömülü kalan konnektör var mı? (Olmamalı)", severity: "major" },
      ],
    },
    {
      id: "C.4",
      title: "String Bağlantıları & Etiketleme",
      items: [
        { id: "C4-1", text: "String başına seri panel sayısı projeye ve inverter MPPT aralığına uygun mu?", severity: "major" },
        { id: "C4-2", text: "Açık devre gerilimi (Voc) inverter max DC giriş gerilimini aşmıyor mu? (En soğuk gün hesabı)", severity: "major" },
        { id: "C4-3", text: "Panel string bağlantıları projeye uygun mu? Reglajlar talebe göre yapıldı mı?", severity: "minor" },
        { id: "C4-4", text: "String etiketleri (Masa başı, Inverter altı, MCB üstü) mevcut, kalıcı malzemeden mi?", severity: "minor" },
        { id: "C4-5", text: "Etiketleme şeması: 'Inverter No / MPPT No / String No' formatında ve okunaklı mı?", severity: "minor" },
        { id: "C4-6", text: "Etiketler UV ve hava şartlarına dayanıklı mı?", severity: "minor" },
      ],
    },
    {
      id: "C.5",
      title: "String Ölçümleri",
      items: [
        { id: "C5-1", text: "Her string için Voc (açık devre gerilimi) ölçümü yapılmış mı?", severity: "major" },
        { id: "C5-2", text: "Her string için Isc (kısa devre akımı) ölçümü yapılmış mı?", severity: "major" },
        { id: "C5-3", text: "İzolasyon direnci (Riso) ölçümü yapılmış mı? (Min. 1 MΩ veya üretici limiti)", severity: "major" },
        { id: "C5-4", text: "Polarite testi yapılmış mı? (+/− doğru bağlanmış mı?)", severity: "major" },
        { id: "C5-5", text: "Toprak kaçak (PV-array to ground) testi yapılmış mı?", severity: "major" },
        { id: "C5-6", text: "I-V curve (akım-gerilim eğrisi) testi yapılmış ve referans değerle karşılaştırılmış mı?", severity: "major" },
        { id: "C5-7", text: "Testler PV ölçü aletiyle (HT Isotest, Seaward PV200/210, Benning PV vb.) yapılmış mı?", severity: "major" },
        { id: "C5-8", text: "Tüm ölçümler ışınım (irradiance) ve sıcaklık ile birlikte raporlanmış mı?", severity: "major" },
        { id: "C5-9", text: "Beklenen üretim ile ölçülen değer arasında sapma %5'in altında mı?", severity: "major" },
        { id: "C5-10", text: "Test raporu PDF olarak imzalı ve tarihli teslim edilmiş mi?", severity: "major" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Bölüm D — INVERTER
// ─────────────────────────────────────────────────────────────────
const D: TeslimAlmaSection = {
  id: "D",
  title: "Inverter Bölümü",
  description: "Inverter santralin kalbi olup elektronik ekipmanların doğru montajı, soğutması ve parametrelendirmesi verim kaybını önler.",
  tone: "purple",
  subsections: [
    {
      id: "D.1",
      title: "Inverter Montajı ve Yerleşim",
      items: [
        { id: "D1-1", text: "Inverter marka, model ve seri numaraları sözleşme ile uyumlu mu?", severity: "major" },
        { id: "D1-2", text: "Inverter karkası projede belirtilen sıraya konumlandırılmış mı?", severity: "minor" },
        { id: "D1-3", text: "Inverterler sağlam şekilde duvar/karkasa sabitlenmiş ve teraziye alındı mı?", severity: "major" },
        { id: "D1-4", text: "Inverter yerden yüksekliği üretici kullanım kılavuzunda belirtildiği şekilde mi? (Genelde min. 30-50 cm)", severity: "minor" },
        { id: "D1-5", text: "Inverter etrafında soğutma için yeterli boşluk (üst, alt, yan) bırakılmış mı? (Min. 50 cm üst)", severity: "major" },
        { id: "D1-6", text: "Destek kolon / panel arkası montaj iskeleti yapılmış mı?", severity: "minor" },
        { id: "D1-7", text: "Birden fazla inverter yan yana ise üretici tavsiyesi minimum aralık sağlanmış mı?", severity: "major" },
        { id: "D1-8", text: "Inverter gölgede / doğrudan güneş ışınına az maruz konumda mı?", severity: "major" },
        { id: "D1-9", text: "Inverter altı havalandırma açıklıkları kapanmamış mı?", severity: "major" },
      ],
    },
    {
      id: "D.2",
      title: "Inverter Topraklaması",
      items: [
        { id: "D2-1", text: "Inverter topraklaması cıvata ve somun ile karkasa sabitlenmiş mi?", severity: "major" },
        { id: "D2-2", text: "Topraklama kablosu kesiti uygun mu? (Min. 16mm² veya proje gereği)", severity: "major" },
        { id: "D2-3", text: "Topraklama pabucu, makaron ve renk kodlaması uygun mu? (Yeşil-Sarı)", severity: "minor" },
        { id: "D2-4", text: "Inverter şasi-toprak süreklilik testi (continuity) yapılmış mı? (< 0.1 Ω)", severity: "major" },
      ],
    },
    {
      id: "D.3",
      title: "Inverter DC ve AC Bağlantıları",
      items: [
        { id: "D3-1", text: "DC kablolar MPPT sırasına göre inverter altında ayrıldı mı? Reglajı buna göre mi?", severity: "minor" },
        { id: "D3-2", text: "MPPT konnektör girişlerinde deforme, eriği, çapak var mı?", severity: "major" },
        { id: "D3-3", text: "Inverter–ADP arası kabloların kesiti doğru mu? (Akım hesabı + voltaj düşümü)", severity: "major" },
        { id: "D3-4", text: "ADP'ye giden inverter grubu doğru mu? Etiketlemesi doğru yapılmış mı?", severity: "minor" },
        { id: "D3-5", text: "Inverter AG kabloların pabuçları düzgün takılmış, sıkılmış mı?", severity: "major" },
        { id: "D3-6", text: "AG kablolarda tork değerleri kullanım kılavuzuna uygun mu? Markalama yapıldı mı?", severity: "major" },
        { id: "D3-7", text: "Faz sırası (L1-L2-L3) doğru mu? Faz sıra testi (rotation test) yapıldı mı?", severity: "major" },
        { id: "D3-8", text: "AC çıkışta nötr ve toprak ayrımı düzgün mü?", severity: "major" },
      ],
    },
    {
      id: "D.4",
      title: "Inverter Parametre Ayarları",
      items: [
        { id: "D4-1", text: "Inverter parametre ayarları (grid code, ülke kodu = TR) doğru girilmiş mi?", severity: "major" },
        { id: "D4-2", text: "Set değerleri (V, Hz limitleri) yerel yönetmeliğe uygun mu? (TEDAŞ / EPDK kriterleri)", severity: "major" },
        { id: "D4-3", text: "Reaktif güç (cos φ) ayarı dağıtım şirketi talebine göre yapıldı mı?", severity: "major" },
        { id: "D4-4", text: "Anti-islanding koruması aktif mi? (Şebeke kesilince inverter durmalı)", severity: "major" },
        { id: "D4-5", text: "LVRT / FRT (düşük gerilim atlatma) ayarları doğru mu?", severity: "major" },
        { id: "D4-6", text: "Inverter firmware güncel mi? Üreticinin en son sürümü kurulu mu?", severity: "minor" },
        { id: "D4-7", text: "Inverter şifresi (yönetici şifresi) işverene teslim edilmiş mi?", severity: "major" },
        { id: "D4-8", text: "Inverter haberleşme (RS485 / Ethernet / Wi-Fi) test edildi mi? SCADA / monitoring portala düştü mü?", severity: "major" },
        { id: "D4-9", text: "Inverter LCD ekranda alarm / hata kodu var mı? (Hatasız çalışıyor mu?)", severity: "major" },
        { id: "D4-10", text: "Inverter ilk devreye alma raporu (commissioning report) hazırlanmış mı?", severity: "major" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Bölüm E — AG (Alçak Gerilim)
// ─────────────────────────────────────────────────────────────────
const E: TeslimAlmaSection = {
  id: "E",
  title: "AG Bölümü (Alçak Gerilim)",
  description: "AG hattı, inverter çıkışından trafo girişine kadar olan elektrik sistemidir.",
  tone: "green",
  subsections: [
    {
      id: "E.1",
      title: "AG Kablo Çekimi ve Korumalar",
      items: [
        { id: "E1-1", text: "AG kablo tipi ve kesiti projeye / yüke uygun mu? (N2XH, NHXMH veya proje gereği)", severity: "major" },
        { id: "E1-2", text: "AG kabloların minimum bükülme yarıçapına uyulmuş mu? (Üretici tavsiyesi)", severity: "major" },
        { id: "E1-3", text: "AG kablolarda yeterli pay (servis loop) bırakılmış mı?", severity: "minor" },
        { id: "E1-4", text: "Pabuçlara doğru renkte ve şartnameye uygun şekilde makaron sarılmış mı? (L1, L2, L3, N, PE)", severity: "minor" },
        { id: "E1-5", text: "AG pabuçlar şartnameye / üretici tavsiyesine uygun torkla sıkılmış mı?", severity: "major" },
        { id: "E1-6", text: "AG kablolar UV ve mekanik darbeden korunmuş mu?", severity: "major" },
        { id: "E1-7", text: "AG kablolar kanal içinde reglajlı, etiketli ve düzenli mi?", severity: "minor" },
      ],
    },
    {
      id: "E.2",
      title: "Kablo Kanalları (Trench)",
      items: [
        { id: "E2-1", text: "Kablo kanalı TEDAŞ onaylı projede belirlenen güzergâhta ilerlemiş mi?", severity: "major" },
        { id: "E2-2", text: "Kanal dip derinliği ve kanal ağzı derinliği teknik şartnamelere uygun mu? (Genelde min. 80cm OG, 60cm AG)", severity: "major" },
        { id: "E2-3", text: "Kanal tabanında ve kablo üzerinde 12 cm kalınlığında 0,0-0,3 mm ince temiz mil kum serilmiş mi?", severity: "major" },
        { id: "E2-4", text: "AG kablo reglajları demet halinde klips yardımıyla sabitlenmiş mi?", severity: "minor" },
        { id: "E2-5", text: "Devreler arası ve farklı gerilim seviyelerindeki kabloların reglajları şartnameye uygun mu?", severity: "major" },
        { id: "E2-6", text: "Kanal boyu ve genişliğinde bims/koruyucu plaka serilmiş mi?", severity: "major" },
        { id: "E2-7", text: "İkaz şeridi (kırmızı plastik) serilmiş mi? Doğru derinlikte mi?", severity: "major" },
        { id: "E2-8", text: "Dolgu malzemesi şartnameye uygun mu? (Sıkıştırma yapılmış mı?)", severity: "minor" },
        { id: "E2-9", text: "Güzergah plakaları (kablo işaretleme dübeli) her 5 metrede bir sabitlenmiş mi?", severity: "minor" },
        { id: "E2-10", text: "Kanal-saha sınırlarında geçiş plakaları, beton babalar mevcut mu?", severity: "minor" },
      ],
    },
    {
      id: "E.3",
      title: "AG Ölçümleri",
      items: [
        { id: "E3-1", text: "İzolasyon direnci ölçümleri (1000V megger ile) yapılmış mı? (Faz-Faz, Faz-N, Faz-PE)", severity: "major" },
        { id: "E3-2", text: "AG faz sıralaması doğru mu? (Rotasyon: L1-L2-L3 saat yönünde)", severity: "major" },
        { id: "E3-3", text: "Süreklilik (continuity) testi tüm devrelerde yapılmış mı?", severity: "major" },
        { id: "E3-4", text: "Devre direnci (loop impedance) ölçümü yapılmış mı?", severity: "major" },
        { id: "E3-5", text: "Kısa devre akımı (Ik) hesaplaması ve doğrulaması yapılmış mı?", severity: "major" },
        { id: "E3-6", text: "Voltaj düşümü ölçümü yapılmış mı? (Yük altında)", severity: "major" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Bölüm F — OG (Orta Gerilim)
// ─────────────────────────────────────────────────────────────────
const F: TeslimAlmaSection = {
  id: "F",
  title: "OG Bölümü (Orta Gerilim)",
  description: "OG tarafı hayati tehlike içeren bölümdür. Kabul ve ölçümleri TEDAŞ onaylı yapılmalıdır.",
  tone: "red",
  subsections: [
    {
      id: "F.1",
      title: "OG Kablo Çekimi",
      items: [
        { id: "F1-1", text: "OG kablo çekimi TEDAŞ onaylı projeye uygun yapılmış mı? (3x1x95, 3x1x150 vb.)", severity: "major" },
        { id: "F1-2", text: "OG kablo tipi N2XSY / XLPE proje gereği ile uyumlu mu?", severity: "major" },
        { id: "F1-3", text: "OG kablo reglajları düzgün, gergi/burma yok mu?", severity: "minor" },
        { id: "F1-4", text: "Hücre içinde OG kablonun yeterince payı (1.5-2m servis loop) bırakılmış mı?", severity: "minor" },
        { id: "F1-5", text: "OG kabloların minimum bükülme yarıçapına uyulmuş mu? (Genelde 12-15 x kablo çapı)", severity: "major" },
        { id: "F1-6", text: "Cable identification tag her iki uçta da mevcut mu?", severity: "minor" },
      ],
    },
    {
      id: "F.2",
      title: "OG Başlıklar (Termination)",
      items: [
        { id: "F2-1", text: "OG başlıklar (Plug-in başlık, Dahili başlık, Hariçi başlık) şartnameye uygun montajlanmış mı?", severity: "major" },
        { id: "F2-2", text: "Başlık montajı sertifikalı kişi tarafından mı yapıldı? (Belge istenmeli)", severity: "major" },
        { id: "F2-3", text: "Beton köşk ve PBK3 OG girişlerinde conta kullanılmış mı? Tork değeri doğru mu?", severity: "major" },
        { id: "F2-4", text: "Başlıkta sızdırmazlık (su, nem) sağlanmış mı?", severity: "major" },
        { id: "F2-5", text: "Stres konisi (stress cone) doğru konumda mı?", severity: "major" },
        { id: "F2-6", text: "Pabuçlama / kuluçka uygun aletle yapılmış mı? (Hidrolik pres)", severity: "major" },
      ],
    },
    {
      id: "F.3",
      title: "OG Test ve Ölçümleri",
      items: [
        { id: "F3-1", text: "OG kablo VLF (Very Low Frequency) testi yapılmış mı?", severity: "major" },
        { id: "F3-2", text: "Hi-Pot (yüksek gerilim) testi raporu mevcut mu? (Genelde 2.5 x Un x 5 dakika)", severity: "major" },
        { id: "F3-3", text: "OG izolasyon direnci ölçümü (5kV megger) yapılmış mı?", severity: "major" },
        { id: "F3-4", text: "OG kabloda kısmi deşarj (partial discharge) testi yapılmış mı?", severity: "major" },
        { id: "F3-5", text: "Faz sırası ve fazlar arası izolasyon kontrolü yapılmış mı?", severity: "major" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Bölüm G — TOPRAKLAMA & YILDIRIMDAN KORUNMA
// ─────────────────────────────────────────────────────────────────
const G: TeslimAlmaSection = {
  id: "G",
  title: "Topraklama & Yıldırımdan Korunma",
  description: "Topraklama can güvenliği, ekipman koruması ve şebeke kalitesi için kritiktir.",
  tone: "yellow",
  subsections: [
    {
      id: "G.1",
      title: "Topraklama Sistemi",
      items: [
        { id: "G1-1", text: "Pano topraklaması yapılmış ve eş potansiyel barayla irtibatlandırılmış mı?", severity: "major" },
        { id: "G1-2", text: "Çevre topraklaması (perimeter) çekilmiş mi?", severity: "major" },
        { id: "G1-3", text: "Topraklama her sıranın doğusundan ve batısından irtibatlandırılmış mı? (Mesh / ring)", severity: "major" },
        { id: "G1-4", text: "Telçit için projeye uygun topraklama dalları bırakılmış mı?", severity: "major" },
        { id: "G1-5", text: "Kolonlara sabitleme cıvata ve somunla yapılmış mı? (Galvaniz)", severity: "major" },
        { id: "G1-6", text: "Köşk gövde topraklaması eş potansiyel barayla irtibatlandırılmış mı?", severity: "major" },
        { id: "G1-7", text: "Temel topraklaması eş potansiyel barayla irtibatlandırılmış mı?", severity: "major" },
        { id: "G1-8", text: "Masa arası topraklama yapılmış ve makaron sarılmış mı?", severity: "major" },
        { id: "G1-9", text: "Panel çerçeve topraklaması (frame grounding) her panelde uygun klips/aparat ile mi?", severity: "major" },
        { id: "G1-10", text: "Topraklama elektrodları (çubuk / şerit) tipi ve uzunluğu projeye uygun mu?", severity: "major" },
        { id: "G1-11", text: "Topraklama bakır şerit / örgülü tel kesiti uygun mu? (Min. 25mm² ya da 50mm² proje gereği)", severity: "major" },
        { id: "G1-12", text: "Kaynak noktaları (cadweld / exothermic) doğru yapılmış mı?", severity: "major" },
        { id: "G1-13", text: "Topraklama kuyusu / muayene baca mevcut ve erişilebilir mi?", severity: "minor" },
      ],
    },
    {
      id: "G.2",
      title: "Topraklama Ölçüm Değerleri",
      items: [
        { id: "G2-1", text: "İşletme topraklaması direnci ölçülmüş ve max 1.5 Ω altında mı?", severity: "major" },
        { id: "G2-2", text: "Koruma topraklaması direnci ölçülmüş ve max 1 Ω altında mı?", severity: "major" },
        { id: "G2-3", text: "Ölçüm cihazı (3 veya 4 kazıklı topraklama ölçer) kalibrasyonlu mu?", severity: "major" },
        { id: "G2-4", text: "Toprak özgül direnci (ρ) ölçümü yapılmış mı? (Wenner metodu)", severity: "major" },
        { id: "G2-5", text: "Adım gerilimi (step voltage) ve dokunma gerilimi (touch voltage) hesabı yapılmış mı?", severity: "major" },
        { id: "G2-6", text: "Topraklama ölçüm raporu imzalı ve tarihli mi? Elektrik mühendisi onayı var mı?", severity: "major" },
      ],
    },
    {
      id: "G.3",
      title: "Yıldırımdan Korunma (LPS)",
      items: [
        { id: "G3-1", text: "Yıldırım risk değerlendirmesi (IEC 62305-2) yapılmış mı?", severity: "major" },
        { id: "G3-2", text: "Yıldırım yakalama uçları (faraday kafesi veya aktif paratoner) projeye uygun mu?", severity: "major" },
        { id: "G3-3", text: "İniş iletkenleri (down conductor) sayısı ve konumu uygun mu?", severity: "major" },
        { id: "G3-4", text: "Yıldırım topraklaması saha topraklamasından ayrı veya eş potansiyel bağlı mı?", severity: "major" },
        { id: "G3-5", text: "AC parafudr (Type 1+2) ana panoda mevcut ve doğru bağlı mı?", severity: "major" },
        { id: "G3-6", text: "DC parafudr inverter girişinde ve string boxlarda mevcut mu? (Tip 1+2 ya da Tip 2)", severity: "major" },
        { id: "G3-7", text: "Parafudr durum göstergesi (yeşil/kırmızı) çalışıyor mu? Yedek modül var mı?", severity: "minor" },
        { id: "G3-8", text: "Haberleşme / SCADA hattında dahili parafudr (data line SPD) mevcut mu?", severity: "minor" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Bölüm H — TRAFO, KÖŞK, PB3
// ─────────────────────────────────────────────────────────────────
const H: TeslimAlmaSection = {
  id: "H",
  title: "Trafo, Köşk ve PB3 Bölümü",
  description: "Beton köşk, trafo ve PB3 santralin OG/AG dönüşümünün yapıldığı kritik üniteleridir.",
  tone: "blue",
  subsections: [
    {
      id: "H.1",
      title: "Trafo Kontrolleri",
      items: [
        { id: "H1-1", text: "Trafo marka, model, güç (kVA), gerilim seviyesi (örn. 0.4/33 kV) projeye uygun mu?", severity: "major" },
        { id: "H1-2", text: "Trafo montaj kontrolü projeye uygun mu? (Yerleşim, mesafeler, havalandırma)", severity: "major" },
        { id: "H1-3", text: "Trafo başlık ve buşinglerin projeye uygun mu? (TS EN / IEC standartları)", severity: "major" },
        { id: "H1-4", text: "Trafo kademe ayarı (tap changer) doğru pozisyonda mı? (Genelde +%2.5 veya nominal)", severity: "major" },
        { id: "H1-5", text: "Trafo yağı / kuru tip durumu uygun mu? (Yağ seviyesi, sızıntı kontrolü)", severity: "major" },
        { id: "H1-6", text: "Yağ analizi (Buchholz, DGA) raporu varsa mevcut mu?", severity: "minor" },
        { id: "H1-7", text: "Trafo gövdesi topraklı mı? (Çift topraklama önerilir)", severity: "major" },
        { id: "H1-8", text: "Trafo etrafı/altı yağ toplama havuzu uygun mu? (Yağlı trafolar için)", severity: "major" },
        { id: "H1-9", text: "Trafo etiketleri (anma değerleri, üretici, seri no) okunaklı mı?", severity: "minor" },
        { id: "H1-10", text: "Trafo etrafı toz, katı atık ve yağ damlatma kontrolü yapıldı mı?", severity: "minor" },
        { id: "H1-11", text: "Trafo - ADP arası bara/kablo tork ve kesitleri kontrol edildi mi?", severity: "major" },
        { id: "H1-12", text: "Trafo izolasyon direnci (5kV megger) ölçüldü mü? Raporlanmış mı?", severity: "major" },
        { id: "H1-13", text: "Trafo polariteleri (vektör grubu - Dyn11 vb.) doğrulandı mı?", severity: "major" },
        { id: "H1-14", text: "Trafo dönüşüm oranı (TTR) testi yapıldı mı?", severity: "major" },
        { id: "H1-15", text: "Trafo eş potansiyel dengeleme barası kontrolü ve toprak ölçümü uygun mu?", severity: "major" },
      ],
    },
    {
      id: "H.2",
      title: "Beton Köşk",
      items: [
        { id: "H2-1", text: "Beton köşk yerleşim kontrolü, mevsim, yerden yükseklik, süs betonu uygun mu?", severity: "minor" },
        { id: "H2-2", text: "Beton köşk korozyon kontrolü yapıldı mı?", severity: "minor" },
        { id: "H2-3", text: "Beton köşk içi temizlik kontrolü yapıldı mı?", severity: "minor" },
        { id: "H2-4", text: "Beton köşk içi hücre hizalaması yapılmış mı?", severity: "minor" },
        { id: "H2-5", text: "Hücre, analizör, röle, ana sayaç ve yedek sayaç kontrolü yapıldı mı?", severity: "major" },
        { id: "H2-6", text: "Beton köşk içi Bar24 - Bar110 voltaj kontrolü yapıldı mı?", severity: "major" },
        { id: "H2-7", text: "Beton köşk içi OG ekipman kontrolü yapıldı mı? (Yük ayırıcı, kesici, gaz seviyesi)", severity: "major" },
        { id: "H2-8", text: "Beton köşk kapıların açılması, kapanması, kilitlenmesi uygun mu?", severity: "minor" },
        { id: "H2-9", text: "Beton köşklerin su alma durumu ve kemirgenlere karşı koruması uygun mu? (Mantar, conta)", severity: "major" },
        { id: "H2-10", text: "Beton köşk iç ve dış boyalarının kontrolü uygun mu?", severity: "minor" },
        { id: "H2-11", text: "Beton köşk iç aydınlatmalarının (acil aydınlatma dahil) kontrolü yapıldı mı?", severity: "minor" },
        { id: "H2-12", text: "Beton köşk topraklama kazık kontrolü yapıldı mı?", severity: "major" },
        { id: "H2-13", text: "Beton köşk havalandırma menfezleri açık ve fonksiyonel mi?", severity: "major" },
        { id: "H2-14", text: "Beton köşk içinde nem ölçer ve havalandırma sistemi varsa çalışıyor mu?", severity: "minor" },
      ],
    },
    {
      id: "H.3",
      title: "PB3 (Bağlantı Bölmesi)",
      items: [
        { id: "H3-1", text: "PB3 kapıların açılması, kapanması, kilitlenmesi uygun mu?", severity: "minor" },
        { id: "H3-2", text: "PB3 su alma durumu ve kemirgenlere karşı koruması uygun mu?", severity: "major" },
        { id: "H3-3", text: "PB3 iç ve dış boyalarının kontrolü uygun mu?", severity: "minor" },
        { id: "H3-4", text: "PB3 aydınlatma kontrolü yapıldı mı?", severity: "minor" },
        { id: "H3-5", text: "PB3 içleri temizlik kontrolü yapıldı mı?", severity: "minor" },
        { id: "H3-6", text: "PB3 topraklama kazık kontrolü yapıldı mı?", severity: "major" },
        { id: "H3-7", text: "PB3 içi hücre hizalaması yapılmış mı?", severity: "minor" },
        { id: "H3-8", text: "PB3 içi Bar24 - Bar110 voltaj kontrolü yapıldı mı?", severity: "major" },
        { id: "H3-9", text: "PB3 içi gövde topraklaması uygun mu?", severity: "major" },
        { id: "H3-10", text: "PB3 içi hücreler hizaya alındı mı?", severity: "minor" },
        { id: "H3-11", text: "PB3 içi hücre sıralaması projeye uygun mu?", severity: "major" },
        { id: "H3-12", text: "PB3 içi kablo reglajı yapıldı mı?", severity: "minor" },
        { id: "H3-13", text: "PB3 içi OG başlık montajı ve tork değerleri kontrol edildi mi?", severity: "major" },
        { id: "H3-14", text: "PB3 içi izole halı, izole eldiven, sehpa, yangın tüpü, uzaktan kurma kumandası mevcut mu?", severity: "major" },
        { id: "H3-15", text: "PB3 içi tek hat şeması ve etiketler güncel/doğru mu?", severity: "major" },
        { id: "H3-16", text: "PB3 içi acil durdurma (emergency stop) butonu erişilebilir mi?", severity: "major" },
      ],
    },
    {
      id: "H.4",
      title: "Tretuvar ve Çevre Düzenleme",
      items: [
        { id: "H4-1", text: "Tretuvar (köşk etrafı yürüme platformu) montajı şartnameye uygun mu?", severity: "minor" },
        { id: "H4-2", text: "Tretuvar kayma önleyici yüzeyli mi?", severity: "major" },
        { id: "H4-3", text: "Trafo-ADP arası bara montajı projeye uygun mu?", severity: "major" },
        { id: "H4-4", text: "Trafo kademe ayarları doğru yapılmış mı?", severity: "major" },
        { id: "H4-5", text: "Redresör (Bar24) bağlantıları yapılmış mı? Akü test edilmiş mi?", severity: "major" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Bölüm I — CCTV, PANO ve İZLEME SİSTEMLERİ
// ─────────────────────────────────────────────────────────────────
const I: TeslimAlmaSection = {
  id: "I",
  title: "CCTV, Pano ve İzleme Sistemleri",
  description: "Saha güvenliği ve uzaktan izleme sistemleri.",
  tone: "purple",
  subsections: [
    {
      id: "I.1",
      title: "AG Pano Kontrolü",
      items: [
        { id: "I1-1", text: "GES AG panoda sigorta, kaçak akım rölesi, TMŞ, parafudr, CMUFD, NH bıçaklı sigorta, akım trafosu projeye uygun mu?", severity: "major" },
        { id: "I1-2", text: "Pano içi cıvata ve pabuç tork değerleri uygun mu?", severity: "major" },
        { id: "I1-3", text: "Pano kapaklarının açılıp kapanmasında sorun var mı? Sızdırmazlık (IP44/54) korunmuş mu?", severity: "major" },
        { id: "I1-4", text: "Bara değerleri ve bara dayanım akımı projeye uygun mu?", severity: "major" },
        { id: "I1-5", text: "Pano içi sayaç (tek yönlü) kontrolü projeye uygun mu? Üretim sayacı çalışır durumda mı?", severity: "major" },
        { id: "I1-6", text: "Kaçak akım rölesi (RCD) tipi ve değeri projeye uygun mu? (Tip B veya B+ önerilir)", severity: "major" },
        { id: "I1-7", text: "Kaçak akım rölesi test butonu ile fonksiyon testi yapıldı mı?", severity: "major" },
        { id: "I1-8", text: "Faz sıralamaları projeye uygun mu?", severity: "major" },
        { id: "I1-9", text: "Etiketlemeler (tüm sigorta, şalter, klemensler) projeye uygun ve okunaklı mı?", severity: "minor" },
        { id: "I1-10", text: "Kablo giriş kontrolleri projeye uygun mu? (Rakor, conta, dikey/yatay giriş)", severity: "minor" },
        { id: "I1-11", text: "Pano montajı ve kaide sağlamlığı uygun mu?", severity: "major" },
        { id: "I1-12", text: "Pano içi havalandırma / fan çalışıyor mu?", severity: "minor" },
        { id: "I1-13", text: "Pano içi tek hat şeması yapışkanlı veya cebinde mevcut mu?", severity: "minor" },
        { id: "I1-14", text: "Topraklama kablosu renk ve pabuç kontrolü projeye uygun mu?", severity: "minor" },
        { id: "I1-15", text: "AG kablo geçiş güzergahı ve levha (sticker) kontrolü uygun mu?", severity: "minor" },
        { id: "I1-16", text: "Kablo renk uygunluğu, korozyon, yüksük, makaron kontrolleri projeye uygun mu?", severity: "minor" },
      ],
    },
    {
      id: "I.2",
      title: "CCTV ve Güvenlik Kameraları",
      items: [
        { id: "I2-1", text: "Kamera marka, model, çözünürlük projeye uygun mu? (Min. 2MP / 4MP IP kamera)", severity: "minor" },
        { id: "I2-2", text: "Kamera açıları (görüş alanları) tüm saha sınırlarını ve kritik noktaları kapsıyor mu?", severity: "major" },
        { id: "I2-3", text: "Kamera montajları (yükseklik, açı, mesafe) projeye uygun mu?", severity: "minor" },
        { id: "I2-4", text: "Gece görüşlü (IR) kamera kullanılmış mı?", severity: "major" },
        { id: "I2-5", text: "Kameralar PoE ile besleniyor mu? Switch ve UPS kapasitesi yeterli mi?", severity: "major" },
        { id: "I2-6", text: "NVR / DVR cihazı kurulu, çalışır durumda mı?", severity: "major" },
        { id: "I2-7", text: "Disk kapasitesi minimum kayıt süresi (genelde 30 gün) için yeterli mi?", severity: "major" },
        { id: "I2-8", text: "Uzaktan görüntü erişim (mobil/web) testi yapıldı mı?", severity: "major" },
        { id: "I2-9", text: "CCTV altyapı (kablolama, kanal, konnektör) projeye uygun mu?", severity: "minor" },
        { id: "I2-10", text: "Hareket algılama, alarm bildirimi gibi yazılım ayarları yapıldı mı?", severity: "minor" },
        { id: "I2-11", text: "Kamera kayıtları korumalı bir alanda (kilitli kabin) tutulmakta mı?", severity: "major" },
        { id: "I2-12", text: "CCTV kayıtları KVKK aydınlatma metni ve uyarı tabelası mevcut mu?", severity: "major" },
      ],
    },
    {
      id: "I.3",
      title: "Haberleşme, İnternet ve SCADA / Monitoring",
      items: [
        { id: "I3-1", text: "Haberleşme hattı (fiber / GSM / ADSL) projeye uygun mu? Bağlantı testleri yapıldı mı?", severity: "major" },
        { id: "I3-2", text: "Haberleşme altyapısı kurulumu projeye uygun mu? (Modem, switch, router montajı)", severity: "minor" },
        { id: "I3-3", text: "İnternet altyapısı projeye uygun mu? Bant genişliği yeterli mi? Statik IP varsa belge ile teslim edildi mi?", severity: "major" },
        { id: "I3-4", text: "Datalogger / akıllı ölçüm cihazı montajı yapıldı mı?", severity: "major" },
        { id: "I3-5", text: "Datalogger projeye uygun olarak parametrelendirildi mi?", severity: "major" },
        { id: "I3-6", text: "Tüm inverter, sayaç, meteo sensör datalogger'a düşüyor mu?", severity: "major" },
        { id: "I3-7", text: "Üretici monitoring portalına login bilgileri test edildi mi?", severity: "major" },
        { id: "I3-8", text: "Portal yetkilendirmeleri (admin/installer/owner) işverene devredildi mi?", severity: "major" },
        { id: "I3-9", text: "Performans, üretim, alarm, hata e-posta bildirimleri açık ve doğru adrese tanımlı mı?", severity: "minor" },
        { id: "I3-10", text: "Meteoroloji istasyonu (pyranometer, sıcaklık sensörü, panel sıcaklığı, anemometer) kurulu ve datalogger'a bağlı mı?", severity: "major" },
        { id: "I3-11", text: "Pyranometer kalibrasyon sertifikası mevcut mu? (En az ISO 9060 Class B)", severity: "major" },
        { id: "I3-12", text: "Saha SCADA ekranında (varsa) tüm parametreler real-time görüntüleniyor mu?", severity: "minor" },
        { id: "I3-13", text: "Modbus / RS485 haberleşme RTU değerleri doğru okunuyor mu?", severity: "major" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Bölüm J — TEST, ÖLÇÜM ve DEVREYE ALMA
// ─────────────────────────────────────────────────────────────────
const J: TeslimAlmaSection = {
  id: "J",
  title: "Test, Ölçüm ve Devreye Alma",
  description: "Devreye alma testleri IEC 62446-1 ve IEC 61829 standartlarına göre yapılmalı.",
  tone: "green",
  subsections: [
    {
      id: "J.1",
      title: "Elektriksel Testler",
      items: [
        { id: "J1-1", text: "Tüm string'lerde Voc (açık devre gerilimi) ölçümü tamamlandı mı?", severity: "major" },
        { id: "J1-2", text: "Tüm string'lerde Isc (kısa devre akımı) ölçümü tamamlandı mı?", severity: "major" },
        { id: "J1-3", text: "DC izolasyon (Riso) testi tüm string'lerde yapıldı mı?", severity: "major" },
        { id: "J1-4", text: "AC tarafta izolasyon direnci ölçümü yapıldı mı?", severity: "major" },
        { id: "J1-5", text: "Polarite testi (her string) yapıldı mı?", severity: "major" },
        { id: "J1-6", text: "Süreklilik (continuity) testi tüm topraklama hatlarında yapıldı mı?", severity: "major" },
        { id: "J1-7", text: "Toprak elektrod direnci ölçüldü mü?", severity: "major" },
        { id: "J1-8", text: "Devre empedansı / kısa devre akımı ölçüldü mü?", severity: "major" },
        { id: "J1-9", text: "RCD (kaçak akım rölesi) çalışma testi yapıldı mı?", severity: "major" },
        { id: "J1-10", text: "Tüm koruma elemanları (sigorta, MCB, MCCB, ACB) seçicilik testi yapıldı mı?", severity: "major" },
        { id: "J1-11", text: "Kısa devre koruma koordinasyon raporu hazırlandı mı?", severity: "major" },
      ],
    },
    {
      id: "J.2",
      title: "Performans Testleri",
      items: [
        { id: "J2-1", text: "I-V curve (akım-gerilim eğrisi) ölçümü her string için yapıldı mı?", severity: "major" },
        { id: "J2-2", text: "I-V curve sonuçları flash test (üretici) değerleriyle karşılaştırıldı mı? (±%5 tolerans)", severity: "major" },
        { id: "J2-3", text: "Capacity test (performans testi) yapıldı mı? PR (Performance Ratio) hesaplandı mı?", severity: "major" },
        { id: "J2-4", text: "PR değeri sözleşme garantili değerin üzerinde mi? (Genelde >%75-80)", severity: "major" },
        { id: "J2-5", text: "Yield (kWh/kWp) ilk gün ölçümü yapıldı mı?", severity: "minor" },
        { id: "J2-6", text: "Inverter verimi (efficiency) farklı yük seviyelerinde test edildi mi?", severity: "minor" },
        { id: "J2-7", text: "Reaktif güç kontrolü (cos φ ayarlanabilirliği) test edildi mi?", severity: "major" },
      ],
    },
    {
      id: "J.3",
      title: "Termal Kamera ve EL Testleri",
      items: [
        { id: "J3-1", text: "Termal kamera ile inverter, pano, klemens, bağlantı noktaları taranmış mı?", severity: "major" },
        { id: "J3-2", text: "Termal kamera ile tüm paneller (drone ile saha bütünü) taranmış mı? (Sabah 9-10 arası önerilir)", severity: "major" },
        { id: "J3-3", text: "Termal hot-spot, fail string, fail panel tespit edildi mi? Raporlandı mı?", severity: "major" },
        { id: "J3-4", text: "Elektroluminesans (EL) testi seçilmiş örnek paneller üzerinde yapıldı mı? (Mikro çatlak, ölü hücre tespiti)", severity: "minor" },
        { id: "J3-5", text: "Termal/EL raporu, kalibrasyon sertifikası ile birlikte teslim edildi mi?", severity: "major" },
      ],
    },
    {
      id: "J.4",
      title: "Çalıştırma Testleri",
      items: [
        { id: "J4-1", text: "Tüm inverterler tek tek devreye alındı mı?", severity: "major" },
        { id: "J4-2", text: "Anti-islanding (şebeke ayrılması) testi yapıldı mı?", severity: "major" },
        { id: "J4-3", text: "Yük altında 72 saat sürekli çalışma testi (gerekirse) yapıldı mı?", severity: "major" },
        { id: "J4-4", text: "Acil durdurma (E-stop) testi yapıldı mı? Tüm sistem güvenli duruma geçiyor mu?", severity: "major" },
        { id: "J4-5", text: "Şebeke kesintisi sonrası otomatik yeniden bağlanma süresi doğru mu?", severity: "major" },
        { id: "J4-6", text: "Inverter aşırı gerilim / düşük gerilim koruma testi yapıldı mı?", severity: "major" },
        { id: "J4-7", text: "Inverter aşırı / düşük frekans koruma testi yapıldı mı?", severity: "major" },
      ],
    },
    {
      id: "J.5",
      title: "Çıktı ve Üretim Doğrulama",
      items: [
        { id: "J5-1", text: "Üretim sayacı (TEDAŞ onaylı) takılı ve mühürlü mü?", severity: "major" },
        { id: "J5-2", text: "Üretim sayacı ile inverter sayacı arasındaki sapma kabul sınırları içinde mi?", severity: "major" },
        { id: "J5-3", text: "İlk gün üretim simülasyon değerleri ile karşılaştırıldı mı? (PVsyst raporu ile)", severity: "major" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Bölüm K — DOKÜMANTASYON
// ─────────────────────────────────────────────────────────────────
const K: TeslimAlmaSection = {
  id: "K",
  title: "Dokümantasyon & Teslim Evrakları",
  description: "As-built çizimler ve test raporları olmadan kabul yapılmamalıdır.",
  tone: "blue",
  subsections: [
    {
      id: "K.1",
      title: "Proje ve İzin Belgeleri",
      items: [
        { id: "K1-1", text: "TEDAŞ proje onayı (tek hat şeması, AG/OG paftaları) güncel kopyası mevcut mu?", severity: "major" },
        { id: "K1-2", text: "EDAŞ bağlantı anlaşması ve sistem kullanım anlaşması mevcut mu?", severity: "major" },
        { id: "K1-3", text: "Çağrı mektubu, geçici kabul başvurusu evrakı tamam mı?", severity: "major" },
        { id: "K1-4", text: "İmar durumu / yapı ruhsatı / yapı kullanma izin belgesi (gerekiyorsa) mevcut mu?", severity: "major" },
        { id: "K1-5", text: "ÇED muafiyet veya ÇED olumlu kararı belgesi mevcut mu?", severity: "major" },
        { id: "K1-6", text: "Tapu / kira sözleşmesi / irtifak hakkı belgesi mevcut mu?", severity: "major" },
        { id: "K1-7", text: "Üretim lisansı veya lisanssız üretim onayı mevcut mu?", severity: "major" },
        { id: "K1-8", text: "Yenilenebilir Enerji Kaynak Belgesi (YEK Belgesi) başvurusu/onayı mevcut mu?", severity: "major" },
      ],
    },
    {
      id: "K.2",
      title: "As-Built (Yapıldı) Dokümanları",
      items: [
        { id: "K2-1", text: "As-built tek hat şeması (PDF + DWG) teslim edildi mi?", severity: "major" },
        { id: "K2-2", text: "As-built saha yerleşim planı (panel layout) teslim edildi mi?", severity: "major" },
        { id: "K2-3", text: "As-built AG / OG yerleşim ve kablolama paftaları teslim edildi mi?", severity: "major" },
        { id: "K2-4", text: "As-built topraklama planı ve ölçüm haritası teslim edildi mi?", severity: "major" },
        { id: "K2-5", text: "As-built CCTV ve haberleşme paftaları teslim edildi mi?", severity: "major" },
        { id: "K2-6", text: "As-built köşk, trafo, PB3 ve pano içi montaj çizimleri teslim edildi mi?", severity: "major" },
        { id: "K2-7", text: "GPS koordinatlı kazık ve inverter konumları teslim edildi mi?", severity: "minor" },
        { id: "K2-8", text: "Kazıkların ve binaların gerçek koordinatları (survey raporu) teslim edildi mi?", severity: "minor" },
      ],
    },
    {
      id: "K.3",
      title: "Test, Ölçüm ve Devreye Alma Raporları",
      items: [
        { id: "K3-1", text: "String ölçüm raporları (Voc, Isc, Riso, I-V curve) imzalı PDF teslim edildi mi?", severity: "major" },
        { id: "K3-2", text: "Topraklama ölçüm raporu (TEDAŞ formatında) teslim edildi mi?", severity: "major" },
        { id: "K3-3", text: "İzolasyon direnci ölçüm raporu teslim edildi mi?", severity: "major" },
        { id: "K3-4", text: "OG kablo Hi-Pot / VLF test raporu teslim edildi mi?", severity: "major" },
        { id: "K3-5", text: "Trafo testleri (TTR, izolasyon, polarite, vektör grubu) raporu teslim edildi mi?", severity: "major" },
        { id: "K3-6", text: "Inverter devreye alma (commissioning) raporu teslim edildi mi?", severity: "major" },
        { id: "K3-7", text: "Termal kamera / drone taraması raporu teslim edildi mi?", severity: "major" },
        { id: "K3-8", text: "Elektroluminesans (EL) test raporu (varsa) teslim edildi mi?", severity: "minor" },
        { id: "K3-9", text: "Performance Ratio (PR) ölçüm raporu teslim edildi mi?", severity: "major" },
        { id: "K3-10", text: "Tüm test cihazlarının kalibrasyon sertifikaları teslim edildi mi?", severity: "major" },
      ],
    },
    {
      id: "K.4",
      title: "Ekipman ve Üretici Belgeleri",
      items: [
        { id: "K4-1", text: "Panel datasheet, garanti belgesi ve seri numara listesi teslim edildi mi?", severity: "major" },
        { id: "K4-2", text: "Panel flash test raporları teslim edildi mi?", severity: "major" },
        { id: "K4-3", text: "Inverter datasheet, kullanım kılavuzu, garanti belgesi teslim edildi mi?", severity: "major" },
        { id: "K4-4", text: "Inverter parametre / set değer listesi teslim edildi mi?", severity: "minor" },
        { id: "K4-5", text: "Trafo datasheet, rutin test raporu, garanti belgesi teslim edildi mi?", severity: "major" },
        { id: "K4-6", text: "OG hücreleri (kesici, ayırıcı, röle) datasheet ve test raporları teslim edildi mi?", severity: "major" },
        { id: "K4-7", text: "Kablo (DC, AG, OG) sertifikaları ve TS EN belgeleri teslim edildi mi?", severity: "major" },
        { id: "K4-8", text: "Konnektör (MC4) sertifikası ve uyumluluk belgesi teslim edildi mi?", severity: "major" },
        { id: "K4-9", text: "Konstrüksiyon malzeme sertifikası (galvaniz raporu, statik hesap) teslim edildi mi?", severity: "major" },
        { id: "K4-10", text: "Statik mühendislik raporu (kar, rüzgar yükü hesabı) teslim edildi mi?", severity: "major" },
        { id: "K4-11", text: "Datalogger / SCADA datasheet ve konfigürasyon dosyaları teslim edildi mi?", severity: "minor" },
        { id: "K4-12", text: "CE, TSE, ISO 9001, IEC sertifikaları teslim edildi mi?", severity: "major" },
      ],
    },
    {
      id: "K.5",
      title: "Operasyon ve Bakım Dokümanları",
      items: [
        { id: "K5-1", text: "O&M (Operation & Maintenance) manueli teslim edildi mi?", severity: "major" },
        { id: "K5-2", text: "Periyodik bakım planı (haftalık/aylık/yıllık) hazırlandı mı?", severity: "major" },
        { id: "K5-3", text: "Acil durum müdahale planı teslim edildi mi?", severity: "major" },
        { id: "K5-4", text: "Arıza giderme kılavuzu (troubleshooting guide) teslim edildi mi?", severity: "minor" },
        { id: "K5-5", text: "Tek hat şemasının kontrol odasında asılı / dijital kopyası mevcut mu?", severity: "minor" },
        { id: "K5-6", text: "Tüm şifreler, kullanıcı adları (SCADA, monitoring, inverter, kamera) liste halinde teslim edildi mi?", severity: "major" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Bölüm L — İSG, GÜVENLİK ve ÇEVRE
// ─────────────────────────────────────────────────────────────────
const L: TeslimAlmaSection = {
  id: "L",
  title: "İSG, Güvenlik ve Çevre",
  description: "İş sağlığı ve güvenliği santralin kuruluş ve işletme süresince ön plandadır.",
  tone: "red",
  subsections: [
    {
      id: "L.1",
      title: "İSG Donanımları",
      items: [
        { id: "L1-1", text: "Yangın söndürücüler (CO2, KKT) sayısı ve konumu projeye uygun mu? Geçerlilik tarihleri kontrol edildi mi?", severity: "major" },
        { id: "L1-2", text: "Yangın algılama / alarm sistemi (gerekiyorsa) çalışır durumda mı?", severity: "major" },
        { id: "L1-3", text: "Pano önlerinde izole halı, izole eldiven, sehpa, neon mercanı bulunuyor mu?", severity: "major" },
        { id: "L1-4", text: "İlk yardım dolabı eksiksiz ve geçerlilik tarihi içinde mi?", severity: "major" },
        { id: "L1-5", text: "Acil çıkış kapıları ve yönlendirme levhaları mevcut mu?", severity: "major" },
        { id: "L1-6", text: "Aydınlatmalı acil çıkış levhaları (UPS destekli) çalışıyor mu?", severity: "major" },
        { id: "L1-7", text: "Yüksekte çalışma için ankraj noktaları, can halatı, paraşüt tipi kemer ekipmanları mevcut mu?", severity: "major" },
        { id: "L1-8", text: "Kişisel koruyucu donanım (KKD) dolabı saha içinde erişilebilir mi? (Baret, gözlük, eldiven)", severity: "major" },
      ],
    },
    {
      id: "L.2",
      title: "Uyarı ve Bilgilendirme Levhaları",
      items: [
        { id: "L2-1", text: "Saha girişinde 'Yetkisiz Giriş Yasaktır' levhası mevcut mu?", severity: "major" },
        { id: "L2-2", text: "Tüm OG ekipmanlarda 'Yüksek Gerilim - Ölüm Tehlikesi' levhası mevcut mu?", severity: "major" },
        { id: "L2-3", text: "AG ve DC panolarda akım tipi/değeri etiketleri mevcut mu?", severity: "major" },
        { id: "L2-4", text: "Tek hat şeması ve acil müdahale prosedürü panolarda asılı mı?", severity: "minor" },
        { id: "L2-5", text: "Tüm DC bağlantı noktalarında 'DC Gerilim - Şebeke Kesilse de Akım Vardır' uyarı etiketi var mı?", severity: "major" },
        { id: "L2-6", text: "İSG uyarı, yangın yönergesi ve acil telefon numaraları görünür yerde mi?", severity: "major" },
        { id: "L2-7", text: "KVKK aydınlatma metni (CCTV için) girişte asılı mı?", severity: "major" },
      ],
    },
    {
      id: "L.3",
      title: "İş Hijyeni ve Çevre",
      items: [
        { id: "L3-1", text: "Saha ofisi / dinlenme alanı varsa temiz ve fonksiyonel mi?", severity: "minor" },
        { id: "L3-2", text: "WC, lavabo, su tesisatı çalışır durumda mı? (Mevcutsa)", severity: "minor" },
        { id: "L3-3", text: "Atık yağ, batarya gibi tehlikeli atıklar için toplama kutuları mevcut mu?", severity: "major" },
        { id: "L3-4", text: "Saha içi gürültü, toz, ışık ve elektromanyetik alan ölçüm raporları (varsa) teslim edildi mi?", severity: "minor" },
        { id: "L3-5", text: "İnşaat artıkları, ambalaj atıkları, organik bitkisel atıklar uygun şekilde tasfiye edildi mi?", severity: "minor" },
      ],
    },
    {
      id: "L.4",
      title: "İSG Belgeleri",
      items: [
        { id: "L4-1", text: "İSG plan ve risk değerlendirme raporu teslim edildi mi?", severity: "major" },
        { id: "L4-2", text: "Saha çalışanlarının İSG eğitim belgeleri (5510 sayılı kanun) işverende mevcut mu?", severity: "major" },
        { id: "L4-3", text: "Yüksekte çalışma, elektrik işleri belgeli personel listesi teslim edildi mi?", severity: "major" },
        { id: "L4-4", text: "Saha ziyaretçi defteri / giriş kayıt sistemi mevcut mu?", severity: "minor" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Bölüm M — GARANTİ, YEDEK PARÇA, EĞİTİM
// ─────────────────────────────────────────────────────────────────
const M: TeslimAlmaSection = {
  id: "M",
  title: "Garantiler, Yedek Parça & Eğitim",
  description: "Garanti şartlarının netleştirilmesi, yedek parça stoklarının devri ve işveren personeline eğitim.",
  tone: "accent",
  subsections: [
    {
      id: "M.1",
      title: "Garantiler",
      items: [
        { id: "M1-1", text: "Panel ürün garantisi (genelde 10-12 yıl) belgesi teslim edildi mi?", severity: "major" },
        { id: "M1-2", text: "Panel performans garantisi (25-30 yıl, lineer veya step) belgesi teslim edildi mi?", severity: "major" },
        { id: "M1-3", text: "Inverter garantisi (genelde 5-10 yıl, uzatma seçeneği) belgesi teslim edildi mi?", severity: "major" },
        { id: "M1-4", text: "Trafo garantisi belgesi teslim edildi mi?", severity: "major" },
        { id: "M1-5", text: "Konstrüksiyon garantisi belgesi teslim edildi mi?", severity: "major" },
        { id: "M1-6", text: "EPC (yapım) garantisi (genelde 2 yıl) sözleşmede ve belge olarak mevcut mu?", severity: "major" },
        { id: "M1-7", text: "Performans garantisi (PR garantisi, yıllık degradasyon limitleri) belgelendi mi?", severity: "major" },
        { id: "M1-8", text: "Garanti devreye alma tarihi resmi olarak başlatıldı mı? (Garanti başlangıç belgesi)", severity: "major" },
        { id: "M1-9", text: "Garanti çağrı süreçleri (response time, resolution time) sözleşmede tanımlı mı?", severity: "minor" },
        { id: "M1-10", text: "Üretici doğrudan garantileri (panel, inverter, trafo) işveren adına devredildi mi?", severity: "major" },
      ],
    },
    {
      id: "M.2",
      title: "Yedek Parça",
      items: [
        { id: "M2-1", text: "Sözleşmede tanımlı yedek parça listesi eksiksiz teslim edildi mi?", severity: "major" },
        { id: "M2-2", text: "Yedek panel sayısı: en az 1 adet veya toplam %0.5 teslim edildi mi?", severity: "major" },
        { id: "M2-3", text: "Yedek inverter (varsa farklı güç değerleri) en az 1 adet teslim edildi mi?", severity: "major" },
        { id: "M2-4", text: "Yedek MC4 konnektör (set), DC sigorta, AC sigorta, parafudr modülü teslim edildi mi?", severity: "major" },
        { id: "M2-5", text: "Yedek izolasyon malzemesi, makaron, kablo bağı teslim edildi mi?", severity: "minor" },
        { id: "M2-6", text: "Yedek parçalar tasniflenmiş, etiketlenmiş ve uygun depoda mı?", severity: "minor" },
        { id: "M2-7", text: "Yedek parça envanter listesi imzalı şekilde teslim edildi mi?", severity: "major" },
      ],
    },
    {
      id: "M.3",
      title: "Eğitim",
      items: [
        { id: "M3-1", text: "İşveren operasyon personeline genel saha tanıtım eğitimi verildi mi?", severity: "major" },
        { id: "M3-2", text: "Inverter kullanım, parametrelendirme, alarm yorumlama eğitimi verildi mi?", severity: "major" },
        { id: "M3-3", text: "SCADA / monitoring portal kullanım eğitimi verildi mi?", severity: "major" },
        { id: "M3-4", text: "OG ekipman çalıştırma, devreye alma/devreden çıkarma eğitimi verildi mi?", severity: "major" },
        { id: "M3-5", text: "Acil durum müdahale prosedürleri eğitimi verildi mi?", severity: "major" },
        { id: "M3-6", text: "Periyodik bakım ve temizlik prosedürleri eğitimi verildi mi?", severity: "major" },
        { id: "M3-7", text: "Tüm eğitimler için katılım belgesi / imzalı tutanak teslim edildi mi?", severity: "minor" },
        { id: "M3-8", text: "Eğitim videoları / kullanım kılavuzu PDF olarak teslim edildi mi?", severity: "minor" },
      ],
    },
    {
      id: "M.4",
      title: "Sigorta ve Diğer",
      items: [
        { id: "M4-1", text: "Tüm risk inşaat sigortası (CAR) süresi ve kapsamı kontrol edildi mi?", severity: "major" },
        { id: "M4-2", text: "İşletme sigortası (Operating All Risks) başlatıldı mı? Poliçe kopyası teslim edildi mi?", severity: "major" },
        { id: "M4-3", text: "Doğal afet (sel, dolu, fırtına) sigorta kapsamında mı?", severity: "major" },
        { id: "M4-4", text: "Üçüncü şahıs mali mesuliyet (TPL) sigortası mevcut mu?", severity: "major" },
        { id: "M4-5", text: "Gelir kaybı (DSU - Delay in Start-Up) sigortası başlatıldı mı?", severity: "minor" },
      ],
    },
    {
      id: "M.5",
      title: "Geçici Kabul ve Resmi İşlemler",
      items: [
        { id: "M5-1", text: "Geçici kabul heyeti (TEDAŞ + bağımsız mühendis + işveren temsilcisi) onayı alındı mı?", severity: "major" },
        { id: "M5-2", text: "Geçici kabul tutanağı imzalandı mı?", severity: "major" },
        { id: "M5-3", text: "Tüm major NCR'lar kapatıldı, minor NCR'lar punch-list'e alındı ve süresi belirlendi mi?", severity: "major" },
        { id: "M5-4", text: "Kesin kabul (genelde 1-2 yıl sonra) tarihi sözleşmede yer alıyor mu?", severity: "major" },
        { id: "M5-5", text: "Üretim sayacı mühürlendi ve EDAŞ ile aktif sözleşme imzalandı mı?", severity: "major" },
        { id: "M5-6", text: "EÜAŞ / EPDK üretim onayı (gerekiyorsa) alındı mı?", severity: "major" },
        { id: "M5-7", text: "Mesken / ticarethane uygunsa abone tarifesi ve fatura mahsuplaşma sistemi aktif mi?", severity: "minor" },
      ],
    },
  ],
};

// ─────────────────────────────────────────────────────────────────
// Toplam şablon
// ─────────────────────────────────────────────────────────────────
export const TESLIM_ALMA_TEMPLATE: TeslimAlmaSection[] = [A, B, C, D, E, F, G, H, I, J, K, L, M];

/** Tüm madde id'lerini ve metinlerini düz Map olarak döner (lookup için). */
export function flattenTeslimAlmaItems(): Map<string, TeslimAlmaItem & { sectionId: string; subsectionId: string }> {
  const out = new Map<string, TeslimAlmaItem & { sectionId: string; subsectionId: string }>();
  for (const sec of TESLIM_ALMA_TEMPLATE) {
    for (const sub of sec.subsections) {
      for (const it of sub.items) {
        out.set(it.id, { ...it, sectionId: sec.id, subsectionId: sub.id });
      }
    }
  }
  return out;
}

/** Toplam madde sayısı (sabit) — UI/PDF'de count için. */
export const TESLIM_ALMA_TOTAL_ITEMS = TESLIM_ALMA_TEMPLATE.reduce(
  (sum, s) => sum + s.subsections.reduce((sub, ss) => sub + ss.items.length, 0),
  0
);
