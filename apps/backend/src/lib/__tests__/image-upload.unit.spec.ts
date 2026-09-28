import { cleanNote, sniffImage, MAX_NOTE_LENGTH } from "../image-upload"

/**
 * These cover the validation behind the site's only public, unauthenticated
 * write. The cases that matter are the rejections.
 */
describe("sniffImage", () => {
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])
  const webp = Buffer.concat([
    Buffer.from("RIFF", "ascii"),
    Buffer.from([0x24, 0x00, 0x00, 0x00]),
    Buffer.from("WEBP", "ascii"),
  ])

  it("recognises the three formats on the allowlist", () => {
    expect(sniffImage(jpeg)).toEqual({ mime: "image/jpeg", ext: "jpg" })
    expect(sniffImage(png)).toEqual({ mime: "image/png", ext: "png" })
    expect(sniffImage(webp)).toEqual({ mime: "image/webp", ext: "webp" })
  })

  /**
   * ⚠️ THE IMPORTANT ONE. An SVG is XML that can carry <script>, and these
   * files are served from a URL the owner opens while logged into the admin.
   * Accepting one turns "upload a picture for my sign" into stored XSS against
   * the business. If this test ever goes green with SVG allowed, that is a
   * vulnerability and not a feature.
   */
  it("rejects SVG, however it is dressed up", () => {
    expect(sniffImage(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull()
    expect(sniffImage(Buffer.from('<?xml version="1.0"?><svg onload="alert(1)"/>'))).toBeNull()
    expect(sniffImage(Buffer.from('  <svg><script>fetch("/admin")</script></svg>'))).toBeNull()
  })

  it("rejects HTML and other interpreted formats", () => {
    expect(sniffImage(Buffer.from("<!doctype html><script>x</script>"))).toBeNull()
    expect(sniffImage(Buffer.from("%PDF-1.7"))).toBeNull()
    expect(sniffImage(Buffer.from("GIF89a"))).toBeNull()
  })

  /** The bytes decide, so a truthful-looking name buys nothing. */
  it("rejects a text file whatever it claims to be", () => {
    expect(sniffImage(Buffer.from("this is not a picture"))).toBeNull()
  })

  it("rejects empty and truncated input rather than throwing", () => {
    expect(sniffImage(Buffer.alloc(0))).toBeNull()
    expect(sniffImage(Buffer.from([0xff, 0xd8]))).toBeNull()
    expect(sniffImage(Buffer.from("RIFF"))).toBeNull()
  })

  /** A RIFF container that is not WEBP — an AVI, say — is not an image. */
  it("rejects RIFF that is not WEBP", () => {
    const avi = Buffer.concat([
      Buffer.from("RIFF", "ascii"),
      Buffer.from([0x24, 0x00, 0x00, 0x00]),
      Buffer.from("AVI ", "ascii"),
    ])
    expect(sniffImage(avi)).toBeNull()
  })
})

describe("cleanNote", () => {
  it("keeps ordinary text", () => {
    expect(cleanNote("Mr Ahmed Khan")).toEqual("Mr Ahmed Khan")
  })

  it("keeps Arabic", () => {
    expect(cleanNote("السيد أحمد خان")).toEqual("السيد أحمد خان")
  })

  /** It is read off a printed board, so newlines and tabs are noise. */
  it("flattens whitespace and control characters", () => {
    expect(cleanNote("Ahmed\n\nKhan")).toEqual("Ahmed Khan")
    expect(cleanNote("Ahmed\tKhan")).toEqual("Ahmed Khan")
    expect(cleanNote("  Ahmed   Khan  ")).toEqual("Ahmed Khan")
    expect(cleanNote("Ahmed\u0000Khan")).toEqual("Ahmed Khan")
  })

  it("treats a blank note as no note", () => {
    expect(cleanNote("")).toBeNull()
    expect(cleanNote("   ")).toBeNull()
    expect(cleanNote("\n\t ")).toBeNull()
  })

  it("rejects anything that is not a string", () => {
    expect(cleanNote(null)).toBeNull()
    expect(cleanNote(undefined)).toBeNull()
    expect(cleanNote(42)).toBeNull()
    expect(cleanNote({ toString: () => "x" })).toBeNull()
  })

  it("caps the length, so a board cannot be asked to hold an essay", () => {
    const long = "a".repeat(500)
    expect(cleanNote(long)).toHaveLength(MAX_NOTE_LENGTH)
  })
})
