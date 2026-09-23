import { MedusaService } from "@medusajs/framework/utils"
import Place from "./models/place"

/** Data access only. Ranking and the import live outside the module. */
class PlaceIndexModuleService extends MedusaService({
  Place,
}) {}

export default PlaceIndexModuleService
