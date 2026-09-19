import type { ReactNode } from "react"

/**
 * Layout for the text pages: legal, contact. One readable column, generous
 * line length limits, headings in the display face.
 */
export default function ProsePage({
  title,
  intro,
  draft,
  children,
}: {
  title: string
  intro?: string
  /** Shown as a banner when the page is a structural draft awaiting the owner's text. */
  draft?: string
  children: ReactNode
}) {
  return (
    <main className="mx-auto w-full max-w-content px-4 pb-16 pt-8">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold text-dd-ink small:text-4xl">{title}</h1>
        {intro && <p className="mt-3 text-lg text-dd-muted">{intro}</p>}
        {draft && (
          <p
            role="note"
            className="mt-6 rounded-dd border border-dd-accent bg-dd-accent-soft px-4 py-3 text-sm text-dd-ink-soft"
          >
            {draft}
          </p>
        )}
        <div className="prose-dd mt-8">{children}</div>
      </div>
    </main>
  )
}
