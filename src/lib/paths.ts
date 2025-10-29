import path from "node:path";
import fs from "node:fs/promises";

export const DATA_DIR = path.join(process.cwd(), "data");
export const bookDir = (bookId: string) => path.join(DATA_DIR, "books", bookId);
export const pagesDir = (bookId: string) => path.join(bookDir(bookId), "pages");
export const pagePath = (bookId: string, index: number) =>
  path.join(pagesDir(bookId), `${index}.webp`);

export async function ensureDirs(...dirs: string[]) {
  await Promise.all(dirs.map((d) => fs.mkdir(d, { recursive: true })));
}
