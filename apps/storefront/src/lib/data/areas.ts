/**
 * Curated Qatar destinations for the search widget.
 *
 * This is the FALLBACK path for destination entry, and it is a first-class one:
 * the funnel must survive Google Maps failing to load (blocked, throttled, slow
 * on hotel wifi), because the search widget is the only revenue path on the
 * site. With no Maps key configured it is also the only path, which is the
 * state at the time of writing.
 *
 * ⚠️ The coordinates decide the fare. The server resolves the band from them,
 * so an area centroid sitting on the wrong side of a boundary misprices every
 * booking to that area, silently. Before launch, check the ones near a
 * boundary against real pickups: Education City and Lusail (A/B at 18.5 km),
 * Mesaieed and Al Khor (B/C at 40 km).
 *
 * Names are deliberately the everyday ones a visitor or a hotel receptionist
 * would say, not the municipal district names. `name_en` is what goes on the
 * driver's job sheet and is read aloud, so it stays English there regardless
 * of the customer's language (see CLAUDE.md, localisation).
 */

export type Area = {
  /** Stable id used in URLs. Never rename one — it would break shared links. */
  id: string
  name_en: string
  name_ar: string
  /** A hint shown under the name, e.g. the district or a landmark. */
  hint_en?: string
  hint_ar?: string
  lat: number
  lng: number
  /** Where it sits in the list. Lower is nearer the top. */
  order: number
}

