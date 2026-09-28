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
/**
 * Classes, not models.
 *
 * The owner's cars change — a Rush this month, something else next — so the
 * catalogue names the CLASS a customer books and never the model that turns
 * up (owner, 28 Sept 2026). This replaces an earlier line-up that used model
 * names; those products are drafted rather than deleted so their orders and
 * price history survive.
 */
type VehicleKey =
  | "sedan"
  | "suv"
  | "large-van"
  | "luxury-van"
  | "luxury-sedan"
  | "test-booking"
  // Retired model-named products, kept as drafts so their orders survive.
  | "toyota-rush"
  | "mpv"
  | "toyota-hiace"
  | "hyundai-h1"
  | "tesla-model-3"

/**
 * The fare table. Band A is the owner's published catalogue; B, C and D are
 * scaled from it using a COMPETITOR'S distance curve, not their price level.
 *
 * Where the shape comes from: five Booking.com quotes the owner pulled on
 * 26 Sept 2026 (one-way, 3 passengers, HIA to West Bay, Souq Al Wakra, Lusail
 * Marina, Al Khor and Dukhan). Their absolute prices are NOT copied — the
 * owner's instruction was to keep the catalogue — only the ratio between a
 * short trip and a long one, per vehicle class.
 *
 * ⚠️ Booking.com's prices are not a function of distance and must not be fitted
 * as one. In that sample Al Khor (58 km) cost MORE than Dukhan (90 km) — 291
 * against 204 QAR — and their Minibus was 1,889 QAR to Al Khor against 302 to
 * Dukhan, six times the price for a longer trip. Every page says "we'll assign
 * a local journey provider": those are marketplace bids from different
 * operators, not a rate card. Al Khor is therefore excluded as an outlier and
 * C is interpolated between B and D.
 *
 * The ratios that survived (A = Al Wakra/West Bay, B = Lusail, D = Dukhan):
 *
 *            B/A    D/A     note
 *   Rush     1.03   3.40    small car, cost is mostly the kilometres
 *   MPV      1.22   3.27
 *   H1       1.08   2.04
 *   Hiace    1.18   1.70    big van, cost is mostly the vehicle
 *
 * ⚠️ TWO THINGS FOR THE OWNER:
 *   1. Band A stays at the catalogue, which is ~65% above Booking.com's
 *      equivalent (100 vs 60 QAR for the smallest car). That gap carries into
 *      every band. It is a positioning choice — direct booking against a
 *      marketplace — not an oversight.
 *   2. The H1 costs more than the Hiace at every band (200 vs 180 in the
 *      catalogue), so a 7-seater is dearer than a 12-seater. That comes
 *      straight from the catalogue and reads oddly on the results page.
 *
 * Prices are the owner's to change in the admin. This table is what a FRESH
 * database gets seeded with; it does not overwrite anything already priced.
 */
export const FARES: Record<BandCode, Record<VehicleKey, number | null>> = {
  //            ── the five classes on sale ──        ── retired, kept for their drafts ──
  A: { "test-booking": 1, sedan: null, suv: 100, "large-van": 180, "luxury-van": 200, "luxury-sedan": 300,
       "toyota-rush": 100, mpv: 120, "toyota-hiace": 180, "hyundai-h1": 200, "tesla-model-3": 300 },
  B: { "test-booking": 1, sedan: null, suv: 105, "large-van": 210, "luxury-van": 215, "luxury-sedan": 315,
       "toyota-rush": 105, mpv: 145, "toyota-hiace": 210, "hyundai-h1": 215, "tesla-model-3": null },
  C: { "test-booking": 1, sedan: null, suv: 240, "large-van": 265, "luxury-van": 330, "luxury-sedan": 720,
       "toyota-rush": 240, mpv: 285, "toyota-hiace": 265, "hyundai-h1": 330, "tesla-model-3": null },
  D: { "test-booking": 1, sedan: null, suv: 340, "large-van": 305, "luxury-van": 410, "luxury-sedan": 1020,
       "toyota-rush": 340, mpv: 390, "toyota-hiace": 305, "hyundai-h1": 410, "tesla-model-3": null },
}

