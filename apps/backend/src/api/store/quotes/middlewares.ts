import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework"
import { z } from "@medusajs/framework/zod"

/**
 * The entire client-controlled surface of the pricing model.
 *
 * Note what is NOT here: no band, no variant id, no amount. The client sends
 * where it wants to go and how many people are going; the server decides
 * everything that costs money. Adding any price-adjacent field to this schema
 * would move a price into the browser's control.
 */
export const CreateQuoteSchema = z.object({
  // Coordinates come from Google Places, but are validated as untrusted input
  // regardless — anyone can POST here.
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),

  // Bounded so a nonsense party size cannot be used to probe the catalogue.
  // The largest vehicle carries 7.
  passengers: z.number().int().min(1).max(16),
  luggage: z.number().int().min(0).max(20),

  /**
   * The pickup instant, ISO 8601 with an offset. Optional: it changes which
   * vehicles are still free, never what they cost.
   */
  pickup_at: z.string().datetime({ offset: true }).nullish(),
})

export type CreateQuoteSchema = z.infer<typeof CreateQuoteSchema>

export const quoteMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/quotes",
    method: "POST",
    middlewares: [validateAndTransformBody(CreateQuoteSchema)],
  },
]
