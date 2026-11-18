import { emailFailureReason } from "../email-failure"
import { summariseBookingEmails, type NotificationRow } from "../booking-email-status"
import { resendKeyFrom } from "../../modules/smtp-notification/service"
import { feedEntry, formatPickup } from "../booking-emails"

describe("resendKeyFrom — which deployments send over Resend's HTTPS API", () => {
  it("uses RESEND_API_KEY when set", () => {
    expect(resendKeyFrom({ RESEND_API_KEY: "re_abc" })).toBe("re_abc")
  })
  it("uses the SMTP password when SMTP points at Resend (that password is the API key)", () => {
    // Production's configuration in Nov 2026: Railway blocks SMTP, so this
    // must move to HTTPS without anyone adding a variable.
    expect(resendKeyFrom({ SMTP_HOST: "smtp.resend.com", SMTP_PASS: "re_xyz" })).toBe("re_xyz")
    expect(resendKeyFrom({ SMTP_HOST: " SMTP.Resend.com ", SMTP_PASS: " re_xyz " })).toBe("re_xyz")
  })
  it("leaves any other SMTP server on SMTP", () => {
    expect(resendKeyFrom({ SMTP_HOST: "smtp.office365.com", SMTP_PASS: "re_looks_like_one" })).toBeUndefined()
    expect(resendKeyFrom({ SMTP_HOST: "smtp.resend.com", SMTP_PASS: "not-a-key" })).toBeUndefined()
    expect(resendKeyFrom({})).toBeUndefined()
  })
})

describe("emailFailureReason — a failed send in words the owner can act on", () => {
  it("says no provider is set up", () => {
    const e = new Error("Could not find a notification provider for channel: email for notification id n1")
    expect(emailFailureReason(e)).toMatch(/No email provider is set up/)
  })
  it("names Railway's SMTP block on a timeout", () => {
    const e = new Error("Failed to send notification with id n1:\nConnection timeout")
    const r = emailFailureReason(e)
    expect(r).toMatch(/Railway blocks SMTP/)
    expect(r).not.toMatch(/Failed to send notification with id/)
  })
  it("names a bad Resend key", () => {
    const e = new Error("Resend refused the email (HTTP 401): API key is invalid")
    expect(emailFailureReason(e)).toMatch(/create a new key in Resend/)
  })
  it("passes anything else through, trimmed", () => {
    const e = new Error("Resend refused the email (HTTP 403): The desertdriverental.com domain is not verified")
    expect(emailFailureReason(e)).toMatch(/domain is not verified/)
    expect(emailFailureReason(new Error("x".repeat(1000))).length).toBeLessThanOrEqual(300)
  })
  it("never comes back empty", () => {
    expect(emailFailureReason(undefined)).toBe("No reason was given.")
  })
})

describe("summariseBookingEmails — the booking page's 'did the emails go out?'", () => {
  const row = (r: Partial<NotificationRow>): NotificationRow => ({
    id: Math.random().toString(36),
    to: "x@example.com",
    channel: "email",
    template: "booking-confirmation",
    status: "success",
    data: null,
    created_at: "2026-11-18T10:00:00Z",
    ...r,
  })

  it("reports a booking from before tracking as unknown, not as failed", () => {
    expect(summariseBookingEmails([])).toEqual({
      customer: { status: "unknown", to: null, at: null, reason: null },
      office: { status: "unknown", to: null, at: null, reason: null },
    })
  })

  it("reports the failure with its reason, and the latest attempt wins", () => {
    const rows = [
      row({ status: "failure", created_at: "2026-11-18T10:00:00Z" }),
      row({
        channel: "feed",
        template: "admin-ui",
        to: "",
        data: { kind: "email_failed", email: "customer", reason: "Railway blocks SMTP" },
        created_at: "2026-11-18T10:00:01Z",
      }),
      row({ template: "booking-owner-alert", to: "office@example.com", status: "failure", created_at: "2026-11-18T10:00:00Z" }),
    ]
    const s = summariseBookingEmails(rows)
    expect(s.customer).toMatchObject({ status: "failed", reason: "Railway blocks SMTP" })
    expect(s.office).toMatchObject({ status: "failed", to: "office@example.com", reason: null })

    // Resent and delivered: the newer row decides.
    const after = summariseBookingEmails([...rows, row({ status: "success", created_at: "2026-11-18T11:00:00Z" })])
    expect(after.customer).toMatchObject({ status: "sent", reason: null })
  })
})

describe("feed entries", () => {
  it("are addressed to every admin and tagged with the booking", () => {
    const e = feedEntry("order_1", "new_booking", "New booking DD-13", "line")
    expect(e).toMatchObject({ to: "", channel: "feed", template: "admin-ui", resource_id: "order_1" })
    expect(e.data).toMatchObject({ title: "New booking DD-13", kind: "new_booking", order_id: "order_1" })
  })
  it("print the pickup in Qatar time", () => {
    expect(formatPickup("2026-11-17T20:45:00Z")).toBe("Tue 17 Nov, 23:45")
    expect(formatPickup("")).toBe("")
  })
})

describe("push devices", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { deviceName, newVapidKeys } = require("../push") as typeof import("../push")
  it("names a device from its browser, so the owner can tell them apart", () => {
    expect(deviceName("Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15")).toBe("iPhone")
    expect(deviceName("Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/131.0")).toBe("Android")
    expect(deviceName("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0")).toBe("Windows")
    expect(deviceName(undefined)).toBe("Browser")
  })
  it("makes a VAPID key pair a push service accepts (P-256, base64url)", () => {
    const k = newVapidKeys()
    expect(k.public_key).toMatch(/^[A-Za-z0-9_-]{87}$/)
    expect(k.private_key).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })
})
