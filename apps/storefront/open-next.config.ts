import { defineCloudflareConfig } from "@opennextjs/cloudflare"
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache"
import { withRegionalCache } from "@opennextjs/cloudflare/overrides/incremental-cache/regional-cache"
import doShardedTagCache from "@opennextjs/cloudflare/overrides/tag-cache/do-sharded-tag-cache"

/**
 * Cloudflare caching for the Desert Drive storefront.
 *
 * Three layers, each solving a different problem:
 *
 *   R2 incremental cache   Persistent store for prerendered pages and fetch
 *                          results. Without it, every Worker isolate re-renders
 *                          from scratch.
 *
 *   withRegionalCache      Cloudflare's Cache API in front of R2, per
 *                          datacentre, because reaching R2 is a network hop.
 *
 *   doShardedTagCache      Sharded Durable Objects. THIS is what makes
 *                          revalidateTag actually do something.
 *
 * ---------------------------------------------------------------------------
 * WHY THE TAG CACHE IS CONFIGURED THE WAY IT IS
 * ---------------------------------------------------------------------------
 * OpenNext's tagCache defaults to "dummy", which silently discards every tag.
 * You can POST to a revalidation endpoint forever and invalidate nothing. So a
 * real one is not optional.
 *
 * But a real one puts a Durable Object round trip on every request, which is
 * not free either. `bypassTagCacheOnCacheHit` is the resolution: a regionally
 * cached page is served without asking whether it is still valid, and only when
 * that entry expires does the request reach R2 — and that path does consult the
 * tag cache.
 *
 * The guarantee this buys is "an admin fare change goes live within the cache
 * window", NOT "on the very next request". Cloudflare's tag-based purge would
 * give both, but it needs a zone on an Enterprise plan.
 *
 * ⚠️ `bypassTagCacheOnCacheHit: true` is ONLY safe because this storefront is on
 * Next 15. On Next 16+, revalidateTag is stale-while-revalidate by default and
 * this flag stops being correct — the adapter itself defaults it to false there.
 * This is the concrete reason the Next version is not negotiable.
 */
export default defineCloudflareConfig({
  incrementalCache: withRegionalCache(r2IncrementalCache, {
    mode: "long-lived",
    bypassTagCacheOnCacheHit: true,
  }),

  tagCache: doShardedTagCache({
    baseShardSize: 4,
    regionalCache: true,
    /**
     * The adapter's default is 5 seconds. At this site's traffic most requests
     * arrive further apart than that, so the lookup expires before it is ever
     * reused and every request pays the Durable Object round trip anyway —
     * i.e. the regional cache does nothing at all. 30s is the trade.
     */
    regionalCacheTtlSec: 30,
  }),

  /**
   * Serves a prerendered page without booting the full Next.js server. Safe
   * only because this site does not use PPR — if PPR is ever enabled, this must
   * be turned off.
   */
  enableCacheInterception: true,
})
