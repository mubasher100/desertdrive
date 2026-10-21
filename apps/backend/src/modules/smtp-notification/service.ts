import { AbstractNotificationProviderService, MedusaError } from "@medusajs/framework/utils"
import type {
  Logger,
  ProviderSendNotificationDTO,
  ProviderSendNotificationResultsDTO,
} from "@medusajs/framework/types"
import nodemailer, { type Transporter } from "nodemailer"
import { renderTemplate } from "./templates"

type Options = {
  host: string
  port: number
  /** true for 465, false for 587 (STARTTLS). */
  secure: boolean
  user: string
  pass: string
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

type InjectedDependencies = { logger: Logger }

/**
 * Email over plain SMTP.
 *
 * Chosen over a vendor SDK because SMTP is the one interface every provider
 * offers, so switching costs nothing but the SMTP_* variables. That turned
 * out to matter: the original plan was to send through the business's own
 * Outlook mailbox, and **Microsoft disabled basic authentication for personal
 * Outlook accounts on 16 September 2024** — which is the only thing an app
 * password works with — while Microsoft 365 tenants lose SMTP AUTH at the end
 * of December 2026. An Outlook mailbox cannot be an SMTP sender any more.
 *
 * The template lives in code (templates.ts) so the confirmation email is
 * versioned with the funnel it describes.
 *
 * Registered under the notification module for the "email" channel.
 */
export default class SmtpNotificationService extends AbstractNotificationProviderService {
  static identifier = "smtp"

  protected readonly logger: Logger
  protected readonly transporter: Transporter
  protected readonly from: string
  protected readonly replyTo?: string

  constructor(container: InjectedDependencies, options: Options) {
    super()
    this.logger = container.logger
    this.from = options.from
    this.replyTo = options.replyTo
    this.transporter = nodemailer.createTransport({
      host: options.host,
      port: options.port,
      secure: options.secure,
      auth: { user: options.user, pass: options.pass },
    })
  }

  static validateOptions(options: Record<string, unknown>) {
    const missing = ["host", "port", "user", "pass", "from"].filter((k) => !options[k])
    if (missing.length) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `SMTP notification provider is missing options: ${missing.join(", ")}. Set the SMTP_* variables.`
      )
    }
  }

  async send(notification: ProviderSendNotificationDTO): Promise<ProviderSendNotificationResultsDTO> {
    const { subject, html, text } = renderTemplate(notification.template, notification.data ?? {})

    const info = await this.transporter.sendMail({
      from: notification.from || this.from,
      // A notification may name its own reply-to — the owner's copy of a
      // booking replies to the customer. Otherwise the configured address.
      ...(typeof notification.data?.reply_to === "string" && notification.data.reply_to
        ? { replyTo: notification.data.reply_to }
        : this.replyTo
          ? { replyTo: this.replyTo }
          : {}),
      to: notification.to,
      subject,
      html,
      text,
      attachments: notification.attachments?.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.content_type,
        encoding: "base64",
      })),
    })

    this.logger.info(`SMTP: sent "${notification.template}" to ${notification.to} (${info.messageId})`)
    return { id: info.messageId }
  }
}
