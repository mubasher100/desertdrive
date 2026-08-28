import { ExecArgs } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  Modules,
  ProductStatus,
} from "@medusajs/framework/utils"
import { createProductsWorkflow } from "@medusajs/medusa/core-flows"
import { FARE_BAND_MODULE } from "../modules/fare-band"

/**
 * Fare bands, vehicle products and add-ons.
 *
 * IDEMPOTENT — safe to re-run. Run seed-qatar.ts first; this needs the region,
 * currency and shipping profile it creates.
 *
 *   npx medusa exec ./src/scripts/seed-fleet.ts
 *
 * ---------------------------------------------------------------------------
 * HOW PRICING WORKS, AND WHY IT IS SHAPED LIKE THIS
 * ---------------------------------------------------------------------------
 * Each vehicle class is a PRODUCT with a single option, `Distance band`. Each
 * distance band is a VARIANT of that product, carrying a real QAR price.
 *
 * That is the whole point of the design: the owner edits a fare in the Medusa
 * admin and it is live within the cache window. No code, no deploy, no
 * migration. Do not replace this with hard-coded prices, a config file, or a
 * custom pricing engine.
 *
 * The variant's `Distance band` option value is the SAME string as the FareBand
 * `code`. That single shared identifier is what turns "resolve km to a price"
 * into an ordinary product query.
 */

// ---------------------------------------------------------------------------
// THE ONLY TABLE YOU NEED TO EDIT
//
// Band A is confirmed by the owner. B, C and D are not yet supplied.
//
// A band whose price is `null` is SKIPPED: no variant is created, so no customer
// can ever be quoted a made-up fare. Fill in a number and re-run — that is the
// entire change. Nothing else in this file needs touching.
// ---------------------------------------------------------------------------
type BandCode = "A" | "B" | "C" | "D"
type VehicleKey = "sedan" | "suv" | "minivan"

const FARES: Record<BandCode, Record<VehicleKey, number | null>> = {
  A: { sedan: 40, suv: 65, minivan: 80 },
  B: { sedan: null, suv: null, minivan: null },
  C: { sedan: null, suv: null, minivan: null },
  D: { sedan: null, suv: null, minivan: null },
}

/** Prices for the add-on products. Same rule: `null` means do not create it. */
const ADD_ON_PRICES: Record<string, number | null> = {
  "child-seat": null,
  "extra-waiting-hour": null,
  "meet-and-greet": null,
  "extra-luggage": null,
}

// ---------------------------------------------------------------------------
// Distance bands
//
// Bounds are STRAIGHT-LINE km from Hamad International, not road km. Haversine
// runs roughly 20-30% short of the road, so these are already set low to
// compensate: a 25 km road trip is about 20 km as the crow flies.
//
// Measured straight-line distances, for reference:
//   Souq Waqif 7.7 · West Bay 9.4 · Al Wakrah 11.9 · Education City 17.8
//   Lusail Marina 19.3 · Mesaieed 31.8 · Al Khor 47.0 · Ras Laffan 70.0
//   Dukhan 84.5 · Al Zubarah 97.9
//
// These are pinned in src/lib/__tests__/geo.unit.spec.ts, so moving a bound here
// without updating that test turns CI red and names the destination that changed
// price. That is intentional.
//
// Arabic names below need a NATIVE REVIEWER before launch.
// ---------------------------------------------------------------------------
const FARE_BANDS: Array<{
  code: BandCode
  name_en: string
  name_ar: string
  max_km: number | null
  rank: number
}> = [
  {
    code: "A",
    name_en: "Doha & central",
    name_ar: "الدوحة والمناطق المركزية",
    max_km: 20,
    rank: 1,
  },
  {
    code: "B",
    name_en: "Greater Doha",
    name_ar: "الدوحة الكبرى",
    max_km: 40,
    rank: 2,
  },
  {
    code: "C",
    name_en: "Northern & southern Qatar",
    name_ar: "شمال وجنوب قطر",
    max_km: 75,
    rank: 3,
  },
  {
    // Unbounded catch-all. Exactly one band must have max_km: null, and it must
    // sort last — without it, a far destination resolves to no band at all.
    code: "D",
    name_en: "Far north & west",
    name_ar: "أقصى الشمال والغرب",
    max_km: null,
    rank: 4,
  },
]

