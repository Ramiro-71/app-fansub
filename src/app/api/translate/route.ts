export const runtime = "nodejs";

import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";
import { translateImageWebpToSegments } from "@/lib/gemini";
import { SegmentsResponse } from "@/lib/validation";
import { sanitizeToJsonArray } from "@/lib/json";
import type { Prisma } from "@prisma/client";

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
    const text = await translateImageWebpToSegments(webp);

    const clean = sanitizeToJsonArray(text);
    const segments = SegmentsResponse.parse(JSON.parse(clean));

    await prisma.$transaction(async (tx) => {
      await tx.textSegment.deleteMany({ where: { pageId: page.id } });
      await tx.textSegment.createMany({
        data: segments.map((s) => ({
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

    return Response.json({ ok: true });
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
