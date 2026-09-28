/**
 * Validation for the meet & greet sign — the words on the board, and the
 * picture beside them.
 *
 * Deliberately NOT in `lib/data/add-ons.ts`. That module is `"use server"`,
 * where every export is a Server Action and must be async; a synchronous
 * helper exported next to a fetch fails the build with "Server Actions must be
 * async functions". Pure helpers live here.
 */

/** The most a sign can say. Enough for a name and a company, short of an essay. */
export const MAX_NOTE_LENGTH = 120

/**
 * The note as it will be printed, or null if there is nothing to print.
 *
 * Control characters are flattened rather than escaped: this string is read
 * off a printed board, so a newline or a tab in it is noise everywhere it is
 * used — the sign, the job sheet, the confirmation email. The backend applies
 * the same rule, so the two ends cannot disagree about what was ordered.
 */
export function cleanNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  // eslint-disable-next-line no-control-regex
  const flat = raw.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim()
  return flat ? flat.slice(0, MAX_NOTE_LENGTH) : null
}

/**
 * Whether this is a URL our own upload endpoint produced.
 *
 * ⚠️ The image URL arrives from the browser and ends up on the order and in an
 * email — somewhere the owner clicks. Without this check a booking could carry
 * any link on the internet, presented by us as the customer's picture.
 *
 * Origin equality, parsed — not `startsWith`, which
 * `https://our-bucket.example.com.attacker.test/x` would sail past. `https`
 * only, because the value is rendered as a link in the admin and an email.
 */
export function isOurUpload(value: unknown, publicBase: string | undefined): boolean {
  if (typeof value !== "string" || !publicBase) return false
  try {
    return new URL(value).protocol === "https:" && new URL(value).origin === new URL(publicBase).origin
  } catch {
    return false
  }
}
