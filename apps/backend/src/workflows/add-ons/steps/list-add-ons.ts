import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  QueryContext,
} from "@medusajs/framework/utils"
import type { IRegionModuleService, RemoteQueryFunction } from "@medusajs/framework/types"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

type IQueryModule = Omit<RemoteQueryFunction, symbol>

/** `calculated_price` comes from the pricing context, so it is not on the base type. */
type PricedVariant = {
  id: string
  calculated_price?: { calculated_amount?: number }
}

const CURRENCY = "qar"

export type AddOn = {
  product_id: string
  variant_id: string
  handle: string
  title: string
  title_ar: string | null
  description: string | null
  description_ar: string | null
  /** QAR, stored and returned as-is. 18 QAR is 18, never 1800. */
  amount: number
  currency_code: string
  /** How many of this add-on one booking may take. */
  max: number
}

/** Metadata is untyped JSON. */
function str(metadata: Record<string, unknown> | null, key: string): string | null {
  const v = metadata?.[key]
  return typeof v === "string" && v.trim() ? v : null
}

/**
 * The add-ons a customer can put on a booking, priced.
 *
 * Add-ons are ordinary single-variant products flagged `add_on: true` on
 * metadata — the same catalogue, the same admin screen, the same "the owner
 * changes a price and it is live within the cache window" as the vehicles.
 *
 * ⚠️ An add-on with no price for this region is NOT returned. That is the
 * expected state for one the owner has not priced yet, and it is the whole
 * mechanism for taking an add-on off sale: clear the price and it stops being
 * offered, with no code change and no deploy. It is also why an unpriced
 * add-on falls through silently rather than appearing at zero.
 *
 * Read-only, so no compensation.
 */
export const listAddOnsStep = createStep(
  "list-add-ons",
  async (_input: Record<string, never>, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY) as IQueryModule
    const regionService = container.resolve(Modules.REGION) as IRegionModuleService

    const [region] = await regionService.listRegions({ currency_code: CURRENCY })

    if (!region) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "No QAR region is configured. Run: npx medusa exec ./src/scripts/seed-qatar.ts"
      )
    }

    const { data: products } = await query.graph({
      entity: "product",
      fields: [
        "id",
        "handle",
        "title",
        "description",
        "metadata",
        "variants.id",
        "variants.calculated_price.*",
      ],
      filters: { status: "published" },
      context: {
        variants: {
          // Without a region and currency this comes back empty and every
          // add-on silently drops out.
          calculated_price: QueryContext({ region_id: region.id, currency_code: CURRENCY }),
        },
      },
    })

    const addOns: AddOn[] = []

    for (const product of products ?? []) {
      const metadata = (product.metadata ?? null) as Record<string, unknown> | null

      if (!metadata?.add_on) {
        continue
      }

      // One variant, by construction — an add-on has no options.
      const variant = ((product.variants ?? []) as PricedVariant[])[0]
      const amount = variant?.calculated_price?.calculated_amount

      if (!variant || typeof amount !== "number") {
        continue
      }

      const rawMax = Number(metadata.max_quantity)

      addOns.push({
        product_id: product.id,
        variant_id: variant.id,
        handle: product.handle,
        title: product.title,
        title_ar: str(metadata, "title_ar"),
        description: product.description ?? null,
        description_ar: str(metadata, "description_ar"),
        amount,
        currency_code: CURRENCY,
        // A cap the owner can raise per add-on; 4 is a sane default for a car.
        max: Number.isFinite(rawMax) && rawMax > 0 ? Math.floor(rawMax) : 4,
      })
    }

    // Cheapest first, then by name, so the order is stable between requests.
    addOns.sort((a, b) => a.amount - b.amount || a.title.localeCompare(b.title))

    return new StepResponse<AddOn[]>(addOns)
  }
)
