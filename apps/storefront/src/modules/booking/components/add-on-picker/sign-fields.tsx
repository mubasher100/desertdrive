"use client"

import { useRef, useState } from "react"
import { clx } from "@medusajs/ui"
import { MAX_NOTE_LENGTH } from "@lib/booking/sign"
import { useTranslations } from "@lib/i18n/use-translations"

/** Matches the server's allowlist. SVG is absent there and must stay absent here. */
const ACCEPT = "image/jpeg,image/png,image/webp"
const MAX_BYTES = 5 * 1024 * 1024

/**
 * What goes on the meet & greet board: the words, and optionally a picture.
 *
 * The picture is uploaded the moment it is chosen rather than held until
 * submit. The customer is on a phone on hotel wifi, and a 4 MB photo uploading
 * silently behind a "Continue to payment" tap is the worst place to discover
 * the connection is bad. Uploading here means the progress and any failure
 * land next to the control that caused them, and the booking can still go
 * through without a picture.
 *
 * ⚠️ The URL this stores is only ever one the upload endpoint returned. The
 * server re-checks that before it charges for anything — a URL typed into the
 * form would be dropped there, not trusted here.
 */
export default function SignFields({
  note,
  imageUrl,
  onNote,
  onImage,
  fieldId,
  uploadsEnabled,
}: {
  note: string
  imageUrl: string | null
  onNote: (value: string) => void
  onImage: (url: string | null) => void
  fieldId: string
  /** False when no bucket is configured, which hides the picture control entirely. */
  uploadsEnabled: boolean
}) {
  const t = useTranslations()
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function pick(file: File | undefined) {
    setError(null)
    if (!file) return

    // Checked here so the customer is told instantly instead of after the
    // upload. The server checks again, on the bytes rather than the label.
    if (file.size > MAX_BYTES) {
      setError(t("addons.sign.tooBig"))
      return
    }

    setBusy(true)
    try {
      const body = new FormData()
      body.append("file", file)
      const res = await fetch("/api/sign-image", { method: "POST", body })
      if (!res.ok) throw new Error(String(res.status))
      const { url } = (await res.json()) as { url?: string }
      if (!url) throw new Error("no url")
      onImage(url)
    } catch {
      // The booking is not blocked by this. The sign still gets its text, and
      // the message says the picture can follow on WhatsApp.
      setError(t("addons.sign.uploadFailed"))
    } finally {
      setBusy(false)
      // Reset so choosing the SAME file again after a failure still fires.
      if (inputRef.current) inputRef.current.value = ""
    }
  }

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
        className="mt-1.5 min-h-[48px] w-full rounded-dd border border-dd-line-strong bg-dd-surface px-3 text-base text-dd-ink focus:border-dd-accent focus:outline-none focus:ring-1 focus:ring-dd-accent"
      />
      <p id={`${fieldId}-hint`} className="mt-1 text-xs text-dd-muted">
        {t("addons.sign.hint")}
      </p>

      {uploadsEnabled && (
        <div className="mt-4">
          <p className="text-sm font-medium text-dd-ink">{t("addons.sign.picture")}</p>

          {imageUrl ? (
            <div className="mt-2 flex items-center gap-x-3">
              {/*
                The customer's own upload, shown back so they can see the
                driver got the right one. Plain <img>: it is an arbitrary
                remote URL, which next/image would need configured as a remote
                pattern, and it is one small thumbnail.
              */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={t("addons.sign.preview")}
                className="h-16 w-16 rounded-dd border border-dd-line object-cover"
              />
              <button
                type="button"
                onClick={() => onImage(null)}
                className="min-h-[44px] rounded-dd border border-dd-line-strong px-4 text-sm font-medium text-dd-ink hover:border-dd-accent"
              >
                {t("addons.sign.removePicture")}
              </button>
            </div>
          ) : (
            <div className="mt-2">
              <input
                ref={inputRef}
                type="file"
                accept={ACCEPT}
                disabled={busy}
                onChange={(e) => pick(e.target.files?.[0])}
                aria-label={t("addons.sign.picture")}
                className={clx(
                  "block w-full text-sm text-dd-ink-soft",
                  "file:me-3 file:min-h-[44px] file:rounded-dd file:border file:border-dd-line-strong",
                  "file:bg-dd-surface file:px-4 file:text-sm file:font-medium file:text-dd-ink",
                  busy && "opacity-60"
                )}
              />
              <p className="mt-1 text-xs text-dd-muted">
                {busy ? t("addons.sign.uploading") : t("addons.sign.pictureHint")}
              </p>
            </div>
          )}

          {error && (
            <p role="alert" className="mt-2 text-sm text-dd-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
