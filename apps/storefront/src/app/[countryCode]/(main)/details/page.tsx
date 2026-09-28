import { Metadata } from "next"
import { redirect } from "next/navigation"
import TripSummary from "@modules/booking/components/trip-summary"
import DetailsForm from "@modules/booking/components/details-form"
import { getQuote } from "@lib/data/quotes"
import { getAddOns } from "@lib/data/add-ons"
import { parseTrip, tripToQuery, type SearchParams, tripCoords } from "@lib/booking/trip"
import { formatUsd } from "@lib/util/money"
import { getTranslations } from "@lib/i18n/get-translations"
import { localeOf } from "@lib/util/locale"

type Props = {
  params: Promise<{ countryCode: string }>
  searchParams: Promise<SearchParams>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  return { title: `${t("details.title")} — ${t("common.brand")}`, robots: { index: false } }
}

/**
 * Step 3 of the funnel. The trip and the chosen variant arrive in the URL; the
 * variant is re-validated against a fresh quote before anything is shown, so a
 * tampered or stale variant id goes back to results rather than into a cart.
 */
export default async function DetailsPage({ params, searchParams }: Props) {
  const { countryCode } = await params
  const sp = await searchParams
  const trip = parseTrip(sp)
  const variantId = typeof sp.variant === "string" ? sp.variant : undefined
  // Carried from the results URL; every downstream re-quote needs it too.
  const testKey = typeof sp.test === "string" ? sp.test : undefined
  const carry = testKey ? { test: testKey } : undefined

  if (!trip) redirect(`/${countryCode}`)
  if (!variantId) redirect(`/${countryCode}/results?${tripToQuery(trip, carry)}`)

  // In parallel: the add-ons never depend on the quote, and the details page
  // is already the slowest step in the funnel.
  const [quote, addOns] = await Promise.all([
    getQuote({
      ...tripCoords(trip),
      passengers: trip.passengers,
      luggage: trip.luggage,
      test_key: testKey ?? null,
    }),
    getAddOns(),
  ])
  const vehicle = quote?.vehicles.find((v) => v.variant_id === variantId)
  if (!vehicle) redirect(`/${countryCode}/results?${tripToQuery(trip, carry)}`)

  const t = getTranslations(countryCode)
  const language = localeOf(countryCode)
  const title = language === "ar" && vehicle.title_ar ? vehicle.title_ar : vehicle.title

  return (
    <main className="mx-auto w-full max-w-content px-4 pb-12 pt-6">
      <TripSummary
        trip={trip}
        segment={countryCode}
        changeHref={`/results?${tripToQuery(trip, carry)}`}
      />

      <div className="mt-4 flex items-center justify-between rounded-dd border border-dd-line bg-dd-surface px-4 py-3">
        <p className="font-medium text-dd-ink">{title}</p>
        <p className="text-end">
          <span className="block text-lg font-semibold tabular-nums text-dd-accent-text">
            {formatUsd(vehicle.amount)}
          </span>
        </p>
      </div>

      <h1 className="mt-8 text-2xl font-semibold text-dd-ink small:text-3xl">{t("details.title")}</h1>

      <DetailsForm
        segment={countryCode}
        trip={trip}
        variantId={vehicle.variant_id}
        testKey={testKey}
        addOns={addOns}
        language={language}
        uploadsEnabled={Boolean(process.env.NEXT_PUBLIC_UPLOADS_PUBLIC_URL)}
      />
    </main>
  )
}
