"use client"

import { useEffect, useId, useMemo, useRef, useState } from "react"
import { clx } from "@medusajs/ui"
import { AREAS, areaHint, areaName, type Area } from "@lib/data/areas"
import { useLanguage, useTranslations } from "@lib/i18n/use-translations"
import { whatsappLink } from "@lib/data/contact"

/**
 * Destination entry: type to search, or open the list and pick.
 *
 * It replaces a plain <select> because a visitor who knows the name of where
 * they are going should be able to type it rather than hunt a 38-item list on
 * a phone — but it keeps the select's virtue, which is that every option is
 * browsable when you do not know the name. Empty input shows everything.
 *
 * Matching is deliberately generous: the English name, the Arabic name and the
 * hint are all searched in both languages, so "pearl", "لؤلؤة", "porto" and
 * "qanat" all find The Pearl. Someone arriving in Doha who half-remembers
 * their hotel's district should not be defeated by spelling.
 *
 * This is still the curated list — the fare comes from the area's coordinates,
 * server-side. Free text that matches nothing is not sent anywhere: it offers
 * WhatsApp instead, with what they typed, because a destination we cannot
 * price is a conversation, not an error.
 *
 * The combobox follows the ARIA pattern rather than a div soup: real listbox
 * and option roles, aria-activedescendant for the virtual cursor, and a live
 * region announcing the number of matches. Booking funnels routinely fail
 * audits at exactly this control.
 */
export default function LocationPicker({
  value,
  onChange,
  label,
  id,
  invalid,
}: {
  value: string
  onChange: (areaId: string) => void
  label: string
  id: string
  invalid?: boolean
}) {
  const t = useTranslations()
  const language = useLanguage()
  const uid = useId()
  const listId = `${uid}-list`

  const sorted = useMemo(() => [...AREAS].sort((a, b) => a.order - b.order), [])
  const selected = useMemo(() => sorted.find((a) => a.id === value) ?? null, [sorted, value])

  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [cursor, setCursor] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  // The input shows the chosen area's name until the customer types again.
  const display = open ? query : selected ? areaName(selected, language) : ""

  const matches = useMemo(() => {
    const q = normalise(query)
    if (!q) return sorted
    return sorted.filter((area) => searchText(area).includes(q))
  }, [query, sorted])

  useEffect(() => {
    setCursor(0)
  }, [query])

  // Clicking away closes the list without changing the selection.
  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDown)
    return () => document.removeEventListener("mousedown", onDown)
  }, [open])

  // Keep the active option in view when arrowing through a long list.
  useEffect(() => {
    if (!open) return
    listRef.current?.querySelector<HTMLLIElement>(`#${CSS.escape(optionId(uid, cursor))}`)?.scrollIntoView({ block: "nearest" })
  }, [cursor, open, uid])

  function choose(area: Area) {
    onChange(area.id)
    setQuery("")
    setOpen(false)
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      if (!open) {
        setOpen(true)
        return
      }
      if (!matches.length) return
      setCursor((c) => (e.key === "ArrowDown" ? (c + 1) % matches.length : (c - 1 + matches.length) % matches.length))
      return
    }
    if (e.key === "Enter") {
      if (open && matches[cursor]) {
        e.preventDefault()
        choose(matches[cursor])
      }
      return
    }
    if (e.key === "Escape") {
      if (open) {
        e.preventDefault()
        setQuery("")
        setOpen(false)
      }
      return
    }
    if (e.key === "Home" && open) {
      e.preventDefault()
      setCursor(0)
    }
    if (e.key === "End" && open) {
      e.preventDefault()
      setCursor(Math.max(0, matches.length - 1))
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        autoComplete="off"
        // Off on purpose: iOS capitalises and corrects place names into
        // nonsense ("Msheireb" → "Mushier"), which breaks the search.
        autoCorrect="off"
        autoCapitalize="none"
        spellCheck={false}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[cursor] ? optionId(uid, cursor) : undefined}
        aria-invalid={invalid || undefined}
        aria-label={label}
        placeholder={t("search.destination.placeholder")}
        value={display}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          if (selected) onChange("")
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className={clx(
          "min-h-touch w-full rounded-dd border bg-dd-surface px-3 pe-9 text-base text-dd-ink",
          "placeholder:text-dd-muted focus:outline-none focus:ring-2 focus:ring-dd-focus focus:ring-offset-1 focus:ring-offset-dd-focus-gap",
          invalid ? "border-dd-danger" : "border-dd-line-strong"
        )}
      />

      {/* Chevron doubles as the "open the whole list" affordance. */}
      <button
        type="button"
        tabIndex={-1}
        aria-hidden="true"
        onClick={() => {
          setOpen((o) => !o)
          inputRef.current?.focus()
        }}
        className="absolute inset-y-0 end-0 flex w-9 items-center justify-center text-dd-grey"
      >
        <svg viewBox="0 0 20 20" className={clx("h-4 w-4 transition-transform", open && "rotate-180")} fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M5 7.5 10 12.5 15 7.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {/* Announced to screen readers on every keystroke, not rendered visually. */}
      <p className="sr-only" role="status" aria-live="polite">
        {open ? t("search.destination.results", { count: matches.length }) : ""}
      </p>

      <ul
        ref={listRef}
        id={listId}
        role="listbox"
        aria-label={label}
        hidden={!open}
        className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-dd border border-dd-line-strong bg-dd-surface py-1 shadow-float"
      >
        {matches.map((area, i) => {
          const hint = areaHint(area, language)
          return (
            <li
              key={area.id}
              id={optionId(uid, i)}
              role="option"
              aria-selected={i === cursor}
              // Pointer down, not click: click fires after blur closes the list.
              onMouseDown={(e) => {
                e.preventDefault()
                choose(area)
              }}
              onMouseEnter={() => setCursor(i)}
              className={clx(
                "cursor-pointer px-3 py-2.5 text-start",
                i === cursor ? "bg-dd-accent-soft text-dd-ink" : "text-dd-ink-soft"
              )}
            >
              <span className="block text-base font-medium">{areaName(area, language)}</span>
              {hint && <span className="block text-sm text-dd-muted">{hint}</span>}
            </li>
          )
        })}

        {!matches.length && (
          <li className="px-3 py-3 text-sm text-dd-ink-soft" role="option" aria-selected="false" aria-disabled="true">
            <span className="block font-medium">{t("search.destination.noMatch")}</span>
            <a
              href={whatsappLink(t("search.destination.whatsappMessage", { place: query.trim() }))}
              target="_blank"
              rel="noopener noreferrer"
              onMouseDown={(e) => e.stopPropagation()}
              className="mt-1 inline-flex min-h-touch items-center font-semibold text-dd-accent-text underline underline-offset-4"
            >
              {t("search.destination.whatsappCta")}
            </a>
          </li>
        )}
      </ul>
    </div>
  )
}

const optionId = (uid: string, index: number) => `${uid}-opt-${index}`

/** Lowercase, strip Arabic diacritics and normalise alef/ya forms so search is forgiving. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ْٰ]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    // Explicit ranges rather than \p{L}: the storefront's tsconfig targets
    // es5, where the unicode flag is unavailable.
    .replace(/[^a-z0-9؀-ۿ]+/g, " ")
    .trim()
}

/** Everything a customer might type to mean this area, in either language. */
function searchText(area: Area): string {
  return normalise([area.name_en, area.name_ar, area.hint_en, area.hint_ar, area.id.replace(/-/g, " ")].filter(Boolean).join(" "))
}
