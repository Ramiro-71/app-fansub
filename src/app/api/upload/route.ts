export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { bookDir, pagesDir, ensureDirs } from "@/lib/paths";
import { extractToWebpPages } from "@/lib/archive";

const ALLOWED_EXTS = new Set([".cbz", ".zip", ".cbr", ".rar"]);

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file") as File | null;
  const providedName = (form.get("name") as string) || undefined;

  if (!file) {
    return new Response(JSON.stringify({ error: "Falta archivo" }), {
      status: 400,
    });
  }
  if (file.size > 300 * 1024 * 1024) {
    return new Response(
      JSON.stringify({ error: "Archivo muy grande (>300MB)" }),
      { status: 413 }
    );
  }

  const originalName = file.name; // <- sin any
  const ext = path.extname(originalName ?? "").toLowerCase();

  if (!ALLOWED_EXTS.has(ext)) {
    return new Response(
      JSON.stringify({
        error: "Formato no soportado (usa .cbz/.cbr/.zip/.rar)",
        detail: { ext, originalName },
      }),
      { status: 400 }
    );
  }

  const bookId = crypto.randomUUID();
  const tmpPath = path.join(process.cwd(), `tmp-${bookId}${ext}`);

  const fileBuf = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(tmpPath, fileBuf);

  try {
    await ensureDirs(bookDir(bookId), pagesDir(bookId));
    const pages = await extractToWebpPages(tmpPath, pagesDir(bookId));

    const name =
      providedName ?? (originalName ? originalName.replace(ext, "") : "Manga");

    await prisma.book.create({
      data: {
        id: bookId,
        name,
        totalPages: pages.length,
        status: "READY",
        pages: {
          create: pages.map((p) => ({
            index: p.index,
            imagePath: p.path,
            width: p.width,
            height: p.height,
            status: "PENDING",
          })),
        },
      },
    });

    return Response.json({ bookId, totalPages: pages.length });
  } finally {
    await fs.unlink(tmpPath).catch(() => {});
  }
}
