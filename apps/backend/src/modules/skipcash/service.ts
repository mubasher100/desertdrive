import { randomUUID } from "node:crypto"
import {
  AbstractPaymentProvider,
  MedusaError,
  PaymentSessionStatus,
} from "@medusajs/framework/utils"
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types"
import {
  formatAmount,
  SkipCashClient,
  SkipCashStatus,
  verifyWebhookSignature,
  type SkipCashOptions,
  type SkipCashPayment,
} from "./client"

type Options = SkipCashOptions & {
  /** Public backend origin, for the webhook URL SkipCash calls back to. */
  backend_url: string
}

type InjectedDependencies = { logger: Logger }

/**
 * What the storefront passes when it initiates a card session. All of it is
 * for SkipCash's hosted page and the return trip — none of it touches the
 * amount, which Medusa supplies from the cart.
 */
type SessionInput = {
  session_id?: string
  first_name?: string
  last_name?: string
  phone?: string
  email?: string
  return_url?: string
  reference?: string
}

/** What we keep on the Medusa payment session between calls. */
type SessionData = {
  skipcash_id: string
  pay_url: string
  uid: string
  amount: string
  reference: string
  session_id: string
  status_id?: number
}

/**
 * SkipCash — Qatar Central Bank licensed card gateway. Redirect flow:
 *
 *   initiatePayment  → create a SkipCash payment, keep its payUrl on the session
 *   (storefront)     → send the customer to payUrl
 *   (SkipCash)       → customer pays, is redirected to return_url, and a webhook
 *                      hits /hooks/payment/skipcash_skipcash
 *   authorizePayment → ask SkipCash for the payment's status; paid means done
 *
 * SkipCash charges in full at payment time, so a successful authorize reports
 * "captured" — there is no separate capture step and capturePayment is a
 * no-op. Fares are stored as-is (40 QAR is 40), and SkipCash wants "40.00".
 */
export default class SkipCashProviderService extends AbstractPaymentProvider<Options> {
  static identifier = "skipcash"

  protected readonly client: SkipCashClient
  protected readonly logger: Logger

  constructor(container: InjectedDependencies, options: Options) {
    super(container, options)
    this.logger = container.logger
    this.client = new SkipCashClient(options)

    /**
     * Say it loudly when the sandbox is wired into a production deploy.
     *
     * Sandbox credentials do not fail — that is the whole problem. Checkout
     * completes, 3-D Secure runs, the customer sees a confirmation, and the
     * money goes nowhere, because SkipCash's test host took it. Nothing in
     * the funnel can tell the difference, so the only place this can be
     * caught is here, where the host is known.
     *
     * The production site ran this way and it took reading the deployed
     * variables to notice (25 Sept 2026).
     */
    if (process.env.NODE_ENV === "production" && !options.base_url.includes("api.skipcash.app")) {
      this.logger.warn(
        `⚠️  SkipCash is pointed at ${options.base_url} in a production deploy. ` +
          "Card payments will NOT collect real money. Set SKIPCASH_BASE_URL to " +
          "https://api.skipcash.app with the production credentials."
      )
    }
  }

