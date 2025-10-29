// src/app/api/pages/[bookId]/[index]/text/route.ts
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

type UISegment = {
  order: number;
  bbox: { x: number; y: number; w: number; h: number };
  original: string;
  translated: string;
  confidence: number;
};

type Params = { bookId: string; index: string };

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<Params> } // 👈 params es Promise
) {
  const { bookId, index } = await ctx.params; // 👈 await
  const idx = Number.parseInt(index, 10);
  if (!bookId || !Number.isFinite(idx)) {
    return new Response("Bad params", { status: 400 });
  }

  const page = await prisma.page.findFirst({
    where: { bookId, index: idx },
    select: { id: true },
  });
  if (!page) return new Response("Not found", { status: 404 });

  const segs = await prisma.textSegment.findMany({
    where: { pageId: page.id },
    orderBy: { order: "asc" },
    select: {
      order: true,
      bboxX: true,
      bboxY: true,
      bboxW: true,
      bboxH: true,
      original: true,
      translated: true,
      confidence: true,
    },
  });

  const payload: UISegment[] = segs.map((s) => ({
    order: s.order,
    bbox: { x: s.bboxX, y: s.bboxY, w: s.bboxW, h: s.bboxH },
    original: s.original,
    translated: s.translated,
    confidence: s.confidence,
  }));

  return Response.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
