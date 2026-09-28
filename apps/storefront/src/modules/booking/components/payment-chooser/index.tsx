"use client"

import { useState, useTransition } from "react"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { startCardPayment } from "@lib/data/booking"
import { whatsappLink } from "@lib/data/contact"
import { formatQar, formatUsd } from "@lib/util/money"
import { useTranslations } from "@lib/i18n/use-translations"

/**
 * Step 4: pay by card.
 *
 * ⚠️ Card is the only way to pay, by the owner's decision (27 Sept 2026). Cash
 * to the driver was offered until then and is gone from the funnel entirely —
 * not hidden behind a flag, because a cash path that still exists is a cash
 * path that can still be reached.
 *
 * What did NOT go with it: the admin's "Mark cash collected" action. Bookings
 * taken before this change, and any the owner takes by phone, still settle in
 * cash and still have to be marked. Removing that would have stranded them.
 *
 * ⚠️ There is now no second way to pay, so the card provider being unavailable
 * is a dead end rather than a degraded path. It says so and offers WhatsApp,
 * where a person can take the booking. Silently showing a button that cannot
 * work would lose the booking AND the customer's trust in the same click.
 *
 * The consent line is a legal requirement, not decoration: Qatar's E-Commerce
 * Law (No. 16 of 2010) requires the terms to be available and accepted before
 * the contract forms, and the Personal Data Privacy Protection Law (No. 13 of
 * 2016) requires consent to processing. The server action records when it was
 * ticked on the order. The 18+ confirmation reflects the age of legal capacity
 * under the Qatar Civil Code.
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
  const [pending, startTransition] = useTransition()
  const [message, setMessage] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)

  function confirm() {
    setMessage(null)
    if (!accepted) {
      setMessage(t("payment.consent.required"))
      return
    }
    startTransition(async () => {
      // Redirects on success; only returns on failure.
      const result = await startCardPayment(segment, accepted)
      if (result?.message) setMessage(result.message)
    })
  }

  if (!cardAvailable) {
    return (
      <div className="mt-6 max-w-xl">
        <div role="alert" className="rounded-dd border border-dd-line bg-dd-paper px-4 py-4">
          <p className="font-semibold text-dd-ink">{t("payment.unavailable.title")}</p>
          <p className="mt-1 text-sm text-dd-ink-soft">{t("payment.unavailable.body")}</p>
          <a
            href={whatsappLink(t("payment.unavailable.message"))}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex min-h-[52px] items-center rounded-dd bg-dd-accent px-6 font-semibold text-dd-on-accent hover:bg-dd-accent-strong"
          >
            {t("payment.unavailable.action")}
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="mt-6 max-w-xl">
      <div className="rounded-dd-lg border-2 border-dd-accent bg-dd-accent-soft/40 p-4">
        <p className="font-semibold text-dd-ink">{t("payment.card")}</p>
        <p className="mt-0.5 text-sm text-dd-muted">{t("payment.card.help")}</p>
      </div>

      <label className="mt-5 flex cursor-pointer items-start gap-x-3 text-sm text-dd-ink-soft">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          aria-describedby={message ? "payment-message" : undefined}
          className="mt-0.5 h-5 w-5 shrink-0 rounded border-dd-line-strong text-dd-accent focus:ring-dd-accent"
        />
        <span>
          {t("payment.consent.prefix")}{" "}
          <LocalizedClientLink href="/terms" className="underline hover:text-dd-ink" target="_blank">
            {t("footer.terms")}
          </LocalizedClientLink>
          ,{" "}
          <LocalizedClientLink href="/cancellation" className="underline hover:text-dd-ink" target="_blank">
            {t("footer.cancellation")}
          </LocalizedClientLink>{" "}
          {t("payment.consent.and")}{" "}
          <LocalizedClientLink href="/privacy" className="underline hover:text-dd-ink" target="_blank">
            {t("footer.privacy")}
          </LocalizedClientLink>
          , {t("payment.consent.age")}
        </span>
      </label>

      {message && (
        <p id="payment-message" role="alert" className="mt-4 rounded-dd-sm bg-dd-danger-soft px-3 py-2 text-sm text-dd-danger">
          {message}
        </p>
      )}

      {/*
        The conversion, stated at the moment of paying.

        Prices are shown in dollars throughout because the customer is usually
        abroad, but the card is charged in riyals by a Qatari gateway. Saying
        so here — next to the button, not in a footnote — is what keeps "the
        price shown is the price charged" true when the two are in different
        currencies. A statement on a card that says $27.47 and a bank line
        that says QAR 100 is a chargeback waiting to happen.
      */}
      <p className="mt-6 rounded-dd border border-dd-line bg-dd-paper px-4 py-3 text-sm text-dd-muted">
        {t("money.chargedIn", { qar: formatQar(amount, t("common.currency")) })}
      </p>

      <div data-sticky-cta className="sticky bottom-0 z-40 -mx-4 mt-6 border-t border-dd-line bg-dd-surface/95 px-4 py-3 backdrop-blur small:static small:mx-0 small:border-0 small:bg-transparent small:p-0">
        <button
          type="button"
          onClick={confirm}
          disabled={pending}
          className="min-h-[52px] w-full rounded-dd bg-dd-accent px-4 text-base font-semibold text-dd-on-accent transition-colors hover:bg-dd-accent-strong disabled:opacity-60"
        >
          {pending ? t("common.loading") + "…" : t("payment.card.confirm", { amount: formatUsd(amount) })}
        </button>
      </div>
    </div>
  )
}
