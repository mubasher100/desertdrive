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
export const FLEET_IMAGES: Record<string, { src: string; width: number; height: number }> = {
  // "toyota-rush": { src: "/fleet/toyota-rush.jpg", width: 1200, height: 800 },
}

export function fleetImage(handle: string | null | undefined) {
  return handle ? FLEET_IMAGES[handle] : undefined
}
