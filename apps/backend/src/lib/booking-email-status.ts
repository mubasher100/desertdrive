/**
 * Turns a booking's notification rows into "did the emails go out?" for the
 * admin's booking page.
 *
 * Rows are tagged with the order by lib/booking-emails.ts. Bookings taken
 * before that tagging existed (before 18 Nov 2026) have no rows at all, and
 * say so as "unknown" rather than pretending to know.
 */

export type NotificationRow = {
  id: string
  to: string
  channel: string
  template: string | null
  status: string
  data?: Record<string, unknown> | null
  created_at: string | Date
}

export type EmailStatus = {
  /** sent · failed · pending · unknown (no record) */
  status: "sent" | "failed" | "pending" | "unknown"
  to: string | null
  at: string | null
  reason: string | null
}

const TEMPLATES = { customer: "booking-confirmation", office: "booking-owner-alert" } as const

export function summariseBookingEmails(rows: NotificationRow[]): { customer: EmailStatus; office: EmailStatus } {
  const byTime = [...rows].sort((a, b) => time(b.created_at) - time(a.created_at))
  return {
    customer: statusFor("customer", byTime),
    office: statusFor("office", byTime),
  }
}

function statusFor(which: keyof typeof TEMPLATES, newestFirst: NotificationRow[]): EmailStatus {
  const latest = newestFirst.find((r) => r.channel === "email" && r.template === TEMPLATES[which])
  if (!latest) return { status: "unknown", to: null, at: null, reason: null }

  const status = latest.status === "success" ? "sent" : latest.status === "failure" ? "failed" : "pending"
  let reason: string | null = null
  if (status === "failed") {
    // The feed entry written for this failure, at or just after the send.
    const report = newestFirst.find(
      (r) =>
        r.channel === "feed" &&
        r.data?.kind === "email_failed" &&
        r.data?.email === which &&
        time(r.created_at) >= time(latest.created_at) - 1000
    )
    reason = typeof report?.data?.reason === "string" ? report.data.reason : null
  }
  return { status, to: latest.to, at: new Date(time(latest.created_at)).toISOString(), reason }
}

function time(v: string | Date): number {
  return new Date(v).getTime()
}
