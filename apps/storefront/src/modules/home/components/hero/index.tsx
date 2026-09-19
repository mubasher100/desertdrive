import Image from "next/image"
import SearchWidget from "@modules/booking/components/search-widget"
import { getTranslations } from "@lib/i18n/get-translations"

/**
 * The hero. The search widget is IN it, not below it: on a phone, the first
 * screen is the headline and the form, and nothing else.
 *
 * A full-bleed photograph of Doha at night under a dark gradient. The photo is
 * what makes the page feel like a place rather than a form; the gradient is
 * what keeps white type readable over it at every crop. Two sizes are shipped
 * and the browser picks by viewport, so a phone on hotel wifi gets 49 KB, not
 * 172 KB. Credit: public/images/CREDITS.md and the footer.
 *
 * `.on-ink` flips the focus ring so keyboard focus stays visible on the dark
 * surface; the widget resets it again inside its white card.
 */
export default function Hero({ segment }: { segment: string }) {
  const t = getTranslations(segment)

  return (
    <section className="on-ink relative isolate overflow-hidden bg-dd-ink text-dd-on-ink">
      <Image
        src="/images/hero-doha-1920.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="-z-20 object-cover object-[50%_35%]"
      />
      {/*
        Gradient, not a flat scrim: heavier on the start side where the headline
        sits, lighter where the skyline shows through. Contrast of the white
        headline is held by the heavy end regardless of the photo.
      */}
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-gradient-to-b from-dd-ink/80 via-dd-ink/60 to-dd-ink/85 small:bg-gradient-to-r small:from-dd-ink/90 small:via-dd-ink/60 small:to-dd-ink/40"
      />

      <div className="mx-auto grid w-full max-w-content gap-8 px-4 pb-10 pt-8 small:grid-cols-[1.1fr_1fr] small:items-center small:gap-12 small:py-24">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-dd-accent">
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
