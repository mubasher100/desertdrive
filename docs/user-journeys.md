# User journeys

Every way a person uses Desert Drive, and the automated test that walks it.
Tests live in `apps/storefront/e2e/` and run on every pull request (CI job
**Journeys (e2e)**) against the whole stack built from an empty database, at
phone width (375 px) unless noted. A journey without a test is listed as
**manual** and says why.

When a journey changes, change its test in the same pull request.

## Customers — booking

| Id | Journey | Test |
|---|---|---|
| B1 | Arrival: search a place on the home page → see fixed prices → pick a car → flight, name, phone, email → payment page. Booking carries the trip, flight, E.164 phone and the `No delivery` method | `booking.spec.ts` B1 |
| B2 | Departure: same, flight number optional | B2 |
| B3 | Return trip: second leg is the same car, opposite direction; price is exactly twice the one-way | B3 |
| B4 | Extras: child seats charged per seat; meet & greet sign free and needs words on it; WhatsApp offers opt-in recorded with a timestamp | B4 |
| B5 | Start from a car: "Choose this car" on the home page → search → that car preselected | B5 |
| B6 | Details left empty: every problem named, focus on the first one on screen | B6 |
| B7 | Pay by card on SkipCash, return to the confirmation page with a reference, calendar file and WhatsApp | **manual** — SkipCash's page takes a real card; run once with a real card (CLAUDE.md, needs-input 7) |
| B8 | Open the confirmation later from the email's signed link | **manual** — needs a paid order; the token is unit-tested |
| B9 | Payment unavailable (SkipCash down): page says so and offers WhatsApp | **manual** |

## Customers — rules they meet

| Id | Journey | Test |
|---|---|---|
| R1 | Standard car bookable for a pickup an hour away (notice 0, 12 Nov 2026) | `rules.spec.ts` R1 |
| R2 | Luxury cars inside 36 hours: greyed, reason on the card; bookable beyond | R2 |
| R3 | A time already past: refused in the widget with words that say so | R3 |
| R4 | Destination list appears only after typing; each place once | R4 |
| R5 | A place nobody knows: WhatsApp link with what was typed, not a dead end | R5 |
| R6 | A broken or hand-edited results link: back to the search, not an error page | R6 |
| R7 | The car taken by someone else at the same time: greyed "booked at this time" | **manual** — needs two concurrent checkouts; the slot logic is unit-tested |
| R8 | Tap or drag the map pin for a villa on an unnamed street | **manual** — map tiles are third-party; pricing from coordinates is covered by B1 |

## Customers — everything around the funnel

| Id | Journey | Test |
|---|---|---|
| S1 | Home, contact, terms, cancellation, privacy (EN + AR): no sideways scroll, no serious WCAG 2.1 AA violations — phone **and** desktop | `site.spec.ts` S1 |
| S2 | `/` and `/qa/...` land on a page, not a 404 | S2 |
| S3 | Unknown page in Arabic: Arabic 404, right-to-left, with a way back | S3 |
| S4 | Switch language: same page, right-to-left, `lang="ar"` | S4 |
| S5 | Contact details are the current ones (info@, Building 64) on the page and in the footer | S5 |
| S6 | Legal pages final: no draft banner, no `[Owner…]` placeholder | S6 |
| S7 | Loading screen between every step and over Continue-to-payment / Pay | covered inside B1–B5 (the steps wait on it); look checked by screenshot |

## The owner — admin

| Id | Journey | Test |
|---|---|---|
| A1 | Log in on a phone → lands on Bookings with Upcoming / Past / Cancelled | `admin.spec.ts` A1 |
| A2 | Download the WhatsApp offers list (or be told nobody has opted in) | A2 |
| A3 | Prices: every area and band, in dollars | A3 |
| A4 | Open a booking → Message on WhatsApp, pickup on map, cancel, record a refund | **manual** — needs a paid order |
| A5 | New booking email to the office with Open booking / Message on WhatsApp | **manual** — "Send test email" button; delivery checked in Gmail |
| A6 | Draw a priced area on the map | **manual** |

## Found by walking these journeys (12 Nov 2026)

| Finding | Status |
|---|---|
| A ticked meet & greet sign with nothing written went to payment **without** the sign — the server drops a blank board, nobody told the customer | **Fixed** — the form now stops and asks for the words (B4) |
| Empty details form put focus on "Full name", not the first field on screen (Flight number) | **Fixed** — focus follows screen order (B6) |
| "The Pearl" listed twice when a preset area or a second priced area had the same name | **Fixed** — each name offered once (R4) |
| Admin login page says "Welcome to Medusa", not Desert Drive | Open — cosmetic; Medusa's login has no setting for it |
| With 0 notice a customer can pay for a pickup minutes away, and the office email is the only alert | Open — owner's call; someone must watch the office inbox |
