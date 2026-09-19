import { Metadata } from "next"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import PaymentChooser from "@modules/booking/components/payment-chooser"
import BookingSummary from "@modules/booking/components/booking-summary"
import { cardPaymentAvailable, retrieveBookingCart } from "@lib/data/booking"
import { getTranslations } from "@lib/i18n/get-translations"

type Props = { params: Promise<{ countryCode: string }> }

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  // Payment pages are never indexed: no canonical, no hreflang.
  return { title: `${t("payment.title")} — ${t("common.brand")}`, robots: { index: false, follow: false } }
}

/**
 * Step 4 of the funnel. Reads the booking in progress from its cookie. The
 * cookie lives two hours; after that the honest answer is "start again", not
 * a blank form.
 */
export default async function PaymentPage({ params }: Props) {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  const [cart, cardAvailable] = await Promise.all([retrieveBookingCart(), cardPaymentAvailable(countryCode)])

  if (!cart || !cart.items?.length) {
    return (
      <main className="mx-auto w-full max-w-content px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold text-dd-ink">{t("payment.expired.title")}</h1>
        <p className="mt-2 text-dd-muted">{t("payment.expired.body")}</p>
        <LocalizedClientLink
          href="/"
          className="mt-6 inline-flex min-h-[52px] items-center rounded-dd bg-dd-accent px-6 font-semibold text-dd-on-accent hover:bg-dd-accent-strong"
        >
          {t("payment.expired.action")}
        </LocalizedClientLink>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-content px-4 pb-12 pt-6">
      <h1 className="text-2xl font-semibold text-dd-ink small:text-3xl">{t("payment.title")}</h1>

      <div className="mt-6 grid gap-8 small:grid-cols-[1fr_360px] small:items-start">
        <div className="small:order-2">
          <BookingSummary
            segment={countryCode}
            metadata={cart.metadata ?? {}}
            vehicleTitle={cart.items[0]?.product_title ?? cart.items[0]?.title ?? ""}
            total={cart.total ?? 0}
          />
        </div>
        <div className="small:order-1">
          <PaymentChooser segment={countryCode} amount={cart.total ?? 0} cardAvailable={cardAvailable} />
        </div>
      </div>
    </main>
  )
}
