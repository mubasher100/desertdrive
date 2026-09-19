"use client"

import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useId, useState } from "react"
import { clx } from "@medusajs/ui"
import type { QuoteVehicle } from "@lib/data/quotes"
import { useLanguage, useTranslations } from "@lib/i18n/use-translations"

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
}: {
  vehicles: QuoteVehicle[]
  /** Details page URL, without the variant. `&variant=` is appended. */
  nextHref: string
}) {
  const t = useTranslations()
  const language = useLanguage()
  const router = useRouter()
  const params = useParams()
  const segment = String(params?.countryCode ?? "en-qa")
  const groupId = useId()

  const [selected, setSelected] = useState<string>(vehicles[0]?.variant_id ?? "")
  const chosen = vehicles.find((v) => v.variant_id === selected)

  function onContinue() {
    if (!chosen) return
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

          return (
            <button
              key={v.variant_id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelected(v.variant_id)}
              className={clx(
                "group flex w-full overflow-hidden rounded-dd-lg border-2 bg-dd-surface text-start shadow-card transition-colors small:flex-col",
                isSelected
                  ? "border-dd-ink"
                  : "border-dd-line hover:border-dd-line-strong"
              )}
            >
              <div className="relative aspect-square w-28 shrink-0 bg-dd-paper small:aspect-[3/2] small:w-full">
                {v.thumbnail ? (
                  <Image
                    src={v.thumbnail}
                    alt=""
                    fill
                    sizes="(min-width: 1024px) 380px, 112px"
                    className="object-cover"
                  />
                ) : (
                  <div aria-hidden="true" className="flex h-full items-center justify-center text-dd-grey">
                    <CarGlyph />
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col p-4">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-base font-semibold text-dd-ink small:text-lg">{title}</h3>
                  <p className="shrink-0 text-lg font-semibold tabular-nums text-dd-ink">
                    {v.amount}{" "}
                    <span className="text-sm font-medium text-dd-muted">{v.currency_code.toUpperCase() === "QAR" ? t("common.currency") : v.currency_code}</span>
                  </p>
                </div>

                <p className="mt-1 text-sm text-dd-muted">
                  {t("results.passengers", { count: v.passengers })} ·{" "}
                  {t("results.luggage", { count: v.luggage })}
                </p>

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
                      isSelected ? "border-dd-ink bg-dd-ink" : "border-dd-line-strong"
                    )}
                  >
                    {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-dd-on-ink" />}
                  </span>
                  {isSelected ? t("results.selected") : t("results.select")}
                </span>
              </div>
            </button>
          )
        })}
      </div>

      {/* Sticky action bar ------------------------------------------------ */}
      <div className="sticky bottom-0 z-40 mt-6 -mx-4 border-t border-dd-line bg-dd-surface/95 px-4 py-3 backdrop-blur small:static small:mx-0 small:mt-8 small:border-0 small:bg-transparent small:p-0">
        <div className="mx-auto flex max-w-content items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="truncate text-sm text-dd-muted">
              {chosen ? (language === "ar" && chosen.title_ar ? chosen.title_ar : chosen.title) : ""}
            </p>
            <p className="text-lg font-semibold tabular-nums text-dd-ink">
              {chosen ? `${chosen.amount} ${t("common.currency")}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onContinue}
            disabled={!chosen}
            className="min-h-[52px] shrink-0 rounded-dd bg-dd-ink px-6 text-base font-semibold text-dd-on-ink transition-colors hover:bg-dd-ink-soft disabled:opacity-50"
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
