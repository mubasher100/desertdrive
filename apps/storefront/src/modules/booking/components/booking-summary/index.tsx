import { findArea, areaName } from "@lib/data/areas"
import { getTranslations } from "@lib/i18n/get-translations"
import { localeOf, type Language } from "@lib/util/locale"
import { formatQar, formatUsd } from "@lib/util/money"

/**
 * The booking as a definition list, from the metadata contract. Used on the
 * payment page and the confirmation page, so both read the same keys the same
 * way — if a key name changes, it changes here once.
 */
export default function BookingSummary({
  segment,
  metadata,
  vehicleTitle,
  total,
  paymentStatus,
}: {
  segment: string
  metadata: Record<string, unknown>
  vehicleTitle: string
  total: number
  /** Present on the confirmation page only. */
  paymentStatus?: "cash" | "card"
}) {
  const t = getTranslations(segment)
  const language = localeOf(segment)
  const m = metadata as Partial<BookingMetadata>

  const area = findArea(m.area_id)
  const place = area ? areaName(area, language) : (m.address ?? "")
  const route =
    m.direction === "departure" ? t("trip.placeToAirport", { place }) : t("trip.airportTo", { place })
  // The return runs the other way: same car, same address, opposite direction.
  const returnRoute =
    m.direction === "departure" ? t("trip.airportTo", { place }) : t("trip.placeToAirport", { place })

  // The line item only carries the English title; the Arabic one rides on
  // metadata so the summary reads in the visitor's language.
  const vehicle = (language === "ar" && m.vehicle_title_ar) || vehicleTitle

  const rows: Array<[string, string | undefined]> = [
    [t("trip.route"), route],
    [t("confirmed.pickup"), m.pickup_at ? formatPickupIso(m.pickup_at, language) : undefined],
    [t("confirmed.return"), m.return_at ? `${returnRoute} · ${formatPickupIso(m.return_at, language)}` : undefined],
    [t("confirmed.flight"), m.flight_number ?? undefined],
    [t("confirmed.vehicle"), vehicle],
    [
      t("confirmed.passengers"),
      m.passengers !== undefined
        ? `${t("results.passengersShort", { count: m.passengers })} · ${t("results.luggageShort", { count: m.luggage ?? 0 })}`
        : undefined,
    ],
    [t("confirmed.contact"), [m.contact_name, m.contact_phone, m.contact_email].filter(Boolean).join(" · ")],
    [
      t("addons.summary"),
      // "2 x Child seat · Meet & greet sign" — the quantity first, because
      // that is the part the driver has to act on.
      Array.isArray(m.add_ons) && m.add_ons.length
        ? m.add_ons
            .map((a) => {
              const name = (language === "ar" && a.title_ar) || a.title
              return a.quantity > 1 ? `${a.quantity} × ${name}` : name
            })
            .join(" · ")
        : undefined,
    ],
    [t("confirmed.notes"), m.notes ?? undefined],
    [
      t("confirmed.payment"),
      paymentStatus === "card"
        ? t("confirmed.payment.card")
        : paymentStatus === "cash"
          ? t("confirmed.payment.cash", { amount: formatUsd(total) })
          : undefined,
    ],
  ]

  return (
    <div className="rounded-dd-lg border border-dd-line bg-dd-paper p-5">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-dd-muted">{t("payment.summary")}</h2>
      <dl className="mt-3 divide-y divide-dd-line">
        {rows
          .filter(([, v]) => !!v)
          .map(([k, v]) => (
            <div key={k} className="grid grid-cols-[110px_1fr] gap-x-3 py-2 text-sm">
              <dt className="text-dd-muted">{k}</dt>
              <dd className="text-dd-ink">{v}</dd>
            </div>
          ))}
        <div className="grid grid-cols-[110px_1fr] gap-x-3 pt-3 text-base">
          <dt className="font-semibold text-dd-ink">{t("payment.total")}</dt>
          <dd className="font-semibold tabular-nums text-dd-ink">
            {formatUsd(total)}
            <span className="ms-2 text-xs font-medium tabular-nums text-dd-muted">
              {t("money.approx", { qar: formatQar(total, t("common.currency")) })}
            </span>
          </dd>
        </div>
      </dl>
    </div>
  )
}

/** The metadata contract from CLAUDE.md. */
export type BookingMetadata = {
  direction: "arrival" | "departure"
  pickup_at: string
  return_at: string | null
  flight_number: string | null
  passengers: number
  luggage: number
  area_id: string
  address: string
  lat: number
  lng: number
  band_code: string
  distance_km: number
  contact_name: string
  contact_phone: string
  contact_email: string
  notes: string | null
  vehicle_title: string
  vehicle_title_ar: string | null
  /**
   * The extras, as chosen. Written by createBookingCart alongside the real
   * line items, so the summary, the email and the job sheet can all read them
   * from one place instead of reconstructing them from the order's lines.
   *
   * Optional on purpose: every booking taken before add-ons existed has no
   * such key, and must still render.
   */
  add_ons: Array<{
    handle: string
    title: string
    title_ar: string | null
    quantity: number
    amount: number
  }> | null
  locale: string
}

function formatPickupIso(iso: string, language: Language): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const locale = language === "ar" ? "ar-QA-u-nu-latn" : "en-QA"
  const date = new Intl.DateTimeFormat(locale, { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Qatar" }).format(d)
  const time = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Qatar" }).format(d)
  return `${date}, ${time}`
}
