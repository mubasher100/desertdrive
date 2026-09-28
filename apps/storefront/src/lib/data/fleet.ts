"use server"

import { sdk } from "@lib/config"
import { getRegion } from "@lib/data/regions"
import { getPublicCacheOptions } from "@lib/data/cookies"
import type { HttpTypes } from "@medusajs/types"

export type FleetVehicle = {
  id: string
  handle: string
  title: string
  title_ar: string | null
  description: string | null
  description_ar: string | null
  thumbnail: string | null
  passengers: number
  luggage: number
  /** The cheapest priced band — normally band A, central Doha. */
  from_amount: number | null
  currency_code: string
}

function readNumber(metadata: Record<string, unknown> | null | undefined, key: string) {
  const raw = metadata?.[key]
  const n = typeof raw === "string" ? Number(raw) : raw
  return typeof n === "number" && Number.isFinite(n) ? n : null
}

/**
 * The vehicle classes for the home page, with their "from" price.
 *
 * Public catalogue data, identical for every visitor, so it uses the
 * cookie-free cache options and the page stays statically renderable. The
 * per-trip price is NOT this — it comes from /store/quotes once a destination
 * is chosen. This is the marketing "from 40 QAR", which is the cheapest band.
 */
export async function listFleet(segment: string): Promise<FleetVehicle[]> {
  const region = await getRegion(segment)
  if (!region) {
    return []
  }

  const { products } = await sdk.client.fetch<{
    products: HttpTypes.StoreProduct[]
  }>("/store/products", {
    method: "GET",
    query: {
      region_id: region.id,
      limit: 20,
      fields:
        "id,handle,title,description,thumbnail,metadata,*variants,*variants.calculated_price",
    },
    next: getPublicCacheOptions("fleet"),
    cache: "force-cache",
  })

  return products
    /**
     * Neither add-ons nor the 1 QAR test vehicle are vehicle classes.
     *
     * ⚠️ The test_only check was missing here from the day the test vehicle
     * was added, and the live home page listed "Test booking (1 QAR) —
     * Internal test vehicle. Not for customers." to everyone. The quote
     * workflow gated it correctly; this list reads the catalogue directly and
     * never asked. Any new place that lists products needs the same filter.
     */
    .filter((p) => {
      const m = p.metadata as Record<string, unknown> | null
      return !m?.add_on && !m?.test_only
    })
    .map((p) => {
      const metadata = p.metadata as Record<string, unknown> | null
      const passengers = readNumber(metadata, "passengers")
      const luggage = readNumber(metadata, "luggage")
      const amounts = (p.variants ?? [])
        .map((v) => v.calculated_price?.calculated_amount)
        .filter((a): a is number => typeof a === "number")

      return {
        id: p.id,
        handle: p.handle ?? p.id,
        title: p.title,
        title_ar: (metadata?.title_ar as string | undefined) ?? null,
        description: p.description ?? null,
        description_ar: (metadata?.description_ar as string | undefined) ?? null,
        thumbnail: p.thumbnail ?? null,
        passengers: passengers ?? 0,
        luggage: luggage ?? 0,
        from_amount: amounts.length ? Math.min(...amounts) : null,
        currency_code: region.currency_code,
      }
    })
    // Only things with a declared capacity are vehicles.
    .filter((v) => v.passengers > 0)
    // Cheapest first, matching the results page.
    .sort((a, b) => (a.from_amount ?? Infinity) - (b.from_amount ?? Infinity))
}
