import { getTranslations } from "@lib/i18n/get-translations"

export default function HowItWorks({ segment }: { segment: string }) {
  const t = getTranslations(segment)

  return (
    <section className="bg-dd-paper">
      <div className="mx-auto w-full max-w-content px-4 py-12 small:py-16">
        <h2 className="text-2xl font-semibold text-dd-ink small:text-3xl">
          {t("home.how.title")}
        </h2>
        <ol className="mt-8 grid gap-8 small:grid-cols-3">
          {([1, 2, 3] as const).map((n) => (
            <li key={n} className="flex gap-x-4">
              <span
                aria-hidden="true"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-dd-accent text-base font-semibold text-dd-on-accent"
              >
                {n}
              </span>
              <div>
                <h3 className="text-base font-semibold text-dd-ink">
                  {t(`home.how.${n}.title`)}
                </h3>
                <p className="mt-1 text-sm text-dd-muted">{t(`home.how.${n}.body`)}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
