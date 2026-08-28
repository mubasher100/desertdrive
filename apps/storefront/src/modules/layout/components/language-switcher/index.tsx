"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { LANGUAGES, switchLanguage, type Language } from "@lib/util/locale"
import { useLanguage, useTranslations } from "@lib/i18n/use-translations"

/**
 * Switches language by changing the URL, not by setting a cookie.
 *
 * That is the whole point of putting the locale in the path: each language has
 * its own URL, its own prerendered page and its own cache entry. A cookie-based
 * switcher cannot work with static generation — a prerendered page has no
 * request to read a cookie from, so every cached page would ship in the default
 * language.
 *
 * Renders a real `<a href>` to the equivalent page in the other language, so it
 * works without JavaScript and can be opened in a new tab. `DirectionSync`
 * handles flipping `dir` when the navigation is client-side.
 *
 * With exactly two languages this renders a single toggle. It iterates
 * LANGUAGES rather than hardcoding the pair, so adding a third language does not
 * silently produce a broken toggle.
 */
export default function LanguageSwitcher({
  className,
}: {
  className?: string
}) {
  const pathname = usePathname()
  const current = useLanguage()
  const t = useTranslations()

  const others = LANGUAGES.filter((language) => language !== current)

  return (
    <nav aria-label={t("language.label")} className={className}>
      <ul className="flex items-center gap-x-3">
        {others.map((language) => (
          <li key={language}>
            <Link
              href={switchLanguage(pathname, language as Language)}
              // The target page is in a different language from the one
              // announcing it, which screen readers need told explicitly.
              lang={language}
              hrefLang={language}
              className="hover:text-ui-fg-base min-h-[44px] inline-flex items-center px-1"
            >
              {LANGUAGE_LABELS[language as Language]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/**
 * Each language is written in ITSELF, never translated. Someone looking for
 * Arabic is scanning for "العربية", not for the word "Arabic" rendered in a
 * language they may not read.
 */
const LANGUAGE_LABELS: Record<Language, string> = {
  en: "English",
  ar: "العربية",
}
