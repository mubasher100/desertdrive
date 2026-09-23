import { model } from "@medusajs/framework/utils"

/**
 * A place a customer might name: a district, a hotel, a campus, a mall, a
 * named compound.
 *
 * Imported from OpenStreetMap rather than queried live. Autocomplete against a
 * paid API bills per keystroke-session and cannot be cached; a copy of Qatar's
 * places is a few thousand rows that refresh weekly and cost nothing to
 * search. It is also the only version that keeps working when the network to
 * a third party does not.
 *
 * Nothing here decides a fare. A place supplies coordinates; the priced area
 * containing them, or the distance band, decides the price — server-side, as
 * with every other destination.
 */
const Place = model
  .define("place", {
    id: model.id().primaryKey(),

    /** "node" | "way" | "relation" — with osm_id, the identity of the source feature. */
    osm_type: model.text(),
    osm_id: model.text(),

    /** English name, which is what the driver reads off the job sheet. */
    name_en: model.text(),
    /** Arabic name where OSM has one; falls back to the English at display time. */
    name_ar: model.text().nullable(),

    /**
     * What sort of place, used to rank results: a district outranks a hotel of
     * the same name, because someone typing "Lusail" means the district.
     */
    kind: model.text(),

    /** The district it sits in, when the import could work it out. Shown as the subtitle. */
    context: model.text().nullable(),

    lat: model.float(),
    lng: model.float(),

    /** Lowercased, unaccented haystack: the English and Arabic names joined. */
    search: model.text(),
  })
  .indexes([
    // One row per source feature, so a re-import updates rather than duplicates.
    { on: ["osm_type", "osm_id"], unique: true },
    { on: ["search"] },
    { on: ["kind"] },
  ])

export default Place
