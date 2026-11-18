import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendBookingEmailsStep } from "./steps/send-booking-emails"

/**
 * "Resend emails" on a booking in the admin: the customer's confirmation and
 * the office alert, exactly as order.placed sends them. For a booking whose
 * emails failed, or a customer who says nothing arrived.
 */
export const resendBookingEmailsWorkflow = createWorkflow("resend-booking-emails", function (input: { order_id: string }) {
  const result = sendBookingEmailsStep(input)
  return new WorkflowResponse(result)
})

export default resendBookingEmailsWorkflow
