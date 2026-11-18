import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { removePushSubscriptionWorkflow } from "../../../../workflows/push"
import type { PushUnsubscribeSchema } from "../middlewares"

/** POST /admin/push/unsubscribe — this device no longer wants notifications. */
export async function POST(req: AuthenticatedMedusaRequest<PushUnsubscribeSchema>, res: MedusaResponse) {
  const { result } = await removePushSubscriptionWorkflow(req.scope).run({ input: { endpoint: req.validatedBody.endpoint } })
  res.json(result)
}