  static validateOptions(options: Record<string, unknown>) {
    const required = ["base_url", "client_id", "key_id", "key_secret", "webhook_key", "backend_url"]
    const missing = required.filter((k) => !options[k])
    if (missing.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `SkipCash provider is missing options: ${missing.join(", ")}. Set the SKIPCASH_* variables.`
      )
    }
  }

  async initiatePayment(input: InitiatePaymentInput): Promise<InitiatePaymentOutput> {
    const data = (input.data ?? {}) as SessionInput
    const amount = Number(input.amount)

    if (!Number.isFinite(amount) || amount <= 0) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `SkipCash: invalid amount ${String(input.amount)}`)
    }
    if (input.currency_code.toLowerCase() !== "qar") {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, `SkipCash only settles QAR, got ${input.currency_code}`)
    }
    if (!data.return_url) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "SkipCash: return_url is required in session data")
    }

    const uid = randomUUID()
    const reference = data.reference ?? uid
    const sessionId = data.session_id ?? ""

    const payment = await this.client.createPayment({
      Uid: uid,
      Amount: formatAmount(amount),
      FirstName: data.first_name || "Customer",
      LastName: data.last_name || "-",
      Phone: data.phone || "",
      Email: data.email || input.context?.customer?.email || "",
      TransactionId: reference,
      // The Medusa session id rides on Custom1 so the webhook can find its way
      // back to the right session. This is the whole handoff.
      Custom1: sessionId,
      returnUrl: data.return_url,
      webhookUrl: `${this.config.backend_url.replace(/\/$/, "")}/hooks/payment/skipcash_skipcash`,
    })

    const sessionData: SessionData = {
      skipcash_id: payment.id,
      pay_url: payment.payUrl,
      uid,
      amount: payment.amount,
      reference,
      session_id: sessionId,
      status_id: payment.statusId,
    }

    return { id: payment.id, data: sessionData, status: PaymentSessionStatus.PENDING }
  }

  /**
   * Amount changed (an add-on was added) — SkipCash payments are immutable, so
   * start a new one. The old one simply never gets paid.
   */
  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const existing = (input.data ?? {}) as Partial<SessionData>
    if (existing.amount === formatAmount(Number(input.amount))) {
      return { data: input.data, status: await this.statusOf(existing) }
    }
    return this.initiatePayment(input)
  }

  async authorizePayment(input: AuthorizePaymentInput): Promise<AuthorizePaymentOutput> {
    const data = (input.data ?? {}) as Partial<SessionData>
    const payment = await this.fetch(data)
    const status = mapStatus(payment.statusId)

    if (status === PaymentSessionStatus.ERROR || status === PaymentSessionStatus.CANCELED) {
      this.logger.warn(`SkipCash payment ${payment.id} is ${payment.status} (statusId ${payment.statusId})`)
    }

    return { status, data: { ...data, status_id: payment.statusId } }
  }

  /** SkipCash captured at payment time. Nothing to do. */
  async capturePayment(input: CapturePaymentInput): Promise<CapturePaymentOutput> {
    return { data: input.data }
  }

  /**
   * Refunds are issued from the SkipCash merchant portal for now. The refund
   * API endpoint has not been verified against the sandbox, and a refund path
   * that "probably works" is worse than one the owner does by hand.
   */
  async refundPayment(_input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Refund this payment from the SkipCash merchant portal, then record it here."
    )
  }

  /** Nothing to cancel remotely — an unpaid SkipCash payment just expires. */
  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data }
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data }
  }

  async getPaymentStatus(input: GetPaymentStatusInput): Promise<GetPaymentStatusOutput> {
    const data = (input.data ?? {}) as Partial<SessionData>
    return { status: await this.statusOf(data), data }
  }

  async retrievePayment(input: RetrievePaymentInput): Promise<RetrievePaymentOutput> {
    const data = (input.data ?? {}) as Partial<SessionData>
    const payment = await this.fetch(data)
    return { data: { ...data, status_id: payment.statusId, skipcash: payment } }
  }

  /**
   * The webhook. Verified against the Webhook Key before anything is believed;
   * an unsigned or mis-signed call is reported as not_supported and ignored.
   * The Medusa session id comes back on Custom1.
   */
  async getWebhookActionAndData(payload: ProviderWebhookPayload["payload"]): Promise<WebhookActionResult> {
    const body = (payload.data ?? {}) as Record<string, unknown>
    const auth = headerValue(payload.headers, "authorization")

    if (!verifyWebhookSignature(body, auth, this.config.webhook_key)) {
      this.logger.warn("SkipCash webhook rejected: bad or missing signature")
      return { action: "not_supported" }
    }

    const sessionId = typeof body.Custom1 === "string" ? body.Custom1 : ""
    const statusId = Number(body.StatusId)
    const amount = Number(body.Amount)

    if (!sessionId.startsWith("payses_")) {
      this.logger.warn(`SkipCash webhook for unknown session "${sessionId}" — ignored`)
      return { action: "not_supported" }
    }

    const data = { session_id: sessionId, amount }

    switch (statusId) {
      case SkipCashStatus.PAID:
        return { action: "captured", data }
      case SkipCashStatus.NEW:
      case SkipCashStatus.PENDING:
        return { action: "pending", data }
      case SkipCashStatus.CANCELED:
        return { action: "canceled", data }
      case SkipCashStatus.FAILED:
      case SkipCashStatus.REJECTED:
        return { action: "failed", data }
      default:
        // Refund states are handled in the portal; nothing for Medusa to do here.
        return { action: "not_supported" }
    }
  }

  private async fetch(data: Partial<SessionData>): Promise<SkipCashPayment> {
    if (!data.skipcash_id) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "SkipCash: session has no skipcash_id")
    }
    return this.client.getPayment(data.skipcash_id)
  }

  private async statusOf(data: Partial<SessionData>): Promise<PaymentSessionStatus> {
    if (!data.skipcash_id) return PaymentSessionStatus.PENDING
    return mapStatus((await this.fetch(data)).statusId)
  }
}

function mapStatus(statusId: number): PaymentSessionStatus {
  switch (statusId) {
    case SkipCashStatus.PAID:
      return PaymentSessionStatus.CAPTURED
    case SkipCashStatus.NEW:
    case SkipCashStatus.PENDING:
      return PaymentSessionStatus.PENDING
    case SkipCashStatus.CANCELED:
      return PaymentSessionStatus.CANCELED
    case SkipCashStatus.FAILED:
    case SkipCashStatus.REJECTED:
      return PaymentSessionStatus.ERROR
    default:
      return PaymentSessionStatus.PENDING
  }
}

function headerValue(headers: Record<string, unknown> | undefined, name: string): string | undefined {
  const v = headers?.[name] ?? headers?.[name.toLowerCase()]
  return Array.isArray(v) ? String(v[0]) : v === undefined ? undefined : String(v)
}
