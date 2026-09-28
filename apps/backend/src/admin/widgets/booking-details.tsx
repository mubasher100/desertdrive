import type { ReactNode } from "react"
import { defineWidgetConfig } from "@medusajs/admin-sdk"
import type { DetailWidgetProps, HttpTypes } from "@medusajs/framework/types"
import { Badge, Button, Container, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { sdk } from "../lib/client"
import { formatPickup, mapsUrl, readBooking, readPayment, returnRouteLabel, routeLabel, whatsappUrl } from "../lib/booking"

/**
 * The booking behind an order, on the order page. Everything the driver and
 * the office need in one card: route, pickup time (Qatar time), flight,
 * passengers, contact, notes — and the one action the owner takes on a cash
 * booking, marking the cash collected (which captures the manual payment).
 *
 * Position on the page is the admin user's choice in the Editor view.
 */
const BookingDetailsWidget = ({ data: initial }: DetailWidgetProps<HttpTypes.AdminOrder>) => {
  const queryClient = useQueryClient()

  // Display query: re-fetch with the payment relations, which the page's own
  // order query does not necessarily include. Loads on mount, unconditionally.
  const { data, isLoading } = useQuery({
    queryKey: ["booking-order", initial.id],
    queryFn: () =>
      sdk.admin.order.retrieve(initial.id, {
        fields: "id,display_id,total,currency_code,metadata,*payment_collections,*payment_collections.payments",
      }),
  })

  const order = data?.order ?? initial
  const booking = readBooking(order)
  const payment = readPayment(order)

  const collect = useMutation({
    mutationFn: () => sdk.admin.payment.capture(payment.paymentId!, {}),
    onSuccess: () => {
      toast.success("Cash marked as collected")
      queryClient.invalidateQueries({ queryKey: ["booking-order", initial.id] })
      queryClient.invalidateQueries({ queryKey: ["order", initial.id] })
      queryClient.invalidateQueries({ queryKey: ["orders", "detail", initial.id] })
    },
    onError: (e: Error) => toast.error(e.message || "Could not capture the payment"),
  })

  if (!booking) {
    // Not every order is a booking (a draft order, say). Say nothing rather than render empties.
    return null
  }

  const pickup = formatPickup(booking.pickup_at)
  const currency = String(order.currency_code ?? "qar").toUpperCase()

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <div className="flex items-center gap-x-3">
          <Text size="small" leading="compact" weight="plus">
            Booking DD-{order.display_id}
          </Text>
          <Badge size="2xsmall" color={booking.direction === "arrival" ? "blue" : "orange"}>
            {booking.direction === "arrival" ? "From airport" : "To airport"}
          </Badge>
          {booking.return_at && (
            <Badge size="2xsmall" color="purple">
              Return
            </Badge>
          )}
          {booking.band_code && (
            <Badge size="2xsmall" color="grey">
              Band {booking.band_code}
              {booking.distance_km != null ? ` · ${booking.distance_km.toFixed(1)} km` : ""}
            </Badge>
          )}
        </div>
        {payment.method === "cash" ? (
          payment.captured ? (
            <Badge size="2xsmall" color="green">
              Cash collected
            </Badge>
          ) : (
            <Button size="small" variant="secondary" isLoading={collect.isPending} disabled={collect.isPending || !payment.paymentId} onClick={() => collect.mutate()}>
              Mark cash collected · {payment.amount} {currency}
            </Button>
          )
        ) : (
          <Badge size="2xsmall" color={payment.captured ? "green" : "orange"}>
            {payment.captured ? `Paid by card · ${payment.amount} ${currency}` : "Card payment pending"}
          </Badge>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-6 py-4 md:grid-cols-2">
        <Row
          label="Route"
          value={
            <span className="flex flex-wrap items-center gap-x-3">
              <span>{routeLabel(booking)}</span>
              {mapsUrl(booking) && (
                <a className="text-ui-fg-interactive hover:underline" href={mapsUrl(booking)!} target="_blank" rel="noreferrer">
                  Open in maps
                </a>
              )}
            </span>
          }
        />
        <Row label="Pickup (Qatar time)" value={`${pickup.date}, ${pickup.time}`} />
        {booking.return_at && (
          <>
            <Row label="Return route" value={returnRouteLabel(booking)} />
            <Row
              label="Return pickup (Qatar time)"
              value={`${formatPickup(booking.return_at).date}, ${formatPickup(booking.return_at).time}`}
            />
          </>
        )}
        <Row label="Flight" value={booking.flight_number ?? "—"} />
        <Row label="Passengers · bags" value={`${booking.passengers} · ${booking.luggage}`} />
        <Row
          label="Contact"
          value={
            <span className="flex flex-wrap items-center gap-x-3">
              <span>{booking.contact_name}</span>
              <a className="text-ui-fg-interactive hover:underline" href={`tel:${booking.contact_phone}`}>
                {booking.contact_phone}
              </a>
              <a className="text-ui-fg-interactive hover:underline" href={whatsappUrl(booking.contact_phone)} target="_blank" rel="noreferrer">
                WhatsApp
              </a>
            </span>
          }
        />
        <Row
          label="Email"
          value={
            <a className="text-ui-fg-interactive hover:underline" href={`mailto:${booking.contact_email}`}>
              {booking.contact_email}
            </a>
          }
        />
        <Row
          label="Extras"
          value={
            booking.add_ons.length ? (
              <span className="flex flex-col gap-y-1">
                {booking.add_ons.map((a) => (
                  <span key={a.title}>
                    {a.quantity > 1 ? `${a.quantity} × ${a.title}` : a.title}
                    {/* The sign's words are the deliverable, so they are shown, quoted. */}
                    {a.note && <> — &ldquo;{a.note}&rdquo;</>}
                    {a.image_url && (
                      <>
                        {" · "}
                        <a
                          className="text-ui-fg-interactive hover:underline"
                          href={a.image_url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          open picture
                        </a>
                      </>
                    )}
                  </span>
                ))}
              </span>
            ) : (
              "—"
            )
          }
          wide
        />
        <Row label="Notes" value={booking.notes ?? "—"} wide />
        <Row
          label="Terms accepted"
          value={booking.terms_accepted_at ? new Date(booking.terms_accepted_at).toLocaleString("en-GB", { timeZone: "Asia/Qatar" }) + " (Qatar time)" : "—"}
        />
        <Row label="Booked in" value={booking.locale.startsWith("ar") ? "Arabic" : "English"} />
      </dl>
      {isLoading && (
        <div className="px-6 py-2">
          <Text size="xsmall" className="text-ui-fg-subtle">
            Refreshing payment status…
          </Text>
        </div>
      )}
    </Container>
  )
}

const Row = ({ label, value, wide }: { label: string; value: ReactNode; wide?: boolean }) => (
  <div className={wide ? "md:col-span-2" : undefined}>
    <dt>
      <Text size="small" leading="compact" className="text-ui-fg-subtle">
        {label}
      </Text>
    </dt>
    {/* A plain element, not <Text>: its children type resolves against a second
        copy of @types/react in this monorepo and rejects ReactNode values. */}
    <dd className="txt-compact-small-plus text-ui-fg-base">{value}</dd>
  </div>
)

export const config = defineWidgetConfig({
  zone: "order.details",
})

export default BookingDetailsWidget
