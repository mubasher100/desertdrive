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

  /** The return leg's instant. A vehicle busy on either leg cannot take the booking. */
  return_at: z.string().datetime({ offset: true }).nullish(),

  /**
   * The owner's test key, which surfaces the 1 QAR test vehicle.
   *
   * This is the one field here that changes what a caller is offered, so it
   * is a SECRET rather than a boolean: `test: true` would let anyone book an
   * airport transfer for a riyal. The route compares it to TEST_BOOKING_KEY
   * and ignores it otherwise — a wrong key is silently the normal fleet, not
   * an error, so the endpoint does not confirm to a guesser that they are
   * close.
   */
  test_key: z.string().max(200).nullish(),
})

export type CreateQuoteSchema = z.infer<typeof CreateQuoteSchema>

export const quoteMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/quotes",
    method: "POST",
    middlewares: [validateAndTransformBody(CreateQuoteSchema)],
  },
]
