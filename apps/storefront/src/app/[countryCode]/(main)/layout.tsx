import { Metadata } from "next"
import { getBaseURL } from "@lib/util/env"
import Footer from "@modules/layout/templates/footer"
import Nav from "@modules/layout/templates/nav"
import WhatsAppButton from "@modules/layout/components/whatsapp-button"
import { getTranslations } from "@lib/i18n/get-translations"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

/**
 * The public page chrome: header, content, footer.
 *
 * The Medusa starter fetched the cart and the customer here on every page. Both
 * are per-visitor reads that pull the whole route out of static rendering, and
 * neither is needed to draw a header — so they are gone. The funnel pages that
 * need the cart fetch it themselves.
 */
export default async function PageLayout(props: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params
  const t = getTranslations(countryCode)

  return (
    <>
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[60] focus:rounded-dd focus:bg-dd-ink focus:px-4 focus:py-3 focus:text-dd-on-ink"
      >
        {t("common.skipToContent")}
      </a>
      <Nav segment={countryCode} />
      <div id="content">{props.children}</div>
      <Footer segment={countryCode} />
      <WhatsAppButton />
    </>
  )
}
