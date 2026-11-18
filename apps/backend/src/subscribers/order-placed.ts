import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { sendBookingEmails } from "../lib/booking-emails"

/**
 * The moment an order exists: the customer's confirmation, the office's
 * alert, and a "New booking" entry in the admin's feed. The work lives in
 * lib/booking-emails.ts, shared with "Resend emails" on a booking in the
 * admin. Nothing here can fail the order.
 */
export default async function orderPlacedHandler({ event: { data }, container }: SubscriberArgs<{ id: string }>) {
  await sendBookingEmails(container, data.id, { announce: true })
}

export const config: SubscriberConfig = {
  event: "order.placed",
}
