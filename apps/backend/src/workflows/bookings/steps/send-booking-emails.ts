import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { sendBookingEmails } from "../../../lib/booking-emails"

export type SendBookingEmailsInput = {
  order_id: string
  /** Announce it as a new booking in the feed (the safety net, when order.placed never ran). */
  announce?: boolean
  /** Only these emails. Default: both. */
  only?: Array<"customer" | "office">
  /** Set by the safety net: a retry, with the emails on their last try. */
  retry?: { lastTry: Array<"customer" | "office"> }
}

/**
 * Sends a booking's emails again. No compensation: an email that went out
 * cannot be recalled, and nothing else is written.
 */
export const sendBookingEmailsStep = createStep(
  "send-booking-emails",
  async (input: SendBookingEmailsInput, { container }) => {
    const result = await sendBookingEmails(container, input.order_id, {
      announce: input.announce ?? false,
      only: input.only,
      retry: input.retry,
    })
    if (!result) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, `Booking ${input.order_id} was not found`)
    }
    return new StepResponse(result)
  }
)
