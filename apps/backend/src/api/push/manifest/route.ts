import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"

/**
 * GET /push/manifest — makes "Add to Home Screen" install the admin as an app
 * called "DD Bookings" that opens on Bookings, full screen. On iPhone that is
 * the only way a website may receive push notifications (iOS 16.4+).
 */
export async function GET(_req: MedusaRequest, res: MedusaResponse) {
  const site = (process.env.STOREFRONT_URL || "https://desertdriverental.com").replace(/\/+$/, "")
  res.setHeader("Content-Type", "application/manifest+json; charset=utf-8")
  res.setHeader("Cache-Control", "no-cache")
  res.json({
    name: "Desert Drive Bookings",
    short_name: "DD Bookings",
    id: "/app/bookings",
    start_url: "/app/bookings",
    scope: "/app/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#0b1f3a",
    icons: [
      { src: `${site}/icon.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      { src: `${site}/apple-icon.png`, sizes: "180x180", type: "image/png" },
    ],
  })
}
