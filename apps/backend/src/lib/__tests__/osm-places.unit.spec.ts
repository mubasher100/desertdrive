import { dedupePlaces, kindOf, normaliseSearch, rankPlaces, searchText, searchTokens, toPlace } from "../osm-places"
import { QATAR_PLACES } from "../../data/qatar-places"

describe("toPlace", () => {
  it("prefers the English name and keeps the Arabic one", () => {
    const p = toPlace(
      { type: "node", id: 1, lat: 25.36, lon: 51.48, tags: { name: "جامعة", "name:en": "UDST", "name:ar": "جامعة الدوحة" } },
      "campus"
    )
    expect(p).toMatchObject({ name_en: "UDST", name_ar: "جامعة الدوحة", lat: 25.36, lng: 51.48, kind: "campus" })
  })

  it("takes the centre of a way, which has no coordinates of its own", () => {
    const p = toPlace({ type: "way", id: 2, center: { lat: 25.3, lon: 51.5 }, tags: { name: "Al Sadd" } }, "district")
    expect(p).toMatchObject({ osm_type: "way", lat: 25.3, lng: 51.5 })
  })

  it("drops anything unsearchable rather than storing it half-formed", () => {
    expect(toPlace({ type: "node", id: 3, lat: 25, lon: 51, tags: {} }, "hotel")).toBeNull()
    expect(toPlace({ type: "way", id: 4, tags: { name: "No position" } }, "hotel")).toBeNull()
  })
})

describe("normaliseSearch", () => {
  it("flattens the Arabic spellings people actually type", () => {
    expect(normaliseSearch("الدوحة")).toBe(normaliseSearch("الدوحه"))
    expect(normaliseSearch("اللؤلؤة")).toBe(normaliseSearch("اللؤلؤه"))
  })

  it("ignores case and punctuation", () => {
    expect(normaliseSearch("Al-Sadd, Doha")).toBe("al sadd doha")
  })
})

describe("rankPlaces", () => {
  const make = (name_en: string, kind: string) => ({ name_en, kind, search: searchText({ name_en, name_ar: null }) })

  it("puts a name that starts with the query first", () => {
    const out = rankPlaces([make("Grand Lusail Hotel", "hotel"), make("Lusail", "district")], "lusail")
    expect(out[0].name_en).toBe("Lusail")
  })

  it("prefers a district to a hotel of the same name", () => {
    const out = rankPlaces([make("Katara Hotel", "hotel"), make("Katara", "district")], "katara")
    expect(out[0].kind).toBe("district")
  })

  it("prefers the shorter name when everything else ties", () => {
    const out = rankPlaces([make("Pearl Marina Retail Units", "compound"), make("Pearl Marina", "compound")], "pearl")
    expect(out[0].name_en).toBe("Pearl Marina")
  })

  it("still returns a mid-word match, just later", () => {
    const out = rankPlaces([make("Msheireb Downtown", "district"), make("Souq Msheireb", "mall")], "msheireb")
    expect(out.map((p) => p.name_en)).toEqual(["Msheireb Downtown", "Souq Msheireb"])
  })
})

describe("kindOf", () => {
  it("keeps a city apart from a district", () => {
    // Doha, Lusail, Al Wakrah and Al Rayyan are all `place=city` in OSM. They
    // were absent from the index entirely until the selector admitted them,
    // so "lusail" answered with hotels and "al wakrah" with nothing at all.
    expect(kindOf({ place: "city" })).toBe("city")
    expect(kindOf({ place: "town" })).toBe("city")
    expect(kindOf({ place: "suburb" })).toBe("district")
  })

  it("recognises the islands people are actually collected from", () => {
    expect(kindOf({ place: "island" })).toBe("island")
  })
})

