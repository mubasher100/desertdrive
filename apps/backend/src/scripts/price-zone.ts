import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  createProductVariantsWorkflow,
  setProductProductOptionsWorkflow,
  updateProductOptionsWorkflow,
} from "@medusajs/medusa/core-flows"

/**
 * Prices a drawn area for one vehicle.
 *
 *   npx medusa exec ./src/scripts/price-zone.ts <product-handle> <zone-code> <amount>
 *
 * A zone is priced exactly like a band: it is another value of the same
 * `Distance band` product option, with its own variant and its own price. This
 * script exists because adding an option value and a variant by hand in the
 * admin is four screens, and the owner will do it once per area per vehicle.
 */
export default async function priceZone({ container, args }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [handle, code, amountRaw] = args
  const amount = Number(amountRaw)

  if (!handle || !code || !Number.isFinite(amount)) {
    logger.error("Usage: medusa exec ./src/scripts/price-zone.ts <product-handle> <zone-code> <amount>")
    return
  }

  const { data: products } = await query.graph({
    entity: "product",
    fields: ["id", "title", "options.id", "options.title", "options.values.value", "variants.id", "variants.options.value"],
    filters: { handle },
  })

  const product = products?.[0]
  if (!product) {
    logger.error(`No product with handle "${handle}".`)
    return
  }

  const option = (product.options ?? []).find((o: { title?: string }) => o?.title === "Distance band")
  if (!option) {
    logger.error(`"${product.title}" has no "Distance band" option.`)
    return
  }

  const values: string[] = (option.values ?? []).map((v: { value: string }) => v.value)

  if (!values.includes(code)) {
    await updateProductOptionsWorkflow(container).run({
      input: { selector: { id: option.id }, update: { values: [...values, code] } },
    })

    /**
     * Medusa 2.16+ lets an option be shared between products, so a product is
     * linked to the specific option VALUES it offers. Adding the value to the
     * option is not enough on its own: without this link the value exists in
     * the table, reads still return the old list, and creating a variant fails
     * with "Option value <x> does not exist for option <y>".
     */
    // `add` takes value IDs, so the freshly created value has to be looked up.
    const { data: refreshed } = await query.graph({
      entity: "product_option",
      fields: ["id", "values.id", "values.value"],
      filters: { id: option.id },
    })
    const added = (refreshed?.[0]?.values ?? []).find((v: { value: string }) => v.value === code)

    if (!added?.id) {
      logger.error(`"${code}" was not created on the option; nothing to link.`)
      return
    }

    await setProductProductOptionsWorkflow(container).run({
      input: {
        product_id: product.id,
        update: [{ product_option_id: option.id, add: [added.id] }],
      },
    })

    logger.info(`Added "${code}" to the Distance band option on ${product.title}.`)
  }

  const exists = (product.variants ?? []).some((v: { options?: { value: string }[] }) =>
    (v.options ?? []).some((o) => o.value === code)
  )

  if (exists) {
    logger.warn(`${product.title} already has a "${code}" variant. Edit its price in the admin instead.`)
    return
  }

  await createProductVariantsWorkflow(container).run({
    input: {
      product_variants: [
        {
          product_id: product.id,
          title: code,
          options: { "Distance band": code },
          manage_inventory: false,
          // Stored as-is: 120 QAR is 120, never 12000.
          prices: [{ amount, currency_code: "qar" }],
        },
      ],
    },
  })

  logger.info(`${product.title}: "${code}" priced at ${amount} QAR.`)
}
