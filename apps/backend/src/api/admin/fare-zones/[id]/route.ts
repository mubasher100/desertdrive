import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { deleteFareZoneWorkflow } from "../../../../workflows/zones/delete-fare-zone"
import { updateFareZoneWorkflow } from "../../../../workflows/zones/update-fare-zone"
import type { UpdateFareZoneSchema } from "../middlewares"

/** POST /admin/fare-zones/:id — Medusa has no PUT or PATCH. */
export async function POST(req: MedusaRequest<UpdateFareZoneSchema>, res: MedusaResponse) {
  const { result } = await updateFareZoneWorkflow(req.scope).run({
    input: { id: req.params.id, ...req.validatedBody },
  })
  res.json({ fare_zone: result })
}

export async function DELETE(req: MedusaRequest, res: MedusaResponse) {
  await deleteFareZoneWorkflow(req.scope).run({ input: { id: req.params.id } })
  res.json({ id: req.params.id, object: "fare_zone", deleted: true })
}
