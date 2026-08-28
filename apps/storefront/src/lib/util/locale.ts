/**
 * Locale handling for Desert Drive.
 *
 * The locale lives in the URL as the first path segment, carrying BOTH language
 * and country: `/en-qa/...`, `/ar-qa/...`.
 *
 * Not a cookie. Prerendered pages cannot read a cookie during static generation,
 * so a cookie-based scheme would ship every cached page in the default language.
 * In the URL, each locale gets its own prerendered variant and the cache still
 * works.
 *
 * ⚠️ The Store API knows nothing about languages. Anything talking to it wants
 * `countryOf(segment)` — `"qa"` — never the raw segment. Passing `"en-qa"` to a
 * region lookup silently finds no region, and the page renders with no prices
 * rather than failing loudly.
 *
 * Pure and dependency-free so it can be used from middleware (edge), server
 * components and client components alike.
 */

export const LANGUAGES = ["en", "ar"] as const
export type Language = (typeof LANGUAGES)[number]

/** Qatar is the only country this store serves. */
export const COUNTRIES = ["qa"] as const
export type Country = (typeof COUNTRIES)[number]

export const DEFAULT_LANGUAGE: Language = "en"
export const DEFAULT_COUNTRY: Country = "qa"

/** Languages written right-to-left. */
const RTL_LANGUAGES = new Set<Language>(["ar"])

export type ParsedLocale = {
  language: Language
  country: Country
}

const isLanguage = (value: string): value is Language =>
  (LANGUAGES as readonly string[]).includes(value)

const isCountry = (value: string): value is Country =>
  (COUNTRIES as readonly string[]).includes(value)

/** `"en"`, `"qa"` -> `"en-qa"`. The canonical form is always lowercase. */
export function buildSegment(language: Language, country: Country): string {
  return `${language}-${country}`
}

export const DEFAULT_SEGMENT = buildSegment(DEFAULT_LANGUAGE, DEFAULT_COUNTRY)

/**
 * Parses a URL segment into a language and country.
 *
 * Accepts the full form only (`en-qa`). A bare country (`qa`) is deliberately
 * NOT accepted here — it is a valid thing for a visitor to type but not a valid
 * thing to render, so it is handled by `resolveSegment` as a redirect rather
 * than being silently treated as the default locale.
 *
 * Returns null for anything unrecognised, so callers must decide what to do
 * rather than receiving a plausible-looking default.
 */
export function parseSegment(raw: string | undefined | null): ParsedLocale | null {
  if (!raw) {
    return null
  }

  const [language, country, ...rest] = raw.toLowerCase().split("-")

  if (rest.length || !language || !country) {
    return null
  }

  if (!isLanguage(language) || !isCountry(country)) {
    return null
  }

  return { language, country }
}

export type SegmentResolution =
  /** A valid, canonical segment. Render it. */
  | { type: "valid"; segment: string; locale: ParsedLocale }
  /**
   * Recognisable but not canonical — a bare country (`qa`), or wrong case
   * (`EN-QA`). Redirect to `segment`, keeping the rest of the path.
   */
  | { type: "redirect"; segment: string }
  /** Not a locale at all. The path has no locale prefix. */
  | { type: "unknown" }

/**
 * Classifies the first path segment of a request.
 *
 * A bare country redirects to the default locale rather than 404ing: `/qa/...`
 * is a reasonable thing for a person or an old link to contain, and losing them
 * to a 404 costs a booking.
 */
export function resolveSegment(raw: string | undefined | null): SegmentResolution {
  if (!raw) {
    return { type: "unknown" }
  }

  const lower = raw.toLowerCase()
  const parsed = parseSegment(lower)

  if (parsed) {
    // Recognised, but the URL was not in canonical lowercase form. Redirect so
    // that one page has one URL, rather than two that both render.
    if (lower !== raw) {
      return { type: "redirect", segment: lower }
    }
    return { type: "valid", segment: lower, locale: parsed }
  }

  if (isCountry(lower)) {
    return { type: "redirect", segment: buildSegment(DEFAULT_LANGUAGE, lower) }
  }

  return { type: "unknown" }
}

/**
 * The country code for the Store API. Falls back to the default rather than
 * throwing, because an unparseable segment should still render a page with
 * prices — the locale layout's own 404 handles genuinely bad URLs.
 */
export function countryOf(segment: string | undefined | null): Country {
  return parseSegment(segment)?.country ?? DEFAULT_COUNTRY
}

/** The language for copy and formatting. */
export function localeOf(segment: string | undefined | null): Language {
  return parseSegment(segment)?.language ?? DEFAULT_LANGUAGE
}

/** Whether the document should be laid out right-to-left. */
export function isRtl(segment: string | undefined | null): boolean {
  return RTL_LANGUAGES.has(localeOf(segment))
}

/** `dir` attribute value for `<html>`. */
export function dirOf(segment: string | undefined | null): "rtl" | "ltr" {
  return isRtl(segment) ? "rtl" : "ltr"
}

/** Every locale segment available for a country, for the language switcher. */
export function segmentsFor(country: Country = DEFAULT_COUNTRY): string[] {
  return LANGUAGES.map((language) => buildSegment(language, country))
}

/** Every valid segment. Used to prerender the locale variants. */
export function allSegments(): string[] {
  return COUNTRIES.flatMap((country) => segmentsFor(country))
}

/**
 * Swaps the language on a full pathname, keeping the rest of the path.
 * `/en-qa/results?x=1` + `ar` -> `/ar-qa/results?x=1`
 */
export function switchLanguage(pathname: string, language: Language): string {
  const [, first, ...rest] = pathname.split("/")
  const country = parseSegment(first)?.country ?? DEFAULT_COUNTRY
  return ["", buildSegment(language, country), ...rest].join("/")
}

/**
 * hreflang alternates for a path, for the `<head>`.
 *
 * `path` is the part AFTER the locale segment, with a leading slash or empty for
 * the home page.
 *
 * Note hreflang uses the `language-REGION` convention with an uppercase region
 * (`en-QA`), which is not the same casing as the URL segment. They look similar
 * enough to be conflated, so they are built separately here on purpose.
 *
 * ⚠️ Not for the payment or confirmation pages. Those are noindex, and the
 * confirmation page holds personal data behind a signed token.
 */
export function alternatesFor(
  path: string = "",
  baseUrl: string = ""
): { languages: Record<string, string>; canonicalFor: (segment: string) => string } {
  const suffix = path && !path.startsWith("/") ? `/${path}` : path

  const languages: Record<string, string> = {}

  for (const country of COUNTRIES) {
    for (const language of LANGUAGES) {
      const segment = buildSegment(language, country)
      languages[`${language}-${country.toUpperCase()}`] =
        `${baseUrl}/${segment}${suffix}`
    }
  }

  languages["x-default"] = `${baseUrl}/${DEFAULT_SEGMENT}${suffix}`

  return {
    languages,
    canonicalFor: (segment: string) => `${baseUrl}/${segment}${suffix}`,
  }
}
