import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
  QueryContext,
} from "@medusajs/framework/utils"
import type {
  IRegionModuleService,
  RemoteQueryFunction,
} from "@medusajs/framework/types"
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"

type IQueryModule = Omit<RemoteQueryFunction, symbol>

/**
 * `calculated_price` is computed by the pricing context passed to query.graph,
 * so it is absent from the base ProductVariant type. Only the fields actually
 * read are declared.
 */
type PricedVariant = {
  id: string
  options?: Array<{ value?: string; option?: { title?: string } }>
  calculated_price?: { calculated_amount?: number }
}

const DISTANCE_BAND_OPTION = "Distance band"
const CURRENCY = "qar"

export type ListBandVehiclesInput = {
  band_code: string
  passengers: number
  luggage: number
}

export type QuotedVehicle = {
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
}

/** Product metadata is untyped JSON; capacity drives which vehicles are offered. */
function readCapacity(metadata: Record<string, unknown> | null, key: string) {
  const raw = metadata?.[key]
  const value = typeof raw === "string" ? Number(raw) : raw
  return typeof value === "number" && Number.isFinite(value) ? value : null
}

/**
 * Lists the vehicle classes that can serve this band and party size, priced.
 *
 * Read-only, so no compensation. It resolves the region itself because pricing
 * cannot be calculated without one — `calculated_price` comes back empty
 * otherwise, which reads as "no price" rather than as a configuration error.
 */
export const listBandVehiclesStep = createStep(
  "list-band-vehicles",
  async (input: ListBandVehiclesInput, { container }) => {
    // The step container is loosely typed, so these are narrowed explicitly.
    const query = container.resolve(
      ContainerRegistrationKeys.QUERY
    ) as IQueryModule
    const regionService = container.resolve(
      Modules.REGION
    ) as IRegionModuleService

    const [region] = await regionService.listRegions({
      currency_code: CURRENCY,
    })

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
        "thumbnail",
        "metadata",
        "variants.id",
        "variants.title",
        "variants.metadata",
        "variants.options.value",
        "variants.options.option.title",
        "variants.calculated_price.*",
      ],
      filters: { status: "published" },
      context: {
        variants: {
          // Without a region and currency, calculated_price comes back empty
          // and every vehicle silently drops out of the results.
          calculated_price: QueryContext({
            region_id: region.id,
            currency_code: CURRENCY,
          }),
        },
      },
    })

    const vehicles: QuotedVehicle[] = []

    for (const product of products ?? []) {
      const metadata = (product.metadata ?? null) as Record<
        string,
        unknown
      > | null

      // Add-ons live in the same catalogue but are never a vehicle choice.
      if (metadata?.add_on) {
        continue
      }

      const passengers = readCapacity(metadata, "passengers")
      const luggage = readCapacity(metadata, "luggage")

      // A product with no declared capacity is not a vehicle class.
      if (passengers === null || luggage === null) {
        continue
      }

      /**
       * Capacity filter. A booking for 5 passengers must not be offered the
       * Sedan — the customer would arrive to a car their party cannot fit in.
       */
      if (passengers < input.passengers || luggage < input.luggage) {
        continue
      }

      /**
       * The variant whose `Distance band` option equals this band's code. This
       * shared identifier is the whole join between the fareBand module and the
       * product catalogue.
       */
      const variants = (product.variants ?? []) as PricedVariant[]

      const variant = variants.find((v) =>
        (v.options ?? []).some(
          (o) =>
            o?.option?.title === DISTANCE_BAND_OPTION &&
            o?.value === input.band_code
        )
      )

      if (!variant) {
        continue
      }

      const amount = variant.calculated_price?.calculated_amount

      /**
       * A variant with no price for this region is not quotable. This is the
       * expected state for bands the owner has not priced yet, and it is why an
       * unpriced band returns an empty list rather than a made-up number.
       */
      if (typeof amount !== "number") {
        continue
      }

      vehicles.push({
        product_id: product.id,
        variant_id: variant.id,
        handle: product.handle,
        title: product.title,
        title_ar: (metadata?.title_ar as string) ?? null,
        description: product.description ?? null,
        thumbnail: product.thumbnail ?? null,
        passengers,
        luggage,
        // Stored and returned as-is. 40 QAR is 40, never 4000.
        amount,
        currency_code: CURRENCY,
      })
    }

    // Cheapest first — the results page leads with the cheapest valid option.
    vehicles.sort((a, b) => a.amount - b.amount)

    return new StepResponse<QuotedVehicle[]>(vehicles)
  }
)
