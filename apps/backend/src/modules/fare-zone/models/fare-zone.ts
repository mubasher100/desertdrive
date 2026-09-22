import { model } from "@medusajs/framework/utils"

/**
 * A priced area drawn on the map.
 *
 * Distance bands price a ring around the airport, which is right for "how far
 * is it" and wrong for "where is it". The Pearl is one place with one fare, but
 * Porto Arabia and Viva Bahriya sit at different radii, so a customer who picks
 * their own villa can land in a different band from their neighbour. A zone
 * fixes that: draw the outline once, label it, and every point inside it prices
 * the same.
 *
 * Zones take precedence over bands, and bands remain the catch-all for
 * everywhere nobody has drawn yet — so adding a zone never leaves a destination
 * unpriced.
 */
const FareZone = model
  .define("fare_zone", {
    id: model.id().primaryKey(),

    /**
     * The pricing key. Matches a `Distance band` product option value exactly,
     * the same contract band codes use — that is what lets a zone be priced by
     * ordinary product variants the owner edits in the admin.
     *
     * A zone with no priced variant falls back to its distance band, so a zone
     * can be drawn first and priced later without taking it off sale.
     */
    code: model.text().unique(),

    name_en: model.text(),
    name_ar: model.text(),

    /**
     * The outline, as [{ lat, lng }] in order. Treated as closed: the last
     * point joins the first. Three points minimum; anything less is a line.
     */
    polygon: model.json(),

    /**
     * Evaluation order, ascending. Overlaps are legal and useful — a compound
     * inside a district can price differently from the district around it — so
     * the smaller, more specific zone must carry the lower rank.
     */
    rank: model.number(),

    /** Off means "ignore this zone", without losing the outline someone drew. */
    active: model.boolean().default(true),
  })
  .indexes([{ on: ["code"] }, { on: ["rank"] }])

export default FareZone
