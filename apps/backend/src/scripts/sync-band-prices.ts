import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { ensurePricedVariant } from "../lib/pricing"
import { FARES, VEHICLES } from "./seed-fleet"

/**
 * Gives every vehicle a price for every band the fare table names.
 *
 *   npx medusa exec ./src/scripts/sync-band-prices.ts
 *
 * seed-fleet only prices a product it CREATES, and skips any it finds — fares
 * belong to the owner in the admin and a re-seed must never overwrite them.
 * That is right, and it leaves no way to add a band to a database already
 * seeded, which is what this is for: bands B, C and D were left unpriced
 * because the owner had not set them, so Lusail, Al Rayyan, Al Khor and Dukhan
 * could not be booked at all.
 *
 * It only ever ADDS. A band that already has a variant is reported and left
 * exactly as it is, price included, so this is safe to re-run and safe to run
 * after the owner has edited fares by hand.
 */
export default async function syncBandPrices({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  let created = 0
  let existing = 0

  for (const vehicle of VEHICLES) {
    for (const code of ["A", "B", "C", "D"] as const) {
      const amount = FARES[code][vehicle.key]
      if (amount === null || amount === undefined) continue

      const result = await ensurePricedVariant(container, vehicle.handle, code, amount)

      if (result === "created") {
        created++
        logger.info(`  ${vehicle.title} band ${code}: ${amount} QAR`)
      } else if (result === "exists") {
        existing++
      } else {
        logger.warn(`  ${vehicle.title} band ${code}: ${result}`)
      }
    }
  }

  logger.info(`bands: ${created} priced, ${existing} already had a price and were left alone`)
}
