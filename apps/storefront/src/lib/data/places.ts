"use server"

import { sdk } from "@lib/config"

export type IndexedPlace = {
  id: string
  name_en: string
  name_ar: string | null
  kind: string
  context: string | null
  lat: number
  lng: number
}

/**
 * Search our own copy of Qatar's places: districts, hotels, campuses, malls,
 * hospitals, named compounds.
 *
 * This is the "it suggests places as you type" behaviour, served from our
 * database rather than a paid autocomplete — nothing is billed per keystroke,
 * and it answers when a third party would be rate limiting us. The index is
 * refreshed weekly from OpenStreetMap.
 *
 * `no-store`: a search is one person's half-typed query, and the route is
 * already cached at the edge by its own headers.
 *
 * A failure returns nothing. The curated areas and the map are both still
 * there, so the destination field never depends on this.
 */
export async function searchPlaces(query: string): Promise<IndexedPlace[]> {
  const q = query.trim()
  if (q.length < 2) return []

  return sdk.client
    .fetch<{ places: IndexedPlace[] }>("/store/places", {
      method: "GET",
      query: { q },
      cache: "no-store",
    })
    .then(({ places }) => places ?? [])
    .catch(() => [])
}
