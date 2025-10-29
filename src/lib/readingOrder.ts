// src/lib/readingOrder.ts

export type UISegment = {
  order: number;
  bbox: { x: number; y: number; w: number; h: number }; // normalizado [0..1]
  original: string;
  translated: string;
  confidence: number;
};

type WithCenter = UISegment & { _cx: number; _cy: number };
export type OrderDir = "rtl" | "ltr";

function withCenter(s: UISegment): WithCenter {
  return { ...s, _cx: s.bbox.x + s.bbox.w / 2, _cy: s.bbox.y + s.bbox.h / 2 };
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

/** Heurística *simple* (fila por Y, luego X por RTL/LTR). */
export function orderSegmentsSimple(
  input: UISegment[],
  dir: OrderDir = "rtl"
): UISegment[] {
  if (!input?.length) return [];
  const items = input.map(withCenter).sort((a, b) => a._cy - b._cy);

  // Tolerancia vertical fija y pequeña (para casos triviales)
  const ROW_EPS = 0.06;
  const rows: WithCenter[][] = [];
  let cur: WithCenter[] = [];
  for (const it of items) {
    if (!cur.length || Math.abs(it._cy - cur[cur.length - 1]._cy) <= ROW_EPS)
      cur.push(it);
    else {
      rows.push(cur);
      cur = [it];
    }
  }
  if (cur.length) rows.push(cur);

  for (const r of rows)
    r.sort((a, b) => (dir === "rtl" ? b._cx - a._cx : a._cx - b._cx));

  const out: UISegment[] = [];
  let k = 0;
  for (const r of rows) for (const s of r) out.push({ ...s, order: k++ });
  return out;
}

/**
 * Heurística *lite*:
 *  - Filas: tolerancia vertical ADAPTATIVA usando mediana de alturas.
 *  - Columnas: se detectan en cada fila solo si hay gaps X grandes (umbral por ancho promedio).
 *  - Orden manga: columnas derecha→izquierda; dentro de columnas arriba→abajo.
 */
export function orderSegmentsLite(
  input: UISegment[],
  dir: OrderDir = "rtl"
): UISegment[] {
  if (!input?.length) return [];

  const items = input.map(withCenter);
  // -------- 1) Filas por Y (tolerancia adaptativa) --------
  const heights = items.map((i) => i.bbox.h).sort((a, b) => a - b);
  const hMed = heights.length ? heights[Math.floor(heights.length / 2)] : 0.08;
  // 60% de la mediana, acotado a [0.04, 0.12]
  const ROW_EPS = clamp(0.6 * hMed, 0.04, 0.12);

  items.sort((a, b) => a._cy - b._cy || a._cx - b._cx);

  const rows: WithCenter[][] = [];
  let cur: WithCenter[] = [];
  for (const it of items) {
    if (!cur.length || Math.abs(it._cy - cur[cur.length - 1]._cy) <= ROW_EPS)
      cur.push(it);
    else {
      rows.push(cur);
      cur = [it];
    }
  }
  if (cur.length) rows.push(cur);

  // -------- 2) Columnas opcionales por gaps X --------
  const out: UISegment[] = [];
  let k = 0;

  for (const row of rows) {
    // umbral de separación entre columnas: 50% del ancho promedio, acotado a [0.04, 0.12]
    const wAvg =
      row.reduce((a, b) => a + b.bbox.w, 0) / Math.max(1, row.length);
    const COL_GAP = clamp(0.5 * wAvg, 0.04, 0.12);

    // orden preliminar por X (según dir) para inspeccionar gaps
    const prelim = row
      .slice()
      .sort((a, b) => (dir === "rtl" ? b._cx - a._cx : a._cx - b._cx));

    // calcular gaps entre vecinos
    const gaps: number[] = [];
    for (let i = 1; i < prelim.length; i++) {
      gaps.push(Math.abs(prelim[i - 1]._cx - prelim[i]._cx));
    }

    // ¿Hay alguna separación clara de columna?
    const splitPositions: number[] = [];
    for (let i = 0; i < gaps.length; i++) {
      if (gaps[i] > COL_GAP) splitPositions.push(i + 1);
    }

    if (splitPositions.length === 0) {
      // una sola columna → ordenar por X directo
      for (const s of prelim) out.push({ ...s, order: k++ });
      continue;
    }

    // construir columnas a partir de splits
    const cols: WithCenter[][] = [];
    let start = 0;
    for (const cut of splitPositions) {
      cols.push(prelim.slice(start, cut));
      start = cut;
    }
    cols.push(prelim.slice(start));

    // dentro de cada columna: arriba→abajo
    for (const col of cols) col.sort((a, b) => a._cy - b._cy);

    // recorrer columnas según dir (ya están en orden por X)
    for (const col of cols) {
      for (const s of col) out.push({ ...s, order: k++ });
    }
  }

  // Renumerado final por si acaso
  return out.map((s, i) => ({ ...s, order: i }));
}
