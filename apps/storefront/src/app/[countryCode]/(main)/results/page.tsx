import { Metadata } from "next"
import { redirect } from "next/navigation"
import TripSummary from "@modules/booking/components/trip-summary"
import VehiclePicker from "@modules/booking/components/vehicle-picker"
import { getQuote } from "@lib/data/quotes"
import { parseTrip, tripToQuery, type SearchParams } from "@lib/booking/trip"
import { getTranslations } from "@lib/i18n/get-translations"
import { localeOf } from "@lib/util/locale"
import { CONTACT, whatsappLink } from "@lib/data/contact"

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<SearchParams>
}

/**
 * Never prerendered, never cached. Without this, the locale layout's
 * generateStaticParams makes Next emit a static /en-qa/results shell at build
 * time, and the funnel must not cache at all — a quote is one person's trip.
 */
export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  // Results are per-trip and hold no evergreen content. Not for the index.
  return { title: `${t("results.title")} — ${t("common.brand")}`, robots: { index: false } }
}

/**
 * Step 2 of the funnel: the fixed price per vehicle class.
 *
 * Dynamic by nature (it reads the query string) and NEVER cached — the quote
 * is one person's coordinates and party size. The trip comes from the URL;
 * anything malformed goes back to the search widget rather than rendering a
 * half-trip.
 */
export default async function ResultsPage({ params, searchParams }: Props) {
  const { countryCode } = await params
  const trip = parseTrip(await searchParams)

  if (!trip) {
    redirect(`/${countryCode}`)
  }

  const t = getTranslations(countryCode)
  const language = localeOf(countryCode)

  const quote = await getQuote({
    lat: trip.area.lat,
    lng: trip.area.lng,
    passengers: trip.passengers,
    luggage: trip.luggage,
  })

  const bandName = quote
    ? language === "ar"
      ? quote.band.name_ar
      : quote.band.name_en
    : null

  return (
    <main className="mx-auto w-full max-w-content px-4 pb-8 pt-6">
      <TripSummary trip={trip} segment={countryCode} />

      <h1 className="mt-8 text-2xl font-semibold text-dd-ink small:text-3xl">
        {t("results.title")}
      </h1>

      {quote?.quotable ? (
        <>
          <p className="mt-2 text-dd-muted">
            {bandName && <span className="text-dd-ink-soft">{bandName} · </span>}
            {t("results.fixedPrice")}
          </p>

          <div className="mt-6">
            <VehiclePicker
              vehicles={quote.vehicles}
              nextHref={`/details?${tripToQuery(trip)}`}
            />
          </div>
        </>
      ) : (
        <NotQuotable
          t={t}
          reason={quote ? "unpriced" : "error"}
          tooMany={trip.passengers > 7}
          passengers={trip.passengers}
        />
      )}
    </main>
  )
}

/**
 * The honest empty state. Either the owner has not published a fare for this
 * band yet (the expected state for bands B–D until prices arrive), the party
 * is too big for one car, or the backend could not be reached. In every case
 * the customer gets a human to contact — never an invented number.
 */
function NotQuotable({
  t,
  reason,
  tooMany,
  passengers,
}: {
  t: ReturnType<typeof getTranslations>
  reason: "unpriced" | "error"
  tooMany: boolean
  passengers: number
}) {
  return (
    <div className="mt-6 rounded-dd-lg border border-dd-line bg-dd-paper p-6">
      <h2 className="text-lg font-semibold text-dd-ink">
        {tooMany ? t("results.tooManyPassengers", { count: passengers }) : t("results.empty.title")}
      </h2>
      {!tooMany && (
        <p className="mt-2 text-dd-muted">
          {reason === "error" ? t("results.error.body") : t("results.empty.body")}
        </p>
      )}
      <div className="mt-5 flex flex-col gap-3 small:flex-row">
        <a
          href={whatsappLink()}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-[52px] items-center justify-center rounded-dd bg-dd-accent px-6 font-semibold text-dd-ink hover:bg-dd-accent-strong"
        >
          {t("confirmed.whatsapp")}
        </a>
        <a
          href={`tel:${CONTACT.phone.e164}`}
          className="inline-flex min-h-[52px] items-center justify-center rounded-dd border border-dd-line-strong bg-dd-surface px-6 font-semibold text-dd-ink hover:bg-dd-paper"
        >
          {t("nav.call")} · {CONTACT.phone.display}
        </a>
      </div>
    </div>
  )
}
