import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, MathBN, Modules } from "@medusajs/framework/utils"
import { bookingLookupUrl } from "../lib/booking-token"

/**
 * Sends the booking confirmation the moment an order exists — for both the
 * cash and the card path, since both confirm instantly.
 *
 * Everything in the email comes from the order's metadata contract (see
 * CLAUDE.md, "Booking details ride on metadata"). If the notification module
 * has no email provider configured (SMTP_* unset), Medusa's notification
 * service throws, which is logged and does not affect the order.
 */
export default async function orderPlacedHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const notification = container.resolve(Modules.NOTIFICATION)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "email", "total", "currency_code", "metadata", "summary", "items.title", "items.product_title", "payment_collections.status", "payment_collections.payments.captured_at"],
    filters: { id: data.id },
  })
  const order = orders?.[0] as (typeof orders)[number] & {
    payment_collections?: Array<{ status?: string; payments?: Array<{ captured_at?: string | null }> }>
  }
  if (!order) {
    logger.warn(`order.placed: order ${data.id} not found, no confirmation sent`)
    return
  }

  const m = (order.metadata ?? {}) as Record<string, unknown>
  const to = String(m.contact_email ?? order.email ?? "")
  if (!to) {
    logger.warn(`order.placed: order ${order.id} has no email address, no confirmation sent`)
    return
  }

  const locale = String(m.locale ?? "en-qa")
  const language = locale.startsWith("ar") ? "ar" : "en"
  const vehicle =
    language === "ar" && m.vehicle_title_ar
      ? String(m.vehicle_title_ar)
      : String(m.vehicle_title ?? order.items?.[0]?.product_title ?? order.items?.[0]?.title ?? "")

  await notification.createNotifications({
    to,
    channel: "email",
    template: "booking-confirmation",
    data: {
      reference: `DD-${order.display_id}`,
      locale: language,
      lookup_url: bookingLookupUrl(order.id, locale),
      direction: m.direction ?? "arrival",
      address: m.address ?? "",
      pickup_at: m.pickup_at ?? "",
      flight_number: m.flight_number ?? null,
      vehicle_title: vehicle,
      passengers: Number(m.passengers ?? 0),
      luggage: Number(m.luggage ?? 0),
      contact_name: m.contact_name ?? "",
      contact_phone: m.contact_phone ?? "",
      notes: m.notes ?? null,
      // query.graph does not populate order.total; the computed figure lives on
      // summary.current_order_total (and is a BigNumber-compatible value).
      total: MathBN.convert(
        ((order as { summary?: { current_order_total?: number | string } }).summary?.current_order_total ?? 0) as number | string
      ).toNumber(),
      currency: String(order.currency_code ?? "qar").toUpperCase(),
      // A captured payment means the card was charged; the cash path only
      // authorises, and is captured later in the admin when the driver is paid.
      payment: order.payment_collections?.some((pc) => pc?.payments?.some((p) => !!p?.captured_at)) ? "card" : "cash",
      business: {
        name: process.env.BUSINESS_NAME || "Desert Drive Rent a Car",
        phone: process.env.BUSINESS_PHONE || "",
        whatsapp_url: process.env.BUSINESS_WHATSAPP_URL || "",
        email: process.env.RESEND_FROM_EMAIL || process.env.SMTP_FROM_ADDRESS || "",
      },
    },
  })

  logger.info(`order.placed: confirmation queued for DD-${order.display_id} → ${to}`)
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
