// src/app/page.tsx
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import BookDeleteButton from "./ui/BookDeleteButton";

export default async function Home() {
  const books = await prisma.book.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      createdAt: true,
      totalPages: true,
      status: true,
    },
  });

  return (
    <main className="px-8 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-lg font-semibold uppercase tracking-wide">
          Mis documentos
        </h1>
        <Link
          href="/upload"
          className="uppercase tracking-wide border-2 px-4 py-2"
        >
          Subir archivo
        </Link>
      </div>

      {/* Grid de tarjetas */}
      {books.length === 0 ? (
        <div className="opacity-70">
          Aún no hay documentos.{" "}
          <Link href="/upload" className="underline">
            Sube uno aquí
          </Link>
          .
        </div>
      ) : (
        <ul className="grid gap-x-16 gap-y-12 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {books.map((b) => (
            <li key={b.id} className="flex flex-col items-center">
              {/* Portada (ancho fijo para que botones coincidan) */}
              <div className="w-[260px] aspect-[3/4] border-2 mb-4 overflow-hidden bg-white">
                <img
                  src={`/api/image/${b.id}/0?ts=${new Date(
                    b.createdAt
                  ).getTime()}`}
                  alt={b.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              <div className="w-[260px] space-y-3">
                <Link
                  href={`/reader?bookId=${b.id}&i=0`}
                  className="block text-center uppercase tracking-wide border-2 px-4 py-2"
                >
                  Abrir
                </Link>

                <BookDeleteButton
                  bookId={b.id}
                  className="w-full uppercase tracking-wide border-2 px-4 py-2 text-center"
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
