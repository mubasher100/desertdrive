import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import type { NotificationRow } from "../lib/booking-email-status"
import { sendPushToAll } from "../lib/push"
import { EMAIL_RECORDS_FROM, emailsToRetry, sessionsToCheck, PAID_CHECK_UNTIL_HOURS } from "../lib/booking-safety-net"
import { SkipCashClient, SkipCashStatus } from "../modules/skipcash/client"
import { retryBookingEmailsWorkflow } from "../workflows/bookings/retry-booking-emails"

/**
 * The safety net under every booking, every five minutes. Two checks, each
 * independent — one failing never skips the other.
 *
 * 1. EMAILS THAT DID NOT GO. order.placed sends the customer's confirmation and
 *    the office alert once. Here, any booking from the last three days whose
 *    email failed, got stuck, or was never attempted (the event was lost to a
 *    restart) is sent again, backing off from five minutes to eight hours,
 *    ten tries in all (lib/booking-safety-net.ts). The owner hears about a
 *    failure once, when it first happens, and again only if every retry fails.
 *
 * 2. MONEY TAKEN, NO BOOKING. A customer can pay on SkipCash and never become
 *    a booking: the tab closed before the return page, the webhook was lost,
 *    or completing the cart threw. Every unfinished cart with a SkipCash
 *    payment from the last six hours is asked about; if SkipCash says it is
 *    paid, the booking is completed here — exactly what the return page would
 *    have done, and through the same rules (workflows/hooks/complete-cart.ts).
 *    If even that fails, the office is alerted by feed, push and email, once,
 *    because a person now has to book it by hand or refund it.
 */
export default async function bookingSafetyNet(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER) as Logger
  const now = new Date()
  try {
    await retryEmails(container, logger, now)
  } catch (e) {
    logger.error(`safety net: email check failed — ${(e as Error).message}`)
  }
  try {
    await findPaidCartsWithoutBooking(container, logger, now)
  } catch (e) {
    logger.error(`safety net: payment check failed — ${(e as Error).message}`)
  }
}

export const config = {
  name: "booking-safety-net",
  schedule: "*/5 * * * *",
}

async function retryEmails(container: MedusaContainer, logger: Logger, now: Date) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const since = new Date(Math.max(now.getTime() - 72 * 3600_000, EMAIL_RECORDS_FROM.getTime()))
  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "status", "created_at", "metadata"],
    filters: { created_at: { $gte: since } },
  })
  const live = (orders ?? []).filter(
    (o) => o.status !== "canceled" && (o.metadata as Record<string, unknown> | null)?.booking_status !== "cancelled"
  )
  if (!live.length) return

  const { data: rows } = await query.graph({
    entity: "notification",
    fields: ["id", "to", "channel", "template", "status", "data", "created_at", "resource_id"],
    filters: { resource_id: live.map((o) => o.id) },
  })
  const byOrder = new Map<string, NotificationRow[]>()
  for (const r of (rows ?? []) as unknown as Array<NotificationRow & { resource_id: string }>) {
    const list = byOrder.get(r.resource_id) ?? []
    list.push(r)
    byOrder.set(r.resource_id, list)
  }

  for (const o of live) {
    const m = (o.metadata ?? {}) as Record<string, unknown>
    const decision = emailsToRetry(
      { created_at: o.created_at as string | Date, pickup_at: m.pickup_at, has_customer_email: !!(m.contact_email || o.email) },
      byOrder.get(o.id) ?? [],
      now
    )
    if (!decision.send.length) continue
    logger.info(`safety net: DD-${o.display_id} — sending again: ${decision.send.join(", ")}`)
    try {
      await retryBookingEmailsWorkflow(container).run({
        input: {
          order_id: o.id,
          announce: decision.announce,
          only: decision.send,
          // A booking nobody heard about is reported like a new one, failures
          // included; a retry is quiet until its last try.
          retry: decision.announce ? undefined : { lastTry: decision.lastTry },
        },
      })
    } catch (e) {
      logger.error(`safety net: DD-${o.display_id} resend failed — ${(e as Error).message}`)
    }
  }
}

type CartRow = {
  id: string
  email?: string | null
  completed_at?: string | null
  metadata?: Record<string, unknown> | null
  payment_collection?: {
    amount?: number | string
    payment_sessions?: Array<{
      id: string
      provider_id?: string
      status?: string
      created_at: string
      data?: Record<string, unknown> | null
    }>
  } | null
}

