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
 *  - "Turn on notifications" subscribes this device to web push
 *    (lib/push.ts): a system notification for every new booking and failed
 *    email, even when the admin is CLOSED. Android Chrome works anywhere;
 *    iPhone only for the admin added to the Home Screen (iOS 16.4+), and the
 *    panel says how. While the admin is open there is also a chime.
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
  const push = usePush()
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
    for (const e of fresh.reverse()) announce(e, alerts, push.state === "on")
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  const unread = entries.filter((e) => Date.parse(e.created_at) > readAt)
  const failing = unread.some((e) => e.data?.kind === "email_failed")
  const shown = expanded ? entries : entries.slice(0, 3)

  const markRead = () => {
    const now = new Date().toISOString()
    save(READ_KEY, now)
    setReadAt(Date.parse(now))
  }

  // Browsers only allow the permission prompt, and audio, from a tap — so
  // both happen here, on the tap that turns notifications on.
  const turnOn = async () => {
    chime(true)
    setAlerts(true)
    save(ALERTS_KEY, "on")
    if (push.state === "available") {
      const ok = await push.subscribe()
      if (ok) toast.success("Notifications on for this device. They arrive even when the admin is closed.")
      return
    }
    toast.success("Alerts on: a chime and a message for every new booking while the admin is open")
  }

  const turnOff = async () => {
    setAlerts(false)
    save(ALERTS_KEY, "off")
    if (push.state === "on") await push.unsubscribe()
    toast.info("Notifications are off on this device")
  }

  const on = push.state === "on" || (push.state !== "available" && alerts)

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
          {on ? (
            <>
              {push.state === "on" && (
                <Button size="small" variant="secondary" className="min-h-[44px] w-full xsmall:w-auto" isLoading={push.busy} onClick={push.test}>
                  Send test notification
                </Button>
              )}
              <Button size="small" variant="secondary" className="min-h-[44px] w-full xsmall:w-auto" onClick={turnOff}>
                Turn off notifications
              </Button>
            </>
          ) : (
            <Button size="small" variant="primary" className="min-h-[44px] w-full xsmall:w-auto" isLoading={push.busy} onClick={turnOn}>
              Turn on notifications
            </Button>
          )}
          {unread.length > 0 && (
            <Button size="small" variant="secondary" className="min-h-[44px] w-full xsmall:w-auto" onClick={markRead}>
              Mark all read
            </Button>
          )}
        </div>
      </div>

      <PushStatus state={push.state} />

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

function announce(e: FeedEntry, alerts: boolean, pushOn: boolean) {
  const title = e.data?.title ?? "Desert Drive"
  const failed = e.data?.kind === "email_failed"
  if (failed) toast.error(title)
  else toast.info(title, { description: e.data?.description?.split("\n")[0] })
  if (!alerts) return
  chime(false)
  // A device with push already gets the system notification from the push.
  if (pushOn) return
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

type PushState = "checking" | "on" | "available" | "ios-needs-home-screen" | "blocked" | "unsupported"

/**
 * Push on this device: whether it can be had, and turning it on and off.
 * The subscription lives in the browser; the backend keeps a copy to send to.
 */
function usePush() {
  const [state, setState] = useState<PushState>("checking")
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    detect().then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const subscribe = async (): Promise<boolean> => {
    setBusy(true)
    try {
      const permission = await Notification.requestPermission()
      if (permission !== "granted") {
        setState("blocked")
        toast.error("Notifications were not allowed. Allow them for this site in the settings, then try again.")
        return false
      }
      const reg = await registration()
      const { public_key } = await sdk.client.fetch<{ public_key: string }>("/admin/push/public-key")
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(public_key) }))
      await sdk.client.fetch("/admin/push/subscriptions", { method: "POST", body: sub.toJSON() })
      setState("on")
      return true
    } catch (e) {
      toast.error(errorText(e, "Notifications could not be turned on"))
      return false
    } finally {
      setBusy(false)
    }
  }

  const unsubscribe = async () => {
    setBusy(true)
    try {
      const reg = await registration()
      const sub = await reg.pushManager.getSubscription()
      if (sub) {
        await sdk.client.fetch("/admin/push/unsubscribe", { method: "POST", body: { endpoint: sub.endpoint } }).catch(() => undefined)
        await sub.unsubscribe()
      }
      setState("available")
    } finally {
      setBusy(false)
    }
  }

  const test = async () => {
    setBusy(true)
    try {
      const r = await sdk.client.fetch<{ sent: number; failed: number; errors?: string[] }>("/admin/push/test", { method: "POST" })
      const why = r.errors?.length ? ` ${r.errors.join(" · ")}` : ""
      if (r.sent && !r.failed) toast.success(`Test sent to ${r.sent} ${r.sent === 1 ? "device" : "devices"}. Close the app to see it arrive.`)
      else if (r.sent) toast.warning(`Sent to ${r.sent}, not to ${r.failed}.${why}`)
      else toast.error(`No device received it.${why || " Turn notifications off and on again on this device."}`)
    } catch (e) {
      toast.error(errorText(e, "The test did not send"))
    } finally {
      setBusy(false)
    }
  }

  return { state, busy, subscribe, unsubscribe, test }
}

