import AxeBuilder from "@axe-core/playwright"
import { expect, type Page } from "@playwright/test"

export const BACKEND = process.env.E2E_BACKEND_URL ?? "http://localhost:9000"
export const KEY = process.env.E2E_PUBLISHABLE_KEY ?? ""

/** A pickup `hours` from now, as the Qatar date and time the widget takes. */
export function qatarSlot(hours: number): { date: string; time: string } {
  const at = new Date(Date.now() + hours * 3_600_000 + 3 * 3_600_000)
  // Round up to the next 5 minutes, as a person would pick it.
  at.setUTCMinutes(Math.ceil((at.getUTCMinutes() + 1) / 5) * 5, 0, 0)
  const iso = at.toISOString()
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) }
}

/** A results URL for a trip, skipping the widget when the widget is not what is under test. */
export function resultsUrl(opts: {
  segment?: string
  hours?: number
  direction?: "arrival" | "departure"
  passengers?: number
  returnHours?: number
  car?: string
}): string {
  const { date, time } = qatarSlot(opts.hours ?? 48)
  const q = new URLSearchParams({
    direction: opts.direction ?? "arrival",
    place_id: "e2e",
    address: "West Bay",
    lat: "25.3215",
    lng: "51.5310",
    date,
    time,
    passengers: String(opts.passengers ?? 2),
    luggage: "2",
  })
  if (opts.returnHours) {
    const back = qatarSlot(opts.returnHours)
    q.set("return_date", back.date)
    q.set("return_time", back.time)
  }
  if (opts.car) q.set("car", opts.car)
  return `/${opts.segment ?? "en-qa"}/results?${q}`
}

/** The search widget, driven the way a customer drives it. */
export async function searchFromHome(page: Page, opts: { place?: string; hours?: number; direction?: "arrival" | "departure" } = {}) {
  const widget = page.locator("#book")
  if (opts.direction === "departure") await widget.getByRole("radio", { name: /To the airport/ }).click()
  const box = widget.getByRole("combobox", { name: "Where to?" })
  await box.click()
  await box.pressSequentially(opts.place ?? "West Bay", { delay: 30 })
  await page.getByRole("option").first().click()
  const { date, time } = qatarSlot(opts.hours ?? 48)
  await widget.locator('input[type="date"]').first().fill(date)
  await widget.locator('input[type="time"]').first().fill(time)
  await widget.getByRole("button", { name: /See prices/ }).click()
}

export async function fillContact(page: Page, opts: { flight?: string; whatsapp?: boolean } = {}) {
  if (opts.flight !== undefined) await page.getByLabel("Flight number").fill(opts.flight)
  await page.getByLabel("Full name").fill("E2E Customer")
  await page.locator('input[name="contact_phone"]').fill("55551234")
  await page.getByLabel("Email").fill("e2e@example.com")
  if (opts.whatsapp) await page.getByRole("checkbox", { name: /offers on WhatsApp/ }).check()
}

/** The booking cart this browser holds, read back from the Store API. */
export async function bookingCart(page: Page) {
  const id = (await page.context().cookies()).find((c) => c.name === "_dd_booking_cart")?.value
  expect(id, "a booking cart cookie").toBeTruthy()
  const res = await fetch(`${BACKEND}/store/carts/${id}?fields=*items,*shipping_methods,*shipping_address,metadata`, {
    headers: { "x-publishable-api-key": KEY },
  })
  expect(res.ok).toBe(true)
  return (await res.json()).cart as {
    metadata: Record<string, unknown>
    items: Array<{ product_handle?: string; quantity: number; unit_price: number }>
    shipping_methods: Array<{ name: string }>
  }
}

/** CLAUDE.md: no horizontal body scroll at any width. */
export async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  expect(overflow, "page wider than the screen").toBeLessThanOrEqual(0)
}

/** WCAG 2.1 AA, as axe-core reads it. Serious and critical only — those block a customer. */
export async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze()
  const blocking = violations.filter((v) => v.impact === "serious" || v.impact === "critical")
  expect(blocking.map((v) => `${v.id}: ${v.help} (${v.nodes.length})`)).toEqual([])
}
