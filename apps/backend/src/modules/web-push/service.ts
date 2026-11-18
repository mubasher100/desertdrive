import { MedusaService } from "@medusajs/framework/utils"
import PushSubscription from "./models/push-subscription"
import PushKey from "./models/push-key"

/** Data access only. Sending lives in lib/push.ts; changes go through workflows/push. */
class WebPushModuleService extends MedusaService({
  PushSubscription,
  PushKey,
}) {}

export default WebPushModuleService
