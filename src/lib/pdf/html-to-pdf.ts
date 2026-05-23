/**
 * Ortak HTML → PDF renderer (html2canvas-pro + jsPDF).
 *
 * Özellikler:
 *  - Üst/alt/yan kenar boşlukları (margin)
 *  - Çok sayfalı içerikte "güvenli sayfa kırılımı" — satır ortasından kesmemek için
 *    sayfa sınırından geriye doğru beyaz/boş satır arar.
 */

import type { jsPDF as JsPDFType } from "jspdf";

export interface HTMLToPDFOptions {
  /** Render edilecek DOM elementi (görünmez konumda olabilir). */
  element: HTMLElement;
  /** Dosya adı (.pdf uzantısız) */
  fileName: string;
  /** A4 dikey için piksel genişliği. Default: 794 */
  pxWidth?: number;
  /** Sayfa kenar boşlukları (mm) */
  margin?: { top: number; bottom: number; left: number; right: number };
  /** Yatay/dikey. Default: portrait. */
  orientation?: "portrait" | "landscape";
}

const DEFAULT_MARGIN = { top: 12, bottom: 12, left: 10, right: 10 };

/**
 * Bir Y koordinatındaki yatay satırın "büyük çoğunlukla beyaz" olup olmadığını döndürür.
 * Sayfa kırılımı için "güvenli nokta" arar — içerik ortasından kesmesin diye.
 */
function isRowMostlyWhite(
  ctx: CanvasRenderingContext2D,
  width: number,
  y: number,
  whiteThreshold = 0.985
): boolean {
  // Tek bir 1 px yüksekliğindeki satırı oku
  const data = ctx.getImageData(0, y, width, 1).data;
  let whiteCount = 0;
  const total = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];
    // Şeffafı da beyaz say
    if (a < 4 || (r > 240 && g > 240 && b > 240)) whiteCount++;
  }
  return whiteCount / total >= whiteThreshold;
}

/**
 * yOffset ile naturalEnd arasında, naturalEnd'den geriye doğru tarayarak ilk
 * "neredeyse boş" satır indeksini döndürür. Bulunamazsa naturalEnd kullanır.
 */
function findSafeBreak(
  ctx: CanvasRenderingContext2D,
  canvasWidth: number,
  yStart: number,
  naturalEnd: number
): number {
  // Sayfanın en az %75'i kadar dolmadan geri arama yapma.
  const minBreak = yStart + (naturalEnd - yStart) * 0.75;
  for (let y = naturalEnd - 1; y >= minBreak; y--) {
    if (isRowMostlyWhite(ctx, canvasWidth, y)) {
      // Boş satırın bir alt sınırını seç (yani boşluğun sonunu)
      return y + 1;
    }
  }
  return naturalEnd;
}

export async function renderHtmlToPdf(opts: HTMLToPDFOptions): Promise<JsPDFType> {
  const margin = opts.margin ?? DEFAULT_MARGIN;
  const orientation = opts.orientation ?? "portrait";

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas-pro"),
  ]);

  const canvas = await html2canvas(opts.element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    windowWidth: opts.pxWidth ?? 794,
  });

  const pdf = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const contentW = pageW - margin.left - margin.right;
  const contentH = pageH - margin.top - margin.bottom;
  const pxPerMm = canvas.width / contentW;
  const pageHpx = contentH * pxPerMm;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    pdf.save(`${opts.fileName}.pdf`);
    return pdf;
  }

  let yOffset = 0;
  let pageNo = 0;
  while (yOffset < canvas.height) {
    const naturalEnd = Math.min(yOffset + pageHpx, canvas.height);
    const isLast = naturalEnd >= canvas.height;
    const safeEnd = isLast ? naturalEnd : findSafeBreak(ctx, canvas.width, yOffset, naturalEnd);
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
    pdf.addImage(imgData, "PNG", margin.left, margin.top, contentW, imgMmH);

    yOffset = safeEnd;
    pageNo++;

    // Sonsuz döngü güvenliği
    if (pageNo > 50) break;
  }

  pdf.save(`${opts.fileName}.pdf`);
  return pdf;
}
