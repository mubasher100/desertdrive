import type { Translate } from "@lib/i18n/dictionary"
import { findDial } from "@lib/data/dial-codes"

/** The dial code behind a contact's selected country, if it picked one. */
export function dialFor(input: Pick<ContactInput, "contact_dial">): string | undefined {
  return findDial(input.contact_dial)?.dial
}

/**
 * Validation for the details step. Pure — shared by the client form (instant
 * feedback) and the server action (the one that counts).
 */

export type ContactInput = {
  contact_name: string
  /** The national number as typed. The country comes from `contact_dial`. */
  contact_phone: string
  /** ISO 3166-1 alpha-2 of the phone's country, e.g. "QA". */
  contact_dial?: string
  contact_email: string
  flight_number: string
  notes: string
}

export type ContactErrors = Partial<Record<keyof ContactInput, string>>

/**
 * Normalises a phone number to E.164.
 *
 * The country normally comes from the dial-code selector, so the field itself
 * holds a national number: "5555 1234" with Qatar selected is +97455551234.
 *
 * A number that is already international wins over the selector, because a
 * customer who types or pastes "+44 7700 900123" means that number whatever
 * the dropdown happens to say. The leading zero of a national trunk prefix is
 * dropped — "07700 900123" with the UK selected is +447700900123, not
 * +4407700900123, which is a number that does not exist.
 */
export function normalisePhone(raw: string, dial?: string): string {
  const digits = raw.replace(/[\s\-().]/g, "")
  if (digits.startsWith("+")) return digits
  if (digits.startsWith("00")) return `+${digits.slice(2)}`

  const local = digits.replace(/^0+/, "")
  if (!local) return digits

  if (dial) {
    // Already typed with the country code in front of it.
    if (local.startsWith(dial) && local.length > dial.length) return `+${local}`
    return `+${dial}${local}`
  }

  // No selector (an older link, or the server re-checking a stored value):
  // fall back to the previous behaviour of assuming Qatar for 8 digits.
  if (/^\d{8}$/.test(local)) return `+974${local}`
  if (/^974\d{8}$/.test(local)) return `+${local}`
  return digits
}

const E164 = /^\+[1-9]\d{6,14}$/
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// Two-letter (or letter+digit) airline code, 1–4 digit number, optional suffix.
const FLIGHT = /^[A-Z0-9]{2}\s?\d{1,4}[A-Z]?$/

export function validateContact(
  input: ContactInput,
  opts: { flightRequired: boolean },
  t: Translate
): ContactErrors {
  const errors: ContactErrors = {}

  if (input.contact_name.trim().length < 2) {
    errors.contact_name = t("details.error.name")
  }

  if (!E164.test(normalisePhone(input.contact_phone, dialFor(input)))) {
    errors.contact_phone = t("details.error.phone")
  }

  if (!EMAIL.test(input.contact_email.trim())) {
    errors.contact_email = t("details.error.email")
  }

  const flight = input.flight_number.trim().toUpperCase()
  if (opts.flightRequired && !flight) {
    errors.flight_number = t("details.error.flightRequired")
  } else if (flight && !FLIGHT.test(flight)) {
    errors.flight_number = t("details.error.flightFormat")
  }

  if (input.notes.length > 500) {
    errors.notes = t("details.error.notes")
  }

  return errors
}
