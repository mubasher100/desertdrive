"use client"

import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useId, useState } from "react"
import { clx } from "@medusajs/ui"
import type { QuoteVehicle } from "@lib/data/quotes"
import { useLanguage, useTranslations } from "@lib/i18n/use-translations"
import { fleetImage } from "@lib/data/fleet-images"
import { formatQar, formatUsd } from "@lib/util/money"

/**
 * The vehicle choice on the results page.
 *
 * A radio group of cards plus a sticky bar with the primary action. On a phone
 * the cards scroll and the bar stays put, so "Continue" is always one thumb
 * away — that is the sticky primary action CLAUDE.md requires on this step.
 *
 * The selected card only holds a variant id. The details page and the backend
 * re-validate that variant against the trip; nothing chosen here is trusted
 * for price.
 */
export default function VehiclePicker({
  vehicles,
  nextHref,
  legs = 1,
}: {
  vehicles: QuoteVehicle[]
  /** Details page URL, without the variant. `&variant=` is appended. */
  nextHref: string
  /**
   * 2 on a return. The card shows the total the customer pays, with the
   * per-leg fare underneath — quoting one leg and charging two is the kind of
   * surprise the whole "price you see is the price you pay" line exists to
   * rule out.
   */
  legs?: 1 | 2
}) {
  const t = useTranslations()
  const language = useLanguage()
  const router = useRouter()
  const params = useParams()
  const segment = String(params?.countryCode ?? "en-qa")
  const groupId = useId()

  // Default to the cheapest car that is actually free, not simply the first.
  const [selected, setSelected] = useState<string>(
    vehicles.find((v) => v.available !== false)?.variant_id ?? ""
  )
  const chosen = vehicles.find((v) => v.variant_id === selected)

  function onContinue() {
    if (!chosen || chosen.available === false) return
    router.push(`/${segment}${nextHref}&variant=${encodeURIComponent(chosen.variant_id)}`)
  }

  return (
    <>
      <div
        role="radiogroup"
        aria-labelledby={`${groupId}-label`}
        className="grid gap-4 small:grid-cols-3"
      >
        <span id={`${groupId}-label`} className="sr-only">
          {t("results.title")}
        </span>

        {vehicles.map((v) => {
          const isSelected = v.variant_id === selected
          const title = language === "ar" && v.title_ar ? v.title_ar : v.title
          const photo = fleetImage(v.handle)

          return (
            <button
              key={v.variant_id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              // Shown, not hidden: a customer who sees a car vanish between
              // visits wonders what happened to it. aria-disabled rather than
              // disabled keeps it focusable, so a screen-reader user can still
              // reach it and hear why it cannot be chosen.
              aria-disabled={v.available === false}
              onClick={() => v.available !== false && setSelected(v.variant_id)}
              className={clx(
                "group flex w-full overflow-hidden rounded-dd-lg border-2 bg-dd-surface text-start shadow-card transition-colors small:flex-col",
                v.available === false
                  ? "cursor-not-allowed border-dd-line bg-dd-paper"
                  : isSelected
                    ? "border-dd-accent bg-dd-accent-soft/40"
                    : "border-dd-line hover:border-dd-line-strong"
              )}
            >
              {/*
                The thumbnail keeps the photo's OWN 3:2 at every width.
                A square box here cropped a third off each side, which on a
                car photo removes the front and the back and leaves a door
                (reported from a phone, 28 Sept 2026). `object-cover` will
                always cut something when the box and the file disagree, so
                the fix is to stop them disagreeing.

                `self-start` matters as much as the ratio: the card is a flex
                row, so without it the box stretches to the card's height and
                `aspect-[3/2]` is overruled — which is how the first attempt at
                this still cropped.
              */}
              <div className="relative aspect-[3/2] w-32 shrink-0 self-start bg-dd-paper small:w-full small:self-auto">
                {photo || v.thumbnail ? (
                  <Image
                    src={photo?.src ?? v.thumbnail!}
                    alt={title}
                    fill
                    sizes="(min-width: 1024px) 380px, 112px"
                    className={clx("object-cover", v.available === false && "opacity-40 grayscale")}
                  />
                ) : (
                  <div aria-hidden="true" className="flex h-full items-center justify-center text-dd-grey">
                    <CarGlyph />
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-dd-ink small:text-lg">{title}</h2>
                  {/*
                    Dollars lead because the customer is usually abroad and
                    thinks in them; the riyal total sits underneath because it
                    is what the card is actually charged, and Qatar's Consumer
                    Protection Law wants the price shown to be the price paid.
                    Never one without the other.
                  */}
                  <p className="shrink-0 text-end">
                    <span className="block text-lg font-semibold tabular-nums text-dd-ink">
                      {formatUsd(v.amount * legs)}
                    </span>
                    <span className="block text-xs font-medium tabular-nums text-dd-muted">
                      {t("money.approx", { qar: formatQar(v.amount * legs, t("common.currency")) })}
                    </span>
                  </p>
                </div>

                <p className="mt-1 text-sm text-dd-muted">
                  {t("results.passengers", { count: v.passengers })} ·{" "}
                  {t("results.luggage", { count: v.luggage })}
                </p>

                {legs === 2 && (
                  <p className="mt-0.5 text-sm text-dd-muted">{t("results.legs", { amount: formatUsd(v.amount) })}</p>
                )}

                {v.available === false && (
                  <p className="mt-2 text-sm font-medium text-dd-ink-soft">
                    {t("results.unavailable")}
                    <span className="block font-normal text-dd-muted">{t("results.unavailableHelp")}</span>
                  </p>
                )}

                {/* Conditional, not `hidden`: the attribute's display:none loses
                    to the inline-flex utility class below and the row stays
                    visible under the "booked" message. */}
                {v.available !== false && (
                <span
                  aria-hidden="true"
                  className={clx(
                    "mt-auto inline-flex items-center gap-x-1.5 pt-3 text-sm font-medium",
                    isSelected ? "text-dd-ink" : "text-dd-muted"
                  )}
                >
                  <span
                    className={clx(
                      "flex h-4 w-4 items-center justify-center rounded-full border-2",
                      isSelected ? "border-dd-accent bg-dd-accent" : "border-dd-line-strong"
                    )}
                  >
                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-dd-on-accent" />}
                  </span>
                  {isSelected ? t("results.selected") : t("results.select")}
                </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Sticky action bar ------------------------------------------------ */}
      <div data-sticky-cta className="sticky bottom-0 z-40 mt-6 -mx-4 border-t border-dd-line bg-dd-surface/95 px-4 py-3 backdrop-blur small:static small:mx-0 small:mt-8 small:border-0 small:bg-transparent small:p-0">
        <div className="mx-auto flex max-w-content items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm text-dd-muted">
              {chosen ? (language === "ar" && chosen.title_ar ? chosen.title_ar : chosen.title) : ""}
            </p>
            <p className="text-lg font-semibold tabular-nums text-dd-ink">
              {chosen ? formatUsd(chosen.amount * legs) : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={!chosen || chosen.available === false}
            className="min-h-[52px] shrink-0 rounded-dd bg-dd-accent px-6 text-base font-semibold text-dd-on-accent transition-colors hover:bg-dd-accent-strong disabled:opacity-50"
          >
            {t("common.continue")}
          </button>
        </div>
      </div>
    </>
  )
}

function CarGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="h-10 w-10 opacity-40 small:h-16 small:w-16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 13l2-5a2 2 0 0 1 1.9-1.3h10.2A2 2 0 0 1 19 8l2 5v5a1 1 0 0 1-1 1h-1a1 1 0 0 1-1-1v-1H6v1a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-5z" />
      <circle cx="7.5" cy="14.5" r="1" />
      <circle cx="16.5" cy="14.5" r="1" />
    </svg>
  )
}
