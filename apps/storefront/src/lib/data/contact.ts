/**
 * Business contact details. One place, because they appear in the header,
 * the footer, the confirmation page and the confirmation email, and they must
 * agree.
 *
 * The phone number is the owner's (supplied 2026-09-21) and is used for calls
 * and WhatsApp alike. The commercial registration number and registered
 * address are still PLACEHOLDERS — deliberately obviously fake so a real-
 * looking wrong value cannot ship by accident. Replace before launch.
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
  /** Qatari commercial registration number, for the footer. */
  cr: "CR 00000",
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
