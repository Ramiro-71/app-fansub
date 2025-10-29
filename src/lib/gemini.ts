import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL_EXTRACT =
  process.env.GEMINI_MODEL_EXTRACT ?? "gemini-2.0-flash-lite";
const MODEL_TRANSL = process.env.GEMINI_MODEL_TRANSL ?? "gemini-2.5-pro";

function ensureKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key)
    throw new Error("GEMINI_API_KEY ausente en el entorno del servidor.");
  return key;
}

function getModel(modelName: string, schema: any) {
  const genAI = new GoogleGenerativeAI(ensureKey());
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: schema,
    },
  });
}

// -------- A) Extracción (sin traducir) --------
export async function extractSegmentsFromImage(
  imgWebp: Buffer
): Promise<string> {
  const schema = {
    type: "array",
    items: {
      type: "object",
      properties: {
        order: { type: "integer" },
        bbox: {
          type: "object",
          properties: {
            x: { type: "number" },
            y: { type: "number" },
            w: { type: "number" },
            h: { type: "number" },
          },
          required: ["x", "y", "w", "h"],
        },
        original: { type: "string" },
        confidence: { type: "number" },
      },
      required: ["order", "bbox", "original"],
    },
  };

  const prompt = `
Analiza esta página de manga. Devuelve SOLO JSON.
- Detecta globos y recuadros de texto.
- Orden manga (derecha→izquierda y arriba→abajo).
- Para cada ítem: { "order", "bbox": {"x","y","w","h"} (0..1), "original": "texto", "confidence": 0..1 }.
- No traduzcas. No agregues explicaciones. Solo JSON.
`;

  const model = getModel(MODEL_EXTRACT, schema);
  const res = await model.generateContent([
    { text: prompt },
    {
      inlineData: { data: imgWebp.toString("base64"), mimeType: "image/webp" },
    },
  ]);
  return res.response.text();
}

// -------- B) Traducción contextual (con idioma origen) --------
export type SourceLang = "en" | "ja" | "auto";

/**
 * Traduce la lista ordenada manteniendo coherencia entre líneas.
 * @param items [{ order, original }]
 * @param lang 'en' | 'ja' | 'auto'  (auto = detectar entre inglés/japonés)
 */
export async function translateSegmentsWithContext(
  items: Array<{ order: number; original: string }>,
  lang: SourceLang = "auto"
): Promise<string> {
  const schema = {
    type: "array",
    items: {
      type: "object",
      properties: {
        order: { type: "integer" },
        translated: { type: "string" },
      },
      required: ["order", "translated"],
    },
  };

  const langLabel =
    lang === "en"
      ? "inglés"
      : lang === "ja"
      ? "japonés"
      : "auto (detecta entre inglés o japonés)";

  const prompt = `
Traduce del ${langLabel} al español neutro manteniendo coherencia de página completa.
Reglas:
- Mantén coherencia (pronombres, tiempos, tono y chistes) entre líneas consecutivas.
- Respeta nombres propios. Honoríficos (san, chan, senpai) solo si aportan matiz; en minúscula.
- Evita literalidad rígida; prioriza naturalidad breve y clara.
- Preserva signos y entonación necesarios (¿? ¡! …).
- NO reordenes líneas. Devuelve SOLO JSON: [{ "order": n, "translated": "..." }].

Lista ordenada (manga RTL):
${items.map((it) => `#${it.order}: ${it.original}`).join("\n")}
`;

  const model = getModel(MODEL_TRANSL, schema);
  const res = await model.generateContent([{ text: prompt }]);
  return res.response.text();
}
