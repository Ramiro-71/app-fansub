"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import Image from "next/image";
import { orderSegmentsLite, type UISegment } from "@/lib/readingOrder";

type SourceLang = "en" | "ja" | "auto";

function useSegments(bookId: string, index: number) {
  return useQuery<UISegment[]>({
    queryKey: ["segments", bookId, index],
    enabled: Boolean(bookId) && Number.isFinite(index),
    queryFn: async () => {
      const r = await fetch(`/api/pages/${bookId}/${index}/text`);
      if (r.status === 404) return [];
      return (await r.json()) as UISegment[];
    },
    refetchOnWindowFocus: false,
  });
}

export default function ReaderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Lee siempre desde search params (robusto con navegación por <Link/>)
  const spBookId = searchParams.get("bookId") ?? "";
  const spIndex = Number(searchParams.get("i") ?? "0");

  const [bookId, setBookId] = useState<string>(spBookId);
  const [index, setIndex] = useState<number>(
    Number.isFinite(spIndex) ? spIndex : 0
  );
  const [pages, setPages] = useState<number>(0);
  const [dir, setDir] = useState<"rtl" | "ltr">("rtl");
  const [sourceLang, setSourceLang] = useState<SourceLang>("en");
  const [translating, setTranslating] = useState(false);

  // Mantén el estado sincronizado si la URL cambia (ej. navegación atrás/adelante)
  useEffect(() => {
    setBookId(spBookId);
    setIndex(Number.isFinite(spIndex) ? spIndex : 0);
  }, [spBookId, spIndex]);

  // Carga metadatos
  useEffect(() => {
    if (!bookId) return;
    void fetch("/api/book?bookId=" + bookId)
      .then((r) => r.json())
      .then((j) => setPages(j.totalPages));
  }, [bookId]);

  // Sincroniza el índice en la barra de direcciones cuando cambias de página
  useEffect(() => {
    if (!bookId) return;
    const sp = new URLSearchParams(searchParams.toString());
    sp.set("bookId", bookId);
    sp.set("i", String(index));
    router.replace(`/reader?${sp.toString()}`, { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookId, index]); // (no pongas searchParams en deps)

  const {
    data: segments = [],
    refetch,
    isFetching,
  } = useSegments(bookId, index);
  const ordered = useMemo(
    () => orderSegmentsLite(segments, dir),
    [segments, dir]
  );
  const imgUrl = useMemo(
    () => (bookId ? `/api/image/${bookId}/${index}` : ""),
    [bookId, index]
  );

  async function translateNow() {
    try {
      setTranslating(true);
      const res = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bookId, index, lang: sourceLang }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert("Error al traducir: " + (j.detail || res.statusText));
      }
      await refetch();
    } finally {
      setTranslating(false);
    }
  }

  const next = () => setIndex((i) => Math.min(i + 1, Math.max(pages - 1, 0)));
  const prev = () => setIndex((i) => Math.max(i - 1, 0));

  if (!bookId) {
    return (
      <div className="p-6">
        Abre con <code>?bookId=...</code>. Sube un archivo en{" "}
        <Link className="underline" href="/upload">
          /upload
        </Link>
        .
      </div>
    );
  }

  return (
    <div className="h-screen grid grid-cols-2 gap-2">
      {/* Izquierda: texto */}
      <div className="p-3 overflow-auto border-r">
        <div className="flex items-center gap-2 mb-3">
          <Link href="/" className="px-3 py-1 border rounded">
            Inicio
          </Link>
          <Link href="/upload" className="px-3 py-1 border rounded">
            Subir
          </Link>

          <button onClick={prev} className="px-3 py-1 border rounded">
            ←
          </button>
          <div>
            {" "}
            Página {pages ? index + 1 : 0} / {pages}{" "}
          </div>
          <button onClick={next} className="px-3 py-1 border rounded">
            →
          </button>

          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm">Lectura:</label>
            <select
              className="border rounded px-2 py-1"
              value={dir}
              onChange={(e) => setDir(e.target.value as "rtl" | "ltr")}
            >
              <option value="rtl">Manga (derecha→izquierda)</option>
              <option value="ltr">Occidental (izquierda→derecha)</option>
            </select>

            <label className="text-sm">Origen:</label>
            <select
              className="border rounded px-2 py-1"
              value={sourceLang}
              onChange={(e) => setSourceLang(e.target.value as SourceLang)}
            >
              <option value="en">Inglés</option>
              <option value="ja">Japonés</option>
              <option value="auto">Auto (en/ja)</option>
            </select>

            <button
              onClick={translateNow}
              disabled={translating}
              className="px-3 py-1 border rounded disabled:opacity-50"
            >
              {translating ? "Traduciendo…" : "Traducir esta página"}
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
                  <b>ORIG:</b> {s.original}
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
