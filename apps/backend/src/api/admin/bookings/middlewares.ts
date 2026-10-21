import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework"
import { z } from "@medusajs/framework/zod"

/** Confirm or Cancel. A cancel may carry a short reason for the record. */
export const BookingActionSchema = z.object({
  action: z.enum(["confirm", "cancel"]),
  reason: z.string().max(300).nullish(),
})
export type BookingActionSchema = z.infer<typeof BookingActionSchema>

/**
 * A refund ALREADY made in the SkipCash portal, in QAR — what the card was
 * charged. The workflow caps it at what is left to refund.
 */
export const BookingRefundSchema = z.object({
  amount: z.number().positive().max(100000),
  note: z.string().max(300).nullish(),
})
export type BookingRefundSchema = z.infer<typeof BookingRefundSchema>

export const bookingAdminMiddlewares: MiddlewareRoute[] = [
  { matcher: "/admin/bookings/:id/action", method: "POST", middlewares: [validateAndTransformBody(BookingActionSchema)] },
  { matcher: "/admin/bookings/:id/refund", method: "POST", middlewares: [validateAndTransformBody(BookingRefundSchema)] },
]

/**
 * One cell of the owner's price table, in whole US dollars — the currency the
 * whole site prices in. Stored as the exact riyal equivalent.
 */
export const SetFarePriceSchema = z.object({
  code: z.string().min(1).max(64),
  handle: z.string().min(1).max(64),
  usd: z.number().int().min(1).max(10000),
})
export type SetFarePriceSchema = z.infer<typeof SetFarePriceSchema>

bookingAdminMiddlewares.push({
  matcher: "/admin/price-table",
  method: "POST",
  middlewares: [validateAndTransformBody(SetFarePriceSchema)],
})
