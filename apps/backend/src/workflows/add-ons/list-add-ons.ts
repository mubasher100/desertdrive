import { createWorkflow, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { listAddOnsStep, type AddOn } from "./steps/list-add-ons"

export type { AddOn }

/**
 * The priced add-ons on offer.
 *
 * Trivial today — one step — and a workflow anyway, because the rule in this
 * codebase is that the API route decides nothing. When an add-on grows a
 * condition (a child seat only on vehicles that can fit one, meet & greet only
 * on arrivals) it goes in here, and the route does not change.
 *
 * Composition rules: a plain synchronous `function`, no `async`, no arrows, no
 * conditionals. It runs once at load to build the graph, not per request.
 */
export const listAddOnsWorkflow = createWorkflow("list-add-ons", function () {
  return new WorkflowResponse(listAddOnsStep({}))
})

export default listAddOnsWorkflow
