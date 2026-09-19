"use client"

import { useState, useTransition } from "react"
import { clx } from "@medusajs/ui"
import { confirmCashBooking, startCardPayment } from "@lib/data/booking"
import { useTranslations } from "@lib/i18n/use-translations"

type Method = "card" | "cash"

/**
 * Step 4: how to pay.
 *
 * Both paths confirm instantly — there is no ops-accept step. Card goes through
 * SkipCash (not wired yet: the option is shown disabled with an honest note,
 * because hiding it entirely would make the page look like cash is the only
 * way this business takes money). Cash creates a confirmed order with payment
 * pending; the owner marks it collected in the admin.
 */
export default function PaymentChooser({
  segment,
  amount,
  cardAvailable,
}: {
  segment: string
  amount: number
  cardAvailable: boolean
}) {
  const t = useTranslations()
  const [method, setMethod] = useState<Method>(cardAvailable ? "card" : "cash")
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)

  function confirm() {
    setMessage(null)
    startTransition(async () => {
      // Both actions redirect on success and only return on failure.
      const result = method === "card" ? await startCardPayment(segment) : await confirmCashBooking(segment)
      if (result?.message) setMessage(result.message)
    })
  }

  return (
    <div className="mt-6 max-w-xl">
      <div role="radiogroup" aria-label={t("payment.title")} className="space-y-3">
        <Option
          selected={method === "card"}
          disabled={!cardAvailable}
          onSelect={() => cardAvailable && setMethod("card")}
          title={t("payment.card")}
          body={cardAvailable ? t("payment.card.help") : t("payment.card.soon")}
        />
        <Option
          selected={method === "cash"}
          onSelect={() => setMethod("cash")}
          title={t("payment.cash")}
          body={t("payment.cash.help")}
        />
      </div>

      {method === "cash" && (
        <p className="mt-4 rounded-dd bg-dd-accent-soft px-4 py-3 text-sm text-dd-ink-soft">
          {t("payment.cash.note", { amount })}
        </p>
      )}

      {message && (
        <p role="alert" className="mt-4 rounded-dd-sm bg-dd-danger-soft px-3 py-2 text-sm text-dd-danger">
          {message}
        </p>
      )}

      <div className="sticky bottom-0 z-40 -mx-4 mt-6 border-t border-dd-line bg-dd-surface/95 px-4 py-3 backdrop-blur small:static small:mx-0 small:border-0 small:bg-transparent small:p-0">
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="min-h-[52px] w-full rounded-dd bg-dd-accent px-4 text-base font-semibold text-dd-on-accent transition-colors hover:bg-dd-accent-strong disabled:opacity-60"
        >
          {pending
            ? t("common.loading") + "…"
            : method === "card"
              ? t("payment.card.confirm", { amount })
              : t("payment.cash.confirm")}
        </button>
      </div>
    </div>
  )
}

function Option({
  selected,
  disabled,
  onSelect,
  title,
  body,
}: {
  selected: boolean
  disabled?: boolean
  onSelect: () => void
  title: string
  body?: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      aria-disabled={disabled}
      onClick={onSelect}
      className={clx(
        "flex w-full items-start gap-x-3 rounded-dd-lg border-2 p-4 text-start transition-colors",
        disabled
          ? "cursor-not-allowed border-dd-line bg-dd-paper opacity-70"
          : selected
            ? "border-dd-accent bg-dd-accent-soft/40"
            : "border-dd-line bg-dd-surface hover:border-dd-line-strong"
      )}
    >
      <span
        aria-hidden="true"
        className={clx(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
          selected ? "border-dd-accent bg-dd-accent" : "border-dd-line-strong"
        )}
      >
        {selected && <span className="h-2 w-2 rounded-full bg-dd-on-accent" />}
      </span>
      <span>
        <span className="block font-semibold text-dd-ink">{title}</span>
        {body && <span className="mt-0.5 block text-sm text-dd-muted">{body}</span>}
      </span>
    </button>
  )
}
