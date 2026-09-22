"use client"

import { useParams, useRouter } from "next/navigation"
import { useId, useMemo, useState, type FormEvent } from "react"
import LocationPicker from "@modules/booking/components/location-picker"
import { checkLeadTime, earliestPickupFields, leadTimeLabel, qatarToday } from "@lib/booking/lead-time"
import { useLanguage, useTranslations } from "@lib/i18n/use-translations"
import { clx } from "@medusajs/ui"

export type Direction = "arrival" | "departure"

/**
 * The search widget. Everything the customer tells us before seeing a price.
 *
 * Design rules that are not negotiable here:
 *
 *  - Completable one-thumbed on a 375px phone. Fields stack; every control is
 *    at least 44px tall; the submit is full width and last.
 *  - Native <input type="date"> and <input type="time">. On a phone these open
 *    the OS picker, which is faster and more accessible than anything we could
 *    build, and they need no JavaScript to work.
 *  - The destination is a type-to-search combobox over a curated list of Qatar
 *    areas: type the name, or open it and browse. This is the fallback path
 *    for Google Places and it is a first-class one — the funnel must work when
 *    Maps fails to load. Places layers on top of this later; it never replaces
 *    it.
 *  - A pickup must be at least the lead time away. The native pickers are
 *    bounded by `min` so the customer is guided before they are rejected, and
 *    the rule is re-checked on submit because `min` on a time input only
 *    applies within a single day.
 *
 * Nothing here touches price. The widget forwards the customer's choices to
 * the results page as URL parameters; the server resolves the fare from them.
 * Passing the AREA ID rather than coordinates keeps even the coordinates
 * server-controlled for this path.
 */
