import { expect, test } from "@playwright/test"
import { qatarSlot, resultsUrl } from "./helpers"

/** The owner's rules, as a customer meets them (R1…, docs/user-journeys.md). */

test("R1 · a standard car can be booked for a pickup an hour from now", async ({ page }) => {
  await page.goto(resultsUrl({ hours: 1 }))
  const cards = page.getByRole("radio")
  await expect(cards.first()).toBeVisible()
  await expect(cards.first()).toBeEnabled()
  await expect(page.getByRole("button", { name: "Continue", exact: true })).toBeEnabled()
})

test("R2 · luxury cars need 36 hours: greyed with the reason inside it, bookable beyond", async ({ page }) => {
  await page.goto(resultsUrl({ hours: 30 }))
  await expect(page.getByText("Luxury vehicles must be booked at least 36 hours in advance.").first()).toBeVisible()

  await page.goto(resultsUrl({ hours: 40 }))
  await expect(page.getByText(/Luxury vehicles must be booked/)).toHaveCount(0)
})

test("R3 · a time already past is refused in the widget, with words that say so", async ({ page }) => {
  await page.goto("/en-qa")
  const widget = page.locator("#book")
  await widget.getByRole("combobox", { name: "Where to?" }).pressSequentially("West Bay", { delay: 30 })
  await page.getByRole("option").first().click()
  const past = qatarSlot(-2)
  await widget.locator('input[type="date"]').first().fill(past.date)
  await widget.locator('input[type="time"]').first().fill(past.time)
  await widget.getByRole("button", { name: /See prices/ }).click()
  await expect(page).not.toHaveURL(/\/results/)
  await expect(widget.getByRole("alert")).toBeVisible()
})

test("R4 · the destination list appears only once something is typed", async ({ page }) => {
  await page.goto("/en-qa")
  const box = page.getByRole("combobox", { name: "Where to?" })
  await box.click()
  await expect(box).toHaveAttribute("aria-expanded", "false")
  await box.pressSequentially("pea", { delay: 30 })
  await expect(box).toHaveAttribute("aria-expanded", "true")
  await expect(page.getByRole("option").first()).toBeVisible()
  // Each place once: a priced area and a preset area of the same name used to both show.
  const names = (await page.getByRole("option").allInnerTexts()).map((t) => t.split(String.fromCharCode(10))[0].trim())
  expect(names.filter((n) => n === "The Pearl")).toHaveLength(1)
})

test("R5 · a place nobody knows offers WhatsApp with what was typed, not a dead end", async ({ page }) => {
  await page.goto("/en-qa")
  await page.getByRole("combobox", { name: "Where to?" }).pressSequentially("zzqx no such place", { delay: 20 })
  const link = page.getByRole("link", { name: /WhatsApp/ }).first()
  await expect(link).toBeVisible()
  await expect(link).toHaveAttribute("href", /wa\.me/)
})

test("R6 · a tampered results URL with no trip goes back to the search, not a broken page", async ({ page }) => {
  await page.goto("/en-qa/results?direction=arrival")
  await expect(page).toHaveURL(/\/en-qa$/)
})
