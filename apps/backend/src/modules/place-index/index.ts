import { Module } from "@medusajs/framework/utils"
import PlaceIndexModuleService from "./service"

/** camelCase — a dash here produces runtime container-resolution errors. */
export const PLACE_INDEX_MODULE = "placeIndex"

export default Module(PLACE_INDEX_MODULE, {
  service: PlaceIndexModuleService,
})
