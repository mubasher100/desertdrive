import { Module } from "@medusajs/framework/utils"
import BookingSlotModuleService from "./service"

/** camelCase — a dash here produces runtime container-resolution errors. */
export const BOOKING_SLOT_MODULE = "bookingSlot"

export default Module(BOOKING_SLOT_MODULE, {
  service: BookingSlotModuleService,
})
