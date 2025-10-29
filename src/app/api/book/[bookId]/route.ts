// src/app/api/book/[bookId]/route.ts
export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import fs from "node:fs/promises";
import path from "node:path";

export async function DELETE(
  _req: NextRequest,
  ctx: { params: Promise<{ bookId: string }> }
) {
  // 👇 en Next 15/16, params es una Promise
  const { bookId } = await ctx.params;

  if (!bookId) {
    return new Response(JSON.stringify({ error: "bookId requerido" }), {
      status: 400,
    });
  }

  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book) {
    return new Response(JSON.stringify({ error: "book no encontrado" }), {
      status: 404,
    });
  }

  // Trae páginas para borrar TextSegments y la carpeta en disco
  const pages = await prisma.page.findMany({
    where: { bookId },
    select: { id: true, imagePath: true },
  });

  // Borrado en disco (carpeta del libro)
  try {
    if (pages.length > 0) {
      const dir = path.dirname(pages[0].imagePath); // p.ej. /data/books/<bookId>
      await fs.rm(dir, { recursive: true, force: true });
    } else {
      // Fallback por si no hay páginas pero sí carpeta
      const maybeDir = path.join(process.cwd(), "data", "books", bookId);
      await fs.rm(maybeDir, { recursive: true, force: true });
    }
  } catch {
    // ignora errores de fs
  }

  // Borrado en DB (transacción)
  await prisma.$transaction(async (tx) => {
    const pageIds = pages.map((p) => p.id);
    if (pageIds.length) {
      await tx.textSegment.deleteMany({ where: { pageId: { in: pageIds } } });
      await tx.page.deleteMany({ where: { id: { in: pageIds } } });
    } else {
      await tx.page.deleteMany({ where: { bookId } });
    }
    await tx.book.delete({ where: { id: bookId } });
  });

  return Response.json({ ok: true });
}
