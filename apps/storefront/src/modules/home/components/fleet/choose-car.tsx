"use client"

import { useTranslations } from "@lib/i18n/use-translations"

/** The event the search widget listens for. Detail: the vehicle's handle and display name. */
export const CHOOSE_CAR_EVENT = "dd:choose-car"
export type ChooseCarDetail = { handle: string; title: string }

/**
 * Lets a customer start from the car rather than the destination (owner,
 * 9 Nov 2026): the choice is handed to the search widget, which carries it to
 * results, where that car is preselected.
 *
 * An event rather than a URL parameter on purpose: the home page is a cached,
 * prerendered page, and reading the query string while rendering it would take
 * it out of the cache. The widget is a client component already.
 */
export default function ChooseCar({ handle, title }: ChooseCarDetail) {
  const t = useTranslations()

  return (
    <button
      type="button"
      onClick={() => {
        window.dispatchEvent(new CustomEvent<ChooseCarDetail>(CHOOSE_CAR_EVENT, { detail: { handle, title } }))
        const widget = document.getElementById("book")
        widget?.scrollIntoView({ behavior: "smooth", block: "start" })
        // Straight to the field the customer needs next.
        widget?.querySelector<HTMLInputElement>('[role="combobox"]')?.focus({ preventScroll: true })
      }}
      className="mt-4 min-h-touch w-full rounded-dd border border-dd-accent px-4 text-base font-semibold text-dd-accent-text hover:bg-dd-accent-soft"
    >
      {t("home.fleet.choose")}
    </button>
  )
}
