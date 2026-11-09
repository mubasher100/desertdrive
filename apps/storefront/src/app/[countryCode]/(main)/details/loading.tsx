import BookingLoader from "@modules/booking/components/booking-loader"

/** Shown the moment this step is requested, until it has rendered. */
export default function Loading() {
  return <BookingLoader step="details" />
}
