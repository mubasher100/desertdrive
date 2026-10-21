import { createWorkflow, transform, when, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { updateOrderWorkflow } from "@medusajs/medusa/core-flows"
import { prepareBookingChangeStep, type PrepareBookingChangeInput } from "./steps/prepare-booking-change"
import { releaseBookingSlotsStep } from "./steps/release-booking-slots"

/**
 * The owner's buttons on a booking: Confirm, Cancel, and Record refund.
 *
 * Writes to the order's metadata through Medusa's own updateOrderWorkflow, so
 * the change is an ordinary, logged order edit. Cancel also releases the car.
 *
 * Composition rules: synchronous, no arrow functions, no conditionals — the
 * branch is `when()`, and data is shaped in `transform()`.
 */
export const updateBookingWorkflow = createWorkflow(
  "update-booking",
  function (input: PrepareBookingChangeInput) {
    const prepared = prepareBookingChangeStep(input)

    when({ input }, function (data) {
      return data.input.change.kind === "action" && data.input.change.action === "cancel"
    }).then(function () {
      releaseBookingSlotsStep({ order_id: input.order_id })
    })

    const update = transform({ prepared, input }, function (data) {
      return {
        id: data.prepared.order_id,
        user_id: data.input.user_id ?? "",
        metadata: data.prepared.metadata,
      }
    })

    updateOrderWorkflow.runAsStep({ input: update })

    return new WorkflowResponse(prepared)
  }
)

export default updateBookingWorkflow
