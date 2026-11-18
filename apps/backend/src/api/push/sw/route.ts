import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /push/sw — the admin's service worker: the small script the phone keeps
 * running after the admin is closed, which receives a push and shows it.
 *
 * Served from the backend (the admin's own origin) with
 * `Service-Worker-Allowed: /app/` so it can control the admin at /app even
 * though it lives at /push/sw. Public on purpose: a browser fetches it with
 * no credentials. It holds no secrets and calls nothing.
 */
const SCRIPT = `
self.addEventListener("install", () => self.skipWaiting())
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()))

self.addEventListener("push", (event) => {
  let m = {}
  try { m = event.data ? event.data.json() : {} } catch (_) { m = { title: "Desert Drive", body: event.data && event.data.text() } }
  const title = m.title || "Desert Drive"
  event.waitUntil(self.registration.showNotification(title, {
    body: m.body || "",
    tag: m.tag || undefined,
    renotify: !!m.tag,
    icon: ICON,
    badge: ICON,
    data: { url: m.url || "/app/bookings" },
  }))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const url = new URL((event.notification.data && event.notification.data.url) || "/app/bookings", self.location.origin).href
  event.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true })
    for (const w of wins) {
      if (w.url.startsWith(self.location.origin + "/app")) {
        await w.focus()
        if ("navigate" in w) await w.navigate(url)
        return
      }
    }
    await self.clients.openWindow(url)
  })())
})
`

export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const icon = JSON.stringify((process.env.STOREFRONT_URL || "https://desertdriverental.com").replace(/\/+$/, "") + "/icon.png")
  res.setHeader("Content-Type", "text/javascript; charset=utf-8")
  res.setHeader("Service-Worker-Allowed", "/app/")
  // Re-checked on every visit so a fix reaches phones without reinstalling.
  res.setHeader("Cache-Control", "no-cache")
  res.send(`const ICON = ${icon}\n` + SCRIPT)
}
