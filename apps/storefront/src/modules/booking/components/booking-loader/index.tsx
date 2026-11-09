"use client"

import Image from "next/image"
import { clx } from "@medusajs/ui"
import { useTranslations } from "@lib/i18n/use-translations"

export type LoaderStep = "results" | "details" | "saving" | "payment" | "skipcash" | "confirming" | "booking"

/**
 * The booking funnel's loading screen (owner, 9 Nov 2026).
 *
 * Every step waits on the backend in Singapore, and on hotel wifi or roaming
 * that is seconds, not milliseconds. Without this the old page simply sat
 * there after a tap, which reads as "nothing happened" and invites a second
 * tap. Two forms:
 *
 *  - in the page, from a route's `loading.tsx`, while the next step renders;
 *  - `overlay`, over everything, while a button's server action runs (creating
 *    the booking, handing over to SkipCash) — the form underneath must not be
 *    tapped again meanwhile.
 *
 * The spinner stops for `prefers-reduced-motion`; the words carry the meaning.
 */
export default function BookingLoader({ step, overlay = false }: { step: LoaderStep; overlay?: boolean }) {
  const t = useTranslations()

  return (
    <div
      role="status"
      aria-live="polite"
      className={clx(
        "flex flex-col items-center justify-center gap-y-5 px-4 text-center",
        overlay ? "fixed inset-0 z-[100] bg-dd-surface" : "min-h-[60vh] py-16"
      )}
    >
      <Image src="/brand/logo-transparent.png" alt="" width={608} height={293} priority className="h-14 w-auto" />
      <span
        aria-hidden="true"
        className="h-10 w-10 animate-spin rounded-full border-4 border-dd-line border-t-dd-accent motion-reduce:animate-none"
      />
      <p className="max-w-xs text-base font-medium text-dd-ink">{t(`loader.${step}` as never, {})}</p>
    </div>
  )
}
