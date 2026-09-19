import { Metadata } from "next"
import Hero from "@modules/home/components/hero"
import TrustStrip from "@modules/home/components/trust-strip"
import Fleet from "@modules/home/components/fleet"
import HowItWorks from "@modules/home/components/how-it-works"
import Faq from "@modules/home/components/faq"
import { getTranslations } from "@lib/i18n/get-translations"
import { alternatesFor } from "@lib/util/locale"
import { getBaseURL } from "@lib/util/env"

type Props = { params: Promise<{ countryCode: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  const alt = alternatesFor("", getBaseURL())

  return {
    title: `${t("common.brand")} — ${t("search.title")}`,
    description: t("search.subtitle"),
    alternates: {
      canonical: alt.canonicalFor(countryCode),
      languages: alt.languages,
    },
    openGraph: {
      title: t("common.brand"),
      description: t("search.subtitle"),
      type: "website",
    },
  }
}

/**
 * Home. The order is the funnel's order of persuasion: the form first, then
 * reasons to trust it, then what you get, then how it works, then the long
 * copy for people (and crawlers) who want it.
 */
export default async function Home({ params }: Props) {
  const { countryCode } = await params
  const t = getTranslations(countryCode)

  return (
    <>
      <Hero segment={countryCode} />
      <TrustStrip segment={countryCode} />
      <Fleet segment={countryCode} />
      <HowItWorks segment={countryCode} />

      <section className="mx-auto w-full max-w-content px-4 py-12 small:py-16">
        <h2 className="text-2xl font-semibold text-dd-ink small:text-3xl">
          {t("home.airport.title")}
        </h2>
        <p className="mt-4 max-w-prose text-base leading-relaxed text-dd-ink-soft">
          {t("home.airport.body")}
        </p>
      </section>

      <Faq segment={countryCode} />
    </>
  )
}
