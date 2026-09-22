import { model } from "@medusajs/framework/utils"

/**
 * One vehicle, held for one pickup.
 *
 * Desert Drive sells a physical car and a driver, not stock on a shelf, so
 * Medusa's inventory module is the wrong shape: the same Toyota Rush is
 * sellable at 06:00 and again at 14:00, but not twice at 06:00. What is scarce
 * is a vehicle *around a moment in time*, which is what a row here represents.
 *
 * A row is created before the cart completes — during checkout — so two people
 * paying at the same second cannot both take the last car. That means rows
 * exist that never become orders: those carry `expires_at` and are swept up by
 * the purge job. Once the order is placed the subscriber stamps `order_id` and
 * clears `expires_at`, and the hold becomes permanent until the order is
 * cancelled.
 */
const BookingSlot = model
  .define("booking_slot", {
    id: model.id().primaryKey(),

    /** The vehicle product. Capacity ("how many of this car exist") is `units` on its metadata. */
    product_id: model.text(),

    /** Denormalised for the admin and for debugging; the product id is the join. */
    vehicle_handle: model.text(),

    /** The pickup instant, stored in UTC. Qatar has no DST, so +03:00 always round-trips. */
    pickup_at: model.dateTime(),

    /** The cart that reserved it. Set at reservation, kept for traceability. */
    cart_id: model.text().nullable(),

    /** Set once the order exists. A row with an order_id is a committed booking. */
    order_id: model.text().nullable(),

    /**
     * When an uncommitted hold lapses. Null means committed — the row is only
     * released by cancelling the order. A held row past this time no longer
     * counts against capacity, so an abandoned checkout frees the car even
     * before the purge job removes it.
     */
    expires_at: model.dateTime().nullable(),
  })
  .indexes([
    // Every capacity question is "this vehicle, around this time".
    { on: ["product_id", "pickup_at"] },
    { on: ["cart_id"] },
    { on: ["order_id"] },
  ])

export default BookingSlot
