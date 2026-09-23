/**
 * Email templates, rendered to plain HTML strings.
 *
 * No template engine: the confirmation is one email with a dozen values, and
 * a table-based layout that every mail client renders the same way is easier
 * to keep correct as a literal than through a framework. Every dynamic value
 * is HTML-escaped.
 *
 * Copy is in both languages, chosen by the order's `locale` metadata. Arabic
 * copy has NOT been reviewed by a native speaker — see CLAUDE.md. Business
 * terms (waiting time, cancellation) are deliberately absent: they come from
 * the owner, not from here.
 */

export type BookingEmailData = {
  reference: string
  locale: "en" | "ar"
  lookup_url: string
  direction: "arrival" | "departure"
  address: string
  /** Exact pickup coordinates, when the customer pinned one. */
  lat?: number | null
  lng?: number | null
  pickup_at: string
  /** ISO 8601, on a return booking. The same vehicle, the opposite direction. */
  return_at?: string | null
  flight_number: string | null
  vehicle_title: string
  passengers: number
  luggage: number
  contact_name: string
  contact_phone: string
  notes: string | null
  total: number
  currency: string
  payment: "cash" | "card"
  business: { name: string; phone: string; whatsapp_url: string; email: string; address?: string; registration?: string }
}

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!)

function formatPickup(iso: string, locale: "en" | "ar") {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const l = locale === "ar" ? "ar-QA-u-nu-latn" : "en-QA"
  const date = new Intl.DateTimeFormat(l, { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Qatar" }).format(d)
  const time = new Intl.DateTimeFormat(l, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Qatar" }).format(d)
  return `${date}, ${time}`
}

const COPY = {
  en: {
    subject: (ref: string) => `Booking confirmed — ${ref}`,
    title: "Your booking is confirmed",
    intro: "Thank you for booking with Desert Drive. Here are your trip details.",
    reference: "Booking reference",
    route: "Route",
    airportTo: (p: string) => `Hamad International Airport → ${p}`,
    toAirport: (p: string) => `${p} → Hamad International Airport`,
    pickup: "Pickup",
    returnPickup: "Return pickup",
    returnRoute: "Return",
    flight: "Flight",
    vehicle: "Vehicle",
    party: "Passengers",
    partyValue: (p: number, l: number) => `${p} passengers · ${l} bags`,
    contact: "Contact",
    notes: "Notes",
    payment: "Payment",
    cash: (amt: string) => `Pay ${amt} in cash to your driver`,
    card: (amt: string) => `${amt} paid by card`,
    view: "View your booking",
    viewHelp: "This link is personal to your booking. Keep this email.",
    help: "Need to change something? Reply to this email or message us on WhatsApp with your booking reference.",
    whatsapp: "WhatsApp",
    openMap: "See your pickup point on a map",
    arrivalNote: "Your driver will meet you in the arrivals hall holding a sign with your name.",
    transactional: "This is a booking confirmation, not a marketing email. We only email you about bookings you make.",
  },
  ar: {
    subject: (ref: string) => `تم تأكيد حجزك — ${ref}`,
    title: "تم تأكيد حجزك",
    intro: "شكرًا لحجزك مع ديزرت درايف. إليك تفاصيل رحلتك.",
    reference: "رقم الحجز",
    route: "المسار",
    airportTo: (p: string) => `مطار حمد الدولي ← ${p}`,
    toAirport: (p: string) => `${p} ← مطار حمد الدولي`,
    pickup: "الاستقبال",
    returnPickup: "استقبال العودة",
    returnRoute: "العودة",
    flight: "الرحلة",
    vehicle: "السيارة",
    party: "الركاب",
    partyValue: (p: number, l: number) => `${p} ركاب · ${l} حقائب`,
    contact: "التواصل",
    notes: "ملاحظات",
    payment: "الدفع",
    cash: (amt: string) => `ادفع ${amt} نقدًا لسائقك`,
    card: (amt: string) => `تم دفع ${amt} بالبطاقة`,
    view: "عرض حجزك",
    viewHelp: "هذا الرابط خاص بحجزك. احتفظ بهذه الرسالة.",
    help: "تريد تعديل شيء؟ رد على هذه الرسالة أو راسلنا على واتساب مع رقم الحجز.",
    whatsapp: "واتساب",
    openMap: "اعرض موقع الاستقبال على الخريطة",
    arrivalNote: "سيستقبلك سائقك في صالة الوصول حاملًا لافتة باسمك.",
    transactional: "هذه رسالة تأكيد حجز وليست رسالة تسويقية. لا نراسلك إلا بشأن حجوزاتك.",
  },
} as const

export function renderBookingConfirmation(d: BookingEmailData): { subject: string; html: string; text: string } {
  const t = COPY[d.locale]
  const rtl = d.locale === "ar"
  const amount = `${d.total} ${d.currency}`
  const route = d.direction === "departure" ? t.toAirport(d.address) : t.airportTo(d.address)

  // The return is the mirror of the outbound, so it reads with the opposite phrase.
  const returnRoute = d.direction === "departure" ? t.airportTo(d.address) : t.toAirport(d.address)

  const mapLink =
    typeof d.lat === "number" && typeof d.lng === "number"
      ? `https://www.google.com/maps?q=${d.lat},${d.lng}`
      : null

  const rows: Array<[string, string | null]> = [
    [t.route, route],
    [t.pickup, formatPickup(d.pickup_at, d.locale)],
    [t.returnRoute, d.return_at ? returnRoute : null],
    [t.returnPickup, d.return_at ? formatPickup(d.return_at, d.locale) : null],
    [t.flight, d.flight_number],
    [t.vehicle, d.vehicle_title],
    [t.party, t.partyValue(d.passengers, d.luggage)],
    [t.contact, `${d.contact_name} · ${d.contact_phone}`],
    [t.notes, d.notes],
    [t.payment, d.payment === "card" ? t.card(amount) : t.cash(amount)],
  ]

  const rowsHtml = rows
    .filter(([, v]) => !!v)
    .map(
      ([k, v]) => `
        <tr>
          <td style="padding:8px 0;color:#5a6366;font-size:14px;vertical-align:top;width:120px">${esc(k)}</td>
          <td style="padding:8px 0;color:#111518;font-size:14px">${esc(v)}</td>
        </tr>`
    )
    .join("")

  const html = `<!doctype html>
<html lang="${d.locale}" dir="${rtl ? "rtl" : "ltr"}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(t.subject(d.reference))}</title></head>
<body style="margin:0;background:#f7f7f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111518">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f7;padding:24px 12px">
    <tr><td align="center">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border-radius:12px;overflow:hidden">
        <tr><td style="background:#0b1f3a;padding:20px 24px;color:#ffffff;font-size:18px;font-weight:600">${esc(d.business.name)}</td></tr>
        <tr><td style="padding:24px">
          <h1 style="margin:0 0 8px;font-size:22px;color:#111518">${esc(t.title)}</h1>
          <p style="margin:0 0 20px;color:#5a6366;font-size:15px">${esc(t.intro)}</p>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e8f0fb;border:1px solid #0a4fb3;border-radius:10px;margin:0 0 20px">
            <tr><td style="padding:14px 16px">
              <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#0a4fb3;font-weight:600">${esc(t.reference)}</div>
              <div style="font-size:28px;font-weight:700;color:#111518;margin-top:4px">${esc(d.reference)}</div>
            </td></tr>
          </table>

          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #d9dcdd">${rowsHtml}</table>

          ${mapLink ? `<p style="margin:12px 0 0;font-size:14px"><a href="${esc(mapLink)}" style="color:#0a4fb3">${esc(t.openMap)}</a></p>` : ""}

          ${d.direction === "arrival" ? `<p style="margin:16px 0 0;color:#3a4247;font-size:14px">${esc(t.arrivalNote)}</p>` : ""}

          <table role="presentation" cellspacing="0" cellpadding="0" style="margin:24px 0 8px">
            <tr><td style="background:#0a4fb3;border-radius:8px">
              <a href="${esc(d.lookup_url)}" style="display:inline-block;padding:14px 22px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px">${esc(t.view)}</a>
            </td></tr>
          </table>
          <p style="margin:0 0 20px;color:#5a6366;font-size:12px">${esc(t.viewHelp)}</p>

          <p style="margin:0;color:#3a4247;font-size:14px">${esc(t.help)}</p>
          <p style="margin:8px 0 0;font-size:14px">
            <a href="${esc(d.business.whatsapp_url)}" style="color:#0a4fb3">${esc(t.whatsapp)}</a>
            &nbsp;·&nbsp; <a href="tel:${esc(d.business.phone)}" style="color:#0a4fb3">${esc(d.business.phone)}</a>
            &nbsp;·&nbsp; <a href="mailto:${esc(d.business.email)}" style="color:#0a4fb3">${esc(d.business.email)}</a>
          </p>
        </td></tr>
        <tr><td style="padding:16px 24px;border-top:1px solid #d9dcdd;color:#5a6366;font-size:12px;line-height:1.5">
          ${esc(d.business.name)}${d.business.registration ? ` · ${esc(d.business.registration)}` : ""}${d.business.address ? `<br>${esc(d.business.address)}` : ""}
          <br>${esc(t.transactional)}
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const text = [
    t.title,
    "",
    `${t.reference}: ${d.reference}`,
    ...rows.filter(([, v]) => !!v).map(([k, v]) => `${k}: ${v}`),
    "",
    `${t.view}: ${d.lookup_url}`,
    "",
    t.help,
    `${t.whatsapp}: ${d.business.whatsapp_url}`,
    "",
    [d.business.name, d.business.registration, d.business.address].filter(Boolean).join(" · "),
    t.transactional,
  ].join("\n")

  return { subject: t.subject(d.reference), html, text }
}

/** Dispatch by template name, so the provider stays generic. */
export function renderTemplate(template: string, data: Record<string, unknown>) {
  switch (template) {
    case "booking-confirmation":
      return renderBookingConfirmation(data as BookingEmailData)
    default:
      throw new Error(`Unknown email template "${template}"`)
  }
}
