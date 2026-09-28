/**
 * Vehicle photography, keyed by product handle.
 *
 * The photos live in the storefront (public/fleet/) rather than as Medusa
 * product thumbnails, because Railway's disk is ephemeral and Medusa's local
 * file provider would lose uploads on every deploy. Until an object store is
 * wired for uploads, this map is the source of truth.
 *
 * To add a vehicle photo: drop `public/fleet/<handle>.jpg` (landscape, ≥1200px
 * wide, see public/fleet/README.md) and add the handle here. Handles match
 * apps/backend/src/scripts/seed-fleet.ts.
 *
 * A handle missing from this map renders the neutral placeholder, sized
 * identically, so adding the photo later moves nothing.
 */
/**
 * ⚠️ PLACEHOLDERS. These are Creative Commons photos of the same models, not
 * the owner's actual cars — credited on /credits as the licence requires.
 * Replace each file with the owner's own photo of the real vehicle (same
 * filename, landscape, ≥1200px) and remove its row from credits.ts.
 */
/**
 * Two crops per vehicle, not one file cropped by CSS.
 *
 * The card is a horizontal row on a phone and a stacked card above `small`, so
 * the photo needs a square and a 3:2 — and a square cut from a 3:2 by
 * `object-cover` loses a third of the width, which on a car removes the front
 * and the back. Each crop is composed around the vehicle instead, and
 * `<picture>` fetches only the one that matches.
 */
export const FLEET_IMAGES: Record<
  string,
  { src: string; square: string; width: number; height: number }
> = {
  // The owner's own cars (28 Sept 2026) — not placeholders, nothing to credit.
  sedan: { src: "/fleet/sedan.jpg", square: "/fleet/sedan-square.jpg", width: 1200, height: 800 },
  "large-van": { src: "/fleet/large-van.jpg", square: "/fleet/large-van-square.jpg", width: 1200, height: 800 },

  // ⚠️ Still CC placeholders of similar vehicles, pointed at the classes that
  // replaced the model-named products. They are credited on /credits; swap in
  // the owner's photography and drop the matching credits row.
  suv: { src: "/fleet/toyota-rush.jpg", square: "/fleet/toyota-rush-square.jpg", width: 1200, height: 800 },
  "luxury-van": { src: "/fleet/hyundai-h1.jpg", square: "/fleet/hyundai-h1-square.jpg", width: 1200, height: 800 },
  "luxury-sedan": { src: "/fleet/tesla-model-3.jpg", square: "/fleet/tesla-model-3-square.jpg", width: 1200, height: 800 },

  // Retired products. Drafted, so a customer never sees these, but the map
  // keeps them so an old order still renders its vehicle.
  "toyota-rush": { src: "/fleet/toyota-rush.jpg", square: "/fleet/toyota-rush-square.jpg", width: 1200, height: 800 },
  "toyota-hiace": { src: "/fleet/toyota-hiace.jpg", square: "/fleet/toyota-hiace-square.jpg", width: 1200, height: 800 },
  "hyundai-h1": { src: "/fleet/hyundai-h1.jpg", square: "/fleet/hyundai-h1-square.jpg", width: 1200, height: 800 },
  "tesla-model-3": { src: "/fleet/tesla-model-3.jpg", square: "/fleet/tesla-model-3-square.jpg", width: 1200, height: 800 },
  mpv: { src: "/fleet/mpv.jpg", square: "/fleet/mpv-square.jpg", width: 1200, height: 800 },
}

export function fleetImage(handle: string | null | undefined) {
  return handle ? FLEET_IMAGES[handle] : undefined
}
