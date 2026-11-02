import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import { PATCHES } from "../scripts/data-patches"

type Locking = { execute: <T>(key: string, fn: () => Promise<T>, options?: { timeout?: number }) => Promise<T> }

/**
 * Applies each one-off data patch (scripts/data-patches.ts) exactly once, and
 * records it in the store's `metadata.data_patches`. Same shape as
 * apply-price-book: once everything is recorded, every run is one read.
 */
export default async function applyDataPatchesJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const stores = container.resolve(Modules.STORE)

  const done = async () => {
    const [store] = await stores.listStores({}, { select: ["id", "metadata"] })
    const metadata = (store?.metadata ?? {}) as Record<string, unknown>
    const applied = Array.isArray(metadata.data_patches) ? (metadata.data_patches as string[]) : []
    return { store, metadata, applied }
  }

  const first = await done()
  if (!first.store || PATCHES.every((p) => first.applied.includes(p.id))) return

  const locking = container.resolve(Modules.LOCKING) as unknown as Locking

  try {
    await locking.execute(
      "apply-data-patches",
      async () => {
        for (const patch of PATCHES) {
          // Re-read under the lock: another run may have recorded it meanwhile.
          const { store, metadata, applied } = await done()
          if (!store || applied.includes(patch.id)) continue

          await patch.run(container)

          await updateStoresWorkflow(container).run({
            input: {
              selector: { id: store.id },
              update: { metadata: { ...metadata, data_patches: [...applied, patch.id] } },
            },
          })
          logger.info(`data patch ${patch.id}: applied and recorded`)
        }
      },
      { timeout: 5 }
    )
  } catch (e) {
    // Not recorded, so the next tick tries again; every patch is idempotent.
    logger.warn(`data patches: not applied this run — ${(e as Error).message.slice(0, 160)}`)
  }
}

export const config = {
  name: "apply-data-patches",
  schedule: "*/5 * * * *",
}
