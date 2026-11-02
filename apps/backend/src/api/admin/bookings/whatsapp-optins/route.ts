import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { optInsCsv, optInsFromOrders } from "../../../../lib/whatsapp-optins"

/**
 * Everyone who opted in to WhatsApp offers, as CSV for the owner to download.
 * Read-only; returned inside JSON so the admin fetches it through the SDK like
 * every other admin call.
 */
export const GET = async (req: AuthenticatedMedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "display_id", "created_at", "metadata"],
    pagination: { take: 5000, order: { created_at: "DESC" } },
  })

  const rows = optInsFromOrders(orders as Parameters<typeof optInsFromOrders>[0])
  res.setHeader("Cache-Control", "no-store")
  res.json({ count: rows.length, csv: optInsCsv(rows) })
}
