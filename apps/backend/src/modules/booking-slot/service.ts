import { MedusaService } from "@medusajs/framework/utils"
import BookingSlot from "./models/booking-slot"

/**
 * Data access only. Deciding whether a car is free — the window, the unit
 * count, the lock — is business logic and lives in the reserve-slot workflow.
 */
class BookingSlotModuleService extends MedusaService({
  BookingSlot,
}) {}

export default BookingSlotModuleService
