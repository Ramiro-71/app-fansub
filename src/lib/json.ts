export function sanitizeToJsonArray(raw: string): string {
  let t = raw.trim();

  // Si viene en bloque ```json ... ```
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence && fence[1]) {
    t = fence[1].trim();
  }

  // Si aún hay prefijos, intenta recortar al primer array
  if (!t.startsWith("[")) {
    const start = t.indexOf("[");
    const end = t.lastIndexOf("]");
    if (start !== -1 && end !== -1 && end > start) {
      t = t.slice(start, end + 1).trim();
    }
  }
  return t;
}
