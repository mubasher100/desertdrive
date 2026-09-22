import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework"
import { z } from "@medusajs/framework/zod"

/**
 * The cart id is the only input: the pickup time and the vehicle are read from
 * the cart server-side. Nothing a browser sends can widen what gets held.
 */
export const CreateReservationSchema = z.object({
  cart_id: z.string().min(1),
})

export type CreateReservationSchema = z.infer<typeof CreateReservationSchema>

export const reservationMiddlewares: MiddlewareRoute[] = [
  {
    matcher: "/store/reservations",
    method: "POST",
    middlewares: [validateAndTransformBody(CreateReservationSchema)],
  },
]
