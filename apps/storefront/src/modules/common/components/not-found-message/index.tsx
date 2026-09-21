"use client"

import LocalizedClientLink from "@modules/common/components/localized-client-link"
import { useTranslations } from "@lib/i18n/use-translations"

/**
 * The body of the in-locale 404.
 *
 * A client component because Next's `not-found.tsx` receives no route params,
 * so the only way to know the language is to read it from the URL — which is
 * exactly what `useTranslations` does.
 */
export default function NotFoundMessage() {
  const t = useTranslations()

  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-2xl-semi text-ui-fg-base">
        {t("error.notFound.title")}
      </h1>
      <p className="text-small-regular text-ui-fg-subtle">
        {t("error.notFound.body")}
      </p>
      <LocalizedClientLink
        href="/"
        className="text-ui-fg-interactive underline underline-offset-4"
      >
        {t("error.notFound.action")}
      </LocalizedClientLink>
    </main>
  )
}
