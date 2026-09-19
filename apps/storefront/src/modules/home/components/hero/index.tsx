import SearchWidget from "@modules/booking/components/search-widget"
import { getTranslations } from "@lib/i18n/get-translations"

/**
 * The hero. The search widget is IN it, not below it: on a phone, the first
 * screen is the headline and the form, and nothing else. A visitor should be
 * able to start booking without scrolling.
 *
 * Dark ink surface with white type — this is the reference's register and the
 * logo's own palette. `.on-ink` flips the focus ring so keyboard focus stays
 * visible against the dark background.
 */
export default function Hero({ segment }: { segment: string }) {
  const t = getTranslations(segment)

  return (
    <section className="on-ink bg-dd-ink text-dd-on-ink">
      <div className="mx-auto grid w-full max-w-content gap-8 px-4 pb-10 pt-8 small:grid-cols-[1.1fr_1fr] small:items-center small:gap-12 small:py-20">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dd-on-ink-2">
            {t("home.hero.eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight small:text-5xl small:leading-[1.1]">
            {t("search.title")}
          </h1>
          <p className="mt-4 max-w-prose text-base text-dd-on-ink-2 small:text-lg">
            {t("search.subtitle")}
          </p>
        </div>

        <SearchWidget className="text-dd-ink" />
      </div>
    </section>
  )
}
