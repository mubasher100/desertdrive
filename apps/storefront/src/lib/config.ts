import { MEDUSA_BACKEND_URL } from "@lib/backend-url"
import Medusa from "@medusajs/js-sdk"

/**
 * The Medusa JS SDK client.
 *
 * Always use this rather than a bare `fetch` — it attaches the publishable key
 * and auth headers that the Store API requires, and a request without them is
 * rejected.
 *
 * The Medusa starter wrapped `sdk.client.fetch` to attach an `x-medusa-locale`
 * header read from a cookie. That is removed here, for two reasons:
 *
 *  1. It put a cookie read on EVERY Store API request. Reading cookies during
 *     render forces a route out of static generation, which stops the
 *     incremental cache serving prerendered pages at all — so the wrapper
 *     quietly made the whole storefront dynamic.
 *
 *  2. It was a second, competing source of truth for the locale. Desert Drive
 *     keeps the locale in the URL (`/en-qa`, `/ar-qa`) precisely so that
 *     prerendered pages can have one; a cookie cannot be read during static
 *     generation, so a cookie-based locale ships every cached page in the
 *     default language.
 *
 * The catalogue is translated through `name_ar`-style metadata and the
 * storefront dictionary, not through Medusa's translation module, so no locale
 * header is needed.
 */
export const sdk = new Medusa({
  baseUrl: MEDUSA_BACKEND_URL,
  debug: process.env.NODE_ENV === "development",
  publishableKey: process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY,
})
