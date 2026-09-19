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
 * ⚠️ NO INVENTED BUSINESS TERMS. Free-waiting minutes, cancellation windows and
 * refund rules come from the owner. Until they are supplied, copy says "at no
 * extra cost" and "see the policy" — never a number.
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
    "search.formTitle": "Book an airport transfer",
    "search.footnote": "Fixed price. No hidden fees, no surge.",
    "search.error.destination": "Choose where you're going.",
    "search.error.datetime": "Choose a date and time.",

    "home.hero.eyebrow": "Doha · Hamad International Airport",
    "home.fleet.title": "Choose your vehicle",
    "home.fleet.subtitle": "Every car comes with a licensed driver. Prices are for central Doha; longer trips are quoted at a fixed rate before you book.",
    "home.fleet.fromLabel": "From",
    "home.fleet.passengers": "{count} passengers",
    "home.fleet.luggage": "{count} bags",
    "home.how.title": "How it works",
    "home.how.1.title": "Tell us where",
    "home.how.1.body": "Pick your destination, date and time. You'll see the fixed price for every vehicle class before you enter a single detail.",
    "home.how.2.title": "Add your flight",
    "home.how.2.body": "We track it. If you land late, your driver is still there.",
    "home.how.3.title": "Pay your way",
    "home.how.3.body": "Card now, or cash to the driver. Either way your booking is confirmed instantly.",
    "home.airport.title": "Private transfers from Hamad International",
    "home.airport.body": "Your driver meets you in the arrivals hall with a name sign, helps with your bags and takes you straight to your door — no queue, no meter, no negotiating. Every driver is licensed, every car is air-conditioned, and the price you booked is the price you pay.",
    "home.faq.title": "Frequently asked questions",
    "home.faq.1.q": "What if my flight is delayed?",
    "home.faq.1.a": "We track your flight number and adjust the pickup automatically. Your driver waits for you after landing at no extra cost.",
    "home.faq.2.q": "Where will I meet my driver?",
    "home.faq.2.a": "In the arrivals hall, holding a sign with your name. Your confirmation includes the driver's contact number.",
    "home.faq.3.q": "Can I pay in cash?",
    "home.faq.3.a": "Yes. Choose 'Pay the driver' at checkout and pay in Qatari riyals on the day. Your booking is confirmed either way.",
    "home.faq.4.q": "Is the price really fixed?",
    "home.faq.4.a": "Yes. The fare depends on your destination and vehicle, not on traffic or time of day. No surcharges on arrival.",
    "home.faq.5.q": "Can I cancel?",
    "home.faq.5.a": "Yes. See our cancellation and refund policy for the terms.",

    "nav.call": "Call us",
    "nav.whatsapp": "WhatsApp",
    "footer.tagline": "Explore with ease.",
    "footer.contact": "Contact",
    "footer.legal": "Legal",
    "footer.terms": "Terms & conditions",
    "footer.cancellation": "Cancellation & refunds",
    "footer.privacy": "Privacy policy",
    "footer.rights": "All rights reserved.",
    "footer.photoCredit": "Skyline photo:",

    "trust.licensed.title": "Licensed drivers",
    "trust.licensed.body": "Every driver is licensed and knows Qatar.",
    "trust.flight.title": "Flight tracking",
    "trust.flight.body": "We watch your flight and adjust for delays.",
    "trust.waiting.title": "Free waiting time",
    "trust.waiting.body": "Your driver waits after you land, at no extra cost.",
    "trust.fixed.title": "Fixed price",
    "trust.fixed.body": "No meter, no surge, no surprises.",

    "results.title": "Choose your vehicle",
    "results.fixedPrice": "This is the price you pay. No meter, no surge.",
    "results.passengers": "Up to {count} passengers",
    "results.luggage": "Up to {count} bags",
    "results.select": "Select",
    "results.selected": "Selected",
    "results.passengersShort": "{count} pax",
    "results.luggageShort": "{count} bags",
    "results.error.body":
      "We couldn't get a price just now. Try again in a moment, or contact us and we'll book it for you.",

    "trip.route": "Route",
    "trip.when": "Pickup time",
    "trip.party": "Party",
    "trip.change": "Change",
    "trip.airportTo": "Airport → {place}",
    "trip.placeToAirport": "{place} → Airport",
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
    "search.formTitle": "احجز توصيلًا من المطار أو إليه",
    "search.footnote": "سعر ثابت. بلا رسوم خفية وبلا زيادات.",
    "search.error.destination": "اختر وجهتك.",
    "search.error.datetime": "اختر التاريخ والوقت.",

    "home.hero.eyebrow": "الدوحة · مطار حمد الدولي",
    "home.fleet.title": "اختر سيارتك",
    "home.fleet.subtitle": "كل سيارة مع سائق مرخّص. الأسعار الموضحة لوسط الدوحة، والرحلات الأبعد بسعر ثابت تراه قبل الحجز.",
    "home.fleet.fromLabel": "ابتداءً من",
    "home.fleet.passengers": "{count} ركاب",
    "home.fleet.luggage": "{count} حقائب",
    "home.how.title": "كيف تعمل الخدمة",
    "home.how.1.title": "حدّد وجهتك",
    "home.how.1.body": "اختر الوجهة والتاريخ والوقت، وسترى السعر الثابت لكل فئة سيارة قبل إدخال أي بيانات.",
    "home.how.2.title": "أضف رقم رحلتك",
    "home.how.2.body": "نتابع رحلتك. إن تأخر وصولك، سيكون سائقك بانتظارك.",
    "home.how.3.title": "ادفع بالطريقة التي تناسبك",
    "home.how.3.body": "بالبطاقة الآن أو نقدًا للسائق. حجزك مؤكد فورًا في الحالتين.",
    "home.airport.title": "توصيل خاص من مطار حمد الدولي",
    "home.airport.body": "يستقبلك سائقك في صالة الوصول بلافتة تحمل اسمك، ويساعدك في حمل أمتعتك، ويوصلك مباشرة إلى بابك — بلا طوابير ولا عدّاد ولا مساومة. جميع سائقينا مرخّصون، وجميع سياراتنا مكيّفة، والسعر الذي حجزت به هو ما تدفعه.",
    "home.faq.title": "الأسئلة الشائعة",
    "home.faq.1.q": "ماذا لو تأخرت رحلتي؟",
    "home.faq.1.a": "نتابع رقم رحلتك ونعدّل موعد الاستقبال تلقائيًا. سائقك بانتظارك بعد الهبوط دون أي تكلفة إضافية.",
    "home.faq.2.q": "أين أقابل السائق؟",
    "home.faq.2.a": "في صالة الوصول، حاملًا لافتة باسمك. يتضمن تأكيد الحجز رقم هاتف السائق.",
    "home.faq.3.q": "هل يمكنني الدفع نقدًا؟",
    "home.faq.3.a": "نعم. اختر «الدفع للسائق» عند إتمام الحجز وادفع بالريال القطري في يوم الرحلة. حجزك مؤكد في الحالتين.",
    "home.faq.4.q": "هل السعر ثابت فعلًا؟",
    "home.faq.4.a": "نعم. يعتمد السعر على وجهتك ونوع السيارة فقط، لا على الازدحام أو وقت اليوم. لا رسوم إضافية عند الوصول.",
    "home.faq.5.q": "هل يمكنني الإلغاء؟",
    "home.faq.5.a": "نعم. راجع سياسة الإلغاء والاسترداد للاطلاع على الشروط.",

    "nav.call": "اتصل بنا",
    "nav.whatsapp": "واتساب",
    "footer.tagline": "استكشف بكل سهولة.",
    "footer.contact": "التواصل",
    "footer.legal": "قانوني",
    "footer.terms": "الشروط والأحكام",
    "footer.cancellation": "الإلغاء والاسترداد",
    "footer.privacy": "سياسة الخصوصية",
    "footer.rights": "جميع الحقوق محفوظة.",
    "footer.photoCredit": "صورة الأفق:",

    "trust.licensed.title": "سائقون مرخصون",
    "trust.licensed.body": "جميع سائقينا مرخصون ويعرفون قطر جيدًا.",
    "trust.flight.title": "متابعة الرحلات",
    "trust.flight.body": "نتابع رحلتك ونعدّل موعد الاستقبال عند التأخير.",
    "trust.waiting.title": "انتظار مجاني",
    "trust.waiting.body": "سائقك بانتظارك بعد الهبوط دون أي تكلفة إضافية.",
    "trust.fixed.title": "سعر ثابت",
    "trust.fixed.body": "بدون عدّاد وبدون زيادات وبدون مفاجآت.",

    "results.title": "اختر سيارتك",
    "results.fixedPrice": "هذا هو السعر الذي تدفعه. بدون عدّاد وبدون زيادات.",
    "results.passengers": "حتى {count} ركاب",
    "results.luggage": "حتى {count} حقائب",
    "results.select": "اختيار",
    "results.selected": "تم الاختيار",
    "results.passengersShort": "{count} ركاب",
    "results.luggageShort": "{count} حقائب",
    "results.error.body":
      "تعذّر الحصول على السعر الآن. حاول مجددًا بعد قليل، أو تواصل معنا وسنحجز لك.",

    "trip.route": "المسار",
    "trip.when": "وقت الاستقبال",
    "trip.party": "عدد الركاب",
    "trip.change": "تعديل",
    "trip.airportTo": "المطار ← {place}",
    "trip.placeToAirport": "{place} ← المطار",
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