export default function SearchWidget({
  defaultDirection = "arrival",
  className,
}: {
  defaultDirection?: Direction
  className?: string
}) {
  const t = useTranslations()
  const language = useLanguage()
  const router = useRouter()
  const params = useParams()
  const segment = String(params?.countryCode ?? "en-qa")
  const ids = useId()

  const [direction, setDirection] = useState<Direction>(defaultDirection)
  const [area, setArea] = useState("")
  const [date, setDate] = useState("")
  const [time, setTime] = useState("")
  const [passengers, setPassengers] = useState(2)
  const [luggage, setLuggage] = useState(2)
  const [error, setError] = useState<string | null>(null)

  // Qatar has no DST, so "today" in the customer's booking sense is Qatar's
  // today. Computed on the client so a late-night booking abroad does not get
  // yesterday's date from a UTC server. `earliest` is the same idea pushed
  // forward by the lead time, and bounds the pickers.
  const today = useMemo(() => qatarToday(), [])
  const earliest = useMemo(() => earliestPickupFields(), [])
  const minTime = date === earliest.date ? earliest.time : undefined

  function onSubmit(e: FormEvent) {
    e.preventDefault()

    if (!area) {
      setError(t("search.error.destination"))
      return
    }
    if (!date || !time) {
      setError(t("search.error.datetime"))
      return
    }

    // Checked here rather than left to the input's `min`: a time input's min
    // is per-day, so 23:00 "today" would pass it while still being in the past.
    const lead = checkLeadTime(date, time)
    if (lead === "past") {
      setError(t("search.error.past"))
      return
    }
    if (lead === "tooSoon") {
      setError(t("search.error.tooSoon", { lead: leadTimeLabel(language) }))
      return
    }

    setError(null)

    const query = new URLSearchParams({
      direction,
      area,
      date,
      time,
      passengers: String(passengers),
      luggage: String(luggage),
    })

    router.push(`/${segment}/results?${query.toString()}`)
  }

  const destinationLabel =
    direction === "arrival"
      ? t("search.destination.label")
      : t("search.destination.labelDeparture")

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      aria-labelledby={`${ids}-title`}
      className={clx(
        "rounded-dd-lg bg-dd-surface p-4 shadow-float small:p-6",
        // The widget is a white card that usually sits on the dark hero, whose
        // .on-ink inverts the focus ring. Reset it here so focus inside the
        // card is ink-on-white again.
        "[--dd-focus:var(--dd-ink)] [--dd-focus-gap:var(--dd-surface)]",
        className
      )}
    >
      <h2 id={`${ids}-title`} className="sr-only">
        {t("search.formTitle")}
      </h2>

      {/* Direction --------------------------------------------------------- */}
      <fieldset className="mb-4">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-wide text-dd-muted">
          {t("search.direction.label")}
        </legend>
        <div
          role="radiogroup"
          aria-label={t("search.direction.label")}
          className="grid grid-cols-2 gap-1 rounded-dd bg-dd-paper p-1"
        >
          {(["arrival", "departure"] as const).map((value) => {
            const selected = direction === value
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setDirection(value)}
                className={clx(
                  "min-h-touch rounded-dd-sm px-3 text-sm font-medium transition-colors",
                  selected
                    ? "bg-dd-accent text-dd-on-accent shadow-card"
                    : "text-dd-ink-soft hover:bg-dd-paper-deep"
                )}
              >
                {value === "arrival"
                  ? t("search.direction.fromAirport")
                  : t("search.direction.toAirport")}
              </button>
            )
          })}
        </div>
      </fieldset>

      {/* Destination ------------------------------------------------------- */}
      <Field label={destinationLabel} htmlFor={`${ids}-area`}>
        <LocationPicker
          id={`${ids}-area`}
          label={destinationLabel}
          value={area}
          onChange={setArea}
          invalid={!!error && !area}
        />
      </Field>

      {/* Date + time ------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("search.date.label")} htmlFor={`${ids}-date`}>
          <input
            id={`${ids}-date`}
            name="date"
            type="date"
            min={today}
            // Bounded again below on submit: `min` here only constrains the day.
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className={inputClass}
          />
        </Field>
        <Field label={t("search.time.label")} htmlFor={`${ids}-time`}>
          <input
            id={`${ids}-time`}
            name="time"
            type="time"
            step={900}
            min={minTime}
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
            className={inputClass}
          />
        </Field>
      </div>

      {/* Party size -------------------------------------------------------- */}
      <div className="grid grid-cols-2 gap-3">
        <Field label={t("search.passengers.label")} htmlFor={`${ids}-pax`}>
          <select
            id={`${ids}-pax`}
            name="passengers"
            value={passengers}
            onChange={(e) => setPassengers(Number(e.target.value))}
            className={selectClass}
          >
            {range(1, 14).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t("search.luggage.label")} htmlFor={`${ids}-bags`}>
          <select
            id={`${ids}-bags`}
            name="luggage"
            value={luggage}
            onChange={(e) => setLuggage(Number(e.target.value))}
            className={selectClass}
          >
            {range(0, 14).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {error && (
        <p
          role="alert"
          className="mb-3 rounded-dd-sm bg-dd-danger-soft px-3 py-2 text-sm text-dd-danger"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        className="min-h-[52px] w-full rounded-dd bg-dd-accent px-4 text-base font-semibold text-dd-on-accent transition-colors hover:bg-dd-accent-strong"
      >
        {t("search.submit")}
      </button>

      <p className="mt-3 text-center text-xs text-dd-muted">
        {t("search.footnote")}
      </p>
    </form>
  )
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string
  htmlFor: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-3">
      <label
        htmlFor={htmlFor}
        className="mb-1 block text-xs font-semibold uppercase tracking-wide text-dd-muted"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

const inputClass =
  "block min-h-touch w-full rounded-dd border border-dd-line bg-dd-surface px-3 text-base text-dd-ink placeholder:text-dd-muted focus:border-dd-ink"

// Native select, with the OS chevron. `appearance-none` is avoided on purpose:
// the platform control is the most familiar and the most accessible one.
const selectClass = inputClass + " pe-8"

function range(from: number, to: number): number[] {
  return Array.from({ length: to - from + 1 }, (_, i) => from + i)
}

/** Today's date in Qatar (UTC+3, no DST) as YYYY-MM-DD. */