// ---------------------------------------------------------------------------
// Vehicle classes
//
// Passenger and luggage capacity live on product metadata and drive the results
// page: a booking for 5 passengers hides the Sedan.
//
// Exact models and real capacities are still to be confirmed by the owner.
// ---------------------------------------------------------------------------
const VEHICLES: Array<{
  key: VehicleKey
  handle: string
  title: string
  title_ar: string
  description: string
  passengers: number
  luggage: number
}> = [
  {
    key: "sedan",
    handle: "sedan",
    title: "Sedan (with driver)",
    title_ar: "سيدان مع سائق",
    description:
      "A comfortable saloon for up to 3 passengers with 2 bags. The everyday airport transfer.",
    passengers: 3,
    luggage: 2,
  },
  {
    key: "suv",
    handle: "large-suv",
    title: "Large SUV (with driver)",
    title_ar: "دفع رباعي كبير مع سائق",
    description:
      "Extra space for up to 6 passengers with 4 bags. Suits families and small groups.",
    passengers: 6,
    luggage: 4,
  },
  {
    key: "minivan",
    handle: "minivan",
    title: "Minivan (with driver)",
    title_ar: "ميني فان مع سائق",
    description:
      "The largest vehicle, for up to 7 passengers with 6 bags. Built for group arrivals.",
    passengers: 7,
    luggage: 6,
  },
]

const ADD_ONS: Array<{
  handle: string
  title: string
  title_ar: string
  description: string
}> = [
  {
    handle: "child-seat",
    title: "Child seat",
    title_ar: "مقعد أطفال",
    description: "A fitted child seat, supplied and installed by the driver.",
  },
  {
    handle: "extra-waiting-hour",
    title: "Extra waiting hour",
    title_ar: "ساعة انتظار إضافية",
    description:
      "One additional hour of driver waiting time beyond the free allowance.",
  },
  {
    handle: "meet-and-greet",
    title: "Meet & greet sign",
    title_ar: "لافتة استقبال",
    description:
      "The driver waits in arrivals holding a name sign, rather than at the kerb.",
  },
  {
    handle: "extra-luggage",
    title: "Extra luggage",
    title_ar: "أمتعة إضافية",
    description: "One additional bag beyond the vehicle's stated capacity.",
  },
]

const CURRENCY = "qar"
const DISTANCE_BAND_OPTION = "Distance band"

