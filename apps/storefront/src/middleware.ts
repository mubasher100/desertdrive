import { NextRequest, NextResponse } from "next/server"
import { DEFAULT_SEGMENT, resolveSegment } from "@lib/util/locale"

/**
 * Puts every request under a locale segment: `/en-qa/...` or `/ar-qa/...`.
 *
 * The Medusa starter's middleware fetched the region list from the backend on
 * every cold start just to decide whether a path prefix was valid. That made
 * routing itself depend on the backend being reachable — if Medusa was down or
 * slow, the site did not serve a degraded page, it failed to route at all.
 *
 * This store serves exactly one country and two languages, all known at build
 * time, so the valid segments are a static list. Routing now cannot fail because
 * of the backend, and there is no fetch on the edge path.
 */

const CACHE_ID_COOKIE = "_medusa_cache_id"

/** Paths that must never be rewritten under a locale. */
function isExempt(pathname: string): boolean {
  return (
    pathname.startsWith("/api") ||
    pathname.startsWith("/_next") ||
    // Anything with an extension is a file: favicon.ico, robots.txt, images.
    pathname.includes(".")
  )
}

export async function middleware(request: NextRequest) {
  const { pathname, search, origin } = request.nextUrl

  if (isExempt(pathname)) {
    return NextResponse.next()
  }

  const [, first, ...rest] = pathname.split("/")
  const resolution = resolveSegment(first)

  /**
   * A per-visitor id used to build cache tags for that visitor's cart and order.
   * Set here rather than during render: reading or writing cookies while
   * rendering forces a route out of static generation, which stops the
   * incremental cache serving prerendered pages at all.
   */
  const cacheId = request.cookies.get(CACHE_ID_COOKIE)?.value

  const withCacheCookie = (response: NextResponse) => {
    if (!cacheId) {
      response.cookies.set(CACHE_ID_COOKIE, crypto.randomUUID(), {
        maxAge: 60 * 60 * 24,
        sameSite: "lax",
        path: "/",
      })
    }
    return response
  }

  if (resolution.type === "valid") {
    return withCacheCookie(NextResponse.next())
  }

  /**
   * Either a bare country (`/qa/...`) or non-canonical casing (`/EN-QA/...`).
   * Redirect rather than 404 — a bare country is a plausible thing for a person
   * or an old link to contain, and losing them costs a booking.
   *
   * 308 rather than the starter's 307: this mapping is permanent and safe for
   * search engines to remember, and it preserves the request method.
   */
  if (resolution.type === "redirect") {
    const target = ["", resolution.segment, ...rest].join("/")
    return withCacheCookie(
      NextResponse.redirect(`${origin}${target}${search}`, 308)
    )
  }

  /**
   * No locale prefix at all — `/` or `/results`. Send them to the default
   * locale, keeping the path.
   *
   * A 307 here, not 308: which locale a bare path belongs to is a decision that
   * could reasonably change (a future Accept-Language check, for instance), and
   * a permanent redirect would be cached in browsers that we could not reach to
   * correct.
   */
  const suffix = pathname === "/" ? "" : pathname
  return withCacheCookie(
    NextResponse.redirect(`${origin}/${DEFAULT_SEGMENT}${suffix}${search}`, 307)
  )
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|images|assets|png|svg|jpg|jpeg|gif|webp).*)",
  ],
}
