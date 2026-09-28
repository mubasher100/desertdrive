"use client"

import { useId } from "react"
import { clx } from "@medusajs/ui"
import type { AddOn, AddOnChoice } from "@lib/data/add-ons"
import SignFields from "./sign-fields"
import { formatUsd } from "@lib/util/money"
import { useTranslations } from "@lib/i18n/use-translations"

/**
 * Optional extras, chosen on the details step.
 *
 * A stepper rather than a checkbox because the quantity is real information
 * for the driver: "two child seats" is a different car preparation from one,
 * and the driver finds out from this number. Each add-on carries its own cap,
 * set by the owner on the product, so a form cannot promise three of something
 * only one of which exists.
 *
 * ⚠️ The prices shown here are the server's, and they are shown for reading,
 * never for sending. The browser posts variant ids and quantities; the server
 * looks the price up again before it charges anything. A price in this markup
 * is a price in devtools.
 *
 * It renders nothing at all when nothing is priced. An empty "Extras" heading
 * over blank space reads as a broken page, and an unpriced add-on is the
 * owner's way of taking it off sale.
 */
export default function AddOnPicker({
  addOns,
  value,
  onChange,
  language,
  uploadsEnabled,
}: {
  addOns: AddOn[]
  /** variant id → what was chosen. Absent, or quantity 0, means not taken. */
  value: Record<string, AddOnChoice>
  onChange: (next: Record<string, AddOnChoice>) => void
  language: "en" | "ar"
  /** False when no bucket is configured — the picture control is then hidden. */
  uploadsEnabled: boolean
}) {
  const t = useTranslations()
  const ids = useId()

  if (!addOns.length) return null

  function setQuantity(variantId: string, next: number, max: number) {
    const clamped = Math.max(0, Math.min(next, max))
    const copy = { ...value }
    if (clamped === 0) delete copy[variantId]
    else copy[variantId] = { ...copy[variantId], quantity: clamped }
    onChange(copy)
  }

  /**
   * Updates one collected field, keeping the rest.
   *
   * Typing into the sign field selects the add-on if it was not already —
   * writing your name on a board you have not ticked is unambiguous intent,
   * and making someone tick a box first is a step for nothing.
   */
  function setField(variantId: string, patch: Partial<AddOnChoice>) {
    const current = value[variantId]
    onChange({
      ...value,
      // Quantity last and explicit: spreading `current` over a default would
      // read as though the default wins, and TS rightly calls that out.
      [variantId]: { ...current, ...patch, quantity: current?.quantity || 1 },
    })
  }

  return (
    <section aria-labelledby={`${ids}-heading`} className="mt-8">
      <h2 id={`${ids}-heading`} className="text-lg font-semibold text-dd-ink">
        {t("addons.title")}
      </h2>
      <p className="mt-1 text-sm text-dd-muted">{t("addons.help")}</p>

      <ul className="mt-4 space-y-3">
        {addOns.map((a) => {
          const choice = value[a.variant_id]
          const quantity = choice?.quantity ?? 0
          const title = language === "ar" && a.title_ar ? a.title_ar : a.title
          const description =
            language === "ar" && a.description_ar ? a.description_ar : a.description

          return (
            <li
              key={a.variant_id}
              className={clx(
                "rounded-dd-lg border-2 p-4 transition-colors",
                quantity > 0 ? "border-dd-accent bg-dd-accent-soft/40" : "border-dd-line bg-dd-surface"
              )}
            >
              <div className="flex items-start justify-between gap-x-4">
                <div className="min-w-0">
                  <p className="font-semibold text-dd-ink">{title}</p>
                  {description && <p className="mt-0.5 text-sm text-dd-muted">{description}</p>}
                </div>
                <p className="shrink-0 text-end">
                  <span className="block font-semibold tabular-nums text-dd-accent-text">
                    {formatUsd(a.amount)}
                  </span>
                </p>
              </div>

              {/*
                A sign is one board or none, so it is a checkbox. A stepper
                that only ever reads 0 or 1 asks the customer to work out
                which it is; a tick says it.
              */}
              {a.collects === "sign" ? (
                <label className="mt-3 flex min-h-[44px] cursor-pointer items-center gap-x-3 text-sm font-medium text-dd-ink">
                  <input
                    type="checkbox"
                    checked={quantity > 0}
                    onChange={(e) => setQuantity(a.variant_id, e.target.checked ? 1 : 0, a.max)}
                    className="h-5 w-5 shrink-0 rounded border-dd-line-strong text-dd-accent focus:ring-dd-accent"
                  />
                  {t("addons.include", { item: title })}
                </label>
              ) : (
              <div className="mt-3 flex items-center gap-x-3">
                <Step
                  label={t("addons.remove", { item: title })}
                  disabled={quantity === 0}
                  onClick={() => setQuantity(a.variant_id, quantity - 1, a.max)}
                >
                  &minus;
                </Step>
                {/*
                  aria-live so a screen reader hears the new count after a tap.
                  The steppers are separate buttons rather than a number input:
                  a numeric keyboard covering half a phone screen to change a
                  0 to a 1 is the wrong trade.
                */}
                <span
                  aria-live="polite"
                  aria-atomic="true"
                  className="min-w-[2.5rem] text-center text-base font-semibold tabular-nums text-dd-ink"
                >
                  <span className="sr-only">{title}: </span>
                  {quantity}
                </span>
                <Step
                  label={t("addons.add", { item: title })}
                  disabled={quantity >= a.max}
                  onClick={() => setQuantity(a.variant_id, quantity + 1, a.max)}
                >
                  +
                </Step>
                {quantity > 0 && (
                  <span className="text-sm tabular-nums text-dd-ink-soft">
                    {formatUsd(a.amount * quantity)}
                  </span>
                )}
              </div>
              )}

              {/*
                Shown once the add-on is taken. The text is what the driver
                holds up, so it is required — `priceAddOns` drops a sign with
                nothing written on it rather than charging for a blank board.
              */}
              {a.collects === "sign" && quantity > 0 && (
                <SignFields
                  fieldId={`${ids}-${a.variant_id}-note`}
                  note={choice?.note ?? ""}
                  imageUrl={choice?.image_url ?? null}
                  onNote={(note) => setField(a.variant_id, { note })}
                  onImage={(image_url) => setField(a.variant_id, { image_url })}
                  uploadsEnabled={uploadsEnabled}
                />
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

/** A 44px touch target, which is the minimum a thumb can hit reliably. */
function Step({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      className={clx(
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-dd border-2 text-xl font-semibold transition-colors",
        disabled
          ? "cursor-not-allowed border-dd-line text-dd-muted opacity-50"
          : "border-dd-line-strong text-dd-ink hover:border-dd-accent hover:text-dd-accent-text"
      )}
    >
      <span aria-hidden="true">{children}</span>
    </button>
  )
}
