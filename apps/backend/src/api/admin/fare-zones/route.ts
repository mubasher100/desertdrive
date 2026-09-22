import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createFareZoneWorkflow } from "../../../workflows/zones/create-fare-zone"
import { FARE_ZONE_MODULE } from "../../../modules/fare-zone"
import type { CreateFareZoneSchema } from "./middlewares"

/** GET /admin/fare-zones — every zone, cheapest rank first. */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const service: { listFareZones: (f: object, c?: object) => Promise<unknown[]> } =
    req.scope.resolve(FARE_ZONE_MODULE)

  const fare_zones = await service.listFareZones({}, { order: { rank: "ASC" } })

  res.json({ fare_zones })
}

/** POST /admin/fare-zones — draw a new one. */
export async function POST(req: MedusaRequest<CreateFareZoneSchema>, res: MedusaResponse) {
  const { result } = await createFareZoneWorkflow(req.scope).run({ input: req.validatedBody })
  res.status(201).json({ fare_zone: result })
}