export const AREAS: readonly Area[] = [
  // --- Central Doha ---------------------------------------------------------
  { id: "west-bay", name_en: "West Bay", name_ar: "الخليج الغربي", hint_en: "Diplomatic area, business hotels", hint_ar: "المنطقة الدبلوماسية، فنادق الأعمال", lat: 25.3208, lng: 51.5312, order: 10 },
  { id: "the-pearl", name_en: "The Pearl", name_ar: "اللؤلؤة", hint_en: "Porto Arabia, Qanat Quartier", hint_ar: "بورتو أرابيا، قناة كوارتييه", lat: 25.3713, lng: 51.5488, order: 20 },
  { id: "souq-waqif", name_en: "Souq Waqif", name_ar: "سوق واقف", hint_en: "Old Doha, Corniche", hint_ar: "الدوحة القديمة، الكورنيش", lat: 25.2874, lng: 51.5331, order: 30 },
  { id: "msheireb", name_en: "Msheireb Downtown", name_ar: "مشيرب قلب الدوحة", lat: 25.2833, lng: 51.5267, order: 40 },
  { id: "katara", name_en: "Katara Cultural Village", name_ar: "الحي الثقافي كتارا", lat: 25.3594, lng: 51.5250, order: 50 },
  { id: "al-dafna", name_en: "Al Dafna", name_ar: "الدفنة", hint_en: "City Center, Corniche hotels", hint_ar: "سيتي سنتر، فنادق الكورنيش", lat: 25.3153, lng: 51.5250, order: 60 },
  { id: "al-sadd", name_en: "Al Sadd", name_ar: "السد", lat: 25.2826, lng: 51.5031, order: 70 },
  { id: "bin-mahmoud", name_en: "Fereej Bin Mahmoud", name_ar: "فريج بن محمود", lat: 25.2833, lng: 51.5190, order: 80 },
  { id: "old-airport", name_en: "Old Airport area", name_ar: "منطقة المطار القديم", lat: 25.2580, lng: 51.5650, order: 90 },
  { id: "al-thumama", name_en: "Al Thumama", name_ar: "الثمامة", lat: 25.2360, lng: 51.5480, order: 100 },
  { id: "hamad-medical", name_en: "Hamad Medical City", name_ar: "مدينة حمد الطبية", lat: 25.2930, lng: 51.5020, order: 110 },

  // --- Wider Doha -------------------------------------------------------
  { id: "aspire-zone", name_en: "Aspire Zone / Villaggio", name_ar: "أسباير زون / فيلاجيو", lat: 25.2620, lng: 51.4420, order: 200 },
  { id: "al-waab", name_en: "Al Waab", name_ar: "الوعب", lat: 25.2590, lng: 51.4590, order: 210 },
  { id: "ain-khaled", name_en: "Ain Khaled", name_ar: "عين خالد", lat: 25.2340, lng: 51.4720, order: 220 },
  { id: "abu-hamour", name_en: "Abu Hamour", name_ar: "أبو هامور", lat: 25.2310, lng: 51.5000, order: 230 },
  { id: "al-rayyan", name_en: "Al Rayyan", name_ar: "الريان", lat: 25.2919, lng: 51.4244, order: 240 },
  { id: "education-city", name_en: "Education City", name_ar: "المدينة التعليمية", hint_en: "Qatar Foundation", hint_ar: "مؤسسة قطر", lat: 25.3145, lng: 51.4370, order: 250 },
  { id: "al-gharrafa", name_en: "Al Gharrafa", name_ar: "الغرافة", lat: 25.3330, lng: 51.4570, order: 260 },
  { id: "madinat-khalifa", name_en: "Madinat Khalifa", name_ar: "مدينة خليفة", lat: 25.3220, lng: 51.4800, order: 270 },
  { id: "al-duhail", name_en: "Al Duhail", name_ar: "الدحيل", lat: 25.3540, lng: 51.4750, order: 280 },
  { id: "doha-festival-city", name_en: "Doha Festival City", name_ar: "الدوحة فستيفال سيتي", lat: 25.3868, lng: 51.4840, order: 290 },
  { id: "muaither", name_en: "Muaither", name_ar: "معيذر", lat: 25.2610, lng: 51.4150, order: 300 },
  { id: "barwa-city", name_en: "Barwa City", name_ar: "بروة سيتي", lat: 25.2050, lng: 51.4930, order: 310 },
  { id: "umm-salal", name_en: "Umm Salal", name_ar: "أم صلال", lat: 25.4100, lng: 51.4050, order: 320 },

  // --- Lusail ---------------------------------------------------------------
  { id: "lusail-marina", name_en: "Lusail Marina", name_ar: "مارينا لوسيل", hint_en: "Lusail Boulevard, Place Vendôme", hint_ar: "بوليفارد لوسيل، بلاس فاندوم", lat: 25.4106, lng: 51.4914, order: 400 },
  { id: "lusail-stadium", name_en: "Lusail Stadium", name_ar: "استاد لوسيل", lat: 25.4200, lng: 51.4920, order: 410 },
  { id: "lusail-north", name_en: "Lusail — Fox Hills & Al Erkyah", name_ar: "لوسيل — فوكس هيلز والعركية", lat: 25.4462, lng: 51.4914, order: 420 },

  // --- South ------------------------------------------------------------
  { id: "al-wakrah", name_en: "Al Wakrah", name_ar: "الوكرة", lat: 25.1659, lng: 51.6031, order: 500 },
  { id: "al-wukair", name_en: "Al Wukair", name_ar: "الوكير", lat: 25.1530, lng: 51.5410, order: 510 },
  { id: "mesaieed", name_en: "Mesaieed", name_ar: "مسيعيد", lat: 24.9917, lng: 51.5500, order: 520 },
  { id: "sealine", name_en: "Sealine Beach", name_ar: "شاطئ سيلين", lat: 24.9290, lng: 51.5490, order: 530 },

  // --- North ------------------------------------------------------------
  { id: "al-daayen", name_en: "Al Daayen", name_ar: "الظعاين", lat: 25.5150, lng: 51.4600, order: 600 },
  { id: "simaisma", name_en: "Simaisma", name_ar: "سميسمة", lat: 25.5760, lng: 51.4890, order: 610 },
  { id: "al-khor", name_en: "Al Khor", name_ar: "الخور", lat: 25.6840, lng: 51.4980, order: 620 },
  { id: "ras-laffan", name_en: "Ras Laffan", name_ar: "راس لفان", lat: 25.9000, lng: 51.5500, order: 630 },
  { id: "al-ruwais", name_en: "Al Ruwais", name_ar: "الرويس", lat: 26.1330, lng: 51.2130, order: 640 },
  { id: "al-zubarah", name_en: "Al Zubarah", name_ar: "الزبارة", lat: 25.9789, lng: 51.0244, order: 650 },

  // --- West -------------------------------------------------------------
  { id: "dukhan", name_en: "Dukhan", name_ar: "دخان", lat: 25.4300, lng: 50.7850, order: 700 },
]

export function findArea(id: string | null | undefined): Area | undefined {
  return id ? AREAS.find((a) => a.id === id) : undefined
}

export function areaName(area: Area, language: "en" | "ar"): string {
  return language === "ar" ? area.name_ar : area.name_en
}

export function areaHint(area: Area, language: "en" | "ar"): string | undefined {
  return language === "ar" ? area.hint_ar : area.hint_en
}
