import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { FARE_ZONE_MODULE } from "../modules/fare-zone"
import { createFareZoneWorkflow } from "../workflows/zones/create-fare-zone"
import { updateFareZoneWorkflow } from "../workflows/zones/update-fare-zone"
import { BAND_TIERS, PRICE_BOOK_VERSION, qarFromUsd, ZONES, type VehicleClass } from "../data/price-book"
import { setVariantPrice, type SetPriceResult } from "../lib/pricing"
import seedFleet from "./seed-fleet"
import syncVehicleStatus from "./sync-vehicle-status"

const CLASSES: VehicleClass[] = ["sedan", "suv", "large-van", "luxury-sedan", "luxury-van"]

/** The $5 extras. Their single variant's option value is "Standard". */
const ADD_ONS: Array<[handle: string, usd: number]> = [
  ["child-seat", 5],
  ["meet-and-greet", 5],
]

type FareZoneService = {
  listFareZones: (filters: object) => Promise<Array<{ id: string; code: string }>>
}

/**
 * Applies the price book: the named areas, every class's price in every area
 * and band, and the add-ons — all at whole-dollar prices.
 *
 * Normally run ONCE by jobs/apply-price-book.ts, which records the version so
 * it never runs again and the admin keeps ownership of every price. Runnable
 * by hand too:  npx medusa exec ./src/scripts/apply-price-book.ts
 *
 * Idempotent: an area that exists is re-drawn to the book's outline, a price
 * already right is left alone, and anything missing — the Sedan product, the
 * add-ons, a band — is created first by seed-fleet, which only ever adds.
 */
export async function applyPriceBook(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  logger.info(`price book ${PRICE_BOOK_VERSION}: applying`)

  // 1 · Anything missing: bands, the Sedan product, the add-on products.
  await seedFleet({ container, args: [] } as unknown as ExecArgs)

  // 1b · Exactly the five classes on sale: retired model-named products
  //      drafted, the Sedan published. Already true in production since 26
  //      Sept; asserted here so a new price list can never revive a retired car.
  await syncVehicleStatus({ container, args: [] } as unknown as ExecArgs)

  // 2 · The named areas.
  const zones = container.resolve(FARE_ZONE_MODULE) as FareZoneService
  for (const z of ZONES) {
    const [existing] = await zones.listFareZones({ code: z.code })
    const shape = { name_en: z.name_en, name_ar: z.name_ar, polygon: z.polygon, rank: z.rank, active: true }
    if (existing) {
      await updateFareZoneWorkflow(container).run({ input: { id: existing.id, ...shape } })
    } else {
      await createFareZoneWorkflow(container).run({ input: { code: z.code, ...shape } })
    }
  }
  logger.info(`price book: ${ZONES.length} areas drawn`)

  // 3 · Every class, in every area and band.
  const tally: Record<SetPriceResult, number> = { created: 0, updated: 0, unchanged: 0, "no-product": 0, "no-option": 0, failed: 0 }
  const priced: Array<[code: string, tier: Record<VehicleClass, number>]> = [
    ...ZONES.map((z) => [z.code, z.tier] as [string, Record<VehicleClass, number>]),
    ...(Object.entries(BAND_TIERS) as Array<[string, Record<VehicleClass, number>]>),
  ]
  for (const [code, tier] of priced) {
    for (const cls of CLASSES) {
      const result = await setVariantPrice(container, cls, code, qarFromUsd(tier[cls]))
      tally[result]++
      if (result === "no-product" || result === "no-option" || result === "failed") {
        logger.warn(`price book: ${cls} / ${code} — ${result}`)
      }
    }
  }

  // 4 · The extras, at exactly $5.
  for (const [handle, usd] of ADD_ONS) {
    tally[await setVariantPrice(container, handle, "Standard", qarFromUsd(usd))]++
  }

  logger.info(`price book ${PRICE_BOOK_VERSION}: ${JSON.stringify(tally)}`)
  return tally
}

export default async function run({ container }: ExecArgs) {
  await applyPriceBook(container)
}
