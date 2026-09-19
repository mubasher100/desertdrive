import Image from "next/image"
import { listFleet, type FleetVehicle } from "@lib/data/fleet"
import { getTranslations } from "@lib/i18n/get-translations"
import { localeOf } from "@lib/util/locale"

/**
 * The three vehicle classes with their "from" price. Reads the live catalogue,
 * so a fare change in the admin shows here within the cache window without a
 * deploy — which is the entire point of prices living on variants.
 */
export default async function Fleet({ segment }: { segment: string }) {
  const t = getTranslations(segment)
  const language = localeOf(segment)
  const vehicles = await listFleet(segment)

  if (!vehicles.length) {
    return null
  }

  return (
    <section className="mx-auto w-full max-w-content px-4 py-12 small:py-16">
      <h2 className="text-2xl font-semibold text-dd-ink small:text-3xl">
        {t("home.fleet.title")}
      </h2>
      <p className="mt-2 max-w-prose text-dd-muted">{t("home.fleet.subtitle")}</p>

      <ul className="mt-8 grid gap-6 small:grid-cols-3">
        {vehicles.map((v) => (
          <VehicleCard key={v.id} vehicle={v} language={language} t={t} />
        ))}
      </ul>
    </section>
  )
}

function VehicleCard({
  vehicle,
  language,
  t,
}: {
  vehicle: FleetVehicle
  language: "en" | "ar"
  t: ReturnType<typeof getTranslations>
}) {
  const title =
    language === "ar" && vehicle.title_ar ? vehicle.title_ar : vehicle.title
  const description =
    language === "ar" && vehicle.description_ar
      ? vehicle.description_ar
      : vehicle.description

  return (
    <li className="overflow-hidden rounded-dd-lg border border-dd-line bg-dd-surface shadow-card">
      {/*
        3:2 frame. Until real photography lands this is a neutral placeholder of
        the exact size, so swapping the image in later moves nothing.
      */}
      <div className="relative aspect-[3/2] w-full bg-dd-paper">
        {vehicle.thumbnail ? (
          <Image
            src={vehicle.thumbnail}
            alt=""
            fill
            sizes="(min-width: 1024px) 380px, 100vw"
            className="object-cover"
          />
        ) : (
          <div
            aria-hidden="true"
            className="flex h-full w-full items-center justify-center text-dd-grey"
          >
            <CarGlyph />
          </div>
        )}
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <h3 className="text-lg font-semibold text-dd-ink">{title}</h3>
          {vehicle.from_amount !== null && (
            <p className="shrink-0 text-end">
              <span className="block text-xs text-dd-muted">
                {t("home.fleet.fromLabel")}
              </span>
              <span className="block text-lg font-semibold tabular-nums text-dd-accent-text">
                {vehicle.from_amount}{" "}
                <span className="text-sm font-medium text-dd-muted">
                  {t("common.currency")}
                </span>
              </span>
            </p>
          )}
        </div>

        {description && (
          <p className="mt-2 text-sm text-dd-muted">{description}</p>
        )}

        <dl className="mt-4 flex gap-x-5 text-sm text-dd-ink-soft">
          <div className="flex items-center gap-x-1.5">
            <dt className="sr-only">{t("search.passengers.label")}</dt>
            <PeopleGlyph />
            <dd>{t("home.fleet.passengers", { count: vehicle.passengers })}</dd>
          </div>
          <div className="flex items-center gap-x-1.5">
            <dt className="sr-only">{t("search.luggage.label")}</dt>
            <BagGlyph />
            <dd>{t("home.fleet.luggage", { count: vehicle.luggage })}</dd>
          </div>
        </dl>
      </div>
    </li>
  )
}

const glyph = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
}

function CarGlyph() {
  return (
    <svg {...glyph} className="h-16 w-16 opacity-40">
      <path d="M3 13l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 8l2 5v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z" />
      <circle cx="7.5" cy="14.5" r="1" />
      <circle cx="16.5" cy="14.5" r="1" />
    </svg>
  )
}
function PeopleGlyph() {
  return (
    <svg {...glyph} className="h-4 w-4 text-dd-grey">
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0" />
      <path d="M16 11a3 3 0 1 0 0-6" />
      <path d="M21 20a6 6 0 0 0-4-5.7" />
    </svg>
  )
}
function BagGlyph() {
  return (
    <svg {...glyph} className="h-4 w-4 text-dd-grey">
      <rect x="5" y="8" width="14" height="12" rx="2" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  )
}
