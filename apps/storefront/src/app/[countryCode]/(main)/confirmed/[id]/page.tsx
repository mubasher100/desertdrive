import { Metadata } from "next"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import BookingSummary from "@modules/booking/components/booking-summary"
import { retrieveBooking } from "@lib/data/booking"
import { getTranslations } from "@lib/i18n/get-translations"
import { CONTACT, whatsappLink } from "@lib/data/contact"

type Props = {
  params: Promise<{ countryCode: string; id: string }>
  searchParams: Promise<{ t?: string }>
}

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  // Holds personal data behind a signed token. Never indexed, no canonical, no hreflang.
  return {
    title: `${t("confirmed.title")} — ${t("common.brand")}`,
    robots: { index: false, follow: false, noarchive: true },
  }
}

/**
 * Step 5: the booking, confirmed. Reached from checkout and from the link in
 * the confirmation email. Gated by the HMAC in `?t=`; without a valid token it
 * renders the not-found state — never a 403 that confirms the id exists.
 */
export default async function ConfirmedPage({ params, searchParams }: Props) {
  const { countryCode, id } = await params
  const { t: token } = await searchParams
  const t = getTranslations(countryCode)

  const order = await retrieveBooking(id, token)

  if (!order) {
    return (
      <main className="mx-auto w-full max-w-content px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-dd-ink">{t("confirmed.notFound.title")}</h1>
        <p className="mx-auto mt-2 max-w-prose text-dd-muted">{t("confirmed.notFound.body")}</p>
        <a
          href={whatsappLink()}
          className="mt-6 inline-flex min-h-[52px] items-center rounded-dd bg-dd-accent px-6 font-semibold text-dd-on-accent hover:bg-dd-accent-strong"
        >
          {t("confirmed.whatsapp")}
        </a>
      </main>
    )
  }

  const reference = `DD-${order.display_id}`
  const metadata = (order.metadata ?? {}) as Record<string, unknown>
  const vehicleTitle = order.items?.[0]?.product_title ?? order.items?.[0]?.title ?? ""
  // Cash orders sit at "authorized" until the owner captures; card orders are captured.
  const paymentStatus = order.payment_status === "captured" ? "card" : "cash"

  return (
    <main className="mx-auto w-full max-w-content px-4 pb-12 pt-8">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-start gap-x-4">
          <span
            aria-hidden="true"
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-dd-success-soft text-dd-success"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L20 7" />
            </svg>
          </span>
          <div>
            <h1 className="text-2xl font-semibold text-dd-ink small:text-3xl">{t("confirmed.title")}</h1>
            <p className="mt-1 text-dd-muted">
              {t("confirmed.subtitle", { email: String(metadata.contact_email ?? order.email ?? "") })}
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-dd-lg border border-dd-accent bg-dd-accent-soft px-5 py-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-dd-accent-text">
            {t("confirmed.reference")}
          </p>
          <p className="mt-1 text-3xl font-semibold tabular-nums text-dd-ink">{reference}</p>
        </div>

        <div className="mt-6">
          <BookingSummary
            segment={countryCode}
            metadata={metadata}
            vehicleTitle={vehicleTitle}
            total={order.total ?? 0}
            paymentStatus={paymentStatus}
          />
        </div>

        <div className="mt-6 flex flex-col gap-3 small:flex-row">
          <a
            href={whatsappLink(`${reference}: `)}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[52px] items-center justify-center rounded-dd bg-dd-accent px-6 font-semibold text-dd-on-accent hover:bg-dd-accent-strong"
          >
            {t("confirmed.whatsapp")}
          </a>
          <a
            href={`tel:${CONTACT.phone.e164}`}
            className="inline-flex min-h-[52px] items-center justify-center rounded-dd border border-dd-line-strong bg-dd-surface px-6 font-semibold text-dd-ink hover:bg-dd-paper"
          >
            {t("nav.call")} · {CONTACT.phone.display}
          </a>
          <a
            href={`/${countryCode}/confirmed/${order.id}/calendar?t=${encodeURIComponent(token ?? "")}`}
            download={`${reference}.ics`}
            className="inline-flex min-h-[52px] items-center justify-center rounded-dd border border-dd-line-strong bg-dd-surface px-6 font-semibold text-dd-ink hover:bg-dd-paper"
          >
            {t("confirmed.addToCalendar")}
          </a>
        </div>

        <p className="mt-6 text-sm text-dd-muted">{t("confirmed.help")}</p>

        <LocalizedClientLink href="/" className="mt-8 inline-flex min-h-touch items-center text-sm text-dd-accent-text underline underline-offset-4">
          {t("error.notFound.action")}
        </LocalizedClientLink>
      </div>
    </main>
  )
}
