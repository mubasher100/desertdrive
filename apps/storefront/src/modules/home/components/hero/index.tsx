import SearchWidget from "@modules/booking/components/search-widget"
import { getTranslations } from "@lib/i18n/get-translations"
import { listSearchZones } from "@lib/data/zones"

/**
 * The hero. The search widget is IN it, not below it: on a phone, the first
 * screen is the headline and the form, and nothing else.
 *
 * A full-bleed photograph of Doha at night under a dark gradient. The photo is
 * what makes the page feel like a place rather than a form; the gradient is
 * what keeps white type readable over it at every crop. Credit:
 * public/images/CREDITS.md and the footer.
 *
 * Two sizes, chosen by `<picture>`: a phone gets the 960 px file (76 KB), a
 * desktop the 1920 (319 KB). ⚠️ This used to be `next/image` with
 * `sizes="100vw"`, which relies on Next's image optimizer to make the small
 * version — and on Cloudflare there is no optimizer (no IMAGES binding), so
 * every phone downloaded the full 319 KB desktop file as the page's very
 * first image. Plain `<picture>` needs no service at all.
 *
 * `.on-ink` flips the focus ring so keyboard focus stays visible on the dark
 * surface; the widget resets it again inside its white card.
 */
export default async function Hero({ segment }: { segment: string }) {
  // Fetched here rather than in the widget: the widget is a client component,
  // and the areas are public, cacheable data that belongs on the server.
  const zones = await listSearchZones()

  const t = getTranslations(segment)

  return (
    <section className="on-ink relative isolate overflow-hidden bg-dd-navy text-dd-on-ink">
      <picture>
        <source media="(max-width: 960px)" srcSet="/images/hero-doha-960.jpg" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-doha-1920.jpg"
          alt=""
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 -z-20 h-full w-full object-cover object-[50%_35%]"
        />
      </picture>
      {/*
        Gradient, not a flat scrim: heavier on the start side where the headline
        sits, lighter where the skyline shows through. Contrast of the white
        headline is held by the heavy end regardless of the photo.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-dd-navy/85 via-dd-navy/70 to-dd-navy/90 small:bg-gradient-to-r small:from-dd-navy/95 small:via-dd-navy/70 small:to-dd-navy/35"
      />

      <div className="mx-auto grid w-full max-w-content gap-8 px-4 pb-10 pt-8 small:grid-cols-[1.1fr_1fr] small:items-center small:gap-12 small:py-24">
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

        <SearchWidget className="text-dd-ink" zones={zones} />
      </div>
    </section>
  )
}
