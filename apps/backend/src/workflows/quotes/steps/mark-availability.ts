import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { BOOKING_SLOT_MODULE } from "../../../modules/booking-slot"
import type BookingSlotModuleService from "../../../modules/booking-slot/service"
import { countsAgainstCapacity, overlapRange, readUnits } from "../../../lib/availability"
import type { QuotedVehicle } from "./list-band-vehicles"

type IQueryModule = Omit<RemoteQueryFunction, symbol>

export type MarkAvailabilityInput = {
  vehicles: QuotedVehicle[]
  /**
   * Every instant the booking needs the vehicle for: one on a one-way, two on
   * a return. Empty when the caller has not chosen a time yet.
   */
  pickup_ats: string[]
}

export type AvailableVehicle = QuotedVehicle & { available: boolean }

/**
 * Flags the vehicles already spoken for around this pickup time.
 *
 * They are flagged rather than removed so the results page can say "not
 * available at 14:30" instead of quietly shrinking the list — a customer who
 * sees four cars and then three wonders what happened to the fourth, and
 * "everything is booked" reads very differently from "we don't serve here".
 *
 * Read-only, so no compensation. With no pickup time it is a pass-through:
 * the workflow stays branch-free and the caller decides whether to ask.
 */
export const markAvailabilityStep = createStep(
  "mark-vehicle-availability",
  async (input: MarkAvailabilityInput, { container }) => {
    const vehicles = input.vehicles ?? []

    const instants = (input.pickup_ats ?? [])
      .map((iso) => new Date(iso))
      .filter((d) => !Number.isNaN(d.getTime()))

    if (!instants.length || !vehicles.length) {
      return new StepResponse<AvailableVehicle[]>(vehicles.map((v) => ({ ...v, available: true })))
    }

    const slots = container.resolve(BOOKING_SLOT_MODULE) as BookingSlotModuleService
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as IQueryModule
    const productIds = vehicles.map((v) => v.product_id)

    // One query per leg. A return is two legs, so this is two round trips at
    // most — cheaper than widening the range and filtering, which would count
    // a vehicle busy in the gap between the legs as busy for both.
    const [heldPerLeg, { data: products }] = await Promise.all([
      Promise.all(
        instants.map((at) => {
          const { from, to } = overlapRange(at)
          return slots.listBookingSlots({ product_id: productIds, pickup_at: { $gte: from, $lte: to } })
        })
      ),
      query.graph({ entity: "product", fields: ["id", "metadata"], filters: { id: productIds } }),
    ])

    const unitsById = new Map<string, number>(
      (products ?? []).map((p) => [p.id as string, readUnits(p.metadata as Record<string, unknown> | null)])
    )

    /**
     * Busy on ANY leg means unavailable: the booking needs the same car for
     * both, so a vehicle free on the way out and taken on the way back cannot
     * serve it.
     */
    const fullFor = new Set<string>()
    for (const held of heldPerLeg) {
      const takenById = new Map<string, number>()
      for (const slot of held) {
        if (!countsAgainstCapacity({ order_id: slot.order_id, expires_at: slot.expires_at })) {
          continue
        }
        takenById.set(slot.product_id, (takenById.get(slot.product_id) ?? 0) + 1)
      }
      for (const [productId, taken] of takenById) {
        if (taken >= (unitsById.get(productId) ?? 1)) {
          fullFor.add(productId)
        }
      }
    }

    return new StepResponse<AvailableVehicle[]>(
      vehicles.map((v) => ({ ...v, available: !fullFor.has(v.product_id) }))
    )
  }
)
