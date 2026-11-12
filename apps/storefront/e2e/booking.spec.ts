import { expect, test } from "@playwright/test"
import { bookingCart, expectAccessible, expectNoSidewaysScroll, fillContact, resultsUrl, searchFromHome } from "./helpers"

/**
 * The booking funnel, end to end, up to the hand-over to SkipCash — the card
 * page is SkipCash's, and paying is not something a test should do.
 * Journey ids (B1…) match docs/user-journeys.md.
 */

test("B1 · arrival from the home page: search, pick a car, details, payment", async ({ page }) => {
  await page.goto("/en-qa")
  await searchFromHome(page, { place: "West Bay", hours: 48 })

  await expect(page).toHaveURL(/\/results\?/)
  await expect(page.getByRole("heading", { name: "Choose your vehicle" })).toBeVisible()
  await expect(page.getByText("This is the price you pay")).toBeVisible()
  await expectNoSidewaysScroll(page)
  await expectAccessible(page)

  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(page).toHaveURL(/\/details\?/)
  await expectNoSidewaysScroll(page)
  await expectAccessible(page)

  await fillContact(page, { flight: "QR123" })
  await page.getByRole("button", { name: /Continue to payment/ }).click()
  await expect(page).toHaveURL(/\/payment/)

  const cart = await bookingCart(page)
  expect(cart.metadata.direction).toBe("arrival")
  expect(cart.metadata.flight_number).toBe("QR123")
  expect(cart.metadata.contact_phone).toBe("+97455551234")
  expect(cart.metadata.legs).toBe(1)
  expect(cart.shipping_methods.map((s) => s.name)).toEqual(["No delivery"])
  await expectNoSidewaysScroll(page)
})

test("B2 · departure: flight number is optional", async ({ page }) => {
  await page.goto(resultsUrl({ direction: "departure" }))
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await expect(page).toHaveURL(/\/details\?/)
  await fillContact(page)
  await page.getByRole("button", { name: /Continue to payment/ }).click()
  await expect(page).toHaveURL(/\/payment/)
  expect((await bookingCart(page)).metadata.direction).toBe("departure")
})

test("B3 · return trip: two legs, twice the one-way fare", async ({ page }) => {
  await page.goto(resultsUrl({ hours: 48 }))
  const oneWay = await page.getByRole("radio").first().innerText()
  await page.goto(resultsUrl({ hours: 48, returnHours: 96 }))
  const twoWay = await page.getByRole("radio").first().innerText()
  const dollars = (s: string) => Number(/\$(\d+)/.exec(s)?.[1])
  expect(dollars(twoWay)).toBe(dollars(oneWay) * 2)

  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await fillContact(page, { flight: "QR1" })
  await page.getByRole("button", { name: /Continue to payment/ }).click()
  await expect(page).toHaveURL(/\/payment/)
  const cart = await bookingCart(page)
  expect(cart.metadata.legs).toBe(2)
  expect(cart.metadata.return_at).toBeTruthy()
})

test("B4 · extras: child seats are charged, the sign is free and needs words, WhatsApp opt-in is recorded", async ({ page }) => {
  await page.goto(resultsUrl({}))
  await page.getByRole("button", { name: "Continue", exact: true }).click()

  await page.getByRole("button", { name: "Add one Child seat" }).click()
  await page.getByRole("button", { name: "Add one Child seat" }).click()
  const sign = page.locator("li", { hasText: "Meet & greet sign" }).first()
  await expect(sign.getByText("Free")).toBeVisible()
  await sign.getByRole("checkbox").check()
  await expect(page.locator('input[type="file"]')).toHaveCount(0)

  await fillContact(page, { flight: "QR2", whatsapp: true })
  // No words on the board yet: the form must say so rather than book a blank sign.
  await page.getByRole("button", { name: /Continue to payment/ }).click()
  await expect(page.getByText("Please write what the sign should say.")).toBeVisible()

  await page.getByLabel("What should the sign say?").fill("Mr E2E")
  await page.getByRole("button", { name: /Continue to payment/ }).click()
  await expect(page).toHaveURL(/\/payment/)

  const cart = await bookingCart(page)
  const line = (h: string) => cart.items.find((i) => i.product_handle === h)
  expect(line("child-seat")?.quantity).toBe(2)
  expect(line("meet-and-greet")?.unit_price).toBe(0)
  expect(cart.metadata.whatsapp_offers).toBe(true)
  expect(cart.metadata.whatsapp_offers_at).toBeTruthy()
})

test("B5 · start from a car: choosing it on the home page preselects it on results", async ({ page }) => {
  await page.goto("/en-qa")
  const cards = page.getByRole("button", { name: "Choose this car" })
  await expect(cards.first()).toBeVisible()
  await cards.nth(1).click()
  const chosen = await page.locator("#book [role=status]").first().innerText()
  const name = chosen.replace(/^Car:\s*/, "").split("\n")[0].trim()
  await expect(page.getByRole("combobox", { name: "Where to?" })).toBeFocused()

  await searchFromHome(page, { hours: 48 })
  await expect(page).toHaveURL(/[?&]car=/)
  await expect(page.getByRole("radio", { checked: true })).toContainText(name)
})

test("B6 · details: missing fields are named, and focus goes to the first", async ({ page }) => {
  await page.goto(resultsUrl({}))
  await page.getByRole("button", { name: "Continue", exact: true }).click()
  await page.getByRole("button", { name: /Continue to payment/ }).click()
  await expect(page).toHaveURL(/\/details\?/)
  await expect(page.getByRole("alert").first()).toBeVisible()
  await expect(page.getByLabel("Flight number")).toBeFocused()
})
