import { GoogleGenerativeAI } from "@google/generative-ai";

const MODEL_FAST = process.env.GEMINI_MODEL_FAST ?? "gemini-2.0-flash";
const MODEL_STRICT = process.env.GEMINI_MODEL_STRICT ?? "gemini-2.0-flash";

const PROMPT = `
Analiza esta página de manga (lectura derecha→izquierda).
Devuelve SOLO JSON válido (array) con elementos:
{ "order": number, "bbox": { "x":0..1, "y":0..1, "w":0..1, "h":0..1 }, "original": string, "translated": string, "confidence": 0..1 }.
Sin texto extra ni explicaciones. Traduce al español neutro.
`;

// Lanza si falta la API key
function ensureKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key)
    throw new Error("GEMINI_API_KEY ausente en el entorno del servidor.");
  return key;
}

// Modelo con configuración para forzar JSON
function getModel(modelName: string) {
  const genAI = new GoogleGenerativeAI(ensureKey());
  return genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: "application/json",
      // Opcional: schema para que cierre bien el formato
      responseSchema: {
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
            translated: { type: "string" },
            confidence: { type: "number" },
          },
          required: ["order", "bbox", "original", "translated", "confidence"],
        },
      },
    },
  });
}

async function callModel(modelName: string, imgWebp: Buffer): Promise<string> {
  const model = getModel(modelName);
  try {
    const res = await model.generateContent([
      { text: PROMPT },
      {
        inlineData: {
          data: imgWebp.toString("base64"),
          mimeType: "image/webp",
        },
      },
    ]);
    return res.response.text(); // debería venir ya como JSON puro
  } catch (e: any) {
    const msg = e?.message || String(e);
    const status = e?.status || e?.response?.status;
    throw new Error(
      `Gemini(${modelName}) fallo [${status ?? "no-status"}]: ${msg}`
    );
  }
}

export async function translateImageWebpToSegments(imgWebp: Buffer) {
  try {
    return await callModel(MODEL_FAST, imgWebp);
  } catch (e: any) {
    const m = (e?.message ?? "").toLowerCase();
    // si hay bloqueo de safety, intentamos con el modelo más estricto
    if (m.includes("safety") || m.includes("blocked")) {
      return await callModel(MODEL_STRICT, imgWebp);
    }
    throw e;
  }
}
