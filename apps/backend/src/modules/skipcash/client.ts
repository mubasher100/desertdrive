import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * SkipCash HTTP client and signature rules.
 *
 * Everything in here was verified against the sandbox before the provider was
 * written — see the commit that introduced it. The request shape and the
 * signed-field order come from SkipCash's OWN Magento module (first-party
 * code), not from third-party packages, per CLAUDE.md.
 *
 * Deliberately free of Medusa imports so the signature logic is unit-testable
 * in isolation.
 */

export type SkipCashOptions = {
  /** https://skipcashtest.azurewebsites.net or https://api.skipcash.app */
  base_url: string
  client_id: string
  key_id: string
  key_secret: string
  webhook_key: string
}

/**
 * SkipCash status ids. From their Magento module's webhook switch.
 * 2 is the only "money has moved" state.
 */
export const SkipCashStatus = {
  NEW: 0,
  PENDING: 1,
  PAID: 2,
  CANCELED: 3,
  FAILED: 4,
  REJECTED: 5,
  REFUNDED: 6,
  PENDING_REFUND: 7,
  REFUND_FAILED: 8,
} as const

export type CreatePaymentRequest = {
  Uid: string
  Amount: string
  FirstName: string
  LastName: string
  Phone: string
  Email: string
  TransactionId: string
  Custom1: string
  returnUrl: string
  webhookUrl: string
}

export type SkipCashPayment = {
  id: string
  statusId: number
  status: string
  payUrl: string
  amount: string
  currency: string
  transactionId: string | null
  custom1: string | null
  visaId: string | null
  created: string
  finishedDate: string | null
}

type Envelope<T> = {
  returnCode: number
  errorCode: number
  errorMessage: string | null
  resultObj: T | null
}

/**
 * The signed fields, IN THIS ORDER. Only non-empty ones are included, as
 * `Key=value` joined by commas. returnUrl and webhookUrl are sent in the body
 * but are NOT part of the signature. Getting this order wrong yields an opaque
 * 401/403 from SkipCash with no hint.
 */
const SIGNED_FIELDS = [
  "Uid",
  "KeyId",
  "Amount",
  "FirstName",
  "LastName",
  "Phone",
  "Email",
  "Street",
  "City",
  "State",
  "Country",
  "PostalCode",
  "TransactionId",
  "Custom1",
] as const

export function buildRequestPlaintext(body: Record<string, unknown>): string {
  return SIGNED_FIELDS.filter((k) => body[k] !== undefined && body[k] !== null && body[k] !== "")
    .map((k) => `${k}=${body[k]}`)
    .join(",")
}

export function signRequest(body: Record<string, unknown>, keySecret: string): string {
  return createHmac("sha256", keySecret).update(buildRequestPlaintext(body)).digest("base64")
}

/**
 * Webhook signature. SkipCash signs the callback with the Webhook Key over
 * these fields, in this order, non-empty only — the same convention as the
 * request. The signature arrives in the Authorization header.
 *
 * ⚠️ SkipCash's own Magento module does NOT verify this and trusts the payload.
 * We do. An unverified webhook would let anyone mark any booking as paid by
 * POSTing to a public URL.
 */
const WEBHOOK_SIGNED_FIELDS = ["PaymentId", "Amount", "StatusId", "TransactionId", "Custom1", "VisaId"] as const

export function buildWebhookPlaintext(payload: Record<string, unknown>): string {
  return WEBHOOK_SIGNED_FIELDS.filter(
    (k) => payload[k] !== undefined && payload[k] !== null && payload[k] !== ""
  )
    .map((k) => `${k}=${payload[k]}`)
    .join(",")
}

export function verifyWebhookSignature(
  payload: Record<string, unknown>,
  authorizationHeader: string | undefined,
  webhookKey: string
): boolean {
  if (!authorizationHeader) return false
  const expected = createHmac("sha256", webhookKey).update(buildWebhookPlaintext(payload)).digest("base64")
  const a = Buffer.from(expected)
  const b = Buffer.from(authorizationHeader.trim())
  return a.length === b.length && timingSafeEqual(a, b)
}

/** Amounts go over the wire as a decimal string with two places: "40.00". */
export function formatAmount(amount: number): string {
  return amount.toFixed(2)
}

export class SkipCashClient {
  constructor(private readonly options: SkipCashOptions) {}

  async createPayment(input: CreatePaymentRequest): Promise<SkipCashPayment> {
    const body = { ...input, KeyId: this.options.key_id }
    const res = await fetch(`${this.options.base_url}/api/v1/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: signRequest(body, this.options.key_secret),
      },
      body: JSON.stringify(body),
    })
    return this.unwrap<SkipCashPayment>(res, "create payment")
  }

  /**
   * Payment status. Authenticated with the CLIENT ID, not a signature — a
   * different scheme from create, and one that returns a bare 403 if you get
   * it wrong.
   */
  async getPayment(id: string): Promise<SkipCashPayment> {
    const res = await fetch(`${this.options.base_url}/api/v1/payments/${encodeURIComponent(id)}`, {
      headers: { Accept: "application/json", Authorization: this.options.client_id },
    })
    return this.unwrap<SkipCashPayment>(res, "get payment")
  }

  private async unwrap<T>(res: Response, what: string): Promise<T> {
    const text = await res.text()
    let json: Envelope<T> | undefined
    try {
      json = JSON.parse(text)
    } catch {
      throw new Error(`SkipCash ${what}: HTTP ${res.status}, non-JSON response: ${text.slice(0, 200)}`)
    }
    if (!res.ok || !json || json.returnCode !== 200 || !json.resultObj) {
      throw new Error(
        `SkipCash ${what}: HTTP ${res.status}, returnCode=${json?.returnCode}, errorCode=${json?.errorCode}, ` +
          `message=${json?.errorMessage ?? "-"}`
      )
    }
    return json.resultObj
  }
}
