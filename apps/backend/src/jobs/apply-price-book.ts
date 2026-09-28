import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { updateStoresWorkflow } from "@medusajs/medusa/core-flows"
import { PRICE_BOOK_VERSION } from "../data/price-book"
import { applyPriceBook } from "../scripts/apply-price-book"

type Locking = { execute: <T>(key: string, fn: () => Promise<T>, options?: { timeout?: number }) => Promise<T> }

/**
 * Applies a new price book to whatever database this runs against — ONCE.
 *
 * A deploy carries a new list into the image, but nothing writes it: prices
 * live in the database and seeds are run by hand. This closes that gap the way
 * ensure-place-index does for places, with one crucial difference: that job
 * enforces an invariant forever, and this one must NOT. Prices belong to the
 * owner in the admin. So the version applied is recorded on the store, and
 * once it matches, every run is a single read that does nothing — the owner's
 * later edits in the admin are never touched again.
 *
 * To publish a new list: change src/data/price-book.ts AND bump
 * PRICE_BOOK_VERSION.
 *
 * Every five minutes so a new list is live soon after the deploy that carries
 * it; the check is one read. The lock stops a slow first run (it creates ~70
 * variants) overlapping the next tick.
 */
export default async function applyPriceBookJob(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const stores = container.resolve(Modules.STORE)

  const [store] = await stores.listStores({}, { select: ["id", "metadata"] })
  if (!store) return

  const metadata = (store.metadata ?? {}) as Record<string, unknown>
  if (metadata.price_book === PRICE_BOOK_VERSION) return

  const locking = container.resolve(Modules.LOCKING) as unknown as Locking

  try {
    await locking.execute(
      "apply-price-book",
      async () => {
        // Re-read under the lock: another run may have finished in between.
        const [fresh] = await stores.listStores({ id: store.id }, { select: ["id", "metadata"] })
        const current = (fresh?.metadata ?? {}) as Record<string, unknown>
        if (current.price_book === PRICE_BOOK_VERSION) return

        await applyPriceBook(container)

        await updateStoresWorkflow(container).run({
          input: {
            selector: { id: store.id },
            update: {
              metadata: {
                ...current,
                price_book: PRICE_BOOK_VERSION,
                price_book_applied_at: new Date().toISOString(),
              },
            },
          },
        })
        logger.info(`price book ${PRICE_BOOK_VERSION}: recorded — will not run again`)
      },
      { timeout: 5 }
    )
  } catch (e) {
    // Not recorded, so the next tick tries again. Nothing half-applied is
    // harmful: every step is idempotent.
    logger.warn(`price book ${PRICE_BOOK_VERSION}: not applied this run — ${(e as Error).message.slice(0, 160)}`)
  }
}

export const config = {
  name: "apply-price-book",
  schedule: "*/5 * * * *",
}
