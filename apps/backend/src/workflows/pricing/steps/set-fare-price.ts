import { MedusaError } from "@medusajs/framework/utils"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { qarFromUsd } from "../../../data/price-book"
import { setVariantPrice } from "../../../lib/pricing"
import { FARE_ZONE_MODULE } from "../../../modules/fare-zone"
import { FARE_BAND_MODULE } from "../../../modules/fare-band"
import { PRICE_TABLE_CLASSES } from "../../../lib/price-table"

export type SetFarePriceInput = { handle: string; code: string; usd: number }

/**
 * One cell of the owner's price table: this car, this area or band, this many
 * whole US dollars — stored as the exact riyal equivalent, as everywhere else.
 * Creates the variant if the car has no price there yet.
 */
export const setFarePriceStep = createStep("set-fare-price", async (input: SetFarePriceInput, { container }) => {
  /**
   * Only a real car and a real area or band. setVariantPrice would otherwise
   * create a brand-new pricing code for anything typed into a request — a
   * variant nothing can ever quote, cluttering the catalogue for good.
   */
  if (!PRICE_TABLE_CLASSES.some((c) => c.handle === input.handle)) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unknown vehicle class "${input.handle}".`)
  }
  const zones = container.resolve(FARE_ZONE_MODULE) as { listFareZones: (f: object) => Promise<unknown[]> }
  const bands = container.resolve(FARE_BAND_MODULE) as { listFareBands: (f: object) => Promise<unknown[]> }
  const [zone] = await zones.listFareZones({ code: input.code })
  const [band] = zone ? [null] : await bands.listFareBands({ code: input.code })
  if (!zone && !band) {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Unknown area or band "${input.code}".`)
  }

  const qar = qarFromUsd(input.usd)
  const result = await setVariantPrice(container, input.handle, input.code, qar)
  if (result === "no-product" || result === "no-option" || result === "failed") {
    throw new MedusaError(MedusaError.Types.INVALID_DATA, `Could not price ${input.handle} in ${input.code} (${result}).`)
  }
  return new StepResponse({ ...input, qar, result })
})
