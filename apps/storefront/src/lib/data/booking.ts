"use server"

import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import type { HttpTypes } from "@medusajs/types"
import { sdk } from "@lib/config"
import { getRegion } from "@lib/data/regions"
import { getQuote } from "@lib/data/quotes"
import { pickupAtIso, tripToQuery, type Trip } from "@lib/booking/trip"
import { normalisePhone, validateContact, type ContactInput } from "@lib/booking/contact"
import { signBookingToken, verifyBookingToken } from "@lib/booking/token"
import { createTranslator } from "@lib/i18n/dictionary"
import { localeOf } from "@lib/util/locale"
import { checkLeadTime, checkLeadTimeIso, leadTimeLabel } from "@lib/booking/lead-time"

/**
 * The booking's own data layer. Separate from the starter's cart.ts on
 * purpose: that file caches the cart with force-cache and a per-visitor tag,
 * and CLAUDE.md is explicit that the cart must be no-store. Everything here is
 * no-store, and every export is async because this is a "use server" module.
 */

const CART_COOKIE = "_dd_booking_cart"
const NO_DELIVERY = "No delivery"

const CART_FIELDS =
  "id,email,total,subtotal,shipping_total,currency_code,metadata," +
  "*items,*items.variant,*items.product,+items.total,*shipping_methods,*shipping_address"

async function getCartId() {
  return (await cookies()).get(CART_COOKIE)?.value
}

async function setCartId(id: string) {
  ;(await cookies()).set(CART_COOKIE, id, {
    maxAge: 60 * 60 * 2, // two hours — a booking in progress, not a shopping cart
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  })
}

async function clearCartId() {
  ;(await cookies()).set(CART_COOKIE, "", { maxAge: -1, path: "/" })
}

export type BookingCart = HttpTypes.StoreCart

/**
 * The booking in progress, or null. Never cached.
 *
 * A cart that has already become an order reads as absent. The cookie cannot
 * always be cleared at the moment of completion — the SkipCash return page is
 * a Server Component render, where Next forbids cookie writes — so the cookie
 * may outlive the cart by up to two hours. Treating a completed cart as "no
 * booking in progress" makes that harmless.
 */
export async function retrieveBookingCart(): Promise<BookingCart | null> {
  const id = await getCartId()
  if (!id) return null

  return sdk.client
    .fetch<HttpTypes.StoreCartResponse>(`/store/carts/${id}`, {
      method: "GET",
      query: { fields: CART_FIELDS + ",completed_at" },
      cache: "no-store",
    })
    .then(({ cart }) => (cart.completed_at ? null : cart))
    .catch(() => null)
}

export type CreateBookingResult =
  | { ok: true }
  | { ok: false; errors: Record<string, string>; message?: string }

/**
 * Step 3 → 4. Turns the trip, the chosen vehicle and the contact details into
 * a Medusa cart, then sends the visitor to payment.
 *
 * The variant id came from the results page, i.e. from the browser. It is NOT
 * trusted: the trip is re-quoted here and the variant must be one the server
 * would have offered for these coordinates and this party size. Anything else
 * is a tampered URL and goes back to results.
 */
