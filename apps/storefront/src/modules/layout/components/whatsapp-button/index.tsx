"use client"

import { useEffect, useState } from "react"
import { clx } from "@medusajs/ui"
import { whatsappLink } from "@lib/data/contact"
import { useTranslations } from "@lib/i18n/use-translations"

/**
 * A WhatsApp button on every page, for the question a form cannot answer.
 *
 * Most of what a customer wants to ask — a 4am pickup, six bags, a child seat,
 * a destination the map does not name — is a sentence, not a field. WhatsApp is
 * how people in Qatar send that sentence, and the owner already answers on it.
 *
 * It is a plain link, not a widget: no third-party script, nothing loaded, no
 * cookie, and it works with JavaScript broken. The message is pre-filled so the
 * first thing the owner reads is what the person wants, not "hi".
 *
 * ⚠️ It lifts itself above the sticky action bar.
 *
 * The results and payment steps pin their primary button to the bottom of the
 * phone screen, which is exactly where a floating bubble wants to sit — and a
 * chat bubble covering "Continue" on the one screen that takes the booking is
 * the whole failure mode of this pattern. Rather than hard-coding an offset
 * that drifts, it watches for `[data-sticky-cta]` and moves up while one is on
 * the page. Those bars go static above the `small` breakpoint, so the lift is
 * mobile-only, matching them.
 */
export default function WhatsAppButton() {
  const t = useTranslations()
  const [raised, setRaised] = useState(false)

  useEffect(() => {
    const check = () => setRaised(Boolean(document.querySelector("[data-sticky-cta]")))
    check()

    // The bar arrives with client-rendered steps, so one look at mount is not
    // enough — but this only ever reads, and only from the body subtree.
    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])

  return (
    /**
     * Wrapped in a landmark on purpose. A link floating as a direct child of
     * the body is content outside any region, which axe flags and which leaves
     * a screen-reader user landmark-navigating the page with no way to reach
     * it. `aside` is right: useful, not part of the main flow.
     */
    <aside aria-label={t("whatsapp.aria", {})}>
      <a
        href={whatsappLink(t("whatsapp.message", {}))}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={t("whatsapp.aria", {})}
        title={t("whatsapp.aria", {})}
        className={clx(
          // `end-4` so it sits bottom-right in English and bottom-LEFT in Arabic.
          // A physical `right-4` would leave it over the back button in RTL.
          "fixed end-4 z-30 inline-flex h-14 w-14 items-center justify-center rounded-full",
          "bg-[#25D366] text-white shadow-lg transition-[bottom,transform] duration-200",
          "hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-dd-ink",
          // print: a phone number on paper is useful, a floating bubble is not.
          "print:hidden",
          raised ? "bottom-[5.5rem] small:bottom-6" : "bottom-6"
        )}
        style={{ marginBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        {/* WhatsApp's glyph, inline: no icon font, no network request. */}
        <svg viewBox="0 0 24 24" className="h-7 w-7" fill="currentColor" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.872.118.571-.085 1.758-.719 2.006-1.413.247-.694.247-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884a9.82 9.82 0 0 1 6.988 2.896 9.83 9.83 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.82 11.82 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.88 11.88 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893A11.82 11.82 0 0 0 20.465 3.49" />
        </svg>
      </a>
    </aside>
  )
}
