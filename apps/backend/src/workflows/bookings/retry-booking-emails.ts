import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendBookingEmailsStep, type SendBookingEmailsInput } from "./steps/send-booking-emails"

/**
 * The safety net's resend (jobs/booking-safety-net.ts): only the emails that
 * did not go, and quiet about a failure until the last try.
 */
export const retryBookingEmailsWorkflow = createWorkflow(
  "retry-booking-emails",
  function (input: SendBookingEmailsInput) {
    const result = sendBookingEmailsStep(input)
    return new WorkflowResponse(result)
  }
)

export default retryBookingEmailsWorkflow
