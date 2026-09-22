import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { reserveSlotStep, type ReserveSlotInput } from "./steps/reserve-slot"

/**
 * Holds a vehicle for a cart, or fails the checkout.
 *
 * Called from the storefront immediately before the cart is completed (cash)
 * or before the customer is sent to SkipCash (card). Failing here is a normal,
 * expected outcome — someone else took the last car — and the storefront turns
 * it into "that time has just been taken", not an error page.
 */
export const reserveBookingSlotWorkflow = createWorkflow(
  "reserve-booking-slot",
  function (input: ReserveSlotInput) {
    const reservation = reserveSlotStep(input)
    return new WorkflowResponse(reservation)
  }
)

export default reserveBookingSlotWorkflow
