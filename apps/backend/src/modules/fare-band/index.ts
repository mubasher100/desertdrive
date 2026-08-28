import { Module } from "@medusajs/framework/utils"
import FareBandModuleService from "./service"

/**
 * camelCase, NOT "fare-band". Medusa resolves modules from the container by
 * property access, so a dash here produces runtime resolution errors rather
 * than anything that looks like a naming problem.
 */
export const FARE_BAND_MODULE = "fareBand"

export default Module(FARE_BAND_MODULE, {
  service: FareBandModuleService,
})