export default async function seedFleet({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const fareBandService: any = container.resolve(FARE_BAND_MODULE)
  const productService = container.resolve(Modules.PRODUCT)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)

  const [salesChannel] = await salesChannelService.listSalesChannels({
    name: "Desert Drive",
  })
  if (!salesChannel) {
    throw new Error(
      'No "Desert Drive" sales channel. Run seed-qatar.ts first:\n' +
        "  npx medusa exec ./src/scripts/seed-qatar.ts"
    )
  }

  const [shippingProfile] = await fulfillmentService.listShippingProfiles({
    type: "default",
  })
  if (!shippingProfile) {
    throw new Error(
      "No default shipping profile. Run seed-qatar.ts first:\n" +
        "  npx medusa exec ./src/scripts/seed-qatar.ts"
    )
  }

  // -------------------------------------------------------------------------
  // Fare bands
  //
  // ALL four are created regardless of pricing. The band table is what resolves
  // a destination; a band with no priced variants simply produces no quote,
  // which is the correct behaviour for "we have not set that fare yet".
  // -------------------------------------------------------------------------
  logger.info("Fare bands...")
  for (const band of FARE_BANDS) {
    const [existing] = await fareBandService.listFareBands({ code: band.code })

    if (existing) {
      await fareBandService.updateFareBands({
        id: existing.id,
        ...band,
      })
      logger.info(`  band ${band.code} updated (${band.name_en})`)
    } else {
      await fareBandService.createFareBands(band)
      logger.info(`  band ${band.code} created (${band.name_en})`)
    }
  }

  // -------------------------------------------------------------------------
  // Vehicle products
  // -------------------------------------------------------------------------
  logger.info("Vehicle classes...")
  const missing: string[] = []

  for (const vehicle of VEHICLES) {
    const pricedBands = FARE_BANDS.filter(
      (band) => typeof FARES[band.code][vehicle.key] === "number"
    )

    for (const band of FARE_BANDS) {
      if (typeof FARES[band.code][vehicle.key] !== "number") {
        missing.push(`${vehicle.title} / band ${band.code}`)
      }
    }

    if (!pricedBands.length) {
      logger.warn(`  ${vehicle.title}: no priced bands, skipped entirely`)
      continue
    }

    const [existing] = await productService.listProducts({
      handle: vehicle.handle,
    })

    if (existing) {
      logger.info(
        `  ${vehicle.title} already exists — leaving prices alone. ` +
          "Edit fares in the admin, not here."
      )
      continue
    }

    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: vehicle.title,
            handle: vehicle.handle,
            description: vehicle.description,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            sales_channels: [{ id: salesChannel.id }],
            /**
             * Capacity drives the results page: a booking for 5 passengers must
             * not be offered the Sedan. Stored as numbers, read server-side.
             */
            metadata: {
              vehicle_key: vehicle.key,
              passengers: vehicle.passengers,
              luggage: vehicle.luggage,
              // Interface copy is translated in the storefront dictionary; the
              // catalogue is translated here.
              title_ar: vehicle.title_ar,
            },
            options: [
              {
                title: DISTANCE_BAND_OPTION,
                values: pricedBands.map((b) => b.code),
              },
            ],
            variants: pricedBands.map((band) => ({
              title: `Band ${band.code} — ${band.name_en}`,
              // Nothing is stocked. A driver is dispatched, not a unit shipped.
              manage_inventory: false,
              allow_backorder: false,
              options: { [DISTANCE_BAND_OPTION]: band.code },
              metadata: { band_code: band.code, band_name_ar: band.name_ar },
              /**
               * Stored as-is. 40 QAR is the number 40 — never 4000. Medusa does
               * not use minor units here.
               */
              prices: [
                {
                  currency_code: CURRENCY,
                  amount: FARES[band.code][vehicle.key] as number,
                },
              ],
            })),
          },
        ],
      },
    })

    logger.info(
      `  ${vehicle.title} created with ${pricedBands.length} band variant(s): ` +
        pricedBands.map((b) => b.code).join(", ")
    )
  }

  // -------------------------------------------------------------------------
  // Add-ons — separate single-variant products, added to the same cart.
  // -------------------------------------------------------------------------
  logger.info("Add-ons...")
  for (const addOn of ADD_ONS) {
    const price = ADD_ON_PRICES[addOn.handle]

    if (typeof price !== "number") {
      missing.push(`Add-on: ${addOn.title}`)
      logger.warn(`  ${addOn.title}: no price set, skipped`)
      continue
    }

    const [existing] = await productService.listProducts({
      handle: addOn.handle,
    })

    if (existing) {
      logger.info(`  ${addOn.title} already exists`)
      continue
    }

    await createProductsWorkflow(container).run({
      input: {
        products: [
          {
            title: addOn.title,
            handle: addOn.handle,
            description: addOn.description,
            status: ProductStatus.PUBLISHED,
            shipping_profile_id: shippingProfile.id,
            sales_channels: [{ id: salesChannel.id }],
            metadata: { add_on: true, title_ar: addOn.title_ar },
            options: [{ title: "Type", values: ["Standard"] }],
            variants: [
              {
                title: addOn.title,
                manage_inventory: false,
                allow_backorder: false,
                options: { Type: "Standard" },
                prices: [{ currency_code: CURRENCY, amount: price }],
              },
            ],
          },
        ],
      },
    })

    logger.info(`  ${addOn.title} created at ${price} QAR`)
  }

  // -------------------------------------------------------------------------
  const rule = "-".repeat(72)
  logger.info("")
  logger.info(rule)

  if (missing.length) {
    logger.warn("FLEET SEEDED WITH GAPS — this store cannot quote every trip.")
    logger.warn("")
    logger.warn("No price supplied, so nothing was created for:")
    for (const item of missing) {
      logger.warn(`  - ${item}`)
    }
    logger.warn("")
    logger.warn("A trip resolving to an unpriced band returns NO quote. That is")
    logger.warn("deliberate: showing an invented fare is worse than showing none.")
    logger.warn("")
    logger.warn("Fill in FARES / ADD_ON_PRICES at the top of this file and re-run.")
  } else {
    logger.info("Fleet seeded. Every band and add-on is priced.")
  }

  logger.info("")
  logger.info("Fares are now editable in the admin: Products > variant > prices.")
  logger.info("Changing one there needs no code change and no deploy.")
  logger.info(rule)
}
