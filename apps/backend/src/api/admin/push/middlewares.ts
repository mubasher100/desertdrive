import { MiddlewareRoute, validateAndTransformBody } from "@medusajs/framework"
import { z } from "@medusajs/framework/zod"

/** A browser PushSubscription, as `subscription.toJSON()` gives it. Only https push services. */
export const PushSubscriptionSchema = z.object({
  endpoint: z.url().max(1000).refine((u) => u.startsWith("https://"), "endpoint must be https"),
  expirationTime: z.number().nullish(),
  keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }),
})
export type PushSubscriptionSchema = z.infer<typeof PushSubscriptionSchema>

export const PushUnsubscribeSchema = z.object({ endpoint: z.string().max(1000) })
export type PushUnsubscribeSchema = z.infer<typeof PushUnsubscribeSchema>

export const pushMiddlewares: MiddlewareRoute[] = [
  { matcher: "/admin/push/subscriptions", method: "POST", middlewares: [validateAndTransformBody(PushSubscriptionSchema)] },
  { matcher: "/admin/push/unsubscribe", method: "POST", middlewares: [validateAndTransformBody(PushUnsubscribeSchema)] },
]
