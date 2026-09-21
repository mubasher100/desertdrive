import { NextRequest } from "next/server"
import { retrieveBooking } from "@lib/data/booking"
import { createTranslator } from "@lib/i18n/dictionary"
import { localeOf } from "@lib/util/locale"
import { CONTACT } from "@lib/data/contact"

export const dynamic = "force-dynamic"

/**
 * "Add to calendar": an iCalendar file for the pickup, gated by the same signed
 * token as the confirmation page — a booking's time and address are personal
 * data, so the calendar file is no more guessable than the page is.
 *
 * Phones open .ics files in their calendar app directly; desktop mail/calendar
 * clients import them. No third-party "add to Google Calendar" link, which
 * would hand the trip details to a query string on someone else's domain.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ countryCode: string; id: string }> }) {
  const { countryCode, id } = await ctx.params
  const token = req.nextUrl.searchParams.get("t") ?? undefined
  const order = await retrieveBooking(id, token)
  if (!order) {
    return new Response("Not found", { status: 404 })
  }

  const t = createTranslator(localeOf(countryCode))
  const m = (order.metadata ?? {}) as Record<string, unknown>
  const start = new Date(String(m.pickup_at ?? ""))
  if (Number.isNaN(start.getTime())) {
    return new Response("Not found", { status: 404 })
  }
  // A transfer has no fixed end; an hour keeps the calendar entry readable.
  const end = new Date(start.getTime() + 60 * 60 * 1000)
  const reference = `DD-${order.display_id}`
  const address = String(m.address ?? "")
  const airport = t("common.airport")
  const arrival = m.direction !== "departure"
  const route = arrival ? t("trip.airportTo", { place: address }) : t("trip.placeToAirport", { place: address })
  const summary = `${t("common.brand")}: ${route}`
  const location = arrival ? airport : address
  const description = [
    `${t("confirmed.reference")}: ${reference}`,
    m.flight_number ? `${t("confirmed.flight")}: ${m.flight_number}` : null,
    `${t("confirmed.vehicle")}: ${order.items?.[0]?.product_title ?? ""}`,
    `${t("confirmed.contact")}: ${CONTACT.phone.display}`,
    req.nextUrl.origin + `/${countryCode}/confirmed/${order.id}?t=${token}`,
  ]
    .filter(Boolean)
    .join("\\n")

  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Desert Drive//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${order.id}@desertdriverental.com`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeIcs(summary)}`,
    `LOCATION:${escapeIcs(location)}`,
    `DESCRIPTION:${escapeIcs(description)}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT2H",
    "ACTION:DISPLAY",
    `DESCRIPTION:${escapeIcs(reference)}`,
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n")

  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": `attachment; filename="${reference}.ics"`,
      "cache-control": "private, no-store",
    },
  })
}

/** UTC timestamp in iCalendar basic format. */
function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z")
}

/** RFC 5545 text escaping; the literal "\n" sequences in description are already escaped. */
function escapeIcs(s: string): string {
  return s.replace(/\\(?!n)/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n")
}
