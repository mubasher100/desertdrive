"use server"

import { sdk } from "@lib/config"

export type AddOn = {
  product_id: string
  variant_id: string
  handle: string
  title: string
  title_ar: string | null
  description: string | null
  description_ar: string | null
  /** QAR, as-is. 18 QAR is 18, never 1800. */
  amount: number
  currency_code: string
  /** The most of this one booking may take. */
  max: number
}

/**
 * The extras a customer can put on a booking, priced by the server.
 *
 * Nothing here decides a price. The list comes from the catalogue, the amounts
 * come from the region's prices, and `createBookingCart` asks this same
 * endpoint again before charging for anything — so a variant id typed into a
 * request body buys exactly what the server says it buys.
 *
 * ⚠️ Every failure returns `[]` rather than throwing. Add-ons are optional by
 * definition: a customer who cannot see a child seat has lost a convenience,
 * but a customer who cannot see the *booking form* has lost the only revenue
 * path on the site. This must never be the thing that breaks checkout.
 *
 * That also covers the deploy race. The storefront ships in about two minutes
 * and the backend in ten to twenty, so for the length of every backend deploy
 * the new storefront is talking to the old API — and `/store/add-ons` simply
 * does not exist there. A 404 is "not deployed yet", and the section is hidden
 * until it is.
 */
export async function getAddOns(): Promise<AddOn[]> {
  try {
    const { add_ons } = await sdk.client.fetch<{ add_ons: AddOn[] }>("/store/add-ons", {
      method: "GET",
      // Short, not none: this is the catalogue, the same answer for everyone,
      // and the guarantee is "an admin price change is live within the cache
      // window". A quote is the opposite and is always no-store.
      next: { revalidate: 60 },
    })
    return Array.isArray(add_ons) ? add_ons : []
  } catch {
    return []
  }
}

/**
 * Prices a set of chosen add-ons against the server's own list.
 *
 * Takes what the browser sent — variant ids and quantities — and returns only
 * the lines the server agrees with, at the server's prices and inside the
 * server's per-add-on caps. An unknown id, a quantity of zero, and a quantity
 * of nine hundred all resolve to something the server was willing to sell.
 */
export async function priceAddOns(
  selected: Record<string, number>
): Promise<Array<{ addOn: AddOn; quantity: number; amount: number }>> {
  const available = await getAddOns()

  return available.flatMap((addOn) => {
    const raw = Math.floor(Number(selected[addOn.variant_id] ?? 0))
    if (!Number.isFinite(raw) || raw <= 0) return []
    const quantity = Math.min(raw, addOn.max)
    return [{ addOn, quantity, amount: addOn.amount * quantity }]
  })
}
