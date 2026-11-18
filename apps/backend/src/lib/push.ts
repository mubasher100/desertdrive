import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import webpush from "web-push"
import { WEB_PUSH_MODULE } from "../modules/web-push"
import type WebPushModuleService from "../modules/web-push/service"

/**
 * Push notifications to the owner's devices, delivered even when the admin is
 * closed: on Android through Chrome, on iPhone through the admin added to the
 * Home Screen (iOS 16.4+; Apple allows web push nowhere else).
 *
 * Sent alongside every feed entry (lib/booking-emails.ts): a new booking, and
 * an email that failed. Email failed silently for weeks in Nov 2026 and a
 * pickup can be minutes away, so this is the alert that reaches a pocket.
 */

export type PushMessage = {
  title: string
  body: string
  /** Opened when the notification is tapped, e.g. /app/bookings/order_… */
  url: string
  /** Same tag replaces, rather than stacks, on the device. */
  tag?: string
}

const SUBJECT = "mailto:info@desertdriverental.com"

/** The key pair from the environment, if set there. */
function envKeys(): { public_key: string; private_key: string } | null {
  const pub = process.env.VAPID_PUBLIC_KEY?.trim()
  const priv = process.env.VAPID_PRIVATE_KEY?.trim()
  return pub && priv ? { public_key: pub, private_key: priv } : null
}

/** Existing keys only, oldest first — never creates (see the ensure-push-keys workflow). */
export async function readVapidKeys(service: WebPushModuleService) {
  const env = envKeys()
  if (env) return env
  const [first] = await service.listPushKeys({}, { order: { created_at: "ASC" }, take: 1 })
  return first ? { public_key: first.public_key, private_key: first.private_key } : null
}

export function newVapidKeys() {
  const k = webpush.generateVAPIDKeys()
  return { public_key: k.publicKey, private_key: k.privateKey }
}

/**
 * Sends to every subscribed device. Never throws: a push that cannot be sent
 * is logged, and never affects the booking that caused it.
 */
export type PushResult = {
  sent: number
  failed: number
  /** One line per device that did not get it, for the admin's test button. */
  errors: string[]
}

/**
 * Sends to every subscribed device. Never throws: a push that cannot be sent
 * is logged and reported, and never affects the booking that caused it.
 *
 * web-push only signs and encrypts (generateRequestDetails); the request is
 * made with Node's own fetch and a hard timeout. web-push's own sender uses
 * https.request, whose timeout handling can emit an error after the promise
 * has settled — on a live server that is a crash, not a failed push.
 */
export async function sendPushToAll(container: MedusaContainer, message: PushMessage): Promise<PushResult> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as Logger
  const result: PushResult = { sent: 0, failed: 0, errors: [] }
  try {
    const service = container.resolve<WebPushModuleService>(WEB_PUSH_MODULE)
    const subs = await service.listPushSubscriptions({}, { take: 100 })
    if (!subs.length) return result
    const keys = await readVapidKeys(service)
    if (!keys) {
      result.errors.push("No push keys exist yet. Turn notifications on from a device first.")
      return result
    }

    const payload = JSON.stringify(message)
    const gone: string[] = []
    await Promise.all(
      subs.map(async (s) => {
        const device = s.device ?? "a device"
        try {
          const req = webpush.generateRequestDetails({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
            vapidDetails: { subject: SUBJECT, publicKey: keys.public_key, privateKey: keys.private_key },
            TTL: 24 * 3600,
            urgency: "high",
          })
          const res = await fetch(req.endpoint, {
            method: req.method,
            headers: req.headers as Record<string, string>,
            body: new Uint8Array(req.body as Buffer),
            signal: AbortSignal.timeout(15_000),
          })
          if (res.ok) {
            result.sent++
            return
          }
          const text = (await res.text().catch(() => "")).slice(0, 200)
          result.failed++
          // 404/410: the device unsubscribed or the app was removed. Forget it.
          if (res.status === 404 || res.status === 410) {
            gone.push(s.id)
            result.errors.push(`${device}: no longer subscribed (removed)`)
          } else {
            result.errors.push(`${device}: push service answered ${res.status} ${text}`.trim())
          }
        } catch (e) {
          result.failed++
          result.errors.push(`${device}: ${(e as Error).message}`)
        }
      })
    )
    for (const line of result.errors) logger.warn(`push: ${line}`)
    // Housekeeping of rows the push service has declared dead; nothing else
    // reads them, so this does not need a workflow's rollback.
    if (gone.length) await service.deletePushSubscriptions(gone)
  } catch (e) {
    result.errors.push((e as Error).message)
    logger.error(`push: ${(e as Error).message}`)
  }
  return result
}

/** "iPhone", "Android", "Windows"… from a user agent, for telling devices apart. */
export function deviceName(userAgent: string | undefined): string {
  const ua = userAgent ?? ""
  if (/iPhone/.test(ua)) return "iPhone"
  if (/iPad/.test(ua)) return "iPad"
  if (/Android/.test(ua)) return "Android"
  if (/Macintosh/.test(ua)) return "Mac"
  if (/Windows/.test(ua)) return "Windows"
  return "Browser"
}
