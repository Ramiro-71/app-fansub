// src/app/ui/BookDeleteButton.tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function BookDeleteButton({
  bookId,
  className = "",
}: {
  bookId: string;
  className?: string;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onDelete() {
    if (!confirm("¿Eliminar este documento y todas sus páginas?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/book/${bookId}`, { method: "DELETE" });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert("No se pudo eliminar: " + (j.detail || res.statusText));
      } else {
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={onDelete}
      disabled={loading}
      className={`${className} disabled:opacity-50`}
      title="Eliminar documento"
    >
      {loading ? "Eliminando…" : "Borrar"}
    </button>
  );
}
