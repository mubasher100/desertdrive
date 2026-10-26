import { Badge, Button, Container, Drawer, Heading, Input, Label, Text, toast, usePrompt } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useState, type ReactNode } from "react"
import { Link, useParams } from "react-router-dom"
import { sdk } from "../../../lib/client"
import "../../../lib/simplify"
import {
  formatPickup,
  mapsUrl,
  money,
  readBooking,
  readPayment,
  returnRouteLabel,
  routeLabel,
  statusBadge,
  whatsappCustomerUrl,
} from "../../../lib/booking"

/**
 * One booking, with every action the owner takes on it as a real button:
 * Message on WhatsApp, Map, Cancel, Record refund. No Confirm: a paid
 * booking is already confirmed, and the driver is allocated by hand.
 *
 * Built for a phone first: the buttons stack full-width and are at least 44 px
 * tall, the details read top to bottom. This is where the "Open booking"
 * link in the office email lands.
 *
 * ⚠️ Refund RECORDS a refund, it does not send one. SkipCash refunds are made
 * in the SkipCash merchant portal — the payment provider refuses them through
 * the API on purpose, so nothing here can claim money went back when it did
 * not. The drawer says so before it asks for the amount.
 */
const BookingPage = () => {
  const { id } = useParams()
  const queryClient = useQueryClient()
  const prompt = usePrompt()
  const [refundOpen, setRefundOpen] = useState(false)

  const queryKey = ["booking", id]
  const { data, isLoading } = useQuery({
    queryKey,
    queryFn: () =>
      sdk.admin.order.retrieve(id!, {
        fields: "id,display_id,status,total,currency_code,metadata,created_at,*items,*payment_collections,*payment_collections.payments",
      }),
    enabled: !!id,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey })
    queryClient.invalidateQueries({ queryKey: ["bookings-list"] })
  }

  const act = useMutation({
    mutationFn: (body: { action: "cancel"; reason?: string }) =>
      sdk.client.fetch(`/admin/bookings/${id}/action`, { method: "POST", body }),
    onSuccess: () => {
      toast.success("Booking cancelled — the car is free again")
      refresh()
    },
    onError: (e: Error) => toast.error(e.message || "That did not work"),
  })

  if (isLoading || !data) {
    return (
      <Container className="px-4 py-8 small:px-6">
        <Text size="small" className="text-ui-fg-subtle">Loading booking…</Text>
      </Container>
    )
  }

  const order = data.order
  const booking = readBooking(order)
  if (!booking) {
    return (
      <Container className="px-4 py-8 small:px-6">
        <Text size="small">This order is not a booking.</Text>
      </Container>
    )
  }

  const payment = readPayment(order)
  const reference = `DD-${order.display_id}`
  const pickup = formatPickup(booking.pickup_at)
  const badge = statusBadge(booking, payment.amount, payment.captured)
  const whatsapp = whatsappCustomerUrl(booking, reference)
  const map = mapsUrl(booking)
  const refundable = Math.round((payment.amount - booking.refunded_total) * 100) / 100
  const cancelled = booking.status === "cancelled"

  const cancel = async () => {
    const ok = await prompt({
      title: `Cancel ${reference}?`,
      description:
        "The booking is marked cancelled and the car goes back on sale for that time. This does not refund the customer — do that in SkipCash, then use Record refund.",
      confirmText: "Cancel booking",
      cancelText: "Keep booking",
      variant: "danger",
    })
    if (ok) act.mutate({ action: "cancel" })
  }

  return (
    <div className="flex flex-col gap-3">
      <Container className="flex flex-col gap-4 px-4 py-4 small:px-6">
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Heading level="h1">{reference}</Heading>
            <Badge size="2xsmall" color={badge.color}>{badge.label}</Badge>
          </div>
          <Text size="large" weight="plus" leading="compact">
            {pickup.date} · {pickup.time}
          </Text>
          <Text size="small" className="text-ui-fg-subtle">
            {String(order.metadata?.vehicle_title ?? "")} · {booking.contact_name}
          </Text>
        </div>

        {/* The actions. Stacked full-width on a phone, a grid on a desk. */}
        <div className="grid grid-cols-1 gap-2 xsmall:grid-cols-2 small:grid-cols-3">
          {whatsapp && <BigLink href={whatsapp}>Message on WhatsApp</BigLink>}
          {map && <BigLink href={map}>Pickup on map</BigLink>}
          {payment.captured && refundable > 0 && (
            <BigButton variant="secondary" onClick={() => setRefundOpen(true)}>
              Record refund
            </BigButton>
          )}
          {!cancelled && (
            <BigButton variant="danger" isLoading={act.isPending} onClick={cancel}>
              Cancel booking
            </BigButton>
          )}
        </div>
      </Container>

      <Container className="divide-y p-0">
        <Row label="Pickup">{pickup.date} · {pickup.time}</Row>
        <Row label="Route">{routeLabel(booking)}</Row>
        {booking.return_at && (
          <Row label="Return">
            {returnRouteLabel(booking)} · {formatPickup(booking.return_at).date} {formatPickup(booking.return_at).time}
          </Row>
        )}
        <Row label="Flight">{booking.flight_number ?? "—"}</Row>
        <Row label="Passengers">{booking.passengers} passengers · {booking.luggage} bags</Row>
        {booking.add_ons.length > 0 && (
          <Row label="Extras">
            <span className="flex flex-col gap-1">
              {booking.add_ons.map((a) => (
                <span key={a.title}>
                  {a.quantity > 1 ? `${a.quantity} × ${a.title}` : a.title}
                  {a.note && <> — “{a.note}”</>}
                  {a.image_url && (
                    <>
                      {" · "}
                      <a className="text-ui-fg-interactive hover:underline" href={a.image_url} target="_blank" rel="noreferrer">
                        open picture
                      </a>
                    </>
                  )}
                </span>
              ))}
            </span>
          </Row>
        )}
        <Row label="Customer">{booking.contact_name}</Row>
        <Row label="Phone">{booking.contact_phone}</Row>
        <Row label="Email">
          <a className="text-ui-fg-interactive hover:underline" href={`mailto:${booking.contact_email}`}>{booking.contact_email}</a>
        </Row>
        <Row label="Notes">{booking.notes ?? "—"}</Row>
        <Row label="Payment">
          {money(payment.amount)} · {payment.captured ? "paid by card" : "not paid yet"}
          {booking.refunded_total > 0 && ` · ${money(booking.refunded_total)} refunded`}
        </Row>
        {booking.cancelled_at && <Row label="Cancelled">{new Date(booking.cancelled_at).toLocaleString("en-GB", { timeZone: "Asia/Qatar" })}</Row>}
        <div className="px-4 py-3 small:px-6">
          <Link to={`/orders/${order.id}`} className="text-ui-fg-interactive text-sm hover:underline">
            Full order details
          </Link>
        </div>
      </Container>

      <RefundDrawer
        open={refundOpen}
        onOpenChange={setRefundOpen}
        orderId={order.id}
        reference={reference}
        maxQar={refundable}
        onDone={refresh}
      />
    </div>
  )
}