describe("dedupePlaces", () => {
  it("offers a name once even though OSM holds it several times", () => {
    // Nuaija is mapped three times and Al Bidda twice — a point and areas.
    const rows = [
      { name_en: "Nuaija", kind: "district" },
      { name_en: "nuaija", kind: "district" },
      { name_en: "Nuaija", kind: "district" },
      { name_en: "Nuaija Health Center", kind: "hospital" },
    ]
    expect(dedupePlaces(rows).map((p) => p.name_en)).toEqual(["Nuaija", "Nuaija Health Center"])
  })

  it("keeps the same name under a different kind", () => {
    const rows = [
      { name_en: "Katara", kind: "district" },
      { name_en: "Katara", kind: "hotel" },
    ]
    expect(dedupePlaces(rows)).toHaveLength(2)
  })

  it("collapses one place OSM holds under two kinds, because the list shows neither", () => {
    // Villaggio Mall is mapped as a mall AND as a retail area. Once a district
    // is known the list shows that, not the kind — so both rows read exactly
    // the same and one of them is noise. Ranking runs first, so the mall is
    // the copy that survives.
    const rows = [
      { name_en: "Villaggio Mall", kind: "mall", context: "Baaya" },
      { name_en: "Villaggio Mall", kind: "compound", context: "Baaya" },
    ]
    expect(dedupePlaces(rows)).toEqual([{ name_en: "Villaggio Mall", kind: "mall", context: "Baaya" }])
  })

  it("still separates two kinds when neither has a district to show", () => {
    const rows = [
      { name_en: "Katara", kind: "district", context: null },
      { name_en: "Katara", kind: "hotel", context: null },
    ]
    expect(dedupePlaces(rows)).toHaveLength(2)
  })

  it("keeps every branch of a chain, because the district makes them different places", () => {
    // Collapsing on name and kind alone returned ONE Starbucks out of thirty,
    // so a customer outside any of the other twenty-nine could not say so —
    // and would have been priced from a district they were nowhere near.
    const rows = [
      { name_en: "Starbucks", kind: "food", context: "Al Sadd" },
      { name_en: "Starbucks", kind: "food", context: "Al Thumama" },
      { name_en: "Starbucks", kind: "food", context: "West Bay" },
      { name_en: "Starbucks", kind: "food", context: "Al Sadd" },
    ]
    expect(dedupePlaces(rows).map((p) => p.context)).toEqual(["Al Sadd", "Al Thumama", "West Bay"])
  })
})

describe("the committed snapshot", () => {
  it("holds the towns a customer types first", () => {
    const cities = QATAR_PLACES.filter((p) => p.kind === "city").map((p) => p.name_en)

    for (const town of ["Lusail", "Al Wakrah", "Al Rayyan", "Doha", "Al Khor", "Dukhan", "Mesaieed"]) {
      expect(cities).toContain(town)
    }
  })

  it("ranks the town above the hotels that share its name", () => {
    const rows = [
      { name_en: "Lusail Palace", kind: "hotel", search: "lusail palace" },
      { name_en: "Lusail", kind: "city", search: "lusail" },
      { name_en: "Lusail District", kind: "district", search: "lusail district" },
    ]
    expect(rankPlaces(rows, "lusail")[0].name_en).toBe("Lusail")
  })
})

describe("searching by name and place together", () => {
  const make = (name_en: string, context: string | null, kind = "shop") => ({
    name_en,
    kind,
    context,
    search: searchText({ name_en, name_ar: null, context }),
  })

  it("puts the district in the searchable text", () => {
    // Without this, "al meera wakra" cannot match however the words are split:
    // the name is in one column and the district in another.
    expect(make("Al Meera", "Al Wakrah").search).toBe("al meera al wakrah")
  })

  it("splits a query into words and ignores the noise", () => {
    expect(searchTokens("Al Meera, Wakra South")).toEqual(["al", "meera", "wakra", "south"])
    expect(searchTokens("a b udst")).toEqual(["udst"])
  })

  it("ranks the branch in the named district above the others", () => {
    // Reported from a phone: typing a shop and a place together returned
    // "We don't have that one on the list yet", and the only way forward was
    // WhatsApp — for a destination the system can price perfectly well.
    const out = rankPlaces(
      [make("Al Meera", "Ain Khaled"), make("Al Meera", "Al Tarfa"), make("Al Meera", "Nuaija")],
      "al meera al tarfa"
    )
    expect(out[0].context).toBe("Al Tarfa")
  })

  it("leaves a one-word query ranked exactly as before", () => {
    const out = rankPlaces(
      [make("Lusail Palace", null, "hotel"), make("Lusail", null, "city")],
      "lusail"
    )
    expect(out[0].name_en).toBe("Lusail")
  })
})
