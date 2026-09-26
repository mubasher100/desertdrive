import { ExecArgs } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, ProductStatus } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { VEHICLES } from "./seed-fleet"

/**
 * Puts each vehicle on or off sale to match the fleet definition.
 *
 *   npx medusa exec ./src/scripts/sync-vehicle-status.ts
 *
 * seed-fleet deliberately refuses to touch a product that already exists —
 * prices are the owner's to edit in the admin and a re-seed must never
 * overwrite them. That leaves no way to take a vehicle off sale on a database
 * that is already seeded, which is what this is for: it changes `status` and
 * NOTHING else, so a fare edited in the admin an hour ago survives it.
 *
 * A vehicle off sale becomes a DRAFT rather than being deleted. The product,
 * its variants, its prices and every order referencing it stay exactly where
 * they are; putting it back on sale is one word in seed-fleet and one run of
 * this.
 */
export default async function syncVehicleStatus({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const productService = container.resolve(Modules.PRODUCT)

  for (const vehicle of VEHICLES) {
    const [product] = await productService.listProducts({ handle: vehicle.handle })

    if (!product) {
      logger.warn(`  ${vehicle.title}: not in this database — run seed-fleet first`)
      continue
    }

    const wanted = vehicle.offered === false ? ProductStatus.DRAFT : ProductStatus.PUBLISHED

    if (product.status === wanted) {
      logger.info(`  ${vehicle.title}: already ${wanted}`)
      continue
    }

    await updateProductsWorkflow(container).run({
      input: { selector: { id: product.id }, update: { status: wanted } },
    })

    logger.info(`  ${vehicle.title}: ${product.status} -> ${wanted}`)
  }
}
