import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { reserveBookingSlotWorkflow } from "../../../workflows/bookings/reserve-slot"
import type { CreateReservationSchema } from "./middlewares"

/**
 * POST /store/reservations
 *
 * Holds the vehicle on a cart for its pickup time. The storefront calls this
 * immediately before completing the cart, or before sending the customer to
 * SkipCash.
 *
 * A refusal is not an error in the operational sense — it means somebody else
 * booked the last car first — so it answers 409 with a machine-readable
 * `reason`, and the storefront turns that into plain language.
 */
export async function POST(
  req: MedusaRequest<CreateReservationSchema>,
  res: MedusaResponse
) {
  const { cart_id } = req.validatedBody

  res.setHeader("Cache-Control", "no-store")

  try {
    const { result } = await reserveBookingSlotWorkflow(req.scope).run({
      input: { cart_id },
    })
    res.json({ reserved: true, slot_ids: result.slot_ids })
  } catch (e) {
    const err = e as { type?: string; message?: string }
    if (err?.type === MedusaError.Types.NOT_ALLOWED) {
      res.status(409).json({ reserved: false, reason: "vehicle_unavailable", message: err.message })
      return
    }
    throw e
  }
}
