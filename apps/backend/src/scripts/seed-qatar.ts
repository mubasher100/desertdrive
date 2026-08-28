import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createApiKeysWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createShippingOptionsWorkflow,
  createShippingProfilesWorkflow,
  createStockLocationsWorkflow,
  createTaxRegionsWorkflow,
  deleteRegionsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
  updateStoresWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Store configuration for Desert Drive: one region, one currency, no VAT, and the
 * zero-cost shipping option that Medusa's checkout will not complete without.
 *
 * IDEMPOTENT — safe to run as many times as you like. Every step checks for what
 * it is about to create.
 *
 *   npx medusa exec ./src/scripts/seed-qatar.ts
 *
 * This must NEVER be moved into src/migration-scripts/. Medusa records executed
 * migration scripts by FILENAME, and local dev runs the .ts while a production
 * build runs the compiled .js — different names, so it would re-run on every
 * single deploy and keep resurrecting whatever it creates. Seeds are invoked
 * explicitly with `medusa exec`, always.
 */

const SALES_CHANNEL_NAME = "Desert Drive"
const REGION_NAME = "Qatar"
const CURRENCY = "qar"
const COUNTRY = "qa"
const SERVICE_ZONE_NAME = "Qatar"
const FULFILLMENT_SET_NAME = "Desert Drive dispatch"
const NO_DELIVERY_OPTION = "No delivery"

