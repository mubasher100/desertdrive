import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendTestOwnerEmailWorkflow } from "../../../../workflows/bookings/send-test-owner-email"
import { emailFailureReason } from "../../../../lib/email-failure"

/**
 * Sends a sample "new booking" email to the office address.
 *
 * A failure is answered with its real reason. Thrown, it would reach Medusa's
 * error handler, which turns every 500 into "An unknown error occurred." —
 * and that is all the owner saw while every email was failing (Nov 2026).
 */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const to = process.env.OWNER_NOTIFY_EMAIL || "desertdrivetransportation@gmail.com"
  const adminBase = (process.env.MEDUSA_BACKEND_URL || "https://ddbackend-production-e9d1.up.railway.app").replace(/\/+$/, "")
  try {
    await sendTestOwnerEmailWorkflow(req.scope).run({ input: { to, admin_base: adminBase, now: new Date().toISOString() } })
    res.json({ sent_to: to })
  } catch (e) {
    res.status(502).json({ message: `The test email to ${to} did not send. ${emailFailureReason(e)}` })
  }
}
