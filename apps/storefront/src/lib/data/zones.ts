"use server"

import { sdk } from "@lib/config"
import { getPublicCacheOptions } from "@lib/data/cookies"

export type SearchZone = {
  code: string
  name_en: string
  name_ar: string
  lat: number
  lng: number
}

/**
 * The areas the owner has drawn, as searchable destinations.
 *
 * Drawing "Viva Bahriya" in the admin makes it findable in the search box
 * within the cache window, with no external place database involved and no
 * per-search cost. Each one carries a point inside its own outline, so picking
 * it prices by that area rather than by whatever band surrounds it.
 *
 * Public and cached: identical for every visitor, no cookie read, no price.
 * A failure returns an empty list — the curated areas are always there
 * underneath, so the search box never depends on this.
 */
export async function listSearchZones(): Promise<SearchZone[]> {
  const next = getPublicCacheOptions("zones")

  return sdk.client
    .fetch<{ zones: SearchZone[] }>("/store/zones", { method: "GET", next })
    .then(({ zones }) => zones ?? [])
    .catch(() => [])
}
