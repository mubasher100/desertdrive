"use client"

import { useParams } from "next/navigation"
import { useMemo } from "react"
import { localeOf } from "@lib/util/locale"
import { createTranslator, type Translate } from "./dictionary"

/**
 * Translations for a client component.
 *
 * Reads the locale from `useParams`, so there is no provider to wrap the tree in
 * and nothing to forget to pass down. The segment is already in the URL that
 * rendered the page — that IS the state.
 *
 *   const t = useTranslations()
 *   <button>{t("search.submit")}</button>
 */
export function useTranslations(): Translate {
  const params = useParams()

  const segment = Array.isArray(params?.countryCode)
    ? params.countryCode[0]
    : (params?.countryCode as string | undefined)

  return useMemo(() => createTranslator(localeOf(segment)), [segment])
}

/** The active language, for the rare component that needs to branch on it. */
export function useLanguage() {
  const params = useParams()

  const segment = Array.isArray(params?.countryCode)
    ? params.countryCode[0]
    : (params?.countryCode as string | undefined)

  return localeOf(segment)
}
