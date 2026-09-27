import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  createProductVariantsWorkflow,
  setProductProductOptionsWorkflow,
  updateProductOptionsWorkflow,
} from "@medusajs/medusa/core-flows"

type Product = {
  id: string
  title: string
  options?: Array<{ id: string; title?: string; values?: Array<{ value: string }> }>
  variants?: Array<{ options?: Array<{ value: string }> }>
}

export type PriceResult = "created" | "exists" | "no-product" | "no-option" | "failed"

/**
 * Gives one vehicle a price for one pricing code, if it does not have one.
 *
 * A "pricing code" is a band ("A".."D") or a drawn zone's code — they are the
 * same thing to the catalogue: a value of the `Distance band` product option
 * with a variant and a price behind it. That shared identifier is what lets
 * "resolve a destination to a fare" be an ordinary product query rather than a
 * pricing engine.
 *
 * ⚠️ It never changes an existing price. Fares belong to the owner in the
 * admin, and a script that "helpfully" reset them would undo real work with no
 * warning. An already-priced code returns "exists" and is left alone.
 *
 * ⚠️ Adding an option value takes THREE steps in Medusa 2.16+, not one. Options
 * can be shared between products, so a product is linked to the specific values
 * it offers. Creating the value persists a row that reads still do not return,
 * and creating the variant then fails with the thoroughly misleading
 * `Option value <x> does not exist for option <y>` while the row sits in the
 * table looking correct. The value must be created, looked up by id, and linked
 * to the product before a variant can use it.
 */
export async function ensurePricedVariant(
  container: MedusaContainer,
  handle: string,
  code: string,
  amount: number
): Promise<PriceResult> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "options.id",
      "options.title",
      "options.values.value",
      "variants.id",
      "variants.options.value",
    ],
    filters: { handle },
  })

  const product = products?.[0] as Product | undefined

  if (!product) return "no-product"

  const option = (product.options ?? []).find((o) => o?.title === "Distance band")
  if (!option) return "no-option"

  const alreadyPriced = (product.variants ?? []).some((v) =>
    (v.options ?? []).some((o) => o.value === code)
  )
  if (alreadyPriced) return "exists"

  const values = (option.values ?? []).map((v) => v.value)

  if (!values.includes(code)) {
    await updateProductOptionsWorkflow(container).run({
      input: { selector: { id: option.id }, update: { values: [...values, code] } },
    })

    // `add` takes value IDs, so the freshly created value has to be looked up.
    const { data: refreshed } = await query.graph({
      entity: "product_option",
      fields: ["id", "values.id", "values.value"],
      filters: { id: option.id },
    })

    const refreshedOption = refreshed?.[0] as { values?: Array<{ id: string; value: string }> } | undefined
    const added = (refreshedOption?.values ?? []).find((v) => v.value === code)

    if (!added?.id) return "failed"

    await setProductProductOptionsWorkflow(container).run({
      input: { product_id: product.id, update: [{ product_option_id: option.id, add: [added.id] }] },
    })
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

  return "created"
}
