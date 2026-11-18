import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { sendBookingEmails } from "../../../lib/booking-emails"

/**
 * Sends a booking's two emails again. No compensation: an email that went out
 * cannot be recalled, and nothing else is written.
 */
export const sendBookingEmailsStep = createStep(
  "send-booking-emails",
  async (input: { order_id: string }, { container }) => {
    const result = await sendBookingEmails(container, input.order_id, { announce: false })
    if (!result) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Booking ${input.order_id} was not found`)
    }
    return new StepResponse(result)
  }
)
