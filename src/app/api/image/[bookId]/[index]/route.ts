// src/app/api/image/[bookId]/[index]/route.ts
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/prisma";

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
    select: { imagePath: true },
  });
  if (!page) return new Response("Not found", { status: 404 });

  const buf = await fs.readFile(page.imagePath);

  // Detecta content-type por extensión (por si en el futuro no es .webp)
  const ext = path.extname(page.imagePath).toLowerCase();
  const type =
    ext === ".webp"
      ? "image/webp"
      : ext === ".png"
      ? "image/png"
      : ext === ".jpg" || ext === ".jpeg"
      ? "image/jpeg"
      : "application/octet-stream";

  return new Response(buf, {
    headers: {
      "Content-Type": type,
      "Cache-Control": "no-store",
    },
  });
}
