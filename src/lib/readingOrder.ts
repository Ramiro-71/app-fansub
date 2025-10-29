export type UISegment = {
  order: number;
  bbox: { x: number; y: number; w: number; h: number };
  original: string;
  translated: string;
  confidence: number;
};

type WithCenters = UISegment & { _cx: number; _cy: number };

function center(s: UISegment) {
  return {
    _cx: s.bbox.x + s.bbox.w / 2,
    _cy: s.bbox.y + s.bbox.h / 2,
  };
}

/**
 * Ordena segmentos por filas (top→bottom) y dentro de la fila:
 *  - RTL: derecha→izquierda
 *  - LTR: izquierda→derecha
 * Renumera order = 0..n-1.
 */
export function orderSegments(
  input: UISegment[],
  dir: "rtl" | "ltr" = "rtl"
): UISegment[] {
  if (!input || input.length <= 1) return input ? [...input] : [];

  const items: WithCenters[] = input.map((s) => ({ ...s, ...center(s) }));

  // 1) Orden inicial por Y (arriba → abajo)
  items.sort((a, b) => a._cy - b._cy);

  // 2) Agrupar por "filas" usando una tolerancia vertical
  const ROW_EPS = 0.06; // 6% de la altura de la página
  const rows: WithCenters[][] = [];
  let current: WithCenters[] = [];

  for (const it of items) {
    if (current.length === 0) {
      current.push(it);
      continue;
    }
    const prev = current[current.length - 1];
    if (Math.abs(it._cy - prev._cy) <= ROW_EPS) {
      current.push(it);
    } else {
      rows.push(current);
      current = [it];
    }
  }
  if (current.length) rows.push(current);

  // 3) Dentro de cada fila, ordenar por X según dir
  for (const r of rows) {
    r.sort((a, b) => (dir === "rtl" ? b._cx - a._cx : a._cx - b._cx));
  }

  // 4) Aplanar y renumerar
  const out: UISegment[] = [];
  let i = 0;
  for (const r of rows) {
    for (const s of r) out.push({ ...s, order: i++ });
  }
  return out;
}
