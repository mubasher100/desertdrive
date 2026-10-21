import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateBookingWorkflow } from "../../../../../workflows/bookings/update-booking"
import type { BookingActionSchema } from "../../middlewares"

/** POST /admin/bookings/:id/action — Confirm or Cancel a booking. */
export async function POST(req: AuthenticatedMedusaRequest<BookingActionSchema>, res: MedusaResponse) {
  const { result } = await updateBookingWorkflow(req.scope).run({
    input: {
      order_id: req.params.id,
      user_id: req.auth_context.actor_id,
      change: { kind: "action", action: req.validatedBody.action, reason: req.validatedBody.reason ?? null },
    },
  })
  res.json({ booking: result })
}
