import { MedusaService } from "@medusajs/framework/utils"
import FareBand from "./models/fare-band"

/**
 * Data access only. Band *resolution* — turning coordinates into a band — is
 * business logic and lives in a workflow, not here.
 */
class FareBandModuleService extends MedusaService({
  FareBand,
}) {}

export default FareBandModuleService
