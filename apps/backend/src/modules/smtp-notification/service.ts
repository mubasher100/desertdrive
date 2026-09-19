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
}

type InjectedDependencies = { logger: Logger }

/**
 * Email over plain SMTP.
 *
 * Chosen over a vendor SDK because the business already has a Microsoft 365
 * mailbox, and SMTP is the one interface every provider offers: Outlook now,
 * Resend or anything else later, with nothing but the SMTP_* variables
 * changing. The template lives in code (templates.ts) so the confirmation
 * email is versioned with the funnel it describes.
 *
 * Registered under the notification module for the "email" channel.
 */
export default class SmtpNotificationService extends AbstractNotificationProviderService {
  static identifier = "smtp"

  protected readonly logger: Logger
  protected readonly transporter: Transporter
  protected readonly from: string

  constructor(container: InjectedDependencies, options: Options) {
    super()
    this.logger = container.logger
    this.from = options.from
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
