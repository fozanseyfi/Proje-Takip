/**
 * Sandbox (Planlama Atölyesi) modu tespiti.
 *
 * `npm run sandbox` ile başlatıldığında `NEXT_PUBLIC_SANDBOX=1` env'i set edilir.
 * Bu modda:
 * - localhost:3001 portunda çalışır (localStorage otomatik izole)
 * - Sidebar sadece WBS, Planlama, Veri Yedeği gösterir
 * - Header'da büyük "PLANLAMA ATÖLYESİ" rozeti
 * - Proje seçici gizli (tek proje varsayımı)
 */
export function isSandboxMode(): boolean {
  return process.env.NEXT_PUBLIC_SANDBOX === "1";
}

/** Sandbox modunda sidebar'da görünür olacak route prefix listesi. */
export const SANDBOX_ALLOWED_ROUTES = ["/wbs", "/planning", "/backup"];
