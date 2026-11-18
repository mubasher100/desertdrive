import { Badge, Button, Container, Text, toast } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { sdk } from "../lib/client"

/**
 * The owner's notifications: new bookings, and emails that failed to send.
 *
 * Email is not a reliable alert on its own. It failed silently for every
 * booking in Nov 2026, and with no minimum notice a customer can book a
 * pickup minutes away. So the backend also writes every new booking and
 * every failed email to Medusa's "feed" channel (lib/booking-emails.ts), and
 * this panel reads it:
 *
 *  - checked every 30 seconds while the admin is open
 *  - unread entries are marked, and "Mark all read" clears them, per device
 *  - "Turn on alerts" asks the browser's permission, then a new booking
 *    plays a short chime and shows a system notification, even when the tab
 *    is in the background. iPhone Safari only allows system notifications
 *    for a site added to the Home Screen; the chime and the on-page message
 *    work regardless.
 *
 * The same entries also appear under Medusa's own bell, top right.
 */

type FeedEntry = {
  id: string
  created_at: string
  data?: {
    title?: string
    description?: string
    kind?: "new_booking" | "email_failed"
    order_id?: string
  } | null
}

const READ_KEY = "dd-notifications-read-at"
const ALERTS_KEY = "dd-notifications-alerts"

function load(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Private mode: works for this visit only.
  }
}

