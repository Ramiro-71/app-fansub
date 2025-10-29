import { z } from "zod";

export const Segment = z.object({
  order: z.number().int().nonnegative(),
  bbox: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .refine(
      (b) => [b.x, b.y, b.w, b.h].every((v) => v >= 0 && v <= 1),
      "bbox fuera de [0..1]"
    ),
  original: z.string().min(1),
  translated: z.string().min(1),
  confidence: z.number().min(0).max(1),
});
export const SegmentsResponse = z.array(Segment).min(1);

// Paso A: extracción (sin traducir)
export const ExtractedSegment = z.object({
  order: z.number().int().nonnegative(),
  bbox: z
    .object({
      x: z.number(),
      y: z.number(),
      w: z.number(),
      h: z.number(),
    })
    .refine(
      (b) => [b.x, b.y, b.w, b.h].every((v) => v >= 0 && v <= 1),
      "bbox fuera de [0..1]"
    ),
  original: z.string().min(1),
  confidence: z.number().min(0).max(1).optional().default(0.9),
});
export const ExtractedSegmentsResponse = z.array(ExtractedSegment).min(1);

// Paso B: mapa de traducción (order -> translated)
export const TranslationMapItem = z.object({
  order: z.number().int().nonnegative(),
  translated: z.string().min(1),
});
export const TranslationMapResponse = z.array(TranslationMapItem).min(1);
export type ExtractedSegmentT = z.infer<typeof ExtractedSegment>;
export type TranslationMapItemT = z.infer<typeof TranslationMapItem>;
