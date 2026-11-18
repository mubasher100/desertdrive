import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { sendPushToAll } from "../../../../lib/push"

/**
 * POST /admin/push/test — a sample notification to every subscribed device,
 * so the owner can close the app and check one arrives.
 *
 * Always answers 200 with what happened per device. A thrown error would
 * become Medusa's "An unknown error occurred", which is what made the first
 * failure on the owner's iPhone (18 Nov 2026) impossible to read.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  try {
    const result = await sendPushToAll(req.scope, {
      title: "Desert Drive — test notification",
      body: "Notifications are working. New bookings will arrive like this.",
      url: "/app/bookings",
      tag: "dd-test",
    })
    res.json(result)
  } catch (e) {
    res.json({ sent: 0, failed: 0, errors: [(e as Error).message] })
  }
}
