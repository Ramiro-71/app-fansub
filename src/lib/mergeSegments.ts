// src/lib/mergeSegments.ts
export type BBox = { x: number; y: number; w: number; h: number };

export type ExtractSeg = {
  order: number;
  bbox: BBox;
  original: string;
  confidence?: number;
};

export type MergedSeg = {
  order: number;
  bbox: BBox;
  original: string;
  translated: string; // vacío aquí; se llenará tras traducir
  confidence: number;
};

export type MergeOptions = {
  lang?: "en" | "ja" | "auto";
};

const ELLIPSIS_RE = /(…|\.{3})\s*$/; // … o ...
const DASH_CONT_RE = /(-|—|–)\s*$/; // guion de continuación
const NO_TERMINAL_RE = /[^\.\!\?…」」』』。！？]\s*$/; // no termina “fuerte” (heurística)
const LOWERCASE_START_RE = /^[a-z¡¿"'(\[]/; // inicio minúscula (inglés)
const JP_CHAR_START_RE =
  /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u;

function endsWithContinuation(
  text: string,
  lang: "en" | "ja" | "auto"
): boolean {
  if (ELLIPSIS_RE.test(text) || DASH_CONT_RE.test(text)) return true;
  // Si no hay cierre fuerte y tal vez sea continuación
  if (NO_TERMINAL_RE.test(text)) return true;
  return false;
}

function startsLikeContinuation(
  text: string,
  lang: "en" | "ja" | "auto"
): boolean {
  const t = text.trim();
  if (lang === "ja") {
    return JP_CHAR_START_RE.test(t); // no hay mayúsculas, asumimos continuidad si empieza “normal”
  }
  // en/auto: si inicia en minúscula o símbolo de apertura, parece continuación
  return LOWERCASE_START_RE.test(t);
}

function unionBBox(a: BBox, b: BBox): BBox {
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.w, b.x + b.w);
  const maxY = Math.max(a.y + a.h, b.y + b.h);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function joinText(prev: string, next: string): string {
  // Si termina en guion, pegamos sin espacio; si “…” o “,”, agregamos espacio
  if (DASH_CONT_RE.test(prev))
    return prev.replace(DASH_CONT_RE, "") + next.trimStart();
  if (ELLIPSIS_RE.test(prev) || /[,:;]$/.test(prev.trim()))
    return prev + " " + next.trim();
  // por defecto, espacio
  return prev.trimEnd() + " " + next.trimStart();
}

/**
 * Fusión secuencial:
 *  - si seg[i] "pide" continuidad y seg[i+1] "parece" continuación → unir.
 *  - reindexa order = 0..n-1
 */
export function mergeBrokenPhrases(
  input: ExtractSeg[],
  opt: MergeOptions = { lang: "auto" }
): MergedSeg[] {
  const lang = opt.lang ?? "auto";
  if (!input || input.length <= 1) {
    return (input ?? []).map((s) => ({
      order: s.order,
      bbox: s.bbox,
      original: s.original,
      translated: "",
      confidence: s.confidence ?? 0.9,
    }));
  }

  const out: MergedSeg[] = [];
  let acc: MergedSeg | null = null;

  const inferLang = lang === "auto" ? detectLangFromPage(input) : lang;

  for (let i = 0; i < input.length; i++) {
    const cur = input[i];
    if (!acc) {
      acc = {
        order: cur.order,
        bbox: cur.bbox,
        original: cur.original,
        translated: "",
        confidence: cur.confidence ?? 0.9,
      };
    } else {
      const prevText = acc.original;
      const nextText = cur.original;

      if (
        endsWithContinuation(prevText, inferLang) &&
        startsLikeContinuation(nextText, inferLang)
      ) {
        // merge
        acc.original = joinText(acc.original, nextText);
        acc.bbox = unionBBox(acc.bbox, cur.bbox);
        acc.confidence = Math.min(acc.confidence, cur.confidence ?? 0.9);
      } else {
        out.push(acc);
        acc = {
          order: cur.order,
          bbox: cur.bbox,
          original: cur.original,
          translated: "",
          confidence: cur.confidence ?? 0.9,
        };
      }
    }
  }
  if (acc) out.push(acc);

  // reindexar order
  return out.map((s, i) => ({ ...s, order: i }));
}

// Detección simple del idioma origen (para heurísticas)
function detectLangFromPage(items: ExtractSeg[]): "en" | "ja" {
  const sample = items
    .slice(0, 6)
    .map((s) => s.original)
    .join(" ");
  const hasJP = /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}]/u.test(
    sample
  );
  return hasJP ? "ja" : "en";
}
