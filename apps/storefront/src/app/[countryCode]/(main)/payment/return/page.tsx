import { Metadata } from "next"
import { redirect } from "next/navigation"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { completeCardBooking } from "@lib/data/booking"
import { getTranslations } from "@lib/i18n/get-translations"

type Props = { params: Promise<{ countryCode: string }> }

export const dynamic = "force-dynamic"

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  return { title: `${t("payment.title")} — ${t("common.brand")}`, robots: { index: false, follow: false } }
}

/**
 * Where SkipCash sends the customer after its hosted page. Whatever the query
 * string says, the truth comes from completing the cart: Medusa asks the
 * provider, the provider asks SkipCash. A paid card lands on the confirmation
 * page; anything else keeps the cart and offers to try again or pay cash.
 */
export default async function PaymentReturnPage({ params }: Props) {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  const result = await completeCardBooking()

  if (result.status === "confirmed") {
    redirect(`/${countryCode}/confirmed/${result.orderId}?t=${result.token}`)
  }
  if (result.status === "expired") {
    redirect(`/${countryCode}/payment`)
  }

  return (
    <main className="mx-auto w-full max-w-content px-4 py-16 text-center">
      <h1 className="text-2xl font-semibold text-dd-ink">{t("payment.return.unpaid.title")}</h1>
      <p className="mx-auto mt-2 max-w-prose text-dd-muted">{t("payment.return.unpaid.body")}</p>
      <LocalizedClientLink
        href="/payment"
        className="mt-6 inline-flex min-h-[52px] items-center rounded-dd bg-dd-accent px-6 font-semibold text-dd-on-accent hover:bg-dd-accent-strong"
      >
        {t("payment.return.unpaid.action")}
      </LocalizedClientLink>
    </main>
  )
}
