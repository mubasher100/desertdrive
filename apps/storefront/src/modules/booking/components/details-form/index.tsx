"use client"

import { useId, useState, useTransition, type FormEvent } from "react"
import { clx } from "@medusajs/ui"
import type { Trip } from "@lib/booking/trip"
import { validateContact, type ContactErrors, type ContactInput } from "@lib/booking/contact"
import { DEFAULT_DIAL_ISO, DIAL_CODES, findDial } from "@lib/data/dial-codes"
import { createBookingCart } from "@lib/data/booking"
import type { AddOn } from "@lib/data/add-ons"
import AddOnPicker from "@modules/booking/components/add-on-picker"
import { useTranslations } from "@lib/i18n/use-translations"

/**
 * Step 3: who is travelling and how to reach them.
 *
 * Validation runs twice on purpose: here, on submit, for instant feedback
 * without a round trip; and again inside the server action, which is the one
 * that counts. Same function, same rules, so they cannot drift.
 *
 * Five fields, stacked, each ≥44px, autocomplete hints set so a phone fills
 * most of it in two taps. The submit is full width and last.
 */
export default function DetailsForm({
  segment,
  trip,
  variantId,
  testKey,
  addOns,
  language,
}: {
  segment: string
  trip: Trip
  variantId: string
  /** The owner's test key, so the cart's own re-quote can find the test vehicle. */
  testKey?: string
  /** Priced by the server. Empty means nothing is on sale, and none is shown. */
  addOns: AddOn[]
  language: "en" | "ar"
}) {
  const t = useTranslations()
  const ids = useId()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<ContactErrors>({})
  const [message, setMessage] = useState<string | null>(null)
  /** variant id -> quantity. Only ever a request; the server prices it. */
  const [extras, setExtras] = useState<Record<string, number>>({})
  const [values, setValues] = useState<ContactInput>({
    contact_name: "",
    contact_phone: "",
    contact_dial: DEFAULT_DIAL_ISO,
    contact_email: "",
    flight_number: "",
    notes: "",
  })

  const flightRequired = trip.direction === "arrival"

  function set<K extends keyof ContactInput>(key: K) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setValues((v) => ({ ...v, [key]: e.target.value }))
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    setMessage(null)

    const local = validateContact(values, { flightRequired }, t)
    setErrors(local)
    if (Object.keys(local).length) {
      // Move focus to the first problem so a screen-reader user hears it.
      const first = Object.keys(local)[0]
      document.getElementById(`${ids}-${first}`)?.focus()
      return
    }

    startTransition(async () => {
      const result = await createBookingCart(segment, trip, variantId, values, testKey, extras)
      // On success the action redirects and never returns.
      if (result && !result.ok) {
        setErrors(result.errors as ContactErrors)
        if (result.message) setMessage(result.message)
      }
    })
  }

  return (
    <form onSubmit={onSubmit} noValidate className="mt-6 max-w-xl">
      <Field
        id={`${ids}-flight_number`}
        label={t("details.flightNumber")}
        hint={flightRequired ? t("details.flightNumber.help") : t("details.flightNumber.optional")}
        error={errors.flight_number}
      >
        <input
          id={`${ids}-flight_number`}
          name="flight_number"
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          placeholder={t("details.flightNumber.placeholder")}
          value={values.flight_number}
          onChange={set("flight_number")}
          required={flightRequired}
          aria-invalid={!!errors.flight_number}
          aria-describedby={`${ids}-flight_number-hint`}
          className={clx(inputClass, "uppercase", errors.flight_number && errorClass)}
        />
      </Field>

      <Field id={`${ids}-contact_name`} label={t("details.name")} error={errors.contact_name}>
        <input
          id={`${ids}-contact_name`}
          name="contact_name"
          type="text"
          autoComplete="name"
          value={values.contact_name}
          onChange={set("contact_name")}
          required
          aria-invalid={!!errors.contact_name}
          className={clx(inputClass, errors.contact_name && errorClass)}
        />
      </Field>

      <Field
        id={`${ids}-contact_phone`}
        label={t("details.phone")}
        hint={t("details.phone.help")}
        error={errors.contact_phone}
      >
        {/*
          The country is picked, not guessed. Most customers book from abroad,
          and a field that quietly assumes +974 hands the driver a number that
          does not ring. Typing a full "+44…" into the field still wins over
          the selector — see normalisePhone.
        */}
        <div className="flex gap-x-2">
          <select
            name="contact_dial"
            aria-label={t("details.phone.country")}
            value={values.contact_dial ?? DEFAULT_DIAL_ISO}
            onChange={set("contact_dial")}
            className={clx(inputClass, "w-[7.5rem] shrink-0 pe-6", errors.contact_phone && errorClass)}
          >
            {DIAL_CODES.map((c) => (
              <option key={c.iso} value={c.iso}>
                {c.iso} +{c.dial}
              </option>
            ))}
          </select>
          <input
            id={`${ids}-contact_phone`}
            name="contact_phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder={t("details.phone.placeholder")}
            value={values.contact_phone}
            onChange={set("contact_phone")}
            required
            aria-invalid={!!errors.contact_phone}
            aria-describedby={`${ids}-contact_phone-hint`}
            className={clx(inputClass, "min-w-0 flex-1", errors.contact_phone && errorClass)}
          />
        </div>
        <p className="sr-only" aria-live="polite">
          {findDial(values.contact_dial ?? DEFAULT_DIAL_ISO)?.name_en}
        </p>
      </Field>

      <Field
        id={`${ids}-contact_email`}
        label={t("details.email")}
        hint={t("details.email.help")}
        error={errors.contact_email}
      >
        <input
          id={`${ids}-contact_email`}
          name="contact_email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={values.contact_email}
          onChange={set("contact_email")}
          required
          aria-invalid={!!errors.contact_email}
          aria-describedby={`${ids}-contact_email-hint`}
          className={clx(inputClass, errors.contact_email && errorClass)}
        />
      </Field>

      <Field id={`${ids}-notes`} label={t("details.notes")} error={errors.notes}>
        <textarea
          id={`${ids}-notes`}
          name="notes"
          rows={3}
          maxLength={500}
          placeholder={t("details.notes.placeholder")}
          value={values.notes}
          onChange={set("notes")}
          aria-invalid={!!errors.notes}
          className={clx(inputClass, "min-h-[96px] py-3", errors.notes && errorClass)}
        />
      </Field>

      {/*
        Extras sit after the contact fields and before the button: a customer
        who wants none scrolls past them, and one who wants a child seat has
        not yet committed. Rendering nothing when nothing is priced is the
        component's own job.
      */}
      <AddOnPicker addOns={addOns} value={extras} onChange={setExtras} language={language} />

      {message && (
        <p role="alert" className="mb-6 mt-6 rounded-dd-sm bg-dd-danger-soft px-3 py-2 text-sm text-dd-danger">
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-8 min-h-[52px] w-full rounded-dd bg-dd-accent px-4 text-base font-semibold text-dd-on-accent transition-colors hover:bg-dd-accent-strong disabled:opacity-60"
      >
        {pending ? t("common.loading") + "…" : t("details.submit")}
      </button>
    </form>
  )
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-dd-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-hint`} role="alert" className="mt-1 text-sm text-dd-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-sm text-dd-muted">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

const inputClass =
  "block min-h-touch w-full rounded-dd border border-dd-line bg-dd-surface px-3 text-base text-dd-ink placeholder:text-dd-muted focus:border-dd-accent"
const errorClass = "border-dd-danger"
