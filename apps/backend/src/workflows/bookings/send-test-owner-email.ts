import { createWorkflow, transform, WorkflowResponse } from "@medusajs/framework/workflows-sdk"
import { sendNotificationsStep } from "@medusajs/medusa/core-flows"

type Input = { to: string; admin_base: string; now: string }

/**
 * Sends the office's "new booking" email with sample data, so the owner can
 * check it arrives without anyone having to book and pay. Same template and
 * same provider as a real booking (subscribers/order-placed.ts); only the
 * data is made up, and it says so in the customer's name.
 */
export const sendTestOwnerEmailWorkflow = createWorkflow("send-test-owner-email", function (input: Input) {
  const notification = transform({ input }, function ({ input }) {
    const pickup = new Date(new Date(input.now).getTime() + 3 * 86400_000)
    pickup.setUTCHours(11, 0, 0, 0)
    return [
      {
        to: input.to,
        channel: "email",
        template: "booking-owner-alert",
        data: {
          reference: "DD-TEST",
          admin_url: `${input.admin_base}/app/bookings`,
          direction: "arrival",
          address: "Four Seasons Hotel Doha, West Bay",
          lat: 25.3209,
          lng: 51.5317,
          pickup_at: pickup.toISOString(),
          return_at: null,
          flight_number: "QR001",
          vehicle_title: "SUV",
          passengers: 3,
          luggage: 3,
          contact_name: "TEST BOOKING — please ignore",
          contact_phone: "+97451514161",
          contact_email: input.to,
          notes: "A test of the new-booking email, sent from the admin. No customer, no payment.",
          add_ons: [{ title: "Meet & greet sign", quantity: 1, note: "Mr Test" }],
          total: 101.92,
          currency: "qar",
          paid: true,
          whatsapp_customer_url: "https://wa.me/97451514161?text=Test",
        },
      },
    ]
  })
  const sent = sendNotificationsStep(notification)
  return new WorkflowResponse(sent)
})