function RefundDrawer({
  open,
  onOpenChange,
  orderId,
  reference,
  maxQar,
  onDone,
}: {
  open: boolean
  onOpenChange: (o: boolean) => void
  orderId: string
  reference: string
  maxQar: number
  onDone: () => void
}) {
  const [amount, setAmount] = useState("")
  const record = useMutation({
    mutationFn: (qar: number) => sdk.client.fetch(`/admin/bookings/${orderId}/refund`, { method: "POST", body: { amount: qar } }),
    onSuccess: () => {
      toast.success("Refund recorded")
      onOpenChange(false)
      setAmount("")
      onDone()
    },
    onError: (e: Error) => toast.error(e.message || "Could not record the refund"),
  })

  const value = amount === "" ? maxQar : Number(amount)

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Record a refund · {reference}</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4">
          <div className="rounded-md bg-ui-bg-subtle p-3">
            <Text size="small" weight="plus">1. Refund the customer in SkipCash first.</Text>
            <Text size="small" className="text-ui-fg-subtle">
              Refunds are sent from your SkipCash merchant portal. This page cannot send money — it only keeps the record.
            </Text>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="refund-amount" size="small" weight="plus">2. Amount you refunded, in QAR</Label>
            <Input
              id="refund-amount"
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              max={maxQar}
              placeholder={String(maxQar)}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            <Text size="small" className="text-ui-fg-subtle">
              {Number.isFinite(value) && value > 0 ? `${money(value)} · ` : ""}up to {maxQar} QAR is left to refund.
            </Text>
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Drawer.Close asChild>
            <Button size="small" variant="secondary">Back</Button>
          </Drawer.Close>
          <Button
            size="small"
            isLoading={record.isPending}
            disabled={record.isPending || !Number.isFinite(value) || value <= 0 || value > maxQar}
            onClick={() => record.mutate(value)}
          >
            Record refund
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  )
}

function BigButton(props: { variant: "primary" | "secondary" | "danger"; onClick: () => void; isLoading?: boolean; children: ReactNode }) {
  return (
    <Button
      variant={props.variant}
      size="large"
      className="min-h-[44px] w-full"
      isLoading={props.isLoading}
      disabled={props.isLoading}
      onClick={props.onClick}
    >
      {props.children}
    </Button>
  )
}

function BigLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button asChild variant="secondary" size="large" className="min-h-[44px] w-full">
      <a href={href} target="_blank" rel="noreferrer">{children}</a>
    </Button>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-0.5 px-4 py-3 xsmall:grid-cols-[120px_1fr] xsmall:gap-3 small:px-6">
      <Text size="small" className="text-ui-fg-subtle">{label}</Text>
      <Text size="small" className="break-words">{children}</Text>
    </div>
  )
}

export default BookingPage
