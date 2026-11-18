/**
 * Makes the admin installable as a Home Screen app, and registers the
 * background script that shows push notifications while it is closed.
 *
 * Medusa's admin has no setting for either, so — like simplify.ts — this is
 * done from outside at load. The manifest and the service worker are served
 * by the backend itself (api/push/manifest, api/push/sw), same origin.
 *
 * iPhone: web push only works for a site added to the Home Screen (Share →
 * Add to Home Screen, iOS 16.4+) and opened from there. Android Chrome works
 * from the browser too.
 */

function addHead(tag: "link" | "meta", attrs: Record<string, string>) {
  const key = attrs.rel ?? attrs.name
  if (document.head.querySelector(`${tag}[${attrs.rel ? "rel" : "name"}="${key}"][data-dd]`)) return
  const el = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
  el.setAttribute("data-dd", "")
  document.head.appendChild(el)
}

function install() {
  if (typeof document === "undefined" || document.documentElement.dataset.ddPwa) return
  document.documentElement.dataset.ddPwa = "1"

  addHead("link", { rel: "manifest", href: "/push/manifest" })
  addHead("link", { rel: "apple-touch-icon", href: "https://desertdriverental.com/apple-icon.png" })
  addHead("meta", { name: "apple-mobile-web-app-capable", content: "yes" })
  addHead("meta", { name: "mobile-web-app-capable", content: "yes" })
  addHead("meta", { name: "apple-mobile-web-app-title", content: "DD Bookings" })
  addHead("meta", { name: "theme-color", content: "#0b1f3a" })

  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/push/sw", { scope: "/app/" }).catch(() => {
      // No service worker, no push; the rest of the admin is unaffected.
    })
  }
}

install()

export {}
