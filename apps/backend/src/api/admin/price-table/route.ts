import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import type { RemoteQueryFunction } from "@medusajs/framework/types"
import { FARE_ZONE_MODULE } from "../../../modules/fare-zone"
import { FARE_BAND_MODULE } from "../../../modules/fare-band"
import { PRICE_TABLE_CLASSES } from "../../../lib/price-table"
import { setFarePriceWorkflow } from "../../../workflows/pricing/set-fare-price"
import type { SetFarePriceSchema } from "../bookings/middlewares"

type Zone = { code: string; name_en: string; rank: number; active: boolean }
type Band = { code: string; name_en: string; max_km: number | null; rank: number }

const BAND_LABEL: Record<string, string> = {
  A: "Rest of Doha (within 18.5 km)",
  B: "18.5–40 km (e.g. Mesaieed town, Umm Salal)",
  C: "40–75 km (e.g. Al Khor)",
  D: "Over 75 km (e.g. Dukhan)",
}

/**
 * GET /admin/price-table — every area and band, and what each car costs
 * there, in QAR as stored. The page shows dollars; the server does the
 * conversion on save, so the two can never disagree.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse) {
  const zones = (await (req.scope.resolve(FARE_ZONE_MODULE) as { listFareZones: (f: object, c?: object) => Promise<Zone[]> })
    .listFareZones({ active: true }, { order: { rank: "ASC" } })) as Zone[]
  const bands = (await (req.scope.resolve(FARE_BAND_MODULE) as { listFareBands: (f: object, c?: object) => Promise<Band[]> })
    .listFareBands({}, { order: { rank: "ASC" } })) as Band[]

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY) as Omit<RemoteQueryFunction, symbol>
  const { data: products } = await query.graph({
    entity: "product",
    fields: ["handle", "variants.options.value", "variants.prices.amount", "variants.prices.currency_code"],
    filters: { handle: PRICE_TABLE_CLASSES.map((c) => c.handle) },
  })

  // price[handle][code] = QAR
  const price: Record<string, Record<string, number>> = {}
  for (const p of (products ?? []) as Array<{ handle: string; variants?: Array<{ options?: Array<{ value: string }>; prices?: Array<{ amount: number; currency_code: string }> }> }>) {
    price[p.handle] = {}
    for (const v of p.variants ?? []) {
      const amount = v.prices?.find((x) => x.currency_code === "qar")?.amount
      for (const o of v.options ?? []) if (typeof amount === "number") price[p.handle][o.value] = Number(amount)
    }
  }

  const row = (code: string, name: string, kind: "area" | "band") => ({
    code,
    name,
    kind,
    prices: Object.fromEntries(PRICE_TABLE_CLASSES.map((c) => [c.handle, price[c.handle]?.[code] ?? null])),
  })

  res.json({
    classes: PRICE_TABLE_CLASSES,
    rows: [
      ...zones.map((z) => row(z.code, z.name_en, "area")),
      ...bands.map((b) => row(b.code, BAND_LABEL[b.code] ?? b.name_en, "band")),
    ],
  })
}

/** POST /admin/price-table — set one car's price in one area or band, in whole dollars. */
export async function POST(req: MedusaRequest<SetFarePriceSchema>, res: MedusaResponse) {
  const { result } = await setFarePriceWorkflow(req.scope).run({ input: req.validatedBody })
  res.json({ price: result })
}
