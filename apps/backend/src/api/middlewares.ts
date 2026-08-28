import { defineMiddlewares } from "@medusajs/framework/http"
import { quoteMiddlewares } from "./store/quotes/middlewares"

export default defineMiddlewares({
  routes: [...quoteMiddlewares],
})
