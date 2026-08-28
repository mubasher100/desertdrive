import { Metadata } from "next"
import NotFoundMessage from "@modules/common/components/not-found-message"

/**
 * The 404 shown inside a locale, reached via the `[...notFound]` catch-all.
 *
 * The nav and footer from the (main) layout are still rendered around this, so
 * the visitor has a way back — unlike the root not-found, which renders outside
 * `[countryCode]` on a bare page.
 */
export const metadata: Metadata = {
  title: "404",
  // Nothing here is worth indexing, and indexing it competes with the real pages
  // for crawl budget.
  robots: { index: false, follow: true },
}

export default function NotFound() {
  return <NotFoundMessage />
}
