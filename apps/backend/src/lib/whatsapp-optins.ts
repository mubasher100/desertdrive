/**
 * Customers who ticked "Send me offers on WhatsApp" on the details step
 * (owner, 2 Nov 2026), as the owner downloads them from the admin.
 *
 * Pure, so it is unit-tested; the route only fetches orders and hands them in.
 */

export type OptIn = {
  name: string
  phone: string
  email: string
  reference: string
  opted_in_at: string
}

type OrderLike = {
  display_id?: number | null
  created_at?: string | Date | null
  metadata?: Record<string, unknown> | null
}

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "")

/**
 * One row per phone number, the most recent opt-in winning: a repeat customer
 * is one person to message, not three. Strictly `=== true` — a missing or
 * malformed value is never consent.
 */
export function optInsFromOrders(orders: OrderLike[]): OptIn[] {
  const byPhone = new Map<string, OptIn>()

  for (const o of orders) {
    const m = o.metadata ?? {}
    if (m.whatsapp_offers !== true) continue
    const phone = str(m.contact_phone)
    if (!phone) continue

    const at = str(m.whatsapp_offers_at) || (o.created_at ? new Date(o.created_at).toISOString() : "")
    const row: OptIn = {
      name: str(m.contact_name),
      phone,
      email: str(m.contact_email),
      reference: o.display_id != null ? `DD-${o.display_id}` : "",
      opted_in_at: at,
    }
    const seen = byPhone.get(phone)
    if (!seen || row.opted_in_at > seen.opted_in_at) byPhone.set(phone, row)
  }

  return [...byPhone.values()].sort((a, b) => b.opted_in_at.localeCompare(a.opted_in_at))
}

/**
 * A cell a spreadsheet will not execute. Names are typed by customers, and a
 * cell starting with = + - or @ is a formula in Excel and Sheets — so it is
 * prefixed with an apostrophe, which they display as plain text. Phone numbers
 * start with "+" and take the same treatment; they still read as the number.
 */
function cell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function optInsCsv(rows: OptIn[]): string {
  const header = ["Name", "WhatsApp number", "Email", "Booking", "Opted in (UTC)"]
  const lines = rows.map((r) => [r.name, r.phone, r.email, r.reference, r.opted_in_at].map(cell).join(","))
  // BOM so Excel opens Arabic names as UTF-8 rather than mojibake.
  return "\uFEFF" + [header.join(","), ...lines].join("\r\n") + "\r\n"
}
