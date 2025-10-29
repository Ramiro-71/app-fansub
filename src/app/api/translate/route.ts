import fs from "node:fs/promises";
import type { Prisma } from "@prisma/client";
import { sanitizeToJsonArray } from "@/lib/json";
import {
  ExtractedSegmentsResponse,
  TranslationMapResponse,
} from "@/lib/validation";
import {
  extractSegmentsFromImage,
  translateSegmentsWithContext,
} from "@/lib/gemini";
import { prisma } from "@/lib/prisma";
import { orderSegments } from "@/lib/readingOrder";

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    bookId?: string;
    index?: number;
  } | null;
  const bookId = body?.bookId;
  const index = body?.index;
  if (!bookId || typeof index !== "number") {
    return new Response(JSON.stringify({ error: "payload inválido" }), {
      status: 400,
    });
  }

  const page = await prisma.page.findFirst({ where: { bookId, index } });
  if (!page)
    return new Response(JSON.stringify({ error: "page no encontrada" }), {
      status: 404,
    });

  await prisma.page.update({
    where: { id: page.id },
    data: { status: "PROCESSING", error: null },
  });

  try {
    const webp = await fs.readFile(page.imagePath);

    // Paso A: extraer sólo originales
    const textA = await extractSegmentsFromImage(webp);
    const cleanA = sanitizeToJsonArray(textA);
    const extracted = ExtractedSegmentsResponse.parse(JSON.parse(cleanA));

    // (opcional) reforzar orden manga con nuestra heurística por si el modelo se equivoca
    const extractedOrdered = orderSegments(
      extracted.map((e) => ({
        order: e.order,
        bbox: e.bbox,
        original: e.original,
        translated: "",
        confidence: e.confidence ?? 0.9,
      })),
      "rtl"
    );

    // Paso B: traducir con el contexto de TODA la página
    const listForLLM = extractedOrdered.map((s) => ({
      order: s.order,
      original: s.original,
    }));
    const textB = await translateSegmentsWithContext(listForLLM);
    const cleanB = sanitizeToJsonArray(textB);
    const tmap = TranslationMapResponse.parse(JSON.parse(cleanB));

    // Fusionar
    const byOrder = new Map(tmap.map((t) => [t.order, t.translated]));
    const final = extractedOrdered.map((s) => ({
      ...s,
      translated: byOrder.get(s.order) ?? s.original, // fallback por si faltara alguno
    }));

    // Persistir
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      await tx.textSegment.deleteMany({ where: { pageId: page.id } });
      await tx.textSegment.createMany({
        data: final.map((s) => ({
          pageId: page.id,
          order: s.order,
          bboxX: s.bbox.x,
          bboxY: s.bbox.y,
          bboxW: s.bbox.w,
          bboxH: s.bbox.h,
          original: s.original,
          translated: s.translated,
          confidence: s.confidence,
        })),
      });
      await tx.page.update({
        where: { id: page.id },
        data: { status: "READY" },
      });
    });

    return Response.json({ ok: true, segments: final.length });
  } catch (e: unknown) {
    const detail = e instanceof Error ? e.message : String(e);
    console.error("[translate] error:", detail);
    await prisma.page.update({
      where: { id: page.id },
      data: { status: "ERROR", error: detail },
    });
    return new Response(JSON.stringify({ error: "traducción falló", detail }), {
      status: 500,
    });
  }
}