/**
 * Prices for the add-on products, in QAR. `null` means do not create it — an
 * unpriced add-on is never offered, which is also how one is taken off sale.
 *
 * ⚠️ 18 QAR is the owner's "child seat additional 5$" (27 Sept 2026), converted
 * at the peg. The exact conversion is 18.20, and the site would then display a
 * clean $5.00 — but it would also print totals like "118.2 QAR", and the riyal
 * is the currency actually charged. 18 displays as $4.95: within a nickel of
 * what the owner said, never above it, and a whole riyal. Set 18.2 here if an
 * exact $5.00 matters more than a round riyal price.
 */
const ADD_ON_PRICES: Record<string, number | null> = {
  "child-seat": 18,
  "extra-waiting-hour": null,
  // Same 18 QAR as the child seat — the owner's call, 28 Sept 2026.
  "meet-and-greet": 18,
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
    /**
     * 18.5, not 20.
     *
     * At 20 km, Lusail Marina (19.3) fell inside band A with only 0.7 km to
     * spare, while northern Lusail fell outside it — so two addresses a customer
     * would both call "Lusail" priced differently, for no reason they could see.
     * The owner's call was to put Lusail in band B rather than absorb it.
     *
     * 18.5 is chosen rather than 18 or 19 because Education City (17.8) and
     * Lusail Marina (19.3) are only 1.5 km apart: any boundary between them is
     * tight by construction, and 18.5 leaves the most room on both sides
     * (0.7 km and 0.8 km respectively).
     *
     * This is still calibrated against straight-line distance. Real road
     * distances for these two would settle it properly.
     */
    code: "A",
    name_en: "Doha & central",
    name_ar: "الدوحة والمناطق المركزية",
    max_km: 18.5,
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
// The fleet — the owner's actual vehicles, from the WhatsApp Business catalogue.
//
// Passenger and luggage capacity drive the results page: a booking for 5
// passengers hides the Tesla and the Rush. The numbers below are sensible
// defaults for each model and are ⚠️ TO BE CONFIRMED by the owner — a Hiace
// configured with 10 seats and one with 14 are different offers.
//
// Photography: the storefront looks for /fleet/<handle>.jpg — see
// apps/storefront/src/lib/data/fleet-images.ts.
//
// Arabic names need a native reviewer before launch.
// ---------------------------------------------------------------------------
export const VEHICLES: Array<{
  key: VehicleKey
  handle: string
  title: string
  title_ar: string
  description: string
  description_ar: string
  passengers: number
  luggage: number
  /** How many of this vehicle exist. Owner-confirmable; defaults to one. */
  units?: number
  /**
   * Whether this vehicle is on sale right now.
   *
   * A vehicle that is not offered is created (or updated) as a DRAFT rather
   * than deleted: the product, its variants, its prices and any orders that
   * reference it all survive, and putting it back on sale is a one-word
   * change. Deleting would take the order history with it.
   *
   * Defaults to true — only say `offered: false` to take something off sale.
   */
  offered?: boolean
  /**
   * Hidden from customers unless the caller proves TEST_BOOKING_KEY. Written
   * to product metadata; the quote step is what enforces it.
   */
  test_only?: boolean
}> = [
  {
    /**
     * A 1 QAR vehicle for proving a real card end to end.
     *
     * It goes through the SAME funnel a customer does — cart, SkipCash, the
     * webhook, the confirmation email — because a test that takes a different
     * path proves nothing about the path that takes money.
     *
     * ⚠️ It is PUBLISHED, and that is deliberate: a draft product cannot be
     * bought, so a draft would not exercise checkout. What keeps it away from
     * customers is `test_only` plus TEST_BOOKING_KEY — the quote step drops it
     * unless the caller proved the key. Do not rely on it being unlisted; a
     * customer offered a 1 QAR airport transfer will book it.
     *
     * Capacity is deliberately large so it appears whatever party size the
     * owner tests with.
     */
    key: "test-booking",
    handle: "test-booking",
    title: "Test booking (1 QAR)",
    title_ar: "حجز تجريبي (1 ر.ق)",
    description: "Internal test vehicle. Not for customers.",
    description_ar: "مركبة اختبار داخلية. ليست للعملاء.",
    passengers: 16,
    luggage: 20,
    test_only: true,
  },
  {
    key: "sedan",
    handle: "sedan",
    title: "Sedan",
    title_ar: "سيدان",
    description: "A comfortable saloon for up to 3 passengers with 2 bags. Our most affordable transfer.",
    description_ar: "سيارة سيدان مريحة تتسع حتى 3 ركاب وحقيبتين. خيارنا الأوفر.",
    passengers: 3,
    luggage: 2,
  },
  {
    key: "suv",
    handle: "suv",
    title: "SUV",
    title_ar: "سيارة دفع رباعي",
    description: "A compact SUV for up to 4 passengers with 3 bags. More room for luggage.",
    description_ar: "سيارة دفع رباعي مدمجة تتسع حتى 4 ركاب و3 حقائب. مساحة أكبر للأمتعة.",
    passengers: 4,
    luggage: 3,
  },
  {
    key: "large-van",
    handle: "large-van",
    title: "Large van",
    title_ar: "فان كبير",
    description: "Our largest vehicle: up to 12 passengers with 12 bags. Built for group arrivals.",
    description_ar: "أكبر سياراتنا: حتى 12 راكبًا و12 حقيبة. مثالية لوصول المجموعات.",
    passengers: 12,
    luggage: 12,
  },
  {
    /** A Mercedes V-Class in practice (owner, 28 Sept 2026), but the class is what sells. */
    key: "luxury-van",
    handle: "luxury-van",
    title: "Luxury van",
    title_ar: "فان فاخر",
    description: "A premium van for up to 7 passengers with 6 bags. Space and comfort together.",
    description_ar: "فان فاخر يتسع حتى 7 ركاب و6 حقائب. مساحة وراحة معًا.",
    passengers: 7,
    luggage: 6,
  },
  {
    /** A Mercedes S-Class in practice (owner, 28 Sept 2026 — it was a BMW until then), but the class is what sells. */
    key: "luxury-sedan",
    handle: "luxury-sedan",
    title: "Luxury sedan",
    title_ar: "سيدان فاخرة",
    description: "A premium saloon for up to 3 passengers with 2 bags. Arrive in style.",
    description_ar: "سيارة سيدان فاخرة تتسع حتى 3 ركاب وحقيبتين. وصول بأناقة.",
    passengers: 3,
    luggage: 2,
  },

  // --- Retired: named after a model, which the fleet does not guarantee. ---
  // Drafted rather than deleted, so their orders and price history survive.
  { offered: false, key: "toyota-rush", handle: "toyota-rush", title: "Toyota Rush", title_ar: "تويوتا راش", description: "Retired — replaced by the SUV class.", description_ar: "متوقفة — استُبدلت بفئة الدفع الرباعي.", passengers: 4, luggage: 3 },
  { offered: false, key: "mpv", handle: "mpv", title: "Family MPV", title_ar: "سيارة عائلية", description: "Retired — replaced by the Sedan and SUV classes.", description_ar: "متوقفة — استُبدلت بفئتي السيدان والدفع الرباعي.", passengers: 6, luggage: 4 },
  { offered: false, key: "hyundai-h1", handle: "hyundai-h1", title: "Hyundai H1", title_ar: "هيونداي H1", description: "Retired — replaced by the Luxury van class.", description_ar: "متوقفة — استُبدلت بفئة الفان الفاخر.", passengers: 7, luggage: 6 },
  { offered: false, key: "toyota-hiace", handle: "toyota-hiace", title: "Toyota Hiace", title_ar: "تويوتا هايس", description: "Retired — replaced by the Large van class.", description_ar: "متوقفة — استُبدلت بفئة الفان الكبير.", passengers: 12, luggage: 12 },
  { offered: false, key: "tesla-model-3", handle: "tesla-model-3", title: "Tesla Model 3", title_ar: "تسلا موديل 3", description: "Retired — replaced by the Luxury sedan class.", description_ar: "متوقفة — استُبدلت بفئة السيدان الفاخرة.", passengers: 3, luggage: 2 },
]

const ADD_ONS: Array<{
  handle: string
  title: string
  title_ar: string
  description: string
  description_ar: string
  /** How many of it one booking may take. Omitted means the API's default of 4. */
  max_quantity?: number
  /**
   * What the customer has to tell us for this add-on to be deliverable.
   *
   * "sign" collects the words to print on the board and, optionally, a picture
   * to print beside them. An add-on with no `collects` is just a quantity.
   */
  collects?: "sign"
}> = [
  {
    handle: "child-seat",
    title: "Child seat",
    title_ar: "مقعد أطفال",
    description: "A fitted child seat, supplied and installed by the driver.",
    description_ar: "مقعد أطفال يوفّره السائق ويركّبه لك.",
    // A car has a back seat. Three is already generous; the driver needs to
    // know the real number, not a number the form happened to allow.
    max_quantity: 3,
  },
  {
    handle: "extra-waiting-hour",
    title: "Extra waiting hour",
    title_ar: "ساعة انتظار إضافية",
    description:
      "One additional hour of driver waiting time beyond the free allowance.",
    description_ar: "ساعة انتظار إضافية للسائق بعد المدة المجانية.",
  },
  {
    handle: "meet-and-greet",
    title: "Meet & greet sign",
    title_ar: "لافتة استقبال",
    description:
      "The driver waits in arrivals holding a sign with whatever you write here, and a picture if you add one.",
    description_ar:
      "ينتظرك السائق في صالة الوصول حاملًا لافتة تحمل ما تكتبه هنا، مع صورة إن أضفتها.",
    max_quantity: 1,
    collects: "sign",
  },
  {
    handle: "extra-luggage",
    title: "Extra luggage",
    title_ar: "أمتعة إضافية",
    description: "One additional bag beyond the vehicle's stated capacity.",
    description_ar: "حقيبة إضافية واحدة تتجاوز السعة المعلنة للمركبة.",
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
            // A vehicle that is not offered exists as a draft: present in the
            // catalogue, absent from the storefront, one word from returning.
            status: vehicle.offered === false ? ProductStatus.DRAFT : ProductStatus.PUBLISHED,
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
              ...(vehicle.test_only ? { test_only: true } : {}),
              /**
               * How many of this car the owner actually runs. It is what the
               * availability check counts against, so a wrong number here
               * either turns customers away or double-books a driver.
               * Seeded at 1 — the honest default for a small fleet — and
               * editable in the admin without a deploy.
               */
              units: vehicle.units ?? 1,
              // Interface copy is translated in the storefront dictionary; the
              // catalogue is translated here.
              title_ar: vehicle.title_ar,
              description_ar: vehicle.description_ar,
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

  // Anything in the catalogue that looks like a vehicle but is not in VEHICLES
  // is reported. It is NOT deleted — a seed must never destroy the owner's
  // data — but a stale vehicle would keep appearing in results.
  const [allProducts] = await productService.listAndCountProducts({}, { take: 200 })
  const known = new Set(VEHICLES.map((v) => v.handle))
  for (const p of allProducts) {
    const meta = (p.metadata ?? {}) as Record<string, unknown>
    if (meta.vehicle_key && !known.has(p.handle ?? "")) {
      logger.warn(`  "${p.title}" (${p.handle}) is not in the current fleet — delete it in the admin if retired`)
    }
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
            metadata: {
              add_on: true,
              title_ar: addOn.title_ar,
              description_ar: addOn.description_ar,
              ...(addOn.max_quantity ? { max_quantity: addOn.max_quantity } : {}),
              ...(addOn.collects ? { collects: addOn.collects } : {}),
            },
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
    logger.info("")
    logger.warn("No price supplied, so nothing was created for:")
    for (const item of missing) {
      logger.warn(`  - ${item}`)
    }
    logger.info("")
    logger.warn("A trip resolving to an unpriced band returns NO quote. That is")
    logger.warn("deliberate: showing an invented fare is worse than showing none.")
    logger.info("")
    logger.warn("Fill in FARES / ADD_ON_PRICES at the top of this file and re-run.")
  } else {
    logger.info("Fleet seeded. Every band and add-on is priced.")
  }

  logger.info("")
  logger.info("Fares are now editable in the admin: Products > variant > prices.")
  logger.info("Changing one there needs no code change and no deploy.")
  logger.info(rule)
}
