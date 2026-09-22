import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework"
import { z } from "@medusajs/framework/zod"

const Point = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
})

/**
 * A zone is a pricing key and an outline. `code` must match the product option
 * value the owner prices against, so it is constrained to the same shape as a
 * handle — no spaces, nothing that needs escaping when it reaches the
 * catalogue.
 */
export const CreateFareZoneSchema = z.object({
  code: z.string().min(1).max(64).regex(/^[a-z0-9-]+$/, "Lowercase letters, numbers and hyphens only"),
  name_en: z.string().min(1).max(120),
  name_ar: z.string().min(1).max(120),
  // Three points is the minimum that encloses anything; the cap stops a
  // pathological outline from bloating every quote.
  polygon: z.array(Point).min(3).max(500),
  rank: z.number().int().min(0).max(10000).optional(),
  active: z.boolean().optional(),
})

export const UpdateFareZoneSchema = CreateFareZoneSchema.partial()

export type CreateFareZoneSchema = z.infer<typeof CreateFareZoneSchema>
export type UpdateFareZoneSchema = z.infer<typeof UpdateFareZoneSchema>

export const fareZoneMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/admin/fare-zones",
    method: "POST",
    middlewares: [validateAndTransformBody(CreateFareZoneSchema)],
  },
  {
    matcher: "/admin/fare-zones/:id",
    method: "POST",
    middlewares: [validateAndTransformBody(UpdateFareZoneSchema)],
  },
]
