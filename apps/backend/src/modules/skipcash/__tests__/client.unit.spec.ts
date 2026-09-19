import { createHmac } from "node:crypto"
import {
  buildRequestPlaintext,
  buildWebhookPlaintext,
  formatAmount,
  signRequest,
  verifyWebhookSignature,
} from "../client"

/**
 * The signature rules, pinned. These were verified against the SkipCash
 * sandbox (a real payment was created with this exact construction) — if a
 * refactor changes the field order or the join, this fails before the sandbox
 * gets a chance to return an opaque 403.
 */
describe("SkipCash request signature", () => {
  const body = {
    Uid: "u-1",
    KeyId: "k-1",
    Amount: "40.00",
    FirstName: "Aisha",
    LastName: "Test",
    Phone: "+97455551234",
    Email: "a@example.com",
    TransactionId: "DD-1",
    Custom1: "payses_1",
    returnUrl: "https://x/return",
    webhookUrl: "https://x/hook",
  }

  it("joins the signed fields in SkipCash's order and leaves the URLs out", () => {
    expect(buildRequestPlaintext(body)).toBe(
      "Uid=u-1,KeyId=k-1,Amount=40.00,FirstName=Aisha,LastName=Test,Phone=+97455551234," +
        "Email=a@example.com,TransactionId=DD-1,Custom1=payses_1"
    )
  })

  it("drops empty optional fields rather than sending Key=", () => {
    expect(buildRequestPlaintext({ ...body, Phone: "", Custom1: undefined })).toBe(
      "Uid=u-1,KeyId=k-1,Amount=40.00,FirstName=Aisha,LastName=Test,Email=a@example.com,TransactionId=DD-1"
    )
  })

  it("keeps address fields between Email and TransactionId when present", () => {
    expect(buildRequestPlaintext({ ...body, City: "Doha", Country: "QA" })).toContain(
      "Email=a@example.com,City=Doha,Country=QA,TransactionId=DD-1"
    )
  })

  it("is base64 HMAC-SHA256 of the plaintext under the key secret", () => {
    const expected = createHmac("sha256", "secret").update(buildRequestPlaintext(body)).digest("base64")
    expect(signRequest(body, "secret")).toBe(expected)
  })
})

describe("SkipCash webhook signature", () => {
  const payload = {
    PaymentId: "p-1",
    Amount: "40.00",
    StatusId: 2,
    TransactionId: "DD-1",
    Custom1: "payses_1",
    VisaId: "v-1",
  }
  const key = "webhook-key"
  const good = createHmac("sha256", key).update(buildWebhookPlaintext(payload)).digest("base64")

  it("uses the documented field order", () => {
    expect(buildWebhookPlaintext(payload)).toBe(
      "PaymentId=p-1,Amount=40.00,StatusId=2,TransactionId=DD-1,Custom1=payses_1,VisaId=v-1"
    )
  })

  it("accepts a correctly signed payload", () => {
    expect(verifyWebhookSignature(payload, good, key)).toBe(true)
  })

  it("rejects a missing, wrong, or tampered signature", () => {
    expect(verifyWebhookSignature(payload, undefined, key)).toBe(false)
    expect(verifyWebhookSignature(payload, "nope", key)).toBe(false)
    expect(verifyWebhookSignature({ ...payload, StatusId: 3 }, good, key)).toBe(false)
    expect(verifyWebhookSignature(payload, good, "other-key")).toBe(false)
  })
})

describe("amount formatting", () => {
  it("sends two decimal places, never minor units", () => {
    expect(formatAmount(40)).toBe("40.00")
    expect(formatAmount(65.5)).toBe("65.50")
  })
})
