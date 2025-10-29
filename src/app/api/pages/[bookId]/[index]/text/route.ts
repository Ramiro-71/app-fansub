export const runtime = "nodejs";

import { prisma } from "@/lib/prisma";

type UISegment = {
  order: number;
  bbox: { x: number; y: number; w: number; h: number };
  original: string;
  translated: string;
  confidence: number;
};

type SegRow = {
  order: number;
  bboxX: number;
  bboxY: number;
  bboxW: number;
  bboxH: number;
  original: string;
  translated: string;
  confidence: number;
};

type Params = { bookId: string; index: string };

export async function GET(_: Request, ctx: { params: Promise<Params> }) {
  const { bookId, index } = await ctx.params; // ← params es Promise
  const idx = Number(index);
  if (!Number.isFinite(idx)) return new Response("Bad index", { status: 400 });

  const page = await prisma.page.findFirst({
    where: { bookId, index: idx },
    select: { id: true },
  });
  if (!page) return new Response("Not found", { status: 404 });

  const segs: SegRow[] = await prisma.textSegment.findMany({
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

  const payload: UISegment[] = segs.map(
    (s): UISegment => ({
      order: s.order,
      bbox: { x: s.bboxX, y: s.bboxY, w: s.bboxW, h: s.bboxH },
      original: s.original,
      translated: s.translated,
      confidence: s.confidence,
    })
  );

  return Response.json(payload);
}
