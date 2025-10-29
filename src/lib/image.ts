import sharp from "sharp";
const MAX = Number(process.env.MAX_IMG_SIDE ?? 2000);

export async function toWebpNormalized(input: Buffer) {
  const img = sharp(input).rotate(); // respeta EXIF
  const meta = await img.metadata();
  const w = meta.width ?? MAX;
  const h = meta.height ?? MAX;
  const scale = Math.max(w, h) > MAX ? MAX / Math.max(w, h) : 1;

  const out = await img
    .resize(Math.round(w * scale), Math.round(h * scale), { fit: "inside" })
    .webp({ quality: 85 })
    .toBuffer();

  const outMeta = await sharp(out).metadata();
  return {
    buffer: out,
    width: outMeta.width ?? Math.round(w * scale),
    height: outMeta.height ?? Math.round(h * scale),
  };
}
