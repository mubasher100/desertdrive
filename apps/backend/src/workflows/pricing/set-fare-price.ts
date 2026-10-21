import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { setFarePriceStep, type SetFarePriceInput } from "./steps/set-fare-price"

/** Sets one price in the owner's price table. */
export const setFarePriceWorkflow = createWorkflow("set-fare-price", function (input: SetFarePriceInput) {
  return new WorkflowResponse(setFarePriceStep(input))
})

export default setFarePriceWorkflow
