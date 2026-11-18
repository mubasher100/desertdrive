import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendPushToAll } from "../../../../lib/push"

/**
 * POST /admin/push/test — a sample notification to every subscribed device,
 * so the owner can close the app and check one arrives.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const result = await sendPushToAll(req.scope, {
    title: "Desert Drive — test notification",
    body: "Notifications are working. New bookings will arrive like this.",
    url: "/app/bookings",
    tag: "dd-test",
  })
  res.json(result)
}
