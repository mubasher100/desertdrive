import type { ExecArgs, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { setVariantPrice } from "../lib/pricing"

/**
 * One-off changes to production data that a deploy cannot make on its own.
 *
 * Deploys run migrations, not seeds, and the price book is applied once and
 * then belongs to the owner — re-applying it to change one figure would undo
 * every fare edited in the admin since. A patch here changes exactly what it
 * names, once: jobs/apply-data-patches.ts runs each id that the store's
 * `metadata.data_patches` does not already list, then records it.
 *
 * Every patch must be idempotent, because a run can fail half way and be
 * retried on the next tick. Add new patches to the end; never edit or reorder
 * one that has shipped.
 */
export const PATCHES: Array<{ id: string; run: (container: MedusaContainer) => Promise<void> }> = [
  {
    // Owner, 2 Nov 2026: the meet & greet sign is free, and no longer takes a
    // picture. Priced at 0 rather than unpriced, because an unpriced add-on is
    // taken off sale (see list-add-ons) and the sign is still offered.
    id: "2026-11-02-meet-and-greet-free",
    run: async (container) => {
      await setVariantPrice(container, "meet-and-greet", "Standard", 0)

      const query = container.resolve(ContainerRegistrationKeys.QUERY)
      const { data } = await query.graph({
        entity: "product",
        fields: ["id", "metadata"],
        filters: { handle: "meet-and-greet" },
      })
      const product = data?.[0] as { id: string; metadata?: Record<string, unknown> | null } | undefined
      if (!product) return

      await updateProductsWorkflow(container).run({
        input: {
          selector: { id: product.id },
          update: {
            description: "The driver waits in arrivals holding a sign with whatever you write here.",
            metadata: {
              ...(product.metadata ?? {}),
              description_ar: "ينتظرك السائق في صالة الوصول حاملًا لافتة تحمل ما تكتبه هنا.",
            },
          },
        },
      })
    },
  },
]

/** By hand:  npx medusa exec ./src/scripts/data-patches.ts  — runs every patch, recorded or not. */
export default async function run({ container }: ExecArgs) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  for (const patch of PATCHES) {
    await patch.run(container)
    logger.info(`data patch ${patch.id}: applied`)
  }
}
