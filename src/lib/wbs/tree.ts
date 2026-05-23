import type { WbsItem } from "@/lib/store/types";

export interface TreeRow {
  item: WbsItem;
  depth: number;             // L0 root = 0; L1 = 1 (display starting from L1 looks visually 0)
  hasChildren: boolean;
  childLeafCodes: string[];  // descendant leaf codes (item kendi leaf ise [item.code])
  parentChain: string[];     // ancestor codes from root → immediate parent
}

export interface WbsTree {
  rows: TreeRow[];                       // full flat tree, top-to-bottom
  childrenMap: Map<string, WbsItem[]>;
  leafsUnder: Map<string, string[]>;
  byCode: Map<string, WbsItem>;
}

/**
 * WBS dizisinden ağaç inşa eder.
 * - Parent ilişkisi parentCode field'ından değil, kod yapısından çıkarılır:
 *   "1.1.1.2" → "1.1.1" → "1.1" → "1" (var olan ilk üst kodu seç).
 *   Bu sayede ara seviyeleri eksik olan kalemler (ör. "1.1.2.1" var ama "1.1.2" yok)
 *   doğru ataya bağlanır.
 * - Sıralama: kod'a göre sayısal lexicographic.
 * - rows: tam ağaç — caller expand state'e göre filtreler.
 */
export function buildWbsTree(wbs: WbsItem[]): WbsTree {
  const byCode = new Map<string, WbsItem>();
  for (const w of wbs) byCode.set(w.code, w);

  /** Kod yapısından geriye doğru yürüyerek var olan en yakın atayı bul */
  function findParentCode(code: string): string | null {
    let curr = code;
    while (true) {
      const lastDot = curr.lastIndexOf(".");
      if (lastDot === -1) return null;
      curr = curr.slice(0, lastDot);
      if (byCode.has(curr)) return curr;
    }
  }

  // parent → children
  const childrenMap = new Map<string, WbsItem[]>();
  for (const w of wbs) {
    const parent = findParentCode(w.code);
    const key = parent ?? "";
    if (!childrenMap.has(key)) childrenMap.set(key, []);
    childrenMap.get(key)!.push(w);
  }
  for (const arr of childrenMap.values()) {
    arr.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  }

  // descendant leaf codes
  const leafsUnder = new Map<string, string[]>();
  function gather(code: string): string[] {
    const cached = leafsUnder.get(code);
    if (cached) return cached;
    const item = byCode.get(code);
    if (!item) {
      leafsUnder.set(code, []);
      return [];
    }
    if (item.isLeaf) {
      const arr = [code];
      leafsUnder.set(code, arr);
      return arr;
    }
    const out: string[] = [];
    for (const c of childrenMap.get(code) ?? []) {
      out.push(...gather(c.code));
    }
    leafsUnder.set(code, out);
    return out;
  }
  for (const w of wbs) gather(w.code);

  // flat rows — kod yapısından türetilmiş ağacı dolaş
  const rows: TreeRow[] = [];
  function walk(item: WbsItem, depth: number, chain: string[]) {
    const children = childrenMap.get(item.code) ?? [];
    rows.push({
      item,
      depth,
      hasChildren: children.length > 0,
      childLeafCodes: leafsUnder.get(item.code) ?? [],
      parentChain: chain,
    });
    const nextChain = [...chain, item.code];
    for (const c of children) walk(c, depth + 1, nextChain);
  }

  const roots = wbs
    .filter((w) => findParentCode(w.code) === null)
    .sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  for (const r of roots) walk(r, 0, []);

  return { rows, childrenMap, leafsUnder, byCode };
}

/**
 * Görünür satırlar: L0 gizli; her satırın L0-dışı atalarının tümü expanded içinde olmalı.
 * collapse hep aynı kuralla işler — "Tümünü Kapat" → expanded=∅ → sadece L1 görünür.
 */
export function getVisibleRows(rows: TreeRow[], expanded: Set<string>): TreeRow[] {
  return rows.filter((r) => {
    if (r.item.level === 0) return false;
    for (const pc of r.parentChain) {
      if (!pc.includes(".")) continue;
      if (!expanded.has(pc)) return false;
    }
    return true;
  });
}

export type ExpandPreset = "ana" | "alt" | "leaf";

/** Preset → expand state */
export function presetExpand(rows: TreeRow[], preset: ExpandPreset): Set<string> {
  if (preset === "ana") return new Set();
  if (preset === "alt") {
    return new Set(rows.filter((r) => r.item.level === 1 && r.hasChildren).map((r) => r.item.code));
  }
  // "leaf" → tüm parent'lar açık
  return new Set(rows.filter((r) => r.hasChildren).map((r) => r.item.code));
}

/** Aktif preset'i expand state'den tespit et (özel durumlar için null) */
export function detectPreset(rows: TreeRow[], expanded: Set<string>): ExpandPreset | null {
  if (expanded.size === 0) return "ana";
  const l1 = rows.filter((r) => r.item.level === 1 && r.hasChildren).map((r) => r.item.code);
  const allParents = rows.filter((r) => r.hasChildren).map((r) => r.item.code);
  const sameSet = (a: Set<string>, b: string[]) => a.size === b.length && b.every((c) => a.has(c));
  if (sameSet(expanded, l1)) return "alt";
  if (sameSet(expanded, allParents)) return "leaf";
  return null;
}