export function NotificationsPanel() {
  const [readAt, setReadAt] = useState<number>(() => Number(Date.parse(load(READ_KEY) ?? "")) || 0)
  const [alerts, setAlerts] = useState<boolean>(() => load(ALERTS_KEY) === "on")
  const [expanded, setExpanded] = useState(false)
  /** The newest entry seen so far; anything newer, after the first load, is announced. */
  const newestSeen = useRef<number | null>(null)

  const { data, isLoading, isError } = useQuery({
    queryKey: ["dd-feed"],
    queryFn: () =>
      sdk.admin.notification.list({ channel: "feed", limit: 20, order: "-created_at" } as Record<string, unknown>) as unknown as Promise<{
        notifications: FeedEntry[]
      }>,
    refetchInterval: 30_000,
    refetchIntervalInBackground: true,
  })

  const entries = (data?.notifications ?? []).filter((n) => n.data?.title)

  useEffect(() => {
    if (!entries.length) {
      if (data && newestSeen.current === null) newestSeen.current = 0
      return
    }
    const newest = Date.parse(entries[0].created_at)
    if (newestSeen.current === null) {
      newestSeen.current = newest
      return
    }
    const fresh = entries.filter((e) => Date.parse(e.created_at) > (newestSeen.current ?? 0))
    newestSeen.current = Math.max(newest, newestSeen.current)
    for (const e of fresh.reverse()) announce(e, alerts)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const unread = entries.filter((e) => Date.parse(e.created_at) > readAt)
  const failing = unread.some((e) => e.data?.kind === "email_failed")
  const shown = expanded ? entries : entries.slice(0, 3)

  const markRead = () => {
    const now = new Date().toISOString()
    save(READ_KEY, now)
    setReadAt(Date.parse(now))
  }

  const toggleAlerts = async () => {
    if (alerts) {
      setAlerts(false)
      save(ALERTS_KEY, "off")
      toast.info("Alerts are off on this device")
      return
    }
    // Ask now, while the owner has just tapped — browsers only allow the
    // prompt from a tap — and unlock audio for the chime the same way.
    chime(true)
    let permission: NotificationPermission | "unsupported" = "unsupported"
    if (typeof Notification !== "undefined") {
      permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission
    }
    setAlerts(true)
    save(ALERTS_KEY, "on")
    toast.success(
      permission === "granted"
        ? "Alerts on: a chime and a notification for every new booking while the admin is open"
        : "Alerts on: a chime for every new booking while the admin is open. This browser did not allow system notifications."
    )
  }

  return (
    <Container className="flex flex-col gap-3 px-4 py-4 small:px-6">
      <div className="flex flex-col gap-2 xsmall:flex-row xsmall:items-center xsmall:justify-between">
        <div className="flex items-center gap-2">
          <Text size="small" weight="plus">Notifications</Text>
          {unread.length > 0 && (
            <Badge size="2xsmall" color={failing ? "red" : "blue"}>
              {unread.length} new
            </Badge>
          )}
        </div>
        <div className="flex flex-col gap-2 xsmall:flex-row">
          <Button size="small" variant="secondary" className="min-h-[44px] w-full xsmall:w-auto" onClick={toggleAlerts}>
            {alerts ? "Turn off alerts" : "Turn on alerts"}
          </Button>
          {unread.length > 0 && (
            <Button size="small" variant="secondary" className="min-h-[44px] w-full xsmall:w-auto" onClick={markRead}>
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <Text size="small" className="text-ui-fg-subtle">Loading…</Text>
      ) : isError ? (
        <Text size="small" className="text-ui-fg-error">Notifications could not be loaded. They will be tried again shortly.</Text>
      ) : entries.length === 0 ? (
        <Text size="small" className="text-ui-fg-subtle">Nothing yet. New bookings, and any email that fails to send, appear here.</Text>
      ) : (
        <ul className="flex flex-col divide-y rounded-md border">
          {shown.map((e) => {
            const isUnread = Date.parse(e.created_at) > readAt
            const failed = e.data?.kind === "email_failed"
            const body = (
              <div className="flex flex-col gap-0.5 px-3 py-3">
                <div className="flex items-start justify-between gap-2">
                  <Text size="small" weight={isUnread ? "plus" : "regular"} className={failed ? "text-ui-fg-error" : undefined}>
                    {e.data?.title}
                  </Text>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <Text size="xsmall" className="text-ui-fg-subtle">{ago(e.created_at)}</Text>
                    {isUnread && <span className="h-2 w-2 rounded-full bg-ui-bg-interactive" aria-label="unread" />}
                  </span>
                </div>
                {e.data?.description && (
                  <Text size="small" className="text-ui-fg-subtle whitespace-pre-line break-words">{e.data.description}</Text>
                )}
              </div>
            )
            return (
              <li key={e.id}>
                {e.data?.order_id ? (
                  <Link to={`/bookings/${e.data.order_id}`} className="block min-h-[44px] hover:bg-ui-bg-base-hover">
                    {body}
                  </Link>
                ) : (
                  body
                )}
              </li>
            )
          })}
        </ul>
      )}
      {entries.length > 3 && (
        <Button size="small" variant="transparent" className="min-h-[44px] self-start" onClick={() => setExpanded((x) => !x)}>
          {expanded ? "Show fewer" : `Show all ${entries.length}`}
        </Button>
      )}
    </Container>
  )
}

function announce(e: FeedEntry, alerts: boolean) {
  const title = e.data?.title ?? "Desert Drive"
  const failed = e.data?.kind === "email_failed"
  if (failed) toast.error(title)
  else toast.info(title, { description: e.data?.description?.split("\n")[0] })
  if (!alerts) return
  chime(false)
  try {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const n = new Notification(title, { body: e.data?.description ?? "", tag: e.id })
      n.onclick = () => {
        window.focus()
        if (e.data?.order_id) window.location.assign(`/app/bookings/${e.data.order_id}`)
      }
    }
  } catch {
    // Some mobile browsers expose Notification but refuse `new Notification`.
  }
}

let audio: AudioContext | null = null

/** Two short tones. `silent` only unlocks audio, on the tap that turns alerts on. */
function chime(silent: boolean) {
  try {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctx) return
    audio = audio ?? new Ctx()
    if (audio.state === "suspended") void audio.resume()
    if (silent) return
    const t = audio.currentTime
    for (const [freq, start] of [[880, 0], [1320, 0.18]] as const) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, t + start)
      gain.gain.exponentialRampToValueAtTime(0.25, t + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + start + 0.3)
      osc.connect(gain).connect(audio.destination)
      osc.start(t + start)
      osc.stop(t + start + 0.32)
    }
  } catch {
    // No audio is not worth an error.
  }
}

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 1000))
  if (s < 60) return "just now"
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  return new Date(iso).toLocaleDateString("en-GB", { timeZone: "Asia/Qatar", day: "numeric", month: "short" })
}
