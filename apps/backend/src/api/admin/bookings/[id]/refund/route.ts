import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateBookingWorkflow } from "../../../../../workflows/bookings/update-booking"
import type { BookingRefundSchema } from "../../middlewares"

/**
 * POST /admin/bookings/:id/refund — RECORD a refund the owner has already
 * made in the SkipCash portal. Moves no money; see lib/booking-status.ts.
 */
export async function POST(req: AuthenticatedMedusaRequest<BookingRefundSchema>, res: MedusaResponse) {
  const { result } = await updateBookingWorkflow(req.scope).run({
    input: {
      order_id: req.params.id,
      user_id: req.auth_context.actor_id,
      change: { kind: "refund", amount: req.validatedBody.amount, note: req.validatedBody.note ?? null },
    },
  })
  res.json({ booking: result })
}
