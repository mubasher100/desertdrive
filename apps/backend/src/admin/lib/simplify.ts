/**
 * The owner's admin, simplified (owner's ask, 21 Oct 2026): Bookings and
 * Prices, nothing else in the menu, and Bookings is where you land.
 *
 * Medusa has no setting to hide its own menu items or change the landing page,
 * so this does both from outside, at load:
 *
 *  - a stylesheet hides the menu links the owner does not use. Hidden, not
 *    removed: every page still works if reached by a link — "Full order
 *    details" on a booking opens Medusa's order page on purpose.
 *  - the Orders LIST (exactly /app/orders, where Medusa sends you after
 *    login) is swapped for Bookings. An individual order still opens.
 *
 * ⚠️ This keys on Medusa's menu link addresses. If an upgrade renames one, that
 * item simply reappears — nothing breaks. Settings is kept: it is where the
 * admin password is changed.
 */

const HIDDEN = [
  "/app/orders",
  "/app/products",
  "/app/inventory",
  "/app/customers",
  "/app/promotions",
  "/app/campaigns",
  "/app/price-lists",
  "/app/zones",
]

function install() {
  if (typeof document === "undefined" || document.getElementById("dd-simplify")) return

  const style = document.createElement("style")
  style.id = "dd-simplify"
  // `nav` scoping keeps in-page links (e.g. "Full order details") visible.
  style.textContent = HIDDEN.map((href) => `nav a[href="${href}"], nav a[href^="${href}?"]`).join(",\n") + " { display: none !important; }"
  document.head.appendChild(style)

  const landOnBookings = () => {
    const p = window.location.pathname.replace(/\/+$/, "")
    if (p === "/app/orders" || p === "/app") window.location.replace("/app/bookings")
  }

  // The admin is a single-page app: after login it moves to /app/orders with
  // history.pushState, which fires no event. Watch the history calls too.
  for (const method of ["pushState", "replaceState"] as const) {
    const original = history[method].bind(history)
    history[method] = ((...args: Parameters<History["pushState"]>) => {
      original(...args)
      landOnBookings()
    }) as History["pushState"]
  }
  window.addEventListener("popstate", landOnBookings)
  landOnBookings()
}

install()

export {}
