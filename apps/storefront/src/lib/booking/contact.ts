import type { Translate } from "@lib/i18n/dictionary"

/**
 * Validation for the details step. Pure — shared by the client form (instant
 * feedback) and the server action (the one that counts).
 */

export type ContactInput = {
  contact_name: string
  contact_phone: string
  contact_email: string
  flight_number: string
  notes: string
}

export type ContactErrors = Partial<Record<keyof ContactInput, string>>

/**
 * Normalises a phone number to E.164.
 *
 * Qatar numbers are 8 digits. A visitor typing "5555 1234", "055551234" or
 * "+974 5555 1234" all mean the same thing, and the driver's phone dials any
 * of them — so accept all of them and store one form. Anything already
 * international is kept as typed (minus spaces).
 */
export function normalisePhone(raw: string): string {
  const digits = raw.replace(/[\s\-().]/g, "")
  if (digits.startsWith("+")) return digits
  if (digits.startsWith("00")) return `+${digits.slice(2)}`
  const local = digits.replace(/^0+/, "")
  // 8 digits: a Qatar number without the country code.
  if (/^\d{8}$/.test(local)) return `+974${local}`
  // 974 + 8 digits typed without the plus.
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

  if (!E164.test(normalisePhone(input.contact_phone))) {
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
