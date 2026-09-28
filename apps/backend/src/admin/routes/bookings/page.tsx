import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Calendar } from "@medusajs/icons"
import { Badge, Container, Heading, Table, Text } from "@medusajs/ui"
import { useQuery } from "@tanstack/react-query"
import { useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { sdk } from "../../lib/client"
import { formatPickup, readBooking, readPayment, routeLabel } from "../../lib/booking"

type Tab = "upcoming" | "past"

/**
 * The job sheet: every booking ordered by pickup time, upcoming first. Medusa's
 * order list cannot filter on metadata, so the most recent orders are fetched
 * and sorted here. At this business's volume (a few bookings a day) that is
 * hundreds of rows at most; revisit with a dedicated index if it ever is not.
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
      .filter((r): r is typeof r & { booking: NonNullable<typeof r.booking> } => !!r.booking && r.order.status !== "canceled")
    const upcoming = all.filter((r) => new Date(r.booking.pickup_at).getTime() >= now - 3 * 3600_000)
    const past = all.filter((r) => new Date(r.booking.pickup_at).getTime() < now - 3 * 3600_000)
    upcoming.sort((a, b) => a.booking.pickup_at.localeCompare(b.booking.pickup_at))
    past.sort((a, b) => b.booking.pickup_at.localeCompare(a.booking.pickup_at))
    return { upcoming, past }
  }, [data])

  const list = rows[tab]

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div>
          <Heading level="h1">Bookings</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            Airport transfers by pickup time, Qatar time. Open a booking to see the full details and mark cash collected.
          </Text>
        </div>
        <div className="flex gap-x-2">
          <TabButton active={tab === "upcoming"} onClick={() => setTab("upcoming")} label={`Upcoming (${rows.upcoming.length})`} />
          <TabButton active={tab === "past"} onClick={() => setTab("past")} label={`Past (${rows.past.length})`} />
        </div>
      </div>

      {isLoading ? (
        <div className="px-6 py-8">
          <Text size="small" className="text-ui-fg-subtle">
            Loading bookings…
          </Text>
        </div>
      ) : list.length === 0 ? (
        <div className="px-6 py-8">
          <Text size="small" className="text-ui-fg-subtle">
            {tab === "upcoming" ? "No upcoming bookings." : "No past bookings."}
          </Text>
        </div>
      ) : (
        <Table>
          <Table.Header>
            <Table.Row>
              <Table.HeaderCell>Pickup</Table.HeaderCell>
              <Table.HeaderCell>Ref</Table.HeaderCell>
              <Table.HeaderCell>Route</Table.HeaderCell>
              <Table.HeaderCell>Flight</Table.HeaderCell>
              <Table.HeaderCell>Pax · bags</Table.HeaderCell>
              <Table.HeaderCell>Contact</Table.HeaderCell>
              <Table.HeaderCell>Payment</Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {list.map(({ order, booking, payment }) => {
              const p = formatPickup(booking.pickup_at)
              const currency = String(order.currency_code ?? "qar").toUpperCase()
              return (
                <Table.Row key={order.id} className="cursor-pointer [&_td]:align-top">
                  <Table.Cell>
                    <Link to={`/orders/${order.id}`} className="block">
                      <Text size="small" weight="plus" leading="compact">
                        {p.date}
                      </Text>
                      <Text size="small" leading="compact" className="text-ui-fg-subtle">
                        {p.time}
                      </Text>
                    </Link>
                  </Table.Cell>
                  <Table.Cell>
                    <Link to={`/orders/${order.id}`} className="text-ui-fg-interactive hover:underline">
                      DD-{order.display_id}
                    </Link>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge size="2xsmall" color={booking.direction === "arrival" ? "blue" : "orange"} className="me-2">
                      {booking.direction === "arrival" ? "From" : "To"}
                    </Badge>
                    {routeLabel(booking)}
                    {booking.return_at && (
                      <Badge size="2xsmall" color="purple" className="ms-2">
                        + return
                      </Badge>
                    )}
                  </Table.Cell>
                  <Table.Cell>{booking.flight_number ?? "—"}</Table.Cell>
                  <Table.Cell>
                    {booking.passengers} · {booking.luggage}
                    {/*
                      The extras sit with the party size because they are the
                      same question for the driver: what has to be IN the car
                      before it leaves. A child seat missed here is a booking
                      that cannot be driven on arrival.
                    */}
                    {booking.add_ons.map((a) => (
                      <Badge key={a.title} size="2xsmall" color="green" className="mt-1 block w-fit">
                        {a.quantity > 1 ? `${a.quantity} × ${a.title}` : a.title}
                      </Badge>
                    ))}
                  </Table.Cell>
                  <Table.Cell>
                    <Text size="small" leading="compact">
                      {booking.contact_name}
                    </Text>
                    <a className="text-ui-fg-interactive hover:underline" href={`tel:${booking.contact_phone}`}>
                      {booking.contact_phone}
                    </a>
                  </Table.Cell>
                  <Table.Cell>
                    {payment.method === "cash" ? (
                      <Badge size="2xsmall" color={payment.captured ? "green" : "grey"}>
                        {payment.captured ? "Cash collected" : `Cash · ${payment.amount} ${currency}`}
                      </Badge>
                    ) : (
                      <Badge size="2xsmall" color={payment.captured ? "green" : "orange"}>
                        {payment.captured ? `Card · ${payment.amount} ${currency}` : "Card pending"}
                      </Badge>
                    )}
                  </Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
      )}
    </Container>
  )
}

const TabButton = ({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={active}
    className={
      active
        ? "rounded-md bg-ui-bg-base-pressed px-3 py-1.5 text-sm font-medium text-ui-fg-base shadow-borders-base"
        : "rounded-md px-3 py-1.5 text-sm text-ui-fg-subtle hover:bg-ui-bg-base-hover"
    }
  >
    {label}
  </button>
)

export const config = defineRouteConfig({
  label: "Bookings",
  icon: Calendar,
})

export default BookingsPage
