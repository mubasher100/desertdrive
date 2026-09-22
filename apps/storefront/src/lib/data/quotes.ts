"use server"

import { sdk } from "@lib/config"

export type QuoteVehicle = {
  product_id: string
  variant_id: string
  handle: string
  title: string
  title_ar: string | null
  description: string | null
  thumbnail: string | null
  passengers: number
  luggage: number
  amount: number
  currency_code: string
  /** False when every one of this vehicle is already out around the pickup time. */
  available?: boolean
}

export type Quote = {
  distance_km: number
  band: { code: string; name_en: string; name_ar: string }
  vehicles: QuoteVehicle[]
  quotable: boolean
  /** False when the band is priced but nothing is free at this time. */
  available?: boolean
}

/**
 * Asks the backend to price a trip.
 *
 * The client supplies coordinates and a party size. The SERVER decides the
 * distance, the band, the variant and the amount — nothing price-related is
 * ever sent from here. See apps/backend/src/api/store/quotes.
 *
 * ⚠️ `no-store`, always. A quote is tied to one person's coordinates and party
 * size. There is nothing to win by caching it and correctness and privacy to
 * lose. Do not "optimise" this later with a per-visitor cache tag — that
 * pattern breaks silently under bypassTagCacheOnCacheHit.
 */
export async function getQuote(input: {
  lat: number
  lng: number
  passengers: number
  luggage: number
  /**
   * ISO 8601 pickup instant. Optional, and it never changes a price — it only
   * decides which vehicles are still free. Omitting it prices as if everything
   * were available.
   */
  pickup_at?: string | null
}): Promise<Quote | null> {
  try {
    return await sdk.client.fetch<Quote>("/store/quotes", {
      method: "POST",
      body: input,
      cache: "no-store",
    })
  } catch (e) {
    /**
     * The storefront and the backend deploy separately, and the storefront
     * usually wins the race. A backend still running the previous release
     * rejects `pickup_at` outright (Medusa validates request bodies strictly),
     * which would take every fare on the site down for the length of a deploy.
     *
     * So: drop the field and ask again. The answer loses availability — every
     * vehicle comes back marked free — which is exactly the behaviour of the
     * release before this one, and it is restored within one deploy.
     */
    const message = e instanceof Error ? e.message : String(e)
    if (input.pickup_at && /pickup_at/.test(message)) {
      console.warn("getQuote: backend predates availability; re-quoting without pickup_at")
      const { pickup_at, ...legacy } = input
      return await getQuote(legacy)
    }

    // Any other failure is shown as "we can't price this online" rather than an
    // error page — the customer still gets the phone number.
    return null
  }
}
