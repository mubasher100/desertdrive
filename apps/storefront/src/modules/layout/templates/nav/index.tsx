import Image from "next/image"
import LocalizedClientLink from "@modules/common/components/localized-client-link"
import LanguageSwitcher from "@modules/layout/components/language-switcher"
import { getTranslations } from "@lib/i18n/get-translations"
import { CONTACT } from "@lib/data/contact"

/**
 * The header. Deliberately minimal — there is no shop to navigate, so there is
 * no menu. Three things a visitor on a phone needs: the way home, a way to
 * call a human, and the other language.
 *
 * Sticky, because the phone number should stay reachable from anywhere in the
 * funnel. Height is fixed (--dd-nav-height) so anchored scrolls and the sticky
 * results-page CTA can account for it.
 */
export default async function Nav({ segment }: { segment: string }) {
  const t = getTranslations(segment)

  return (
    <header className="sticky inset-x-0 top-0 z-50 border-b border-dd-line bg-dd-surface">
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-content items-center justify-between px-4"
      >
        <LocalizedClientLink
          href="/"
          className="flex min-h-touch items-center"
          aria-label={t("common.brand")}
        >
          {/*
            The transparent logo, sized for the 64px bar. `priority` because it
            is above the fold on every page and its absence shifts the layout.
          */}
          <Image
            src="/brand/logo-transparent.png"
            alt={t("common.brand")}
            width={608}
            height={293}
            priority
            className="h-9 w-auto small:h-10"
          />
        </LocalizedClientLink>

        <div className="flex items-center gap-x-1 small:gap-x-4">
          <a
            href={`tel:${CONTACT.phone.e164}`}
            className="inline-flex min-h-touch items-center gap-x-2 rounded-dd px-2 text-sm font-medium text-dd-ink hover:bg-dd-paper small:px-3"
          >
            <PhoneIcon />
            <span className="hidden small:inline">{CONTACT.phone.display}</span>
            <span className="sr-only small:hidden">{t("nav.call")}</span>
          </a>
          <LanguageSwitcher className="text-sm font-medium" />
        </div>
      </nav>
    </header>
  )
}

function PhoneIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.9 2z" />
    </svg>
  )
}
