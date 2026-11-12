"use client"

import { MAX_NOTE_LENGTH } from "@lib/booking/sign"
import { useTranslations } from "@lib/i18n/use-translations"

/**
 * What goes on the meet & greet board: the words.
 *
 * There used to be an optional picture as well, uploaded to R2 the moment it
 * was chosen. The owner removed it (2 Nov 2026); the driver prints the name.
 */
export default function SignFields({
  note,
  onNote,
  fieldId,
  error,
}: {
  note: string
  onNote: (value: string) => void
  fieldId: string
  /** Shown when the sign is ticked and the form is submitted with nothing written. */
  error?: string
}) {
  const t = useTranslations()

  return (
    <div className="mt-4 border-t border-dd-line pt-4">
      <label htmlFor={fieldId} className="block text-sm font-medium text-dd-ink">
        {t("addons.sign.label")}
      </label>
      <input
        id={fieldId}
        type="text"
        value={note}
        onChange={(e) => onNote(e.target.value.slice(0, MAX_NOTE_LENGTH))}
        maxLength={MAX_NOTE_LENGTH}
        placeholder={t("addons.sign.placeholder")}
        aria-describedby={`${fieldId}-hint`}
        aria-invalid={error ? true : undefined}
        // The details form finds this to focus it when the board is left blank.
        data-sign-note=""
        className="mt-1.5 min-h-[48px] w-full rounded-dd border border-dd-line-strong bg-dd-surface px-3 text-base text-dd-ink focus:border-dd-accent focus:outline-none focus:ring-1 focus:ring-dd-accent"
      />
      {error ? (
        <p id={`${fieldId}-hint`} role="alert" className="mt-1 text-sm text-dd-danger">
          {error}
        </p>
      ) : (
        <p id={`${fieldId}-hint`} className="mt-1 text-xs text-dd-muted">
          {t("addons.sign.hint")}
        </p>
      )}

    </div>
  )
}
