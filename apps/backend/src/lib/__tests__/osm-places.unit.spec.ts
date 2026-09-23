import { normaliseSearch, rankPlaces, searchText, toPlace } from "../osm-places"

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
