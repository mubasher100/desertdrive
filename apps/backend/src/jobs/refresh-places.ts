import type { MedusaContainer } from "@medusajs/framework/types"
import importPlaces from "../scripts/import-places"

/**
 * Refreshes the place index from OpenStreetMap.
 *
 * Weekly, because that is how fast a country's hotels and districts change,
 * and because the free Overpass servers this leans on should be asked no more
 * often than the data warrants. A failed run leaves the previous index in
 * place and search carries on.
 */
export default async function refreshPlaces(container: MedusaContainer) {
  await importPlaces({ container, args: [] } as Parameters<typeof importPlaces>[0])
}

export const config = {
  name: "refresh-place-index",
  // 03:00 UTC on Sunday: quiet for Qatar, and quiet for Overpass.
  schedule: "0 3 * * 0",
}
