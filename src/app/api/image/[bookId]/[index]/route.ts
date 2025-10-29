export const runtime = "nodejs";

import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import { prisma } from "@/lib/prisma";

type Params = { bookId: string; index: string };

export async function GET(_: NextRequest, ctx: { params: Promise<Params> }) {
  const { bookId, index } = await ctx.params; // ← params es Promise
  const idx = Number(index);
  if (!Number.isFinite(idx)) return new Response("Bad index", { status: 400 });

  const page = await prisma.page.findFirst({ where: { bookId, index: idx } });
  if (!page) return new Response("Not found", { status: 404 });

  const buf = await fs.readFile(page.imagePath);
  return new Response(buf, {
    headers: { "Content-Type": "image/webp", "Cache-Control": "no-store" },
  });
}
