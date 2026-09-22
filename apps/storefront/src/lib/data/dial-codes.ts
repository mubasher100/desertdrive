/**
 * International dialling codes for the phone field.
 *
 * The customer is usually abroad when they book — that is the whole premise of
 * the site — so a field that silently assumes +974 gets the driver an
 * unreachable number. The selector makes the country explicit.
 *
 * Ordered by who actually books a Doha airport transfer rather than
 * alphabetically: Qatar first, then the Gulf, then the countries that supply
 * most of Qatar's traffic and residents, then the rest alphabetically. On a
 * phone this is the difference between one scroll and forty.
 *
 * ⚠️ The dial code is a prefix, not a validation rule. Numbers are checked
 * against E.164 shape only (see `normalisePhone`), because per-country length
 * rules go stale and a rejected real number costs a booking.
 */

export type DialCode = {
  /** ISO 3166-1 alpha-2, used as the stable option value. */
  iso: string
  name_en: string
  name_ar: string
  /** Without the plus. */
  dial: string
}

/** Qatar. The default, and the only one most bookings use. */
export const DEFAULT_DIAL_ISO = "QA"

export const DIAL_CODES: readonly DialCode[] = [
  // Qatar and the Gulf
  { iso: "QA", name_en: "Qatar", name_ar: "قطر", dial: "974" },
  { iso: "AE", name_en: "United Arab Emirates", name_ar: "الإمارات", dial: "971" },
  { iso: "SA", name_en: "Saudi Arabia", name_ar: "السعودية", dial: "966" },
  { iso: "KW", name_en: "Kuwait", name_ar: "الكويت", dial: "965" },
  { iso: "BH", name_en: "Bahrain", name_ar: "البحرين", dial: "973" },
  { iso: "OM", name_en: "Oman", name_ar: "عُمان", dial: "968" },

  // The rest of the region
  { iso: "EG", name_en: "Egypt", name_ar: "مصر", dial: "20" },
  { iso: "JO", name_en: "Jordan", name_ar: "الأردن", dial: "962" },
  { iso: "LB", name_en: "Lebanon", name_ar: "لبنان", dial: "961" },
  { iso: "SY", name_en: "Syria", name_ar: "سوريا", dial: "963" },
  { iso: "IQ", name_en: "Iraq", name_ar: "العراق", dial: "964" },
  { iso: "YE", name_en: "Yemen", name_ar: "اليمن", dial: "967" },
  { iso: "SD", name_en: "Sudan", name_ar: "السودان", dial: "249" },
  { iso: "MA", name_en: "Morocco", name_ar: "المغرب", dial: "212" },
  { iso: "DZ", name_en: "Algeria", name_ar: "الجزائر", dial: "213" },
  { iso: "TN", name_en: "Tunisia", name_ar: "تونس", dial: "216" },
  { iso: "LY", name_en: "Libya", name_ar: "ليبيا", dial: "218" },
  { iso: "PS", name_en: "Palestine", name_ar: "فلسطين", dial: "970" },
  { iso: "IR", name_en: "Iran", name_ar: "إيران", dial: "98" },
  { iso: "TR", name_en: "Türkiye", name_ar: "تركيا", dial: "90" },

  // South and South-East Asia
  { iso: "IN", name_en: "India", name_ar: "الهند", dial: "91" },
  { iso: "PK", name_en: "Pakistan", name_ar: "باكستان", dial: "92" },
  { iso: "BD", name_en: "Bangladesh", name_ar: "بنغلاديش", dial: "880" },
  { iso: "NP", name_en: "Nepal", name_ar: "نيبال", dial: "977" },
  { iso: "LK", name_en: "Sri Lanka", name_ar: "سريلانكا", dial: "94" },
  { iso: "PH", name_en: "Philippines", name_ar: "الفلبين", dial: "63" },
  { iso: "ID", name_en: "Indonesia", name_ar: "إندونيسيا", dial: "62" },
  { iso: "MY", name_en: "Malaysia", name_ar: "ماليزيا", dial: "60" },
  { iso: "SG", name_en: "Singapore", name_ar: "سنغافورة", dial: "65" },
  { iso: "TH", name_en: "Thailand", name_ar: "تايلاند", dial: "66" },
  { iso: "VN", name_en: "Vietnam", name_ar: "فيتنام", dial: "84" },
  { iso: "CN", name_en: "China", name_ar: "الصين", dial: "86" },
  { iso: "HK", name_en: "Hong Kong", name_ar: "هونغ كونغ", dial: "852" },
  { iso: "JP", name_en: "Japan", name_ar: "اليابان", dial: "81" },
  { iso: "KR", name_en: "South Korea", name_ar: "كوريا الجنوبية", dial: "82" },

  // Europe
  { iso: "GB", name_en: "United Kingdom", name_ar: "المملكة المتحدة", dial: "44" },
  { iso: "IE", name_en: "Ireland", name_ar: "أيرلندا", dial: "353" },
  { iso: "FR", name_en: "France", name_ar: "فرنسا", dial: "33" },
  { iso: "DE", name_en: "Germany", name_ar: "ألمانيا", dial: "49" },
  { iso: "IT", name_en: "Italy", name_ar: "إيطاليا", dial: "39" },
  { iso: "ES", name_en: "Spain", name_ar: "إسبانيا", dial: "34" },
  { iso: "PT", name_en: "Portugal", name_ar: "البرتغال", dial: "351" },
  { iso: "NL", name_en: "Netherlands", name_ar: "هولندا", dial: "31" },
  { iso: "BE", name_en: "Belgium", name_ar: "بلجيكا", dial: "32" },
  { iso: "CH", name_en: "Switzerland", name_ar: "سويسرا", dial: "41" },
  { iso: "AT", name_en: "Austria", name_ar: "النمسا", dial: "43" },
  { iso: "SE", name_en: "Sweden", name_ar: "السويد", dial: "46" },
  { iso: "NO", name_en: "Norway", name_ar: "النرويج", dial: "47" },
  { iso: "DK", name_en: "Denmark", name_ar: "الدنمارك", dial: "45" },
  { iso: "FI", name_en: "Finland", name_ar: "فنلندا", dial: "358" },
  { iso: "PL", name_en: "Poland", name_ar: "بولندا", dial: "48" },
  { iso: "CZ", name_en: "Czechia", name_ar: "التشيك", dial: "420" },
  { iso: "GR", name_en: "Greece", name_ar: "اليونان", dial: "30" },
  { iso: "RO", name_en: "Romania", name_ar: "رومانيا", dial: "40" },
  { iso: "HU", name_en: "Hungary", name_ar: "المجر", dial: "36" },
  { iso: "RU", name_en: "Russia", name_ar: "روسيا", dial: "7" },
  { iso: "UA", name_en: "Ukraine", name_ar: "أوكرانيا", dial: "380" },

  // Americas
  { iso: "US", name_en: "United States", name_ar: "الولايات المتحدة", dial: "1" },
  { iso: "CA", name_en: "Canada", name_ar: "كندا", dial: "1" },
  { iso: "MX", name_en: "Mexico", name_ar: "المكسيك", dial: "52" },
  { iso: "BR", name_en: "Brazil", name_ar: "البرازيل", dial: "55" },
  { iso: "AR", name_en: "Argentina", name_ar: "الأرجنتين", dial: "54" },

  // Africa, Oceania and the rest
  { iso: "ZA", name_en: "South Africa", name_ar: "جنوب أفريقيا", dial: "27" },
  { iso: "KE", name_en: "Kenya", name_ar: "كينيا", dial: "254" },
  { iso: "NG", name_en: "Nigeria", name_ar: "نيجيريا", dial: "234" },
  { iso: "GH", name_en: "Ghana", name_ar: "غانا", dial: "233" },
  { iso: "ET", name_en: "Ethiopia", name_ar: "إثيوبيا", dial: "251" },
  { iso: "TZ", name_en: "Tanzania", name_ar: "تنزانيا", dial: "255" },
  { iso: "UG", name_en: "Uganda", name_ar: "أوغندا", dial: "256" },
  { iso: "AU", name_en: "Australia", name_ar: "أستراليا", dial: "61" },
  { iso: "NZ", name_en: "New Zealand", name_ar: "نيوزيلندا", dial: "64" },
]

export function findDial(iso: string | undefined): DialCode | undefined {
  return DIAL_CODES.find((c) => c.iso === iso)
}

/**
 * The best guess at which country a typed number belongs to: the longest
 * matching dial code wins, so +1 does not shadow nothing and +97 does not
 * shadow +974. Used to set the selector when a customer pastes a full
 * international number rather than using it.
 */
export function isoForNumber(e164: string): string | undefined {
  if (!e164.startsWith("+")) return undefined
  const digits = e164.slice(1)
  let best: DialCode | undefined
  for (const c of DIAL_CODES) {
    if (digits.startsWith(c.dial) && (!best || c.dial.length > best.dial.length)) {
      best = c
    }
  }
  return best?.iso
}

export function dialLabel(c: DialCode, language: "en" | "ar"): string {
  return `${language === "ar" ? c.name_ar : c.name_en} +${c.dial}`
}
