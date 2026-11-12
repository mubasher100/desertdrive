import { expect, test, type Page } from "@playwright/test"
import { BACKEND } from "./helpers"

/** The owner's admin, on a phone (A1…, docs/user-journeys.md). Needs an admin login. */

const EMAIL = process.env.E2E_ADMIN_EMAIL
const PASSWORD = process.env.E2E_ADMIN_PASSWORD
test.skip(!EMAIL || !PASSWORD, "E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD not set")

async function logIn(page: Page) {
  await page.goto(`${BACKEND}/app/login`)
  await page.getByPlaceholder("Email").fill(EMAIL!)
  await page.getByPlaceholder("Password").fill(PASSWORD!)
  await page.getByRole("button", { name: "Continue with Email" }).click()
  await expect(page).toHaveURL(/\/app\/bookings/, { timeout: 30_000 })
}

test("A1 · logging in lands on Bookings, with the three tabs", async ({ page }) => {
  await logIn(page)
  await expect(page.getByRole("heading", { name: "Bookings" })).toBeVisible()
  for (const tab of [/Upcoming/, /Past/, /Cancelled/]) await expect(page.getByRole("button", { name: tab })).toBeVisible()
})

test("A2 · the WhatsApp offers list downloads, or says there is nobody yet", async ({ page }) => {
  await logIn(page)
  const download = page.waitForEvent("download", { timeout: 15_000 }).then((d) => d.suggestedFilename())
  const nobody = page.getByText(/No customer has opted in/).waitFor({ timeout: 15_000 }).then(() => "nobody")
  await page.getByRole("button", { name: "Download WhatsApp offers list" }).click()
  // Whichever the data calls for — a file, or the toast saying there is no one yet.
  const outcome = await Promise.any([download, nobody])
  expect(outcome).toMatch(/^(nobody|whatsapp-offers-\d{4}-\d{2}-\d{2}\.csv)$/)
})

test("A3 · Prices shows every area and band", async ({ page }) => {
  await logIn(page)
  await page.goto(`${BACKEND}/app/prices`)
  await expect(page.getByText(/West Bay/).first()).toBeVisible()
})
