import type { Logger, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MathBN, Modules } from "@medusajs/framework/utils"
import { bookingLookupUrl } from "./booking-token"
import { emailFailureReason } from "./email-failure"
import { sendPushToAll } from "./push"

/** What happened to one email. `null` when there was nobody to send it to. */
export type EmailOutcome = { to: string; ok: true } | { to: string; ok: false; reason: string } | null

export type BookingEmailsResult = { reference: string; customer: EmailOutcome; office: EmailOutcome }

/**
 * The booking's two emails — the customer's confirmation and the office's
 * alert — plus the admin feed entries that go with them.
 *
 * Called by order.placed (subscribers/order-placed.ts) the moment an order
 * exists, and by "Resend emails" on a booking in the admin. Everything in the
 * emails comes from the order's metadata contract (CLAUDE.md, "Booking
 * details ride on metadata").
 *
 * The two emails are sent independently: one failing never stops the other.
 * A failure never touches the order either. It is recorded (the notification
 * row is marked failed, and the feed says why) and the booking stands.
 * Every email is tagged with its order, which is how the booking page shows
 * whether its emails went out.
 */
export async function sendBookingEmails(
  container: MedusaContainer,
  orderId: string,
  opts: {
    announce: boolean
    /** Send only these (the safety net's retries). Default: both. */
    only?: Array<"customer" | "office">
    /**
     * A retry. Its failure is not reported again, unless it was the last
     * try, so a long Resend outage is one alert and not one every five
     * minutes. The booking page shows each email's state either way.
     */
    retry?: { lastTry: Array<"customer" | "office"> }
  }
): Promise<BookingEmailsResult | null> {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notification = container.resolve(Modules.NOTIFICATION)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "total", "currency_code", "metadata", "summary", "items.title", "items.product_title", "payment_collections.status", "payment_collections.payments.captured_at"],
    filters: { id: orderId },
  })
  const order = orders?.[0] as (typeof orders)[number] & {
    payment_collections?: Array<{ status?: string; payments?: Array<{ captured_at?: string | null }> }>
  }
  if (!order) {
    logger.warn(`booking emails: order ${orderId} not found, nothing sent`)
    return null
  }

  const m = (order.metadata ?? {}) as Record<string, unknown>
  const to = String(m.contact_email ?? order.email ?? "")

  const locale = String(m.locale ?? "en-qa")
  const language = locale.startsWith("ar") ? "ar" : "en"
  const vehicle =
    language === "ar" && m.vehicle_title_ar
      ? String(m.vehicle_title_ar)
      : String(m.vehicle_title ?? order.items?.[0]?.product_title ?? order.items?.[0]?.title ?? "")

  const customerData = {
      reference: `DD-${order.display_id}`,
      locale: language,
      lookup_url: bookingLookupUrl(order.id, locale),
      direction: m.direction ?? "arrival",
      address: m.address ?? "",
      pickup_at: m.pickup_at ?? "",
      return_at: m.return_at ?? null,
      lat: typeof m.lat === "number" ? m.lat : null,
      lng: typeof m.lng === "number" ? m.lng : null,
      flight_number: m.flight_number ?? null,
      vehicle_title: vehicle,
      passengers: Number(m.passengers ?? 0),
      luggage: Number(m.luggage ?? 0),
      contact_name: m.contact_name ?? "",
      contact_phone: m.contact_phone ?? "",
      notes: m.notes ?? null,
      short_notice: m.short_notice === true,
      /**
       * The extras, as the storefront recorded them. Narrowed defensively:
       * this is JSON off a database column, and an order written by an older
       * release has no such key at all.
       */
      add_ons: Array.isArray(m.add_ons)
        ? (m.add_ons as Array<Record<string, unknown>>)
            .filter((a) => a && typeof a.title === "string" && Number(a.quantity) > 0)
            .map((a) => ({
              title: String(a.title),
              title_ar: typeof a.title_ar === "string" ? a.title_ar : null,
              quantity: Number(a.quantity),
              note: typeof a.note === "string" && a.note.trim() ? a.note : null,
            }))
        : null,
      // query.graph does not populate order.total; the computed figure lives on
      // summary.current_order_total (and is a BigNumber-compatible value).
      total: MathBN.convert(
        ((order as { summary?: { current_order_total?: number | string } }).summary?.current_order_total ?? 0) as number | string
      ).toNumber(),
      currency: String(order.currency_code ?? "qar").toUpperCase(),
      // A captured payment means the card was charged. Anything else is still
      // being confirmed — never "pay in cash", which no longer exists.
      payment: order.payment_collections?.some((pc) => pc?.payments?.some((p) => !!p?.captured_at)) ? "card" : "pending",
      business: {
        name: process.env.BUSINESS_NAME || "Desert Drive Rent a Car",
        phone: process.env.BUSINESS_PHONE || "",
        whatsapp_url: process.env.BUSINESS_WHATSAPP_URL || "",
        // The address the customer is told to write to — not the sending
        // address, which is bookings@ and only ever sends.
        email: process.env.BUSINESS_EMAIL || "info@desertdriverental.com",
        // Trader identity on the confirmation — required by Qatar's E-Commerce
        // Law (No. 16 of 2010). Empty values render nothing rather than a fake.
        address: process.env.BUSINESS_ADDRESS || "",
        registration: process.env.BUSINESS_CR || "",
      },
    }

  /**
   * Two emails, sent independently: a failure sending one must never stop the
   * other. The customer's confirmation, and the office's copy.
   */
  const reference = `DD-${order.display_id}`
  const tag = { resource_id: order.id, resource_type: "order" }

  const wants = (which: "customer" | "office") => !opts.only || opts.only.includes(which)

  let customer: EmailOutcome = null
  if (to && wants("customer")) {
    customer = await send(notification, logger, reference, "customer confirmation", {
      to,
      channel: "email",
      template: "booking-confirmation",
      // The office keeps a copy of exactly what the customer was sent
      // (owner, 18 Nov 2026). Blind, in the same send: it arrives with the
      // customer's, and a retry carries it again with the retry.
      data: { ...customerData, bcc: confirmationCopyTo() },
      trigger_type: "booking-confirmation",
      ...tag,
    })
  } else if (!to) {
    logger.warn(`booking emails: ${reference} has no email address, no customer confirmation sent`)
  }

  /**
   * The office's copy — to info@ unless OWNER_NOTIFY_EMAIL says otherwise —
   * with a button that opens the booking in the admin, where the owner
   * confirms it. Reply-to is the customer, so answering the email answers
   * them. Always English: the office reads it, not the customer.
   */
  const ownerTo = process.env.OWNER_NOTIFY_EMAIL || "desertdrivetransportation@gmail.com"
  const adminBase = (process.env.MEDUSA_BACKEND_URL || "https://ddbackend-production-e9d1.up.railway.app").replace(/\/$/, "")
  const phoneDigits = String(m.contact_phone ?? "").replace(/[^\d]/g, "")
  const office = !wants("office") ? null : await send(notification, logger, reference, "office alert", {
    to: ownerTo,
    channel: "email",
    template: "booking-owner-alert",
    trigger_type: "booking-owner-alert",
    ...tag,
    data: {
      reference: customerData.reference,
      admin_url: `${adminBase}/app/bookings/${order.id}`,
      direction: customerData.direction,
      address: customerData.address,
      lat: customerData.lat,
      lng: customerData.lng,
      pickup_at: customerData.pickup_at,
      return_at: customerData.return_at,
      flight_number: customerData.flight_number,
      // English for the office, whatever language the customer booked in.
      vehicle_title: String(m.vehicle_title ?? order.items?.[0]?.product_title ?? order.items?.[0]?.title ?? ""),
      passengers: customerData.passengers,
      luggage: customerData.luggage,
      contact_name: customerData.contact_name,
      contact_phone: customerData.contact_phone,
      contact_email: to,
      notes: customerData.notes,
      // The sign picture is a link only when it is one of OUR uploads —
      // https, the storefront already refused anything else.
      add_ons: Array.isArray(m.add_ons)
        ? (m.add_ons as Array<Record<string, unknown>>)
            .filter((a) => a && typeof a.title === "string" && Number(a.quantity) > 0)
            .map((a) => ({
              title: String(a.title),
              quantity: Number(a.quantity),
              note: typeof a.note === "string" && a.note.trim() ? a.note : null,
              image_url: typeof a.image_url === "string" && a.image_url.startsWith("https://") ? a.image_url : null,
            }))
        : null,
      total: customerData.total,
      currency: customerData.currency,
      paid: customerData.payment === "card",
      whatsapp_customer_url: phoneDigits
        ? `https://wa.me/${phoneDigits}?text=${encodeURIComponent(`Hello ${customerData.contact_name}, this is Desert Drive about your booking ${customerData.reference}.`)}`
        : null,
      reply_to: to || undefined,
    },
  })

  /**
   * The admin's feed. A new booking is announced there whatever happens to
   * email, and a failed email says so with its reason, so the owner learns
   * about a booking from the dashboard even on a day email is broken.
   */
  const feed: Array<Record<string, unknown>> = []
  if (opts.announce) {
    const route =
      customerData.direction === "departure"
        ? `${customerData.address} → Hamad International`
        : `Hamad International → ${customerData.address}`
    const line1 = [formatPickup(String(customerData.pickup_at ?? "")), String(customerData.vehicle_title ?? "")].filter(Boolean).join(" · ")
    feed.push(
      feedEntry(order.id, "new_booking", `New booking ${reference}`, [line1, route, String(customerData.contact_name ?? "")].filter(Boolean).join("\n"))
    )
  }
  const outcomes: Array<[string, "customer" | "office", EmailOutcome]> = [
    ["Customer confirmation", "customer", customer],
    ["Office email", "office", office],
  ]
  for (const [label, which, outcome] of outcomes) {
    if (outcome && !outcome.ok) {
      if (opts.retry && !opts.retry.lastTry.includes(which)) continue
      const title = opts.retry
        ? `${label} for ${reference} did not send, after every retry`
        : `${label} for ${reference} did not send`
      const next = opts.retry
        ? " It will not be tried again by itself: use Resend emails on the booking, or contact them on WhatsApp."
        : " It will be tried again automatically."
      feed.push(
        feedEntry(order.id, "email_failed", title, `To ${outcome.to}. ${outcome.reason}${next}`, {
          reason: outcome.reason,
          email: which,
        })
      )
    }
  }
  if (feed.length) {
    try {
      await notification.createNotifications(feed as never)
    } catch (e) {
      logger.error(`booking emails: admin feed for ${reference} failed — ${(e as Error).message}`)
    }
  }

  // The same alerts as push notifications, to the owner's phone even when
  // the admin is closed (lib/push.ts). Never throws.
  for (const entry of feed as Array<ReturnType<typeof feedEntry>>) {
    await sendPushToAll(container, {
      title: entry.data.title,
      body: entry.data.description,
      url: `/app/bookings/${order.id}`,
      // Distinct per alert, so the customer's and the office's failures do
      // not replace each other on the phone.
      tag: [entry.data.kind, (entry.data as { email?: string }).email, order.id].filter(Boolean).join("-"),
    })
  }

  return { reference, customer, office }
}

