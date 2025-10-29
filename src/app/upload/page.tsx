"use client";
import { useState } from "react";

type UploadResult = { bookId: string; totalPages: number } | null;

export default function UploadPage() {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResult>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    fd.append("name", name || file.name);
    const r = await fetch("/api/upload", { method: "POST", body: fd });
    const j = (await r.json()) as { bookId?: string; totalPages?: number };
    setResult(
      j.bookId && typeof j.totalPages === "number"
        ? { bookId: j.bookId, totalPages: j.totalPages }
        : null
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">Subir CBZ/CBR</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <input
          className="border px-3 py-2 w-full"
          placeholder="Nombre del libro (opcional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          type="file"
          accept=".cbz,.cbr,.zip,.rar"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
        <button className="border px-4 py-2 rounded" type="submit">
          Subir y extraer
        </button>
      </form>
      {result && (
        <div className="mt-4">
          <div className="mb-2">
            Libro: <b>{result.bookId}</b> ({result.totalPages} páginas)
          </div>
          <a
            className="underline text-blue-600"
            href={`/reader?bookId=${result.bookId}`}
          >
            Abrir lector
          </a>
        </div>
      )}
    </div>
  );
}
