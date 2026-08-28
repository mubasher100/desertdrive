"use client"

import { useParams } from "next/navigation"
import { useEffect } from "react"
import { dirOf, localeOf } from "@lib/util/locale"

/**
 * Keeps `<html lang>` and `<html dir>` in step with the locale in the URL.
 *
 * This is the SECOND of two mechanisms, and both are needed:
 *
 *   1. An inline script in the root layout sets lang and dir before first paint.
 *      The root layout receives no route params, and doing it in an effect would
 *      flash the wrong direction on load.
 *
 *   2. This component, in the locale layout, handles everything after that. The
 *      inline script runs once per document load, so on a client-side language
 *      switch the page would otherwise re-render in Arabic while the document
 *      stayed `dir="ltr"`.
 *
 * A hard-navigating language switcher would not remove the need for this either:
 * browser back and forward hit the same path without a document load.
 *
 * Renders nothing.
 */
export default function DirectionSync() {
  const params = useParams()
  const segment = Array.isArray(params?.countryCode)
    ? params.countryCode[0]
    : (params?.countryCode as string | undefined)

  useEffect(() => {
    if (!segment) {
      return
    }

    const root = document.documentElement
    const lang = localeOf(segment)
    const dir = dirOf(segment)

    if (root.lang !== lang) {
      root.lang = lang
    }

    if (root.dir !== dir) {
      root.dir = dir
    }
  }, [segment])

  return null
}
