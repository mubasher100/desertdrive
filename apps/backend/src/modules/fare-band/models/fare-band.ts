import { model } from "@medusajs/framework/utils"

/**
 * A distance band: the unit Desert Drive prices by.
 *
 * A trip's fare is decided entirely by which band its non-airport end falls in,
 * plus the vehicle class. `code` is the join: it matches, exactly, the value of
 * the `Distance band` product option on every vehicle product. That is what lets
 * km → band → price be an ordinary product query instead of a pricing engine,
 * and it is why the owner can change a fare in the admin with no deploy.
 *
 * Rename a code here without renaming the matching option value and every quote
 * stops resolving. They are one identifier stored in two places on purpose.
 */
const FareBand = model.define("fare_band", {
  id: model.id().primaryKey(),

  // "A" | "B" | "C" | "D". Must equal the `Distance band` product option value.
  code: model.text().unique(),

  name_en: model.text(),
  name_ar: model.text(),

  /**
   * Inclusive upper bound in STRAIGHT-LINE kilometres from Hamad International.
   *
   * Straight-line, not road distance — haversine runs roughly 20–30% short of
   * the road, so these bounds are already set low to compensate. A trip is in
   * the first band, by `rank`, whose max_km it does not exceed.
   *
   * `null` means unbounded: the catch-all band that everything beyond the last
   * boundary falls into. Exactly one band should have it, and it must sort last.
   */
  max_km: model.number().nullable(),

  // Evaluation order, ascending. Bands are tested cheapest-bound first.
  rank: model.number(),
})

export default FareBand
