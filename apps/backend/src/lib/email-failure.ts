/**
 * Turns a failed email send into a sentence the owner can act on.
 *
 * The raw errors come from three places — Medusa's notification module, the
 * Resend API, and nodemailer — and none of them say what to do next. The
 * owner reads this on a phone in the admin, so it names the fix.
 */
export function emailFailureReason(e: unknown): string {
  const raw = errorText(e)
    // Medusa wraps the provider's error: "Failed to send notification with id x:\n<reason>"
    .replace(/Failed to send notification with id \S+:\s*/g, "")
    .trim()

  if (/Could not find a notification provider for channel: email/i.test(raw)) {
    return "No email provider is set up. Add RESEND_API_KEY to the backend's variables on Railway."
  }
  if (/HTTP 40[13]\b/.test(raw) && /api key/i.test(raw)) {
    return `Resend rejected the API key — create a new key in Resend and set it as RESEND_API_KEY on Railway. (${clip(raw)})`
  }
  if (/ETIMEDOUT|ECONNREFUSED|ECONNRESET|Greeting never received|Connection timeout|ESOCKET/i.test(raw)) {
    return `The mail server could not be reached. Railway blocks SMTP below its Pro plan; set RESEND_API_KEY so email goes over HTTPS. (${clip(raw)})`
  }
  if (/Invalid login|535|EAUTH/i.test(raw)) {
    return `The mail server refused the password (SMTP_PASS). (${clip(raw)})`
  }
  return clip(raw) || "No reason was given."
}

function errorText(e: unknown): string {
  if (e instanceof AggregateError) return e.errors.map(errorText).join("; ")
  if (e instanceof Error) return e.message
  if (typeof e === "string") return e
  if (Array.isArray(e)) return e.map(errorText).join("; ")
  if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message)
  return ""
}

function clip(s: string): string {
  const one = s.replace(/\s+/g, " ").trim()
  return one.length > 300 ? one.slice(0, 297) + "…" : one
}
