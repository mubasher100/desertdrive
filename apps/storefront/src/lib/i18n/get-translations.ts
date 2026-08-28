import { localeOf } from "@lib/util/locale"
import { createTranslator, type Translate } from "./dictionary"

/**
 * Translations for a server component.
 *
 * Pass the locale segment down from the locale layout's route params. There is
 * no provider and no context: the segment is already in the URL that rendered
 * the page, so threading it as a value keeps these components fully static and
 * cacheable.
 *
 *   const t = getTranslations(params.countryCode)
 *   <h1>{t("search.title")}</h1>
 *
 * Synchronous on purpose — an async version would make every caller a promise
 * for no benefit, and this module is imported by components that are not server
 * actions.
 */
export function getTranslations(segment: string | undefined | null): Translate {
  return createTranslator(localeOf(segment))
}
