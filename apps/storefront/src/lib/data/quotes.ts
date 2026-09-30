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
  /** Which pricing key this fare came from: an area code, or a band code. */
  priced_by?: string
  /** False when every one of this vehicle is already out around the pickup time. */
  available?: boolean
  /** The notice this vehicle needs, in minutes: 720 standard, 1440 for the luxury classes. */
  min_lead_minutes?: number
  /**
   * False when the chosen pickup is inside THIS vehicle's minimum notice — the
   * S-Class and V-Class need 24 hours. Optional: an older backend omits it,
   * so read it as `=== false`, never `!lead_ok`.
   */
  lead_ok?: boolean
}

export type Quote = {
  distance_km: number
  band: { code: string; name_en: string; name_ar: string }
  /**
   * The drawn area the destination fell inside, when it fell in one. Named so
   * the page can say "The Pearl" rather than "Doha & central" — the customer
   * recognises the place, not the band.
   */
  zone?: { code: string; name_en: string; name_ar: string } | null
  vehicles: QuoteVehicle[]
  quotable: boolean
  /** False when the band is priced but nothing is free at this time. */
  available?: boolean
  /**
   * How many fares the trip costs: 1 per leg, doubled for any leg under 12
   * hours away. Each vehicle's `amount` is ONE fare. Optional: a backend from
   * before short-notice pricing omits it, and the caller falls back to legs.
   */
  fare_units?: FareUnits
}

export type FareUnits = {
  units: number
  legs: number
  surged_legs: number
  multiplier: number
  window_hours: number
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
  /** The return leg's instant. A vehicle busy on either leg cannot take the booking. */
  return_at?: string | null
  /**
   * The owner's test key, from `?test=` on the results URL, which surfaces the
   * 1 QAR test vehicle. Server-side only: this module is a server action, so
   * the key never reaches the browser bundle. The backend compares it to
   * TEST_BOOKING_KEY and silently ignores anything else.
   */
  test_key?: string | null
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
    if ((input.pickup_at || input.return_at) && /pickup_at|return_at/.test(message)) {
      console.warn("getQuote: backend predates availability; re-quoting without the pickup times")
      const { pickup_at, return_at, ...legacy } = input
      return await getQuote(legacy)
    }

    // Any other failure is shown as "we can't price this online" rather than an
    // error page — the customer still gets the phone number.
    return null
  }
}
