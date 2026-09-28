/**
 * What a customer is allowed to put on their meet & greet sign.
 *
 * This is the validation behind a PUBLIC, UNAUTHENTICATED upload endpoint —
 * the only one on the site — so it is written as a deny-by-default allowlist
 * rather than a list of things to reject.
 */

/** 5 MB. A phone photo of a logo is well under this; anything larger is not a sign. */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export type ImageKind = { mime: string; ext: string }

/**
 * The three raster formats every phone produces and every browser renders.
 *
 * ⚠️ SVG IS DELIBERATELY ABSENT AND MUST STAY ABSENT. An SVG is an XML
 * document that can carry `<script>`, and these files are served from a URL
 * the owner opens in their browser while logged into the admin. Accepting one
 * would turn "upload a picture for my sign" into stored XSS against the
 * business. Same reasoning excludes HTML, PDF and anything else with an
 * interpreter behind it.
 */
const MAGIC: Array<{ mime: string; ext: string; test: (b: Buffer) => boolean }> = [
  {
    mime: "image/jpeg",
    ext: "jpg",
    test: (b) => b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  },
  {
    mime: "image/png",
    ext: "png",
    // \x89PNG\r\n\x1a\n
    test: (b) =>
      b.length >= 8 &&
      b[0] === 0x89 &&
      b[1] === 0x50 &&
      b[2] === 0x4e &&
      b[3] === 0x47 &&
      b[4] === 0x0d &&
      b[5] === 0x0a &&
      b[6] === 0x1a &&
      b[7] === 0x0a,
  },
  {
    mime: "image/webp",
    ext: "webp",
    // "RIFF" .... "WEBP"
    // >= 12, not > 12: the signature IS 12 bytes, and a minimal WebP header
    // is exactly that long. `>` rejected valid files — caught by the unit test.
    test: (b) =>
      b.length >= 12 &&
      b.toString("ascii", 0, 4) === "RIFF" &&
      b.toString("ascii", 8, 12) === "WEBP",
  },
]

/**
 * The real type of a file, from its first bytes.
 *
 * ⚠️ The client's `Content-Type` and filename extension are both attacker-
 * controlled and are never consulted. A `.png` header is what makes something
 * a PNG; `name="logo.png"` on a multipart part is a string someone typed.
 * Returns null when the bytes match nothing on the allowlist, which is the
 * answer for a text file renamed to .jpg as much as for a genuine oddity.
 */
export function sniffImage(buffer: Buffer): ImageKind | null {
  const match = MAGIC.find((m) => m.test(buffer))
  return match ? { mime: match.mime, ext: match.ext } : null
}

/** The most a sign can say. Long enough for a name and a company, short of an essay. */
export const MAX_NOTE_LENGTH = 120

/**
 * The note as it will be printed, or null if there is nothing to print.
 *
 * Control characters are stripped rather than escaped: this string is read
 * aloud off a printed board, so a newline or a tab in it is noise in every
 * place it is ever used — the sign, the job sheet, the confirmation email.
 */
export function cleanNote(raw: unknown): string | null {
  if (typeof raw !== "string") return null
  // eslint-disable-next-line no-control-regex
  const flattened = raw.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s+/g, " ").trim()
  return flattened ? flattened.slice(0, MAX_NOTE_LENGTH) : null
}
