import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { updateFareZoneStep, type UpdateZoneInput } from "./steps/write-fare-zone"

/** Renames, re-ranks, re-draws or deactivates an area. */
export const updateFareZoneWorkflow = createWorkflow("update-fare-zone", function (input: UpdateZoneInput) {
  return new WorkflowResponse(updateFareZoneStep(input))
})

export default updateFareZoneWorkflow
