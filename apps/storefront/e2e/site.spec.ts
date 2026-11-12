import { expect, test } from "@playwright/test"
import { expectAccessible, expectNoSidewaysScroll } from "./helpers"

/** Everything around the funnel (S1…, docs/user-journeys.md). Runs at phone and desktop width. */

const PAGES = ["/en-qa", "/en-qa/contact", "/en-qa/terms", "/en-qa/cancellation", "/en-qa/privacy", "/ar-qa", "/ar-qa/terms"]

for (const path of PAGES) {
  test(`S1 · ${path} fits the screen and passes WCAG AA`, async ({ page }) => {
    await page.goto(path)
    await expectNoSidewaysScroll(page)
    await expectAccessible(page)
  })
}

test("S2 · a bare address and a bare country land on a page, not a 404", async ({ page }) => {
  await page.goto("/")
  await expect(page).toHaveURL(/\/en-qa$/)
  await page.goto("/qa/contact")
  await expect(page).toHaveURL(/\/en-qa\/contact$/)
})

test("S3 · an unknown page inside Arabic is an Arabic 404 with a way back", async ({ page }) => {
  const res = await page.goto("/ar-qa/no-such-page")
  expect(res?.status()).toBe(404)
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  await expect(page.getByRole("link").first()).toBeVisible()
})

test("S4 · switching language keeps the page and turns it right-to-left", async ({ page }) => {
  await page.goto("/en-qa/contact")
  await page.getByRole("link", { name: "العربية" }).first().click()
  await expect(page).toHaveURL(/\/ar-qa\/contact$/)
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl")
  await expect(page.locator("html")).toHaveAttribute("lang", "ar")
})

test("S5 · contact details are the current ones everywhere they are printed", async ({ page }) => {
  await page.goto("/en-qa/contact")
  await expect(page.getByText("info@desertdriverental.com").first()).toBeVisible()
  await expect(page.getByText(/Building 64/).first()).toBeVisible()
  await expect(page.locator("footer").getByText("info@desertdriverental.com")).toBeVisible()
})

test("S6 · the legal pages are final: no draft banner, no bracketed placeholders", async ({ page }) => {
  for (const path of ["/en-qa/terms", "/en-qa/cancellation", "/en-qa/privacy"]) {
    await page.goto(path)
    const text = await page.locator("main").innerText()
    expect(text, path).not.toMatch(/Structural draft|\[Owner/)
  }
})
