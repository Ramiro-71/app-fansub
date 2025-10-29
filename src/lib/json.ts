export function sanitizeToJsonArray(raw: string): string {
  let t = raw.trim();
  const fence = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
  if (fence?.[1]) t = fence[1].trim();
  if (!t.startsWith("[")) {
    const s = t.indexOf("["),
      e = t.lastIndexOf("]");
    if (s !== -1 && e !== -1 && e > s) t = t.slice(s, e + 1).trim();
  }
  return t;
}
