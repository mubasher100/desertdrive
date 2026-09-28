import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  createApiKeysWorkflow,
  createProductsWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows"
import { ProductStatus } from "@medusajs/framework/utils"

jest.setTimeout(120 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let headers: Record<string, string>
    let container: ReturnType<typeof getContainer>

    /** An add-on is an ordinary single-variant product flagged on metadata. */
    async function createAddOn(opts: {
      handle: string
      title: string
      price: number | null
      metadata?: Record<string, unknown>
    }) {
      await createProductsWorkflow(container).run({
        input: {
          products: [
            {
              title: opts.title,
              handle: opts.handle,
              status: ProductStatus.PUBLISHED,
              metadata: { add_on: true, ...opts.metadata },
              options: [{ title: "Type", values: ["Standard"] }],
              variants: [
                {
                  title: opts.title,
                  manage_inventory: false,
                  options: { Type: "Standard" },
                  // No price at all is how an add-on is taken off sale.
                  prices:
                    opts.price === null ? [] : [{ currency_code: "qar", amount: opts.price }],
                },
              ],
            },
          ],
        },
      })
    }

    beforeEach(async () => {
      container = getContainer()

      const { result: channels } = await createSalesChannelsWorkflow(container).run({
        input: { salesChannelsData: [{ name: "Test channel" }] },
      })

      const { result: keys } = await createApiKeysWorkflow(container).run({
        input: { api_keys: [{ title: "Test", type: "publishable", created_by: "test" }] },
      })

      await linkSalesChannelsToApiKeyWorkflow(container).run({
        input: { id: keys[0].id, add: [channels[0].id] },
      })

      headers = { "x-publishable-api-key": keys[0].token }

      // Prices are calculated against a region; without one nothing resolves.
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
    })

    describe("GET /store/add-ons", () => {
      it("returns an empty list rather than failing when nothing is priced", async () => {
        const response = await api.get("/store/add-ons", { headers })

        expect(response.status).toEqual(200)
        expect(response.data.add_ons).toEqual([])
      })

      it("returns a priced add-on with its amount as-is", async () => {
        await createAddOn({ handle: "child-seat", title: "Child seat", price: 18 })

        const response = await api.get("/store/add-ons", { headers })

        expect(response.status).toEqual(200)
        expect(response.data.add_ons).toHaveLength(1)

        const [addOn] = response.data.add_ons
        expect(addOn.handle).toEqual("child-seat")
        // Stored as-is. 18 QAR is 18, never 1800.
        expect(addOn.amount).toEqual(18)
        expect(addOn.currency_code).toEqual("qar")
        expect(typeof addOn.variant_id).toEqual("string")
      })

      /**
       * The mechanism for taking an add-on off sale: clear its price. It must
       * disappear from the list rather than appear at zero, which would give
       * the thing away for free.
       */
      it("omits an add-on that has no price", async () => {
        await createAddOn({ handle: "child-seat", title: "Child seat", price: 18 })
        await createAddOn({ handle: "meet-and-greet", title: "Meet & greet", price: null })

        const response = await api.get("/store/add-ons", { headers })

        expect(response.data.add_ons.map((a: { handle: string }) => a.handle)).toEqual([
          "child-seat",
        ])
      })

      /** A vehicle is not an add-on, and must never be offered as one. */
      it("ignores products that are not flagged as add-ons", async () => {
        await createProductsWorkflow(container).run({
          input: {
            products: [
              {
                title: "SUV",
                handle: "suv",
                status: ProductStatus.PUBLISHED,
                metadata: { passengers: 4, luggage: 3 },
                options: [{ title: "Distance band", values: ["A"] }],
                variants: [
                  {
                    title: "A",
                    manage_inventory: false,
                    options: { "Distance band": "A" },
                    prices: [{ currency_code: "qar", amount: 100 }],
                  },
                ],
              },
            ],
          },
        })

        const response = await api.get("/store/add-ons", { headers })

        expect(response.data.add_ons).toEqual([])
      })

      it("carries the Arabic name and the owner's quantity cap", async () => {
        await createAddOn({
          handle: "child-seat",
          title: "Child seat",
          price: 18,
          metadata: { title_ar: "مقعد أطفال", max_quantity: 3 },
        })

        const [addOn] = (await api.get("/store/add-ons", { headers })).data.add_ons

        expect(addOn.title_ar).toEqual("مقعد أطفال")
        expect(addOn.max).toEqual(3)
      })

      it("defaults the cap when the owner has not set one", async () => {
        await createAddOn({ handle: "extra-luggage", title: "Extra luggage", price: 25 })

        const [addOn] = (await api.get("/store/add-ons", { headers })).data.add_ons

        expect(addOn.max).toEqual(4)
      })

      it("sorts cheapest first, so the order is stable between requests", async () => {
        await createAddOn({ handle: "meet-and-greet", title: "Meet & greet", price: 40 })
        await createAddOn({ handle: "child-seat", title: "Child seat", price: 18 })

        const response = await api.get("/store/add-ons", { headers })

        expect(response.data.add_ons.map((a: { amount: number }) => a.amount)).toEqual([18, 40])
      })
    })
  },
})