export async function createBookingCart(
  segment: string,
  trip: Trip,
  variantId: string,
  contact: ContactInput
): Promise<CreateBookingResult> {
  const t = createTranslator(localeOf(segment))

  const errors = validateContact(contact, { flightRequired: trip.direction === "arrival" }, t)
  if (Object.keys(errors).length) {
    return { ok: false, errors }
  }

  /**
   * The server's own lead-time check. The widget and the results page both
   * check it too, but this is the one that counts: everything before it is in
   * the browser's hands, and the details form can sit open for an hour.
   */
  const lead = checkLeadTime(trip.date, trip.time)
  if (lead) {
    return {
      ok: false,
      errors: {},
      message:
        lead === "past"
          ? t("search.error.past")
          : t("search.error.tooSoon", { lead: leadTimeLabel(localeOf(segment)) }),
    }
  }

  const quote = await getQuote({
    lat: trip.area.lat,
    lng: trip.area.lng,
    passengers: trip.passengers,
    luggage: trip.luggage,
    pickup_at: pickupAtIso(trip),
  })
  const vehicle = quote?.vehicles.find((v) => v.variant_id === variantId)
  // An unavailable vehicle is treated exactly like a tampered variant: back to
  // results, where the card is greyed out and the reason is on the page.
  if (!quote || !vehicle || !vehicle.available) {
    redirect(`/${segment}/results?${tripToQuery(trip)}`)
  }

  const region = await getRegion(segment)
  if (!region) {
    return { ok: false, errors: {}, message: t("details.error.generic") }
  }

  const phone = normalisePhone(contact.contact_phone)
  const email = contact.contact_email.trim().toLowerCase()
  const name = contact.contact_name.trim()
  const [first_name, ...rest] = name.split(/\s+/)
  const last_name = rest.join(" ") || "-"

  try {
    // 1. The cart, with the trip on its metadata. These key names are the
    //    contract shared with the confirmation email and the admin screen —
    //    see CLAUDE.md, "Booking details ride on metadata".
    const { cart } = await sdk.store.cart.create({
      region_id: region.id,
      email,
      metadata: {
        direction: trip.direction,
        pickup_at: pickupAtIso(trip),
        flight_number: contact.flight_number.trim().toUpperCase() || null,
        passengers: trip.passengers,
        luggage: trip.luggage,
        area_id: trip.area.id,
        address: trip.area.name_en, // English on purpose: the driver reads it
        lat: trip.area.lat,
        lng: trip.area.lng,
        band_code: quote.band.code,
        distance_km: quote.distance_km,
        contact_name: name,
        contact_phone: phone,
        contact_email: email,
        notes: contact.notes.trim() || null,
        vehicle_title: vehicle.title,
        vehicle_title_ar: vehicle.title_ar,
        locale: segment,
      },
    })

    // 2. The vehicle, at the price the server just resolved.
    await sdk.store.cart.createLineItem(cart.id, { variant_id: vehicle.variant_id, quantity: 1 })

    // 3. Minimal addresses. Nothing is shipped, but Medusa's shipping-option
    //    lookup and tax calculation both key off the country.
    await sdk.store.cart.update(cart.id, {
      shipping_address: { first_name, last_name, address_1: trip.area.name_en, city: "Doha", country_code: "qa", phone },
      billing_address: { first_name, last_name, address_1: trip.area.name_en, city: "Doha", country_code: "qa" },
    })

    // 4. The zero-cost "No delivery" method. Load-bearing: completeCart
    //    refuses without a shipping method. Selected silently, by name.
    const { shipping_options } = await sdk.store.fulfillment.listCartOptions({ cart_id: cart.id })
    const option = shipping_options.find((o) => o.name === NO_DELIVERY) ?? shipping_options[0]
    if (!option) {
      throw new Error(`No shipping option available for cart ${cart.id} — has seed-qatar.ts been run?`)
    }
    await sdk.store.cart.addShippingMethod(cart.id, { option_id: option.id })

    await setCartId(cart.id)
  } catch (e) {
    console.error("createBookingCart failed", e)
    return { ok: false, errors: {}, message: t("details.error.generic") }
  }

  redirect(`/${segment}/payment`)
}

/**
 * Step 4, cash path. Confirms the booking instantly with payment pending —
 * there is no ops-accept step; the owner commits to every booking taken and
 * marks the cash collected in the admin.
 *
 * Uses Medusa's manual provider (pp_system_default). It authorises without
 * taking money; capture is the owner's "cash received" click.
 */
