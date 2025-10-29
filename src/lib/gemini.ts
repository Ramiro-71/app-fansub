import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL_EXTRACT =
  process.env.GEMINI_MODEL_EXTRACT ?? "gemini-2.0-flash-lite";
const MODEL_TRANSL = process.env.GEMINI_MODEL_TRANSL ?? "gemini-2.0-flash"; // mejor calidad en traducción

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

// A) Extrae solo segmentos (sin traducir)
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
- Ordena para lectura manga (derecha→izquierda y arriba→abajo).
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

// B) Traduce lista ordenada con coherencia de página
export async function translateSegmentsWithContext(
  items: Array<{ order: number; original: string }>
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

  const prompt = `
Traduce del ingles al español neutro teniendo en cuenta TODO el contexto de la página.
Reglas:
- Mantén coherencia entre líneas (pronombres, tiempos, chistes).
- Conserva nombres propios y honoríficos si agregan matiz (san, chan, senpai), en minúscula.
- Evita traducciones literales raras; prioriza naturalidad breve.
- NO cambies el orden. Devuelve SOLO JSON: [{ "order": n, "translated": "..." }].
Aquí está la lista (orden manga):
${items.map((it) => `#${it.order}: ${it.original}`).join("\n")}
`;
  const model = getModel(MODEL_TRANSL, schema);
  const res = await model.generateContent([{ text: prompt }]);
  return res.response.text();
}
