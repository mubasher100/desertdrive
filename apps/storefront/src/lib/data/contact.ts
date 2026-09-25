/**
 * Business contact details. One place, because they appear in the header,
 * the footer, the confirmation page and the confirmation email, and they must
 * agree.
 *
 * The phone number (2026-09-21) and the commercial registration number
 * (2026-09-25) are the owner's. The registered ADDRESS is still missing — it
 * is an empty string rather than a plausible-looking placeholder, and every
 * consumer renders nothing rather than a fake. Qatar's E-Commerce Law wants it
 * shown before contracting, so it is still outstanding.
 */
export const CONTACT = {
  phone: {
    /** E.164, for tel: links and WhatsApp deep links. */
    e164: "+97451514161",
    /** As printed. Qatar numbers are conventionally shown as +974 XXXX XXXX. */
    display: "+974 5151 4161",
  },
  whatsapp: {
    e164: "+97451514161",
  },
  email: "bookings@desertdriverental.com",
  /** Qatari commercial registration number, for the footer. Owner-supplied, 25 Sept 2026. */
  cr: "CR 211743",
  /** Legal entity name as it should appear in the footer and on receipts. */
  legalName: "Desert Drive Rent a Car",
  /**
   * Registered business address. Qatar's E-Commerce Law (Law No. 16 of 2010,
   * Art. 6 and the implementing regulations) requires the trader's name,
   * address and registration details to be displayed to the customer before
   * contracting and on the order confirmation. Empty until the owner supplies
   * it; every consumer of this field renders nothing rather than a fake.
   */
  address: { en: "", ar: "" },
} as const

/** A WhatsApp deep link, optionally with a pre-filled message. */
export function whatsappLink(message?: string): string {
  const number = CONTACT.whatsapp.e164.replace(/\D/g, "")
  const text = message ? `?text=${encodeURIComponent(message)}` : ""
  return `https://wa.me/${number}${text}`
}
