import { Module } from "@medusajs/framework/utils"
import WebPushModuleService from "./service"

/** camelCase — a dash here produces runtime container-resolution errors. */
export const WEB_PUSH_MODULE = "webPush"

export default Module(WEB_PUSH_MODULE, {
  service: WebPushModuleService,
})
