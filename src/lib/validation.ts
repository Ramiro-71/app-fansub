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
export type SegmentT = z.infer<typeof Segment>;
