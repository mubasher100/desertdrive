import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ensurePushKeysWorkflow } from "../../../../workflows/push"

/** GET /admin/push/public-key — what a device needs to subscribe. Created on first use. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse) {
  const { result } = await ensurePushKeysWorkflow(req.scope).run()
  res.json(result)
}
