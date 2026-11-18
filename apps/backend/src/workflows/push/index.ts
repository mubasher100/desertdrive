import { createStep, createWorkflow, StepResponse, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { WEB_PUSH_MODULE } from "../../modules/web-push"
import type WebPushModuleService from "../../modules/web-push/service"
import { newVapidKeys, readVapidKeys } from "../../lib/push"

/**
 * The site's push key pair: the existing one, or a new one on first use. Only
 * the public half leaves this workflow.
 */
const ensurePushKeysStep = createStep(
  "ensure-push-keys",
  async (_: void, { container }) => {
    const service = container.resolve<WebPushModuleService>(WEB_PUSH_MODULE)
    const existing = await readVapidKeys(service)
    if (existing) return new StepResponse({ public_key: existing.public_key }, null)
    const created = await service.createPushKeys(newVapidKeys())
    // Two first requests at once could both create; readVapidKeys always
    // takes the OLDEST, so both callers converge on the same pair.
    const winner = (await readVapidKeys(service))!
    return new StepResponse({ public_key: winner.public_key }, created.id)
  },
  async (createdId, { container }) => {
    if (!createdId) return
    await container.resolve<WebPushModuleService>(WEB_PUSH_MODULE).deletePushKeys(createdId)
  }
)

export const ensurePushKeysWorkflow = createWorkflow("ensure-push-keys", function () {
  return new WorkflowResponse(ensurePushKeysStep())
})

export type SavePushSubscriptionInput = {
  endpoint: string
  p256dh: string
  auth: string
  user_id: string | null
  device: string | null
}

type SavedRow = { id: string; endpoint: string; p256dh: string; auth: string; user_id: string | null; device: string | null }
type SaveUndo = { kind: "created"; id: string } | { kind: "updated"; previous: SavedRow }

/** Adds a device, or refreshes it if this endpoint is already known. */
const savePushSubscriptionStep = createStep(
  "save-push-subscription",
  async (input: SavePushSubscriptionInput, { container }) => {
    const service = container.resolve<WebPushModuleService>(WEB_PUSH_MODULE)
    const [existing] = await service.listPushSubscriptions({ endpoint: input.endpoint }, { take: 1 })
    if (existing) {
      const updated = await service.updatePushSubscriptions({ id: existing.id, ...input })
      const undo: SaveUndo = { kind: "updated", previous: existing }
      return new StepResponse<{ id: string }, SaveUndo>({ id: updated.id }, undo)
    }
    const created = await service.createPushSubscriptions(input)
    const undo: SaveUndo = { kind: "created", id: created.id }
    return new StepResponse<{ id: string }, SaveUndo>({ id: created.id }, undo)
  },
  async (undo, { container }) => {
    if (!undo) return
    const service = container.resolve<WebPushModuleService>(WEB_PUSH_MODULE)
    if (undo.kind === "created") await service.deletePushSubscriptions(undo.id)
    else {
      const p = undo.previous
      await service.updatePushSubscriptions({ id: p.id, endpoint: p.endpoint, p256dh: p.p256dh, auth: p.auth, user_id: p.user_id, device: p.device })
    }
  }
)

export const savePushSubscriptionWorkflow = createWorkflow("save-push-subscription", function (input: SavePushSubscriptionInput) {
  return new WorkflowResponse(savePushSubscriptionStep(input))
})

/** Forgets a device that turned notifications off. */
const removePushSubscriptionStep = createStep(
  "remove-push-subscription",
  async (input: { endpoint: string }, { container }) => {
    const service = container.resolve<WebPushModuleService>(WEB_PUSH_MODULE)
    const rows = await service.listPushSubscriptions({ endpoint: input.endpoint })
    if (rows.length) await service.deletePushSubscriptions(rows.map((r) => r.id))
    return new StepResponse({ removed: rows.length }, rows)
  },
  async (rows, { container }) => {
    if (!rows?.length) return
    const service = container.resolve<WebPushModuleService>(WEB_PUSH_MODULE)
    await service.createPushSubscriptions(
      rows.map((r) => ({ endpoint: r.endpoint, p256dh: r.p256dh, auth: r.auth, user_id: r.user_id, device: r.device }))
    )
  }
)

export const removePushSubscriptionWorkflow = createWorkflow("remove-push-subscription", function (input: { endpoint: string }) {
  return new WorkflowResponse(removePushSubscriptionStep(input))
})