export default async function seedQatar({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const link = container.resolve(ContainerRegistrationKeys.LINK)

  const storeService = container.resolve(Modules.STORE)
  const salesChannelService = container.resolve(Modules.SALES_CHANNEL)
  const regionService = container.resolve(Modules.REGION)
  const taxService = container.resolve(Modules.TAX)
  const fulfillmentService = container.resolve(Modules.FULFILLMENT)
  const stockLocationService = container.resolve(Modules.STOCK_LOCATION)
  const apiKeyService = container.resolve(Modules.API_KEY)

  const [store] = await storeService.listStores()
  if (!store) {
    throw new Error("No store found. Has `npx medusa db:migrate` been run?")
  }

  // -------------------------------------------------------------------------
  // Sales channel
  // -------------------------------------------------------------------------
  logger.info("Sales channel...")
  let [salesChannel] = await salesChannelService.listSalesChannels({
    name: SALES_CHANNEL_NAME,
  })

  if (!salesChannel) {
    const { result } = await createSalesChannelsWorkflow(container).run({
      input: { salesChannelsData: [{ name: SALES_CHANNEL_NAME }] },
    })
    salesChannel = result[0]
    logger.info(`  created "${SALES_CHANNEL_NAME}"`)
  } else {
    logger.info(`  "${SALES_CHANNEL_NAME}" already exists`)
  }

  // -------------------------------------------------------------------------
  // Currency: QAR only, and QAR is the default.
  //
  // Fares are stored as-is. A 40 QAR fare is the number 40 — Medusa does not use
  // minor units here, so never multiply or divide by 100.
  // -------------------------------------------------------------------------
  logger.info("Store currency...")
  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: {
        supported_currencies: [{ currency_code: CURRENCY, is_default: true }],
        default_sales_channel_id: salesChannel.id,
      },
    },
  })
  logger.info("  QAR set as the only supported currency")

  // -------------------------------------------------------------------------
  // Region: `qa` must be the ONLY region.
  //
  // The Medusa starter ships a Europe/EUR region. Left in place it appears in the
  // region switcher, splits the catalogue's prices across two currencies, and
  // lets checkout resolve to EUR. Delete it on every run — it comes back if
  // anyone ever runs the starter's own seed.
  // -------------------------------------------------------------------------
  logger.info("Region...")
  const allRegions = await regionService.listRegions({})
  const strays = allRegions.filter((r) => r.currency_code !== CURRENCY)

  if (strays.length) {
    await deleteRegionsWorkflow(container).run({
      input: { ids: strays.map((r) => r.id) },
    })
    logger.info(
      `  removed ${strays.length} non-QAR region(s): ${strays
        .map((r) => r.name)
        .join(", ")}`
    )
  }

  let [region] = await regionService.listRegions({ currency_code: CURRENCY })

  if (!region) {
    const { result } = await createRegionsWorkflow(container).run({
      input: {
        regions: [
          {
            name: REGION_NAME,
            currency_code: CURRENCY,
            countries: [COUNTRY],
            // Cash-to-driver is not a payment provider — it is the manual
            // provider with the order marked as awaiting cash. SkipCash gets
            // registered separately once its provider module lands.
            payment_providers: ["pp_system_default"],
          },
        ],
      },
    })
    region = result[0]
    logger.info(`  created "${REGION_NAME}" (${CURRENCY.toUpperCase()})`)
  } else {
    logger.info(`  "${region.name}" already exists`)
  }

  // -------------------------------------------------------------------------
  // Tax: 0%, but it must exist.
  //
  // Qatar charges no VAT on this service. The tax region is still required —
  // without one, checkout cannot calculate totals at all, and it fails with an
  // error that says nothing about tax.
  // -------------------------------------------------------------------------
  logger.info("Tax region...")
  const existingTaxRegions = await taxService.listTaxRegions({
    country_code: COUNTRY,
  })

  if (!existingTaxRegions.length) {
    await createTaxRegionsWorkflow(container).run({
      input: [{ country_code: COUNTRY, provider_id: "tp_system" }],
    })
    logger.info("  created qa tax region at 0%")
  } else {
    logger.info("  qa tax region already exists")
  }

  // -------------------------------------------------------------------------
  // Stock location: a formality. Nothing is stocked, but the fulfillment set has
  // to hang off a location.
  // -------------------------------------------------------------------------
  logger.info("Stock location...")
  let [stockLocation] = await stockLocationService.listStockLocations({
    name: "Doha",
  })

  if (!stockLocation) {
    const { result } = await createStockLocationsWorkflow(container).run({
      input: {
        locations: [
          {
            name: "Doha",
            address: { city: "Doha", country_code: "QA", address_1: "" },
          },
        ],
      },
    })
    stockLocation = result[0]
    logger.info("  created Doha")
  } else {
    logger.info("  Doha already exists")
  }

  await updateStoresWorkflow(container).run({
    input: {
      selector: { id: store.id },
      update: { default_location_id: stockLocation.id },
    },
  })

  await link.create({
    [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
    [Modules.FULFILLMENT]: { fulfillment_provider_id: "manual_manual" },
  })

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: { id: stockLocation.id, add: [salesChannel.id] },
  })

  // -------------------------------------------------------------------------
  // Fulfillment: the "No delivery" option.
  //
  // LOAD-BEARING. Nothing is being shipped — the customer is the cargo. But
  // Medusa's completeCart will not proceed without a shipping method selected,
  // so a zero-cost option exists and the storefront selects it silently during
  // checkout.
  //
  // This is deliberate. It is not dead code and must not be "cleaned up" by a
  // later refactor. If the vehicle products are ever reconfigured as
  // non-shippable, VERIFY that checkout still completes before removing it —
  // do not assume.
  // -------------------------------------------------------------------------
  logger.info("Fulfillment...")
  let [shippingProfile] = await fulfillmentService.listShippingProfiles({
    type: "default",
  })

  if (!shippingProfile) {
    const { result } = await createShippingProfilesWorkflow(container).run({
      input: { data: [{ name: "Default Shipping Profile", type: "default" }] },
    })
    shippingProfile = result[0]
  }

  let [fulfillmentSet] = await fulfillmentService.listFulfillmentSets(
    { name: FULFILLMENT_SET_NAME },
    { relations: ["service_zones"] }
  )

  if (!fulfillmentSet) {
    fulfillmentSet = await fulfillmentService.createFulfillmentSets({
      name: FULFILLMENT_SET_NAME,
      type: "shipping",
      service_zones: [
        {
          name: SERVICE_ZONE_NAME,
          geo_zones: [{ country_code: COUNTRY, type: "country" }],
        },
      ],
    })
    logger.info(`  created fulfillment set "${FULFILLMENT_SET_NAME}"`)

    await link.create({
      [Modules.STOCK_LOCATION]: { stock_location_id: stockLocation.id },
      [Modules.FULFILLMENT]: { fulfillment_set_id: fulfillmentSet.id },
    })
  } else {
    logger.info(`  fulfillment set "${FULFILLMENT_SET_NAME}" already exists`)
  }

  const serviceZone = fulfillmentSet.service_zones?.[0]
  if (!serviceZone) {
    throw new Error(
      `Fulfillment set "${FULFILLMENT_SET_NAME}" has no service zone. Delete it ` +
        "in the admin and re-run this script."
    )
  }

  const existingOptions = await fulfillmentService.listShippingOptions({
    name: NO_DELIVERY_OPTION,
  })

  if (!existingOptions.length) {
    await createShippingOptionsWorkflow(container).run({
      input: [
        {
          name: NO_DELIVERY_OPTION,
          price_type: "flat",
          provider_id: "manual_manual",
          service_zone_id: serviceZone.id,
          shipping_profile_id: shippingProfile.id,
          type: {
            label: "No delivery",
            description: "The customer is the cargo. Nothing is shipped.",
            code: "no-delivery",
          },
          // Zero. The fare rides on the vehicle line item, not here.
          prices: [
            { currency_code: CURRENCY, amount: 0 },
            { region_id: region.id, amount: 0 },
          ],
          rules: [
            { attribute: "enabled_in_store", value: "true", operator: "eq" },
            { attribute: "is_return", value: "false", operator: "eq" },
          ],
        },
      ],
    })
    logger.info(`  created zero-cost "${NO_DELIVERY_OPTION}" option`)
  } else {
    logger.info(`  "${NO_DELIVERY_OPTION}" option already exists`)
  }

  // -------------------------------------------------------------------------
  // Publishable API key
  //
  // Every Store API request is rejected without an x-publishable-api-key header,
  // and the key only works once it is linked to a sales channel.
  // -------------------------------------------------------------------------
  logger.info("Publishable API key...")
  let [publishableKey] = await apiKeyService.listApiKeys({
    title: SALES_CHANNEL_NAME,
    type: "publishable",
  })

  if (!publishableKey) {
    const { result } = await createApiKeysWorkflow(container).run({
      input: {
        api_keys: [
          { title: SALES_CHANNEL_NAME, type: "publishable", created_by: "seed" },
        ],
      },
    })
    publishableKey = result[0]
    logger.info("  created")
  } else {
    logger.info("  already exists")
  }

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: { id: publishableKey.id, add: [salesChannel.id] },
  })

  const rule = "-".repeat(72)
  logger.info("")
  logger.info(rule)
  logger.info("Qatar store configured.")
  logger.info("")
  logger.info("Put this in apps/storefront/.env.local, and in the Cloudflare")
  logger.info("Worker's variables in production:")
  logger.info("")
  logger.info(`  NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY=${publishableKey.token}`)
  logger.info("")
  logger.info("Next: npx medusa exec ./src/scripts/seed-fleet.ts")
  logger.info(rule)
}
