import { defineMiddlewares } from "@medusajs/framework/http"
import { quoteMiddlewares } from "./store/quotes/middlewares"
import { reservationMiddlewares } from "./store/reservations/middlewares"
import { fareZoneMiddlewares } from "./admin/fare-zones/middlewares"

export default defineMiddlewares({
  routes: [...quoteMiddlewares, ...reservationMiddlewares, ...fareZoneMiddlewares],
})
