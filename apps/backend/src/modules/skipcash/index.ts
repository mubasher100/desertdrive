import { ModuleProvider, Modules } from "@medusajs/framework/utils"
import SkipCashProviderService from "./service"

/**
 * Registered under the payment module's `providers` in medusa-config.ts with
 * id "skipcash", which makes the provider id `pp_skipcash_skipcash` and the
 * webhook path /hooks/payment/skipcash_skipcash.
 */
export default ModuleProvider(Modules.PAYMENT, {
  services: [SkipCashProviderService],
})
