/**
 * Business contact details. One place, because they appear in the header,
 * the footer, the confirmation page and the confirmation email, and they must
 * agree.
 *
 * ⚠️ PLACEHOLDERS. None of these are the real numbers yet — the owner has not
 * supplied them (CLAUDE.md, "Needs input" #5). They are deliberately obviously
 * fake so that a real-looking wrong number cannot ship by accident. Replace
 * all of them, and the commercial registration number, before launch.
 */
export const CONTACT = {
  phone: {
    /** E.164, for tel: links and WhatsApp deep links. */
    e164: "+97400000000",
    /** As printed. Qatar numbers are conventionally shown as +974 XXXX XXXX. */
    display: "+974 0000 0000",
  },
  whatsapp: {
    e164: "+97400000000",
  },
  email: "bookings@desertdriverental.com",
  /** Qatari commercial registration number, for the footer. */
  cr: "CR 00000",
  /** Legal entity name as it should appear in the footer and on receipts. */
  legalName: "Desert Drive Rent a Car",
} as const

/** A WhatsApp deep link, optionally with a pre-filled message. */
export function whatsappLink(message?: string): string {
  const number = CONTACT.whatsapp.e164.replace(/\D/g, "")
  const text = message ? `?text=${encodeURIComponent(message)}` : ""
  return `https://wa.me/${number}${text}`
}
