import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { savePushSubscriptionWorkflow } from "../../../../workflows/push"
import { deviceName } from "../../../../lib/push"
import type { PushSubscriptionSchema } from "../middlewares"

/** GET /admin/push/subscriptions — the devices that receive notifications. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data } = await query.graph({ entity: "push_subscription", fields: ["id", "device", "created_at"] })
  res.json({ devices: data })
}

/** POST /admin/push/subscriptions — this device wants notifications. */
export async function POST(req: AuthenticatedMedusaRequest<PushSubscriptionSchema>, res: MedusaResponse) {
  const body = req.validatedBody
  const { result } = await savePushSubscriptionWorkflow(req.scope).run({
    input: {
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
      user_id: req.auth_context?.actor_id ?? null,
      device: deviceName(req.headers["user-agent"]),
    },
  })
  res.json(result)
}
