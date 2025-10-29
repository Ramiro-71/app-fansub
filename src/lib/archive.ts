import fs from "node:fs/promises";
import path from "node:path";
import * as unzipper from "unzipper";
import { createExtractorFromData } from "unrar-js";
import { toWebpNormalized } from "./image";

const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".bmp", ".gif"]);

export async function extractToWebpPages(archivePath: string, outDir: string) {
  const ext = path.extname(archivePath).toLowerCase();
  const items: { name: string; getBuffer: () => Promise<Buffer> }[] = [];

  if (ext === ".cbz" || ext === ".zip") {
    const dir = await unzipper.Open.file(archivePath);
    for (const e of dir.files) {
      const eext = path.extname(e.path).toLowerCase();
      if (!IMG_EXT.has(eext)) continue;
      items.push({ name: e.path, getBuffer: () => e.buffer() });
    }
  } else if (ext === ".cbr" || ext === ".rar") {
    const ab = new Uint8Array(await fs.readFile(archivePath));
    const extractor = await createExtractorFromData({ data: ab });
    const list = extractor.getFileList();
    for (const h of list.fileHeaders) {
      const eext = path.extname(h.name).toLowerCase();
      if (!IMG_EXT.has(eext)) continue;
      items.push({
        name: h.name,
        getBuffer: async () => {
          const ex = extractor.extract({ files: [h.name] });
          const file = ex.files[0];
          return Buffer.from(file.extracted);
        },
      });
    }
  } else {
    throw new Error("Formato no soportado (usa .cbz/.cbr)");
  }

  // orden natural por nombre
  items.sort((a, b) =>
    a.name.localeCompare(b.name, undefined, {
      numeric: true,
      sensitivity: "base",
    })
  );

  await fs.mkdir(outDir, { recursive: true });
  let i = 0;
  const pages: {
    index: number;
    path: string;
    width: number;
    height: number;
  }[] = [];
  for (const it of items) {
    const raw = await it.getBuffer();
    const { buffer, width, height } = await toWebpNormalized(raw);
    const p = path.join(outDir, `${i}.webp`);
    await fs.writeFile(p, buffer);
    pages.push({ index: i, path: p, width, height });
    i++;
  }
  return pages;
}