/**
 * The SDK's error message is empty when the server answers without a JSON
 * message (a gateway error, a restart), which is how the first failure on
 * the owner's iPhone read only "The test did not send". Always say the status.
 */
function errorText(e: unknown, what: string): string {
  const err = e as { message?: string; status?: number; statusText?: string }
  const detail = [err.status ? `HTTP ${err.status}` : null, err.message || err.statusText || null].filter(Boolean).join(" — ")
  return `${what}${detail ? `: ${detail}` : "."}`
}

async function detect(): Promise<PushState> {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent)
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true
  const supported = "serviceWorker" in navigator && "PushManager" in window && typeof Notification !== "undefined"
  if (ios && !standalone) return "ios-needs-home-screen"
  if (!supported) return "unsupported"
  if (Notification.permission === "denied") return "blocked"
  try {
    const reg = await registration()
    const sub = await reg.pushManager.getSubscription()
    if (sub && Notification.permission === "granted") {
      // Keep the backend's copy current: it may have been dropped as stale.
      sdk.client.fetch("/admin/push/subscriptions", { method: "POST", body: sub.toJSON() }).catch(() => undefined)
      return "on"
    }
  } catch {
    return "unsupported"
  }
  return "available"
}

async function registration(): Promise<ServiceWorkerRegistration> {
  const existing = await navigator.serviceWorker.getRegistration("/app/")
  if (existing) return existing
  await navigator.serviceWorker.register("/push/sw", { scope: "/app/" })
  return navigator.serviceWorker.ready
}

function base64UrlToBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const pad = "=".repeat((4 - (b64url.length % 4)) % 4)
  const raw = atob((b64url + pad).replace(/-/g, "+").replace(/_/g, "/"))
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

function PushStatus({ state }: { state: PushState }) {
  if (state === "on") {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        This device gets a notification for every new booking, even when the admin is closed.
      </Text>
    )
  }
  if (state === "ios-needs-home-screen") {
    return (
      <div className="flex flex-col gap-1 rounded-md bg-ui-bg-subtle p-3">
        <Text size="small" weight="plus">To get notifications on this iPhone</Text>
        <Text size="small" className="text-ui-fg-subtle">1. Tap the Share button, then “Add to Home Screen”.</Text>
        <Text size="small" className="text-ui-fg-subtle">2. Open “DD Bookings” from the Home Screen and log in.</Text>
        <Text size="small" className="text-ui-fg-subtle">3. Tap “Turn on notifications” there.</Text>
      </div>
    )
  }
  if (state === "blocked") {
    return (
      <Text size="small" className="text-ui-fg-error">
        Notifications are blocked for this site. Allow them in the browser or phone settings, then reload.
      </Text>
    )
  }
  if (state === "unsupported") {
    return (
      <Text size="small" className="text-ui-fg-subtle">
        This browser cannot get notifications while closed. Alerts still work while the admin is open.
      </Text>
    )
  }
  return null
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
