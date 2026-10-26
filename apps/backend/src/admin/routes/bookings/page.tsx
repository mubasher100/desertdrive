import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Calendar } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { sdk } from "../../lib/client"
import "../../lib/simplify"
import { formatPickup, money, readBooking, readPayment, routeLabel, statusBadge } from "../../lib/booking"

type Tab = "upcoming" | "past" | "cancelled"

/**
 * The owner's home: every booking as a card, soonest first.
 *
 * Cards rather than a table, because the owner reads this on a phone — a
 * table of seven columns is unreadable at 375 px, a card is not. Each card
 * opens the booking, where the buttons are.
 *
 * Medusa's order list cannot filter on metadata, so the most recent orders
 * are fetched and sorted here. At this business's volume (a few bookings a
 * day) that is hundreds at most; revisit with an index if it ever is not.
 */
const BookingsPage = () => {
  const [tab, setTab] = useState<Tab>("upcoming")

  const { data, isLoading } = useQuery({
    queryKey: ["bookings-list"],
    queryFn: () =>
      sdk.admin.order.list({
        limit: 200,
        order: "-created_at",
        fields: "id,display_id,status,total,currency_code,metadata,created_at,*payment_collections,*payment_collections.payments",
      }),
    refetchInterval: 60_000,
  })

  const rows = useMemo(() => {
    const now = Date.now()
    const all = (data?.orders ?? [])
      .map((order) => ({ order, booking: readBooking(order), payment: readPayment(order) }))
      .filter((r): r is typeof r & { booking: NonNullable<typeof r.booking> } => !!r.booking)
    const cancelled = all.filter((r) => r.booking.status === "cancelled" || r.order.status === "canceled")
    const live = all.filter((r) => !cancelled.includes(r))
    const upcoming = live.filter((r) => new Date(r.booking.pickup_at).getTime() >= now - 3 * 3600_000)
    const past = live.filter((r) => new Date(r.booking.pickup_at).getTime() < now - 3 * 3600_000)
    upcoming.sort((a, b) => a.booking.pickup_at.localeCompare(b.booking.pickup_at))
    past.sort((a, b) => b.booking.pickup_at.localeCompare(a.booking.pickup_at))
    cancelled.sort((a, b) => b.booking.pickup_at.localeCompare(a.booking.pickup_at))
    return { upcoming, past, cancelled }
  }, [data])

  const testEmail = useMutation({
    mutationFn: () => sdk.client.fetch<{ sent_to: string }>("/admin/bookings/test-email", { method: "POST" }),
    onSuccess: (r) => toast.success(`Test email sent to ${r.sent_to}`),
    onError: (e: Error) => toast.error(e.message || "The test email did not send"),
  })

  const list = rows[tab]

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-3 px-4 py-4 small:px-6">
        <div className="flex flex-col gap-3 xsmall:flex-row xsmall:items-start xsmall:justify-between">
        <div>
          <Heading level="h1">Bookings</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Paid bookings are confirmed. Times are Qatar time. Tap a booking to message the customer or cancel it.
          </Text>
        </div>
          {/* Sends the "new booking" email with sample data, to check it arrives. */}
          <Button
            size="small"
            variant="secondary"
            className="min-h-[44px] w-full shrink-0 xsmall:w-auto"
            isLoading={testEmail.isPending}
            disabled={testEmail.isPending}
            onClick={() => testEmail.mutate()}
          >
            Send test email
          </Button>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <TabButton active={tab === "upcoming"} onClick={() => setTab("upcoming")} label={`Upcoming (${rows.upcoming.length})`} />
          <TabButton active={tab === "past"} onClick={() => setTab("past")} label={`Past (${rows.past.length})`} />
          <TabButton active={tab === "cancelled"} onClick={() => setTab("cancelled")} label={`Cancelled (${rows.cancelled.length})`} />
        </div>
      </div>

      {isLoading ? (
        <div className="px-4 py-8 small:px-6">
          <Text size="small" className="text-ui-fg-subtle">Loading bookings…</Text>
        </div>
      ) : list.length === 0 ? (
        <div className="px-4 py-8 small:px-6">
          <Text size="small" className="text-ui-fg-subtle">
            {tab === "upcoming" ? "No upcoming bookings." : tab === "past" ? "No past bookings." : "No cancelled bookings."}
          </Text>
        </div>
      ) : (
        <ul className="divide-y">
          {list.map(({ order, booking, payment }) => {
            const p = formatPickup(booking.pickup_at)
            const badge = statusBadge(booking, payment.amount, payment.captured)
            return (
              <li key={order.id}>
                <Link
                  to={`/bookings/${order.id}`}
                  className="flex flex-col gap-1.5 px-4 py-4 transition-colors hover:bg-ui-bg-base-hover focus-visible:bg-ui-bg-base-hover small:px-6"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Text size="base" weight="plus" leading="compact">
                        {p.date} · {p.time}
                      </Text>
                      <Text size="small" className="text-ui-fg-subtle">
                        DD-{order.display_id} · {String(order.metadata?.vehicle_title ?? "")}
                      </Text>
                    </div>
                    <Badge size="2xsmall" color={badge.color} className="shrink-0">
                      {badge.label}
                    </Badge>
                  </div>
                  <Text size="small">{routeLabel(booking)}</Text>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Text size="small" className="text-ui-fg-subtle">
                      {booking.contact_name} · {booking.contact_phone}
                    </Text>
                    <Text size="small" weight="plus">
                      {money(payment.amount)}
                      {payment.captured ? "" : " · not paid"}
                    </Text>
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Container>
  )
}

function TabButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "min-h-[44px] rounded-md px-2 text-xs font-medium transition-colors small:text-sm " +
        (active ? "bg-ui-button-inverted text-ui-fg-on-inverted" : "bg-ui-bg-component text-ui-fg-subtle hover:bg-ui-bg-component-hover")
      }
    >
      {label}
    </button>
  )
}

export const config = defineRouteConfig({
  label: "Bookings",
  icon: Calendar,
})

export default BookingsPage
