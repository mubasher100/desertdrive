"use server"

import { sdk } from "@lib/config"
import { cleanNote, isOurUpload } from "@lib/booking/sign"

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
  /**
   * What the customer must supply for this add-on to be deliverable. "sign"
   * means the words for the board and, optionally, a picture.
   */
  collects?: "sign" | null
}

/** What the browser sends per chosen add-on. Quantity, plus anything collected. */
export type AddOnChoice = {
  quantity: number
  /** The words to print. Required when the add-on collects a sign. */
  note?: string | null
  /** A URL returned by POST /store/sign-image. Never a URL the client invented. */
  image_url?: string | null
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
  selected: Record<string, AddOnChoice>
): Promise<
  Array<{
    addOn: AddOn
    quantity: number
    amount: number
    note: string | null
    imageUrl: string | null
  }>
> {
  const available = await getAddOns()

  return available.flatMap((addOn) => {
    const choice = selected[addOn.variant_id]
    const raw = Math.floor(Number(choice?.quantity ?? 0))
    if (!Number.isFinite(raw) || raw <= 0) return []
    const quantity = Math.min(raw, addOn.max)

    const note = addOn.collects === "sign" ? cleanNote(choice?.note) : null

    /**
     * A sign with nothing on it is not a thing the driver can hold, so the
     * add-on is dropped rather than charged for. The form asks for the text
     * before it will submit; this is the server refusing to sell the empty
     * case whatever the form did.
     */
    if (addOn.collects === "sign" && !note) return []

    return [
      {
        addOn,
        quantity,
        amount: addOn.amount * quantity,
        note,
        /**
         * ⚠️ Only a URL OUR OWN upload endpoint produced is kept.
         *
         * This value arrives from the browser, and it ends up on the order and
         * in an email — somewhere the owner clicks. Without this check a
         * booking could carry any link on the internet, presented by us as
         * the customer's picture. The upload route is the only way to get a
         * URL past this line.
         */
        imageUrl:
          addOn.collects === "sign" &&
          isOurUpload(choice?.image_url, process.env.NEXT_PUBLIC_UPLOADS_PUBLIC_URL)
            ? String(choice!.image_url)
            : null,
      },
    ]
  })
}
