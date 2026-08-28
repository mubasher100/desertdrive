import type { Language } from "@lib/util/locale"

/**
 * Interface copy, keyed by a flat dot-namespaced string.
 *
 * Flat rather than nested so a key is greppable: searching for
 * `search.direction.fromAirport` finds both the definition and every use.
 *
 * ⚠️ THE ARABIC HERE HAS NOT BEEN REVIEWED BY A NATIVE SPEAKER.
 *
 * It follows conventional Gulf usage rather than literal translation of the
 * English, but it must be checked before launch — see CLAUDE.md. Wording that is
 * technically correct and idiomatically wrong reads as machine-translated, and
 * on a payment flow that costs trust at exactly the wrong moment.
 *
 * Two conventions worth not "correcting":
 *
 *  - **Western digits** (`40 ر.ق`, `14:30`), not Eastern Arabic numerals.
 *    Eastern numerals are correct but unconventional in Qatari e-commerce and
 *    read as unfamiliar.
 *  - **Form values the driver reads stay English.** Area names on the printed
 *    job sheet and time windows are read aloud by a driver at 4am. Those are not
 *    interface copy and are not translated here.
 */

export const dictionary = {
  en: {
    "common.brand": "Desert Drive",
    "common.tagline": "Explore with ease",
    "common.currency": "QAR",
    "common.continue": "Continue",
    "common.back": "Back",
    "common.loading": "Loading",
    "common.skipToContent": "Skip to content",

    "nav.home": "Home",
    "nav.fleet": "Our fleet",
    "nav.howItWorks": "How it works",
    "nav.faq": "FAQ",
    "nav.contact": "Contact",

    "language.switch": "العربية",
    "language.label": "Change language",

    "search.title": "Airport transfers in Qatar, at a fixed price",
    "search.subtitle":
      "Book a licensed driver to or from Hamad International. The price you see is the price you pay.",
    "search.direction.label": "Direction",
    "search.direction.fromAirport": "From the airport",
    "search.direction.toAirport": "To the airport",
    "search.destination.label": "Where to?",
    "search.destination.labelDeparture": "Where from?",
    "search.destination.placeholder": "Enter a hotel, address or area",
    "search.date.label": "Date",
    "search.time.label": "Time",
    "search.passengers.label": "Passengers",
    "search.luggage.label": "Bags",
    "search.submit": "See prices",

    "trust.licensed.title": "Licensed drivers",
    "trust.licensed.body": "Every driver is licensed and knows Qatar.",
    "trust.flight.title": "Flight tracking",
    "trust.flight.body": "We watch your flight and adjust for delays.",
    "trust.waiting.title": "Free waiting time",
    "trust.waiting.body": "60 minutes free on arrivals, 15 on departures.",
    "trust.fixed.title": "Fixed price",
    "trust.fixed.body": "No meter, no surge, no surprises.",

    "results.title": "Choose your vehicle",
    "results.fixedPrice": "This is the price you pay. No meter, no surge.",
    "results.passengers": "Up to {count} passengers",
    "results.luggage": "Up to {count} bags",
    "results.select": "Select",
    "results.empty.title": "We can't price this trip online yet",
    "results.empty.body":
      "We haven't published a fare for this area. Contact us and we'll quote you directly.",
    "results.tooManyPassengers":
      "No vehicle fits {count} passengers. Contact us to arrange more than one car.",

    "details.title": "Your details",
    "details.flightNumber": "Flight number",
    "details.flightNumber.help": "So we can track delays.",
    "details.flightNumber.placeholder": "QR123",
    "details.name": "Full name",
    "details.phone": "Mobile number",
    "details.phone.help": "The driver will call this number.",
    "details.email": "Email",
    "details.email.help": "Your confirmation is sent here.",
    "details.notes": "Pickup notes",
    "details.notes.placeholder": "Building name, gate, anything that helps",

    "payment.title": "Payment",
    "payment.card": "Pay by card now",
    "payment.cash": "Pay the driver in cash",
    "payment.cash.help": "Your booking is confirmed either way.",

    "confirmed.title": "Your booking is confirmed",
    "confirmed.reference": "Booking reference",
    "confirmed.addToCalendar": "Add to calendar",
    "confirmed.whatsapp": "Message us on WhatsApp",

    "error.notFound.title": "Page not found",
    "error.notFound.body": "That page doesn't exist. Let's get you back.",
    "error.notFound.action": "Go to the home page",
  },

  ar: {
    "common.brand": "ديزرت درايف",
    "common.tagline": "استكشف بكل سهولة",
    "common.currency": "ر.ق",
    "common.continue": "متابعة",
    "common.back": "رجوع",
    "common.loading": "جارٍ التحميل",
    "common.skipToContent": "تخطٍ إلى المحتوى",

    "nav.home": "الرئيسية",
    "nav.fleet": "أسطولنا",
    "nav.howItWorks": "كيف تعمل الخدمة",
    "nav.faq": "الأسئلة الشائعة",
    "nav.contact": "اتصل بنا",

    "language.switch": "English",
    "language.label": "تغيير اللغة",

    "search.title": "توصيل من وإلى المطار في قطر بسعر ثابت",
    "search.subtitle":
      "احجز سائقًا مرخصًا من مطار حمد الدولي أو إليه. السعر الذي تراه هو السعر الذي تدفعه.",
    "search.direction.label": "الاتجاه",
    "search.direction.fromAirport": "من المطار",
    "search.direction.toAirport": "إلى المطار",
    "search.destination.label": "إلى أين؟",
    "search.destination.labelDeparture": "من أين؟",
    "search.destination.placeholder": "أدخل الفندق أو العنوان أو المنطقة",
    "search.date.label": "التاريخ",
    "search.time.label": "الوقت",
    "search.passengers.label": "عدد الركاب",
    "search.luggage.label": "الحقائب",
    "search.submit": "عرض الأسعار",

    "trust.licensed.title": "سائقون مرخصون",
    "trust.licensed.body": "جميع سائقينا مرخصون ويعرفون قطر جيدًا.",
    "trust.flight.title": "متابعة الرحلات",
    "trust.flight.body": "نتابع رحلتك ونعدّل موعد الاستقبال عند التأخير.",
    "trust.waiting.title": "انتظار مجاني",
    "trust.waiting.body": "٦٠ دقيقة مجانًا عند الوصول و١٥ دقيقة عند المغادرة.",
    "trust.fixed.title": "سعر ثابت",
    "trust.fixed.body": "بدون عدّاد وبدون زيادات وبدون مفاجآت.",

    "results.title": "اختر سيارتك",
    "results.fixedPrice": "هذا هو السعر الذي تدفعه. بدون عدّاد وبدون زيادات.",
    "results.passengers": "حتى {count} ركاب",
    "results.luggage": "حتى {count} حقائب",
    "results.select": "اختيار",
    "results.empty.title": "لا يمكننا تسعير هذه الرحلة عبر الموقع حاليًا",
    "results.empty.body":
      "لم نحدد سعرًا لهذه المنطقة بعد. تواصل معنا وسنزوّدك بالسعر مباشرة.",
    "results.tooManyPassengers":
      "لا توجد سيارة تتسع لـ {count} ركاب. تواصل معنا لترتيب أكثر من سيارة.",

    "details.title": "بياناتك",
    "details.flightNumber": "رقم الرحلة",
    "details.flightNumber.help": "لنتمكن من متابعة التأخير.",
    "details.flightNumber.placeholder": "QR123",
    "details.name": "الاسم الكامل",
    "details.phone": "رقم الجوال",
    "details.phone.help": "سيتصل بك السائق على هذا الرقم.",
    "details.email": "البريد الإلكتروني",
    "details.email.help": "سنرسل تأكيد الحجز إلى هذا البريد.",
    "details.notes": "ملاحظات الاستقبال",
    "details.notes.placeholder": "اسم المبنى أو البوابة أو أي تفاصيل تساعدنا",

    "payment.title": "الدفع",
    "payment.card": "ادفع بالبطاقة الآن",
    "payment.cash": "ادفع للسائق نقدًا",
    "payment.cash.help": "حجزك مؤكد في الحالتين.",

    "confirmed.title": "تم تأكيد حجزك",
    "confirmed.reference": "رقم الحجز",
    "confirmed.addToCalendar": "إضافة إلى التقويم",
    "confirmed.whatsapp": "راسلنا على واتساب",

    "error.notFound.title": "الصفحة غير موجودة",
    "error.notFound.body": "هذه الصفحة غير موجودة. دعنا نعيدك إلى المسار.",
    "error.notFound.action": "الذهاب إلى الصفحة الرئيسية",
  },
} satisfies Record<Language, Record<string, string>>

/** Every key that exists. English is the source of truth for the key set. */
export type TranslationKey = keyof (typeof dictionary)["en"]

export type Translate = (
  key: TranslationKey,
  values?: Record<string, string | number>
) => string

/**
 * Builds the lookup for a language.
 *
 * A missing key falls back to English rather than rendering the raw key, so a
 * half-translated page degrades into a readable mixed-language page instead of
 * showing `results.empty.title` to a customer.
 */
export function createTranslator(language: Language): Translate {
  const table = dictionary[language] as Record<string, string>
  const fallback = dictionary.en as Record<string, string>

  return (key, values) => {
    const template = table[key] ?? fallback[key] ?? String(key)

    if (!values) {
      return template
    }

    return Object.entries(values).reduce(
      (out, [name, value]) => out.replaceAll(`{${name}}`, String(value)),
      template
    )
  }
}
