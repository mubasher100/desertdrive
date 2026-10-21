import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendTestOwnerEmailWorkflow } from "../../../../workflows/bookings/send-test-owner-email"

/** Sends a sample "new booking" email to the office address. */
export const POST = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const to = process.env.OWNER_NOTIFY_EMAIL || "info@desertdriverental.com"
  const adminBase = (process.env.MEDUSA_BACKEND_URL || "https://ddbackend-production-e9d1.up.railway.app").replace(/\/+$/, "")
  await sendTestOwnerEmailWorkflow(req.scope).run({ input: { to, admin_base: adminBase, now: new Date().toISOString() } })
  res.json({ sent_to: to })
}