type NotificationService = { createNotifications: (data: never) => Promise<unknown> }

async function send(
  notification: NotificationService,
  logger: Logger,
  reference: string,
  label: string,
  input: Record<string, unknown> & { to: string }
): Promise<EmailOutcome> {
  try {
    await notification.createNotifications(input as never)
    logger.info(`booking emails: ${label} for ${reference} sent → ${input.to}`)
    return { to: input.to, ok: true }
  } catch (e) {
    const reason = emailFailureReason(e)
    logger.error(`booking emails: ${label} for ${reference} failed — ${reason}`)
    return { to: input.to, ok: false, reason }
  }
}

/**
 * One entry in the admin's feed. `to: ""` is what Medusa's own bell reads as
 * "for every admin user"; the Bookings page reads the same rows.
 */
export function feedEntry(
  orderId: string,
  kind: "new_booking" | "email_failed",
  title: string,
  description: string,
  extra: Record<string, unknown> = {}
) {
  return {
    to: "",
    channel: "feed",
    template: "admin-ui",
    resource_id: orderId,
    resource_type: "order",
    trigger_type: kind,
    data: { title, description, kind, order_id: orderId, ...extra },
  }
}

/** "Tue 17 Nov, 23:45" in Qatar time, for a feed line. */
export function formatPickup(iso: string): string {
  const d = new Date(iso)
  if (!iso || Number.isNaN(d.getTime())) return ""
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Qatar",
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(d)
}

/**
 * Who gets a blind copy of every customer confirmation. CONFIRMATION_COPY_TO
 * overrides it; set it to "none" to stop the copies.
 */
export function confirmationCopyTo(env: Record<string, string | undefined> = process.env): string | undefined {
  const v = (env.CONFIRMATION_COPY_TO ?? "info@desertdriverental.com").trim()
  return v && v.toLowerCase() !== "none" ? v : undefined
}