export async function confirmCashBooking(segment: string, accepted: boolean): Promise<{ message: string } | never> {
  const t = createTranslator(localeOf(segment))
  const cart = await retrieveBookingCart()
  if (!cart) {
    redirect(`/${segment}`)
  }

  const pickupAt = String((cart.metadata ?? {}).pickup_at ?? "")
  const lead = checkLeadTimeIso(pickupAt)
  if (lead) {
    return {
      message:
        lead === "past"
          ? t("search.error.past")
          : t("search.error.tooSoon", { lead: leadTimeLabel(localeOf(segment)) }),
    }
  }

  let orderId: string
  try {
    if (!(await recordConsent(cart, accepted))) {
      return { message: t("payment.consent.required") }
    }

    // Hold the car before the order exists. Two people confirming the same
    // slot at the same second: one of them gets this message instead of a
    // booking the owner cannot drive.
    const held = await reserveVehicle(cart.id)
    if (held !== "ok") {
      return { message: held === "taken" ? t("payment.error.taken") : t("payment.error.generic") }
    }
    const { payment_collection } = await sdk.store.payment.initiatePaymentSession(cart, {
      provider_id: "pp_system_default",
    })
    if (!payment_collection) {
      throw new Error("No payment collection returned")
    }

    const result = await sdk.store.cart.complete(cart.id)
    if (result.type !== "order") {
      throw new Error(`Cart did not complete: ${JSON.stringify(result.error ?? result)}`)
    }
    orderId = result.order.id
  } catch (e) {
    console.error("confirmCashBooking failed", e)
    return { message: t("payment.error.generic") }
  }

  await clearCartId()
  redirect(`/${segment}/confirmed/${orderId}?t=${signBookingToken(orderId)}`)
}

/**
 * Holds the vehicle for this cart's pickup time.
 *
 * Called immediately before money or an order is created — completing a cart
 * or sending the customer to SkipCash — because a hold taken any earlier would
 * strand cars behind browsing, and any later would be a hold on something
 * already sold.
 *
 * Returns the reason on refusal rather than throwing: "someone took the last
 * car" is an ordinary outcome of two people booking at once, not a fault.
 */
async function reserveVehicle(cartId: string): Promise<"ok" | "taken" | "error"> {
  try {
    await sdk.client.fetch("/store/reservations", {
      method: "POST",
      body: { cart_id: cartId },
      cache: "no-store",
    })
    return "ok"
  } catch (e) {
    const status = (e as { status?: number })?.status
    if (status === 409) {
      return "taken"
    }
    console.error("reserveVehicle failed", e)
    return "error"
  }
}

const SKIPCASH_PROVIDER = "pp_skipcash_skipcash"

/** Bump when the wording of /terms, /cancellation or /privacy changes materially. */
const TERMS_VERSION = "2026-09-21"

/**
 * Records the customer's acceptance of the terms on the cart, so it is carried
 * onto the order as evidence of when (and which version) they agreed to.
 * Qatar's E-Commerce Law (No. 16 of 2010) makes the contract conditional on
 * the customer having had the terms made available before confirming; the
 * timestamp is what shows that happened. Returns false if they did not tick.
 */
async function recordConsent(cart: BookingCart, accepted: boolean): Promise<boolean> {
  if (!accepted) return false
  await sdk.store.cart.update(cart.id, {
    metadata: { ...(cart.metadata ?? {}), terms_accepted_at: new Date().toISOString(), terms_version: TERMS_VERSION },
  })
  return true
}

/** Whether card payment is available: the provider is enabled on the region. */
export async function cardPaymentAvailable(segment: string): Promise<boolean> {
  const region = await getRegion(segment)
  if (!region) return false
  return sdk.client
    .fetch<{ payment_providers: Array<{ id: string }> }>("/store/payment-providers", {
      method: "GET",
      query: { region_id: region.id },
      cache: "no-store",
    })
    .then(({ payment_providers }) => payment_providers.some((p) => p.id === SKIPCASH_PROVIDER))
    .catch(() => false)
}

/**
 * Step 4, card path. Opens a SkipCash payment for the cart and sends the
 * customer to SkipCash's hosted page. They come back to /payment/return, where
 * the cart is completed and SkipCash is asked whether it was actually paid.
 *
 * Nothing about the amount is sent from here — Medusa gives the provider the
 * cart total. What goes across is who is paying and where to come back to.
 */
