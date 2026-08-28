import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  createApiKeysWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { FARE_BAND_MODULE } from "../../src/modules/fare-band"

jest.setTimeout(120 * 1000)

/**
 * The bands as seeded, including the 18.5 km A/B boundary that exists so the
 * whole of Lusail prices as band B.
 */
const BANDS = [
  { code: "A", name_en: "Doha & central", name_ar: "أ", max_km: 18.5, rank: 1 },
  { code: "B", name_en: "Greater Doha", name_ar: "ب", max_km: 40, rank: 2 },
  { code: "C", name_en: "Northern & southern", name_ar: "ج", max_km: 75, rank: 3 },
  { code: "D", name_en: "Far north & west", name_ar: "د", max_km: null, rank: 4 },
]

const SOUQ_WAQIF = { lat: 25.287, lng: 51.533 } // 7.7 km  -> A
const LUSAIL_MARINA = { lat: 25.4106, lng: 51.4914 } // 19.3 km -> B
const AL_KHOR = { lat: 25.684, lng: 51.498 } // 47.0 km -> C
const AL_ZUBARAH = { lat: 25.9789, lng: 51.0244 } // 97.9 km -> D

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>

    beforeEach(async () => {
      const container = getContainer()

      // Every Store API request is rejected without a publishable key linked to
      // a sales channel, so the test has to set that up like the seed does.
      const { result: channels } = await createSalesChannelsWorkflow(
        container
      ).run({ input: { salesChannelsData: [{ name: "Test channel" }] } })

      const { result: keys } = await createApiKeysWorkflow(container).run({
        input: {
          api_keys: [
            { title: "Test", type: "publishable", created_by: "test" },
          ],
        },
      })

      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: { id: keys[0].id, add: [channels[0].id] },
      })

      headers = { "x-publishable-api-key": keys[0].token }

      /**
       * A QAR region is required, not incidental: variant prices are calculated
       * against a region, so without one the pricing lookup has no context and
       * the quote step cannot resolve any fare. seed-qatar.ts creates it in a
       * real environment.
       */
      await createRegionsWorkflow(container).run({
        input: {
          regions: [
            {
              name: "Qatar",
              currency_code: "qar",
              countries: ["qa"],
              payment_providers: ["pp_system_default"],
            },
          ],
        },
      })

      const fareBandService: any = container.resolve(FARE_BAND_MODULE)
      await fareBandService.createFareBands(BANDS)
    })

    describe("POST /store/quotes", () => {
      /**
       * The point of the endpoint: the client sends coordinates, the SERVER
       * decides the band. Nothing in the request names a band or a price.
       */
      // Name and band come first so printf-style interpolation fills the two
      // %s placeholders with them, rather than dumping the coordinate object
      // into the test name.
      it.each([
        ["Souq Waqif", "A", SOUQ_WAQIF],
        ["Lusail Marina", "B", LUSAIL_MARINA],
        ["Al Khor", "C", AL_KHOR],
        ["Al Zubarah", "D", AL_ZUBARAH],
      ])("resolves %s to band %s server-side", async (_name, band, coords) => {
        const response = await api.post(
          "/store/quotes",
          { ...coords, passengers: 2, luggage: 2 },
          { headers }
        )

        expect(response.status).toEqual(200)
        expect(response.data.band.code).toEqual(band)
        expect(typeof response.data.distance_km).toEqual("number")
      })

      /**
       * No vehicle products are seeded here, so nothing is quotable. The
       * endpoint must say so plainly rather than erroring — this is the same
       * path a trip into an unpriced band takes.
       */
      it("reports not quotable rather than failing when no vehicle is priced", async () => {
        const response = await api.post(
          "/store/quotes",
          { ...SOUQ_WAQIF, passengers: 2, luggage: 2 },
          { headers }
        )

        expect(response.status).toEqual(200)
        expect(response.data.quotable).toBe(false)
        expect(response.data.vehicles).toEqual([])
      })

      it("is never cached", async () => {
        const response = await api.post(
          "/store/quotes",
          { ...SOUQ_WAQIF, passengers: 2, luggage: 2 },
          { headers }
        )

        // A quote is tied to one person's coordinates and party size.
        expect(response.headers["cache-control"]).toContain("no-store")
      })

      /**
       * The validation schema is the security boundary of the pricing model.
       * Anything that lets a client widen it is a price field in devtools.
       */
      it.each([
        ["latitude out of range", { lat: 91, lng: 51.5 }],
        ["longitude out of range", { lat: 25.3, lng: 181 }],
        ["non-numeric latitude", { lat: "25.3", lng: 51.5 }],
        ["missing longitude", { lat: 25.3 }],
      ])("rejects %s", async (_name, coords) => {
        const response = await api
          .post(
            "/store/quotes",
            { ...coords, passengers: 2, luggage: 2 },
            { headers }
          )
          .catch((e: any) => e.response)

        expect(response.status).toEqual(400)
      })

      it("rejects a party size outside the supported range", async () => {
        const response = await api
          .post(
            "/store/quotes",
            { ...SOUQ_WAQIF, passengers: 0, luggage: 2 },
            { headers }
          )
          .catch((e: any) => e.response)

        expect(response.status).toEqual(400)
      })

      /**
       * Guards the shape of the contract. If a band, variant or amount field
       * ever becomes client-supplied, the pricing model is broken.
       *
       * The schema is strict, so these are rejected outright rather than merely
       * ignored — a stronger guarantee, and worth pinning: loosening the schema
       * to passthrough would turn a 400 into a silently accepted price hint.
       */
      it("rejects price-related fields the client tries to inject", async () => {
        const response = await api
          .post(
            "/store/quotes",
            {
              ...AL_ZUBARAH,
              passengers: 2,
              luggage: 2,
              band_code: "A",
              amount: 1,
              variant_id: "variant_injected",
            },
            { headers }
          )
          .catch((e: any) => e.response)

        expect(response.status).toEqual(400)
        expect(response.data.message).toContain("Unrecognized fields")
      })

      /**
       * The airport end is fixed, so a band is always decided from the customer's
       * coordinates alone. This pins that a far destination cannot be talked into
       * a cheap band by any legitimate request either.
       */
      it("prices Al Zubarah as band D on distance alone", async () => {
        const response = await api.post(
          "/store/quotes",
          { ...AL_ZUBARAH, passengers: 2, luggage: 2 },
          { headers }
        )

        expect(response.status).toEqual(200)
        expect(response.data.band.code).toEqual("D")
        expect(response.data.distance_km).toBeGreaterThan(90)
      })
    })
  },
})
