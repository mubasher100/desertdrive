import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import nodemailer, { type Transporter } from "nodemailer"
import { renderTemplate } from "./templates"

type Options = {
  /**
   * A Resend API key (re_...). When set, mail goes over Resend's HTTPS API
   * and the SMTP settings are not used. See the class comment for why.
   */
  resendApiKey?: string
  host?: string
  port?: number
  /** true for 465, false for 587 (STARTTLS). */
  secure?: boolean
  user?: string
  pass?: string
  /** "Desert Drive <bookings@desertdriverental.com>" */
  from: string
  /**
   * Where a customer's reply should land — the mailbox a person actually
   * reads, which is not the same address the mail is sent from.
   *
   * Optional, and it matters as soon as the sender is a domain rather than a
   * mailbox. Mail now leaves through a provider as bookings@<domain>; a
   * customer answering "my flight is delayed" hits reply and reaches an
   * address nobody opens. That is a booking lost in silence.
   */
  replyTo?: string
}

/**
 * The Resend key to use, if any: RESEND_API_KEY, or the SMTP password when
 * the SMTP settings point at Resend (its SMTP password IS the API key), so a
 * deployment configured for Resend-over-SMTP moves to the API with no new
 * variable.
 */
export function resendKeyFrom(env: Record<string, string | undefined>): string | undefined {
  const explicit = env.RESEND_API_KEY?.trim()
  if (explicit) return explicit
  const host = env.SMTP_HOST?.trim().toLowerCase()
  const pass = env.SMTP_PASS?.trim()
  if (host === "smtp.resend.com" && pass?.startsWith("re_")) return pass
  return undefined
}

type InjectedDependencies = { logger: Logger }

/**
 * Email: Resend's HTTPS API when a Resend key is configured, plain SMTP
 * otherwise.
 *
 * ⚠️ **Railway blocks outbound SMTP** (ports 25, 465, 587) on its Trial and
 * Hobby plans; only Pro and above may open them. A connection to
 * smtp.resend.com from production simply times out — every confirmation and
 * every office alert failed this way, while the booking itself completed and
 * looked fine (DD-13, 17 Nov 2026). HTTPS on 443 is never blocked, so with a
 * Resend key the mail goes over the API instead.
 *
 * SMTP is kept for any other provider, and because it was chosen for a reason:
 * the original plan was the business's own Outlook mailbox, and Microsoft
 * disabled basic authentication for personal Outlook accounts on
 * 16 September 2024 — the only thing an app password works with — while
 * Microsoft 365 tenants lose SMTP AUTH at the end of December 2026.
 *
 * The template lives in code (templates.ts) so the confirmation email is
 * versioned with the funnel it describes.
 *
 * Registered under the notification module for the "email" channel.
 */
export default class SmtpNotificationService extends AbstractNotificationProviderService {
  static identifier = "smtp"

  protected readonly logger: Logger
  protected readonly transporter?: Transporter
  protected readonly resendApiKey?: string
  protected readonly from: string
  protected readonly replyTo?: string

  constructor(container: InjectedDependencies, options: Options) {
    super()
    this.logger = container.logger
    this.from = options.from
    this.replyTo = options.replyTo
    this.resendApiKey = options.resendApiKey || undefined
    if (!this.resendApiKey) {
      this.transporter = nodemailer.createTransport({
        host: options.host,
        port: options.port,
        secure: options.secure,
        auth: { user: options.user, pass: options.pass },
        // Fail in seconds, not minutes, when the port is blocked.
        connectionTimeout: 15_000,
        greetingTimeout: 15_000,
      })
    }
  }

  static validateOptions(options: Record<string, unknown>) {
    if (!options.from) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Email provider is missing SMTP_FROM.")
    }
    if (options.resendApiKey) return
    const missing = ["host", "port", "user", "pass"].filter((k) => !options[k])
    if (missing.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Email provider is missing options: ${missing.join(", ")}. Set RESEND_API_KEY, or the SMTP_* variables.`
      )
    }
  }

  async send(notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
    const { subject, html, text } = renderTemplate(notification.template, notification.data ?? {})
    const from = notification.from || this.from
    const replyTo =
      typeof notification.data?.reply_to === "string" && notification.data.reply_to
        ? notification.data.reply_to
        : this.replyTo
    // A blind copy, sent with the email itself (lib/booking-emails.ts puts the
    // office's address on the customer's confirmation). Never the recipient.
    const bcc =
      typeof notification.data?.bcc === "string" && notification.data.bcc && notification.data.bcc !== notification.to
        ? notification.data.bcc
        : undefined

    const id = this.resendApiKey
      ? await this.sendViaResend({ from, to: notification.to, bcc, replyTo, subject, html, text, attachments: notification.attachments })
      : await this.sendViaSmtp({ from, to: notification.to, bcc, replyTo, subject, html, text, attachments: notification.attachments })

    this.logger.info(`Email: sent "${notification.template}" to ${notification.to} (${id})`)
    return { id }
  }

  private async sendViaResend(m: Mail): Promise<string> {
    let res: Response
    try {
      res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${this.resendApiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: m.from,
          to: [m.to],
          ...(m.bcc ? { bcc: [m.bcc] } : {}),
          ...(m.replyTo ? { reply_to: m.replyTo } : {}),
          subject: m.subject,
          html: m.html,
          text: m.text,
          ...(m.attachments?.length
            ? { attachments: m.attachments.map((a) => ({ filename: a.filename, content: a.content })) }
            : {}),
        }),
        signal: AbortSignal.timeout(20_000),
      })
    } catch (e) {
      throw new Error(`Could not reach Resend: ${(e as Error).message}`)
    }
    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string }
    if (!res.ok || !body.id) {
      throw new Error(`Resend refused the email (HTTP ${res.status}): ${body.message ?? body.name ?? "no reason given"}`)
    }
    return body.id
  }

  private async sendViaSmtp(m: Mail): Promise<string> {
    const info = await this.transporter!.sendMail({
      from: m.from,
      ...(m.replyTo ? { replyTo: m.replyTo } : {}),
      to: m.to,
      ...(m.bcc ? { bcc: m.bcc } : {}),
      subject: m.subject,
      html: m.html,
      text: m.text,
      attachments: m.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.content_type,
        encoding: "base64",
      })),
    })
    return info.messageId
  }
}

type Mail = {
  from: string
  to: string
  bcc?: string
  replyTo?: string
  subject: string
  html: string
  text: string
  attachments?: ProviderSendNotificationDTO["attachments"]
}