async function findPaidCartsWithoutBooking(container: MedusaContainer, logger: Logger, now: Date) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: [
      "id",
      "email",
      "completed_at",
      "metadata",
      "payment_collection.amount",
      "payment_collection.payment_sessions.id",
      "payment_collection.payment_sessions.provider_id",
      "payment_collection.payment_sessions.status",
      "payment_collection.payment_sessions.created_at",
      "payment_collection.payment_sessions.data",
    ],
    filters: { completed_at: null, updated_at: { $gte: new Date(now.getTime() - PAID_CHECK_UNTIL_HOURS * 3600_000) } },
  })

  const client = skipCashClient()
  for (const cart of (carts ?? []) as unknown as CartRow[]) {
    const sessions = sessionsToCheck(cart.payment_collection?.payment_sessions ?? [], now)
    if (!sessions.length) continue

    let paidId: string | null = null
    for (const s of sessions) {
      if (s.status === "authorized" || s.status === "captured") {
        paidId = String(s.data?.skipcash_id ?? "")
        break
      }
      if (!client) continue
      try {
        const payment = await client.getPayment(String(s.data?.skipcash_id))
        if (payment.statusId === SkipCashStatus.PAID) {
          paidId = String(s.data?.skipcash_id)
          break
        }
      } catch (e) {
        logger.warn(`safety net: could not ask SkipCash about cart ${cart.id} — ${(e as Error).message}`)
      }
    }
    if (paidId === null) continue

    logger.warn(`safety net: cart ${cart.id} is paid (SkipCash ${paidId}) but has no booking — completing it`)
    try {
      const { result } = await completeCartWorkflow(container).run({ input: { id: cart.id } })
      logger.info(`safety net: cart ${cart.id} completed as order ${(result as { id?: string })?.id ?? "?"}`)
      continue
    } catch (e) {
      const reason = (e as Error).message || "Completing the booking failed."
      logger.error(`safety net: cart ${cart.id} could not be completed — ${reason}`)
      await alertPaidWithoutBooking(container, logger, cart, paidId, reason)
    }
  }
}

/** Once per cart: the feed row doubles as the record that it was raised. */
async function alertPaidWithoutBooking(container: MedusaContainer, logger: Logger, cart: CartRow, skipcashId: string, reason: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notification = container.resolve(Modules.NOTIFICATION)
  const { data: already } = await query.graph({
    entity: "notification",
    fields: ["id"],
    filters: { resource_id: cart.id, trigger_type: "paid_no_booking" },
  })
  if (already?.length) return

  const m = (cart.metadata ?? {}) as Record<string, unknown>
  const qar = Number(cart.payment_collection?.amount ?? 0)
  const amount = `$${Math.ceil(qar / 3.64)} (${qar.toFixed(2)} QAR)`
  const name = String(m.contact_name ?? "")
  const phone = String(m.contact_phone ?? "")
  const digits = phone.replace(/[^\d]/g, "")
  const title = `Paid but not booked: ${name || "a customer"}, ${amount}`
  const description = [
    [phone, String(m.contact_email ?? cart.email ?? "")].filter(Boolean).join(" · "),
    String(m.address ?? ""),
    "Book it by hand or refund it from the SkipCash portal.",
  ]
    .filter(Boolean)
    .join("\n")

  // Shaped like every other feed entry (lib/booking-emails.ts), but tagged
  // with the cart: there is no order to point at, which is the whole problem.
  const feed = {
    to: "",
    channel: "feed",
    template: "admin-ui",
    resource_id: cart.id,
    resource_type: "cart",
    trigger_type: "paid_no_booking",
    data: { title, description, kind: "paid_no_booking", cart_id: cart.id, skipcash_id: skipcashId, reason },
  }

  try {
    await notification.createNotifications(feed as never)
  } catch (e) {
    logger.error(`safety net: feed alert for cart ${cart.id} failed — ${(e as Error).message}`)
  }
  await sendPushToAll(container, { title, body: description, url: "/app/bookings", tag: `paid-${cart.id}` })
  try {
    await notification.createNotifications({
      to: process.env.OWNER_NOTIFY_EMAIL || "desertdrivetransportation@gmail.com",
      channel: "email",
      template: "payment-without-booking",
      trigger_type: "payment-without-booking",
      resource_id: cart.id,
      resource_type: "cart",
      data: {
        amount,
        contact_name: name,
        contact_phone: phone,
        contact_email: String(m.contact_email ?? cart.email ?? ""),
        pickup_at: String(m.pickup_at ?? ""),
        address: String(m.address ?? ""),
        vehicle_title: String(m.vehicle_title ?? ""),
        skipcash_id: skipcashId,
        cart_id: cart.id,
        reason,
        whatsapp_customer_url: digits ? `https://wa.me/${digits}` : null,
        reply_to: String(m.contact_email ?? cart.email ?? "") || undefined,
      },
    } as never)
  } catch (e) {
    logger.error(`safety net: office email for cart ${cart.id} failed — ${(e as Error).message}`)
  }
}

function skipCashClient(): SkipCashClient | null {
  const e = process.env
  if (!e.SKIPCASH_CLIENT_ID || !e.SKIPCASH_KEY_ID || !e.SKIPCASH_KEY_SECRET) return null
  return new SkipCashClient({
    base_url: e.SKIPCASH_BASE_URL || "https://skipcashtest.azurewebsites.net",
    client_id: e.SKIPCASH_CLIENT_ID,
    key_id: e.SKIPCASH_KEY_ID,
    key_secret: e.SKIPCASH_KEY_SECRET,
    webhook_key: e.SKIPCASH_WEBHOOK_KEY || "",
  })
}
