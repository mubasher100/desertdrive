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
export async function sendPushToAll(container: MedusaContainer, message: PushMessage): Promise<{ sent: number; failed: number }> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as Logger
  let sent = 0
  let failed = 0
  try {
    const service = container.resolve<WebPushModuleService>(WEB_PUSH_MODULE)
    const subs = await service.listPushSubscriptions({}, { take: 100 })
    if (!subs.length) return { sent, failed }
    const keys = await readVapidKeys(service)
    if (!keys) return { sent, failed }

    const payload = JSON.stringify(message)
    const gone: string[] = []
    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
            vapidDetails: { subject: SUBJECT, publicKey: keys.public_key, privateKey: keys.private_key },
            TTL: 24 * 3600,
            urgency: "high",
            timeout: 15_000,
          })
          sent++
        } catch (e) {
          failed++
          const status = (e as { statusCode?: number }).statusCode
          // 404/410: the device unsubscribed or the app was removed. Forget it.
          if (status === 404 || status === 410) gone.push(s.id)
          else logger.warn(`push: to ${s.device ?? "a device"} failed — ${status ?? ""} ${(e as Error).message}`)
        }
      })
    )
    // Housekeeping of rows the push service has declared dead; nothing else
    // reads them, so this does not need a workflow's rollback.
    if (gone.length) await service.deletePushSubscriptions(gone)
  } catch (e) {
    logger.error(`push: ${(e as Error).message}`)
  }
  return { sent, failed }
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
