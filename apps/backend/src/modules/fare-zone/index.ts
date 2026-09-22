import { Module } from "@medusajs/framework/utils"
import FareZoneModuleService from "./service"

/** camelCase — a dash here produces runtime container-resolution errors. */
export const FARE_ZONE_MODULE = "fareZone"

export default Module(FARE_ZONE_MODULE, {
  service: FareZoneModuleService,
})
