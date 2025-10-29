"use client";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { orderSegments, type UISegment } from "@/lib/readingOrder";

function useSegments(bookId: string, index: number) {
  return useQuery<UISegment[]>({
    queryKey: ["segments", bookId, index],
    enabled: Boolean(bookId) && Number.isFinite(index),
    queryFn: async () => {
      const r = await fetch(`/api/pages/${bookId}/${index}/text`);
      if (r.status === 404) return [];
      return (await r.json()) as UISegment[];
    },
  });
}

export default function ReaderPage() {
  const [bookId] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("bookId") || "";
  });
  const [index, setIndex] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    const v = new URLSearchParams(window.location.search).get("i");
    return Number(v ?? 0) || 0;
  });
  const [pages, setPages] = useState<number>(0);
  const [dir, setDir] = useState<"rtl" | "ltr">("rtl"); // ← por defecto manga (RTL)

  useEffect(() => {
    if (!bookId) return;
    void fetch("/api/book?bookId=" + bookId)
      .then((r) => r.json())
      .then((j) => setPages(j.totalPages));
  }, [bookId]);

  const {
    data: segments = [],
    refetch,
    isFetching,
  } = useSegments(bookId, index);
  const ordered = useMemo(() => orderSegments(segments, dir), [segments, dir]); // ← ordenar aquí
  const imgUrl = useMemo(
    () => (bookId ? `/api/image/${bookId}/${index}` : ""),
    [bookId, index]
  );

  async function translateNow() {
    await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bookId, index }),
    });
    await refetch();
  }

  const next = () => setIndex((i) => Math.min(i + 1, Math.max(pages - 1, 0)));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));

  if (!bookId) {
    return (
      <div className="p-6">
        Abre con <code>?bookId=...</code>. Sube un archivo en{" "}
        <a className="underline" href="/upload">
          /upload
        </a>
      </div>
    );
  }

  return (
    <div className="h-screen grid grid-cols-2 gap-2">
      {/* Izquierda: texto */}
      <div className="p-3 overflow-auto border-r">
        <div className="flex items-center gap-2 mb-3">
          <button onClick={prev} className="px-3 py-1 border rounded">
            ←
          </button>
          <div>
            Página {pages ? index + 1 : 0} / {pages}
          </div>
          <button onClick={next} className="px-3 py-1 border rounded">
            →
          </button>

          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm">Orden:</label>
            <select
              className="border rounded px-2 py-1"
              value={dir}
              onChange={(e) => setDir(e.target.value as "rtl" | "ltr")}
              title="Orden de lectura (manga: RTL)"
            >
              <option value="rtl">Manga (derecha→izquierda)</option>
              <option value="ltr">Occidental (izquierda→derecha)</option>
            </select>
            <button onClick={translateNow} className="px-3 py-1 border rounded">
              Traducir esta página
            </button>
          </div>
        </div>

        {isFetching && <div className="text-sm opacity-70">Cargando…</div>}

        {ordered.length === 0 ? (
          <div className="opacity-60">Sin segmentos aún.</div>
        ) : (
          <ul className="space-y-2">
            {ordered.map((s) => (
              <li key={s.order} className="p-2 border rounded">
                <div className="text-xs opacity-70">
                  #{s.order} conf:{Math.round(s.confidence * 100)}%
                </div>
                <div className="text-sm">
                  <b>JP:</b> {s.original}
                </div>
                <div className="text-sm">
                  <b>ES:</b> {s.translated}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Derecha: imagen */}
      <div className="bg-black/5 flex items-center justify-center">
        <div className="relative h-[95vh] w-full">
          {imgUrl && (
            <Image
              src={imgUrl}
              alt={`page-${index}`}
              fill
              unoptimized
              style={{ objectFit: "contain" }}
              sizes="(min-width: 1024px) 50vw, 100vw"
              priority
            />
          )}
        </div>
      </div>
    </div>
  );
}