export async function startCardPayment(segment: string, accepted: boolean): Promise<{ message: string } | never> {
  const t = createTranslator(localeOf(segment))
  const cart = await retrieveBookingCart()
  if (!cart) {
    redirect(`/${segment}`)
  }
  if (!(await recordConsent(cart, accepted).catch(() => false))) {
    return { message: t("payment.consent.required") }
  }

  const pickupAt = String((cart.metadata ?? {}).pickup_at ?? "")
  const lead = checkLeadTimeIso(pickupAt)
  if (lead) {
    return {
      message:
        lead === "past"
          ? t("search.error.past")
          : t("search.error.tooSoon", { lead: leadTimeLabel(localeOf(segment)) }),
    }
  }

  // Held before the customer leaves for SkipCash, so the car is still theirs
  // when they come back from a 3-D Secure challenge three minutes later. The
  // hold lapses on its own if they abandon the payment.
  const held = await reserveVehicle(cart.id)
  if (held !== "ok") {
    return { message: held === "taken" ? t("payment.error.taken") : t("payment.error.generic") }
  }

  const m = (cart.metadata ?? {}) as Record<string, unknown>
  const name = String(m.contact_name ?? "").trim()
  const [first_name, ...rest] = name.split(/\s+/)
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:8000"

  let payUrl: string | undefined
  try {
    const { payment_collection } = await sdk.store.payment.initiatePaymentSession(cart, {
      provider_id: SKIPCASH_PROVIDER,
      data: {
        first_name: first_name || "Customer",
        last_name: rest.join(" ") || "-",
        phone: String(m.contact_phone ?? ""),
        email: String(m.contact_email ?? cart.email ?? ""),
        return_url: `${baseUrl}/${segment}/payment/return`,
        reference: cart.id,
      },
    })
    const session = payment_collection?.payment_sessions?.find((s) => s.provider_id === SKIPCASH_PROVIDER)
    payUrl = (session?.data as { pay_url?: string } | undefined)?.pay_url
  } catch (e) {
    console.error("startCardPayment failed", e)
  }

  if (!payUrl) {
    return { message: t("payment.error.generic") }
  }

  redirect(payUrl)
}

export type CardReturnResult =
  | { status: "confirmed"; orderId: string; token: string }
  | { status: "unpaid" }
  | { status: "expired" }

/**
 * Back from SkipCash. Completing the cart makes Medusa ask the provider to
 * authorise, and the provider asks SkipCash whether the payment is actually
 * paid — the redirect itself proves nothing and is not trusted. If the
 * webhook already completed the cart, Medusa hands back the existing order.
 */
export async function completeCardBooking(): Promise<CardReturnResult> {
  const cart = await retrieveBookingCart()
  if (!cart) {
    return { status: "expired" }
  }

  try {
    const result = await sdk.store.cart.complete(cart.id)
    if (result.type === "order") {
      // No clearCartId() here: this runs during the return page's render, and
      // Next only allows cookie writes in Server Actions and Route Handlers.
      // retrieveBookingCart() ignores completed carts, so the cookie is inert.
      return { status: "confirmed", orderId: result.order.id, token: signBookingToken(result.order.id) }
    }
    console.warn("completeCardBooking: cart not completed", result.error)
    return { status: "unpaid" }
  } catch (e) {
    // "not authorized with the provider" is the ordinary abandoned/declined
    // outcome, not a fault: the customer came back without paying.
    const msg = e instanceof Error ? e.message : String(e)
    if (/not authorized/i.test(msg)) console.warn("completeCardBooking: payment not authorized", msg)
    else console.error("completeCardBooking failed", e)
    return { status: "unpaid" }
  }
}

export type Booking = HttpTypes.StoreOrder

/**
 * The confirmed booking, gated by its signed token. A bad or missing token
 * gets null — never a 403 that confirms the id exists.
 */
export async function retrieveBooking(orderId: string, token: string | undefined): Promise<Booking | null> {
  if (!/^order_[A-Z0-9]+$/.test(orderId) || !verifyBookingToken(orderId, token)) {
    return null
  }

  return sdk.client
    .fetch<{ order: HttpTypes.StoreOrder }>(`/store/orders/${orderId}`, {
      method: "GET",
      query: {
        fields:
          "id,display_id,status,payment_status,email,total,currency_code,metadata,created_at,*items,*items.variant,*items.product",
      },
      cache: "no-store",
    })
    .then(({ order }) => order)
    .catch(() => null)
}
