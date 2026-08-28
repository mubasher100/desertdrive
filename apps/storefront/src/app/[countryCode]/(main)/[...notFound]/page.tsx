import { notFound } from "next/navigation"

/**
 * Catches every unmatched path INSIDE the locale.
 *
 * Without this, `/ar-qa/nonsense` falls through to the root not-found, which
 * renders outside `[countryCode]` — so an Arabic visitor gets an English 404, on
 * a bare page, with no navigation and no obvious way back. Catching it here
 * means the locale layout, the nav and the footer are all still present and
 * still in the right language.
 *
 * This route must stay the lowest-priority match: a real page at the same path
 * always wins, because Next prefers a more specific segment over a catch-all.
 */
export default function LocaleCatchAll() {
  notFound()
}
