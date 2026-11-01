/**
 * Business contact details. One place, because they appear in the header,
 * the footer, the confirmation page and the confirmation email, and they must
 * agree.
 *
 * All owner-supplied: phone 2026-09-21, commercial registration and registered
 * address 2026-09-25. Qatar's E-Commerce Law wants the trader's name,
 * registration and address shown before contracting and on the confirmation,
 * which is why these live in one place and are printed in the footer, on
 * /contact, in the terms and in the confirmation email.
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
  /** The address customers write to (owner, 1 Nov 2026). Mail is SENT from bookings@; replies come here. */
  email: "info@desertdriverental.com",
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
  address: {
    en: "Al Aqariya Tower, 10/01, Street 137, Al Mathaf, Doha, Qatar",
    // ⚠️ Rendered from the English; needs a native reviewer like the rest of
    // the Arabic copy. Qatar has no postal codes, so none is printed — the
    // "00000" the owner supplied is a form artefact, not part of the address.
    ar: "برج العقارية، 10/01، شارع 137، المتحف، الدوحة، قطر",
  },
} as const

/** A WhatsApp deep link, optionally with a pre-filled message. */
export function whatsappLink(message?: string): string {
  const number = CONTACT.whatsapp.e164.replace(/\D/g, "")
  const text = message ? `?text=${encodeURIComponent(message)}` : ""
  return `https://wa.me/${number}${text}`
}
