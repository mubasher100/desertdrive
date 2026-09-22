import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { createFareZoneStep, type ZoneInput } from "./steps/write-fare-zone"

/** Draws a new priced area. */
export const createFareZoneWorkflow = createWorkflow("create-fare-zone", function (input: ZoneInput) {
  return new WorkflowResponse(createFareZoneStep(input))
})

export default createFareZoneWorkflow
