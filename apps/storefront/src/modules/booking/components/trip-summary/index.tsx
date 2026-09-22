import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { formatPickup, formatReturn, type Trip } from "@lib/booking/trip"
import { destinationName } from "@lib/booking/destination"
import { getTranslations } from "@lib/i18n/get-translations"
import { localeOf } from "@lib/util/locale"

/**
 * One-line recap of the trip at the top of results and details, with a way
 * back to change it. The airport end is implied by the direction; only the
 * non-airport end is named.
 */
export default function TripSummary({
  trip,
  segment,
  changeHref = "/",
}: {
  trip: Trip
  segment: string
  changeHref?: string
}) {
  const t = getTranslations(segment)
  const language = localeOf(segment)
  const place = destinationName(trip.destination, language)

  const route =
    trip.direction === "arrival"
      ? t("trip.airportTo", { place })
      : t("trip.placeToAirport", { place })

  // The return is the mirror image, so it is described by the opposite phrase.
  const back = formatReturn(trip, language)
  const returnRoute =
    trip.direction === "arrival"
      ? t("trip.placeToAirport", { place })
      : t("trip.airportTo", { place })

  return (
    <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 rounded-dd border border-dd-line bg-dd-paper px-4 py-3 text-sm">
      <dl className="flex flex-wrap gap-x-6 gap-y-1">
        <div>
          <dt className="sr-only">{t("trip.route")}</dt>
          <dd className="font-medium text-dd-ink">{route}</dd>
        </div>
        <div>
          <dt className="sr-only">{t("trip.when")}</dt>
          <dd className="text-dd-ink-soft">{formatPickup(trip, language)}</dd>
        </div>
        {back && (
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-dd-muted">{t("trip.return")}</dt>
            <dd className="text-dd-ink-soft">
              {returnRoute} · {back}
            </dd>
          </div>
        )}
        <div>
          <dt className="sr-only">{t("trip.party")}</dt>
          <dd className="text-dd-ink-soft">
            {t("results.passengersShort", { count: trip.passengers })} ·{" "}
            {t("results.luggageShort", { count: trip.luggage })}
          </dd>
        </div>
      </dl>
      <LocalizedClientLink
        href={changeHref}
        className="inline-flex min-h-touch items-center font-medium text-dd-ink underline underline-offset-4"
      >
        {t("trip.change")}
      </LocalizedClientLink>
    </div>
  )
}
