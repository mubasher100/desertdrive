import { ContainerRegistrationKeys, MathBN, MedusaError } from "@medusajs/framework/utils"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import {
  applyBookingAction,
  BookingRuleError,
  recordRefund,
  type BookingAction,
} from "../../../lib/booking-status"

export type PrepareBookingChangeInput = {
  order_id: string
  user_id: string | null
  change:
    | { kind: "action"; action: BookingAction; reason?: string | null }
    | { kind: "refund"; amount: number; note?: string | null }
}

/**
 * Reads the order and works out its metadata after the owner's action —
 * Confirm, Cancel, or a refund recorded after it was made in SkipCash. The
 * rules are in lib/booking-status.ts; this step only feeds them the order and
 * turns a broken rule into a 400 the admin can show.
 *
 * Read-only, so nothing to compensate.
 */
export const prepareBookingChangeStep = createStep(
  "prepare-booking-change",
  async (input: PrepareBookingChangeInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as Omit<RemoteQueryFunction, symbol>
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "metadata", "summary"],
      filters: { id: input.order_id },
    })
    const order = data?.[0] as
      | { id: string; metadata?: Record<string, unknown> | null; summary?: { current_order_total?: number | string } }
      | undefined
    if (!order) throw new MedusaError(MedusaError.Types.NOT_FOUND, "Booking not found.")
    if (!order.metadata?.pickup_at) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "This order is not a booking.")

    const now = new Date()
    try {
      const metadata =
        input.change.kind === "action"
          ? applyBookingAction(order.metadata, input.change.action, input.user_id, now, input.change.reason)
          : recordRefund(
              order.metadata,
              input.change.amount,
              // query.graph leaves order.total empty; the computed total is here.
              MathBN.convert((order.summary?.current_order_total ?? 0) as number | string).toNumber(),
              input.user_id,
              now,
              input.change.note
            )
      return new StepResponse({ order_id: order.id, metadata })
    } catch (e) {
      if (e instanceof BookingRuleError) throw new MedusaError(MedusaError.Types.NOT_ALLOWED, e.message)
      throw e
    }
  }
)
