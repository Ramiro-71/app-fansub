export const runtime = "nodejs";

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const bookId = new URL(req.url).searchParams.get("bookId")!;
  const b = await prisma.book.findUnique({ where: { id: bookId } });
  if (!b) return new Response("Not found", { status: 404 });
  return Response.json({ totalPages: b.totalPages, name: b.name });
}
