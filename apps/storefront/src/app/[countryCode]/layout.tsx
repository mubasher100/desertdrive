import { notFound } from "next/navigation"
import DirectionSync from "@modules/layout/components/direction-sync"
import { allSegments, parseSegment } from "@lib/util/locale"

/**
 * The locale boundary. Everything below this runs under a known language and
 * country.
 *
 * Wraps both the (main) and (checkout) route groups, so there is exactly one
 * place that guarantees the segment is valid.
 */

/**
 * Prerender a variant per locale. This is the reason the locale is in the URL
 * rather than a cookie: each locale gets its own cache entry, instead of one
 * cached page that has to guess.
 */
export function generateStaticParams() {
  return allSegments().map((countryCode) => ({ countryCode }))
}

export default async function LocaleLayout(props: {
  children: React.ReactNode
  params: Promise<{ countryCode: string }>
}) {
  const { countryCode } = await props.params

  /**
   * Middleware should have redirected anything invalid before it reaches here,
   * so this is defence in depth rather than the primary path. It matters because
   * an unrecognised segment would otherwise render a page in the fallback
   * language at a URL that looks legitimate — and get it indexed.
   */
  if (!parseSegment(countryCode)) {
    notFound()
  }

  return (
    <>
      <DirectionSync />
      {props.children}
    </>
  )
}
