import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resendBookingEmailsWorkflow } from "../../../../../workflows/bookings/resend-booking-emails"
import { summariseBookingEmails, type NotificationRow } from "../../../../../lib/booking-email-status"

/**
 * GET /admin/bookings/:id/emails — did this booking's emails go out?
 *
 * Read from the notification rows tagged with the order (lib/booking-emails),
 * with the reason for a failure taken from the feed entry that reported it.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({
    entity: "notification",
    fields: ["id", "to", "channel", "template", "status", "data", "created_at"],
    filters: { resource_id: req.params.id },
  })
  res.json({ emails: summariseBookingEmails(data as unknown as NotificationRow[]) })
}

/** POST /admin/bookings/:id/emails — send both emails again. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await resendBookingEmailsWorkflow(req.scope).run({ input: { order_id: req.params.id } })
  res.json(result)
}
