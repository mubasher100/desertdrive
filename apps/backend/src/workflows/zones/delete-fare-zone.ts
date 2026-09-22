import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { deleteFareZoneStep } from "./steps/write-fare-zone"

/** Removes an area. Destinations inside it fall back to their distance band. */
export const deleteFareZoneWorkflow = createWorkflow("delete-fare-zone", function (input: { id: string }) {
  return new WorkflowResponse(deleteFareZoneStep(input))
})

export default deleteFareZoneWorkflow
