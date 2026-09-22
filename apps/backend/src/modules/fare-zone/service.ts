import { MedusaService } from "@medusajs/framework/utils"
import FareZone from "./models/fare-zone"

/**
 * Data access only. Deciding which zone a point falls in is business logic and
 * lives in the quote workflow.
 */
class FareZoneModuleService extends MedusaService({
  FareZone,
}) {}

export default FareZoneModuleService
