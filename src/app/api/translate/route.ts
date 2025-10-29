// src/app/api/translate/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { sanitizeToJsonArray } from "@/lib/json";
import {
  ExtractedSegmentsResponse,
  TranslationMapResponse,
} from "@/lib/validation";
import {
  extractSegmentsFromImage,
  translateSegmentsWithContext,
  type SourceLang,
} from "@/lib/gemini";
import { orderSegmentsLite, orderSegmentsSimple } from "@/lib/readingOrder";
import { mergeBrokenPhrases } from "@/lib/mergeSegments";

// --- helpers de normalización ---
function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}
function normalizeBBoxes(
  raw: any[],
  pageW?: number | null,
  pageH?: number | null
) {
  const w = pageW && pageW > 0 ? pageW : undefined;
  const h = pageH && pageH > 0 ? pageH : undefined;

  return (raw ?? []).map((e: any, i: number) => {
    let x = Number(e?.bbox?.x ?? 0);
    let y = Number(e?.bbox?.y ?? 0);
    let bw = Number(e?.bbox?.w ?? 0);
    let bh = Number(e?.bbox?.h ?? 0);

    // ¿parecen píxeles?
    const looksPx = [x, y, bw, bh].some((v) => v > 1.0001);

    if (looksPx && w && h) {
      x /= w;
      bw /= w;
      y /= h;
      bh /= h;
    }

    // clamp y arregla desbordes
    x = clamp01(x);
    y = clamp01(y);
    bw = clamp01(bw);
    bh = clamp01(bh);
    if (x + bw > 1) bw = clamp01(1 - x);
    if (y + bh > 1) bh = clamp01(1 - y);

    return {
      order: typeof e?.order === "number" ? e.order : i,
      bbox: { x, y, w: bw, h: bh },
      original: String(e?.original ?? ""),
      confidence: typeof e?.confidence === "number" ? e.confidence : 0.9,
    };
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as {
    bookId?: string;
    index?: number;
    lang?: SourceLang; // 'en' | 'ja' | 'auto'
  } | null;

  const bookId = body?.bookId;
  const index = body?.index;
  const lang: SourceLang =
    body?.lang === "en" || body?.lang === "ja" || body?.lang === "auto"
      ? body.lang
      : "auto";

  if (!bookId || typeof index !== "number") {
    return new Response(JSON.stringify({ error: "payload inválido" }), {
      status: 400,
    });
  }

  const page = await prisma.page.findFirst({ where: { bookId, index } });
  if (!page) {
    return new Response(JSON.stringify({ error: "page no encontrada" }), {
      status: 404,
    });
  }

  await prisma.page.update({
    where: { id: page.id },
    data: { status: "PROCESSING", error: null },
  });

  try {
    const webp = await fs.readFile(page.imagePath);

    // A) Extraer (sin traducir) y limpiar respuesta del LLM
    const textA = await extractSegmentsFromImage(webp);
    const cleanA = sanitizeToJsonArray(textA);

    // B) NORMALIZAR bbox a [0..1] usando dimensiones de la página
    const raw = JSON.parse(cleanA) as any[];
    const normalized = normalizeBBoxes(raw, page.width, page.height);

    // C) Validar con Zod (ya en [0..1])
    const extracted = ExtractedSegmentsResponse.parse(normalized);

    // D) Orden LITE (rápido) en modo manga RTL
    const base = extracted.map((e, i) => ({
      order: i,
      bbox: e.bbox,
      original: e.original,
      translated: "",
      confidence: e.confidence ?? 0.9,
    }));

    let extractedOrdered = orderSegmentsLite(base, "rtl");
    // Fallback: si no cambió nada, usa la simple
    if (
      extractedOrdered.every((s, i) => s.order === i) &&
      extractedOrdered.length > 1
    ) {
      extractedOrdered = orderSegmentsSimple(extractedOrdered, "rtl");
    }

    // E) Unir frases cortadas (según idioma origen)
    const merged = mergeBrokenPhrases(extractedOrdered, { lang });

    // F) Traducir con contexto de la página
    const listForLLM = merged.map((s) => ({
      order: s.order,
      original: s.original,
    }));
    const textB = await translateSegmentsWithContext(listForLLM, lang);
    const cleanB = sanitizeToJsonArray(textB);
    const tmap = TranslationMapResponse.parse(JSON.parse(cleanB));

    const byOrder = new Map(tmap.map((t) => [t.order, t.translated]));
    const final = merged.map((s) => ({
      ...s,
      translated: byOrder.get(s.order) ?? s.original,
    }));

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
    // Mejora el error para Zod
    const detail = (e as any)?.issues
      ? JSON.stringify((e as any).issues, null, 2)
      : e instanceof Error
      ? e.message
      : String(e);

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
