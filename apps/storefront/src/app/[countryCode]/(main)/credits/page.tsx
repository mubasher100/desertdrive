import { Metadata } from "next"
import ProsePage from "@modules/common/components/prose-page"
import { CREDITS } from "@lib/data/credits"
import { getTranslations } from "@lib/i18n/get-translations"
import { localeOf } from "@lib/util/locale"

type Props = { params: Promise<{ countryCode: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  return { title: `${t("footer.credits")} — ${t("common.brand")}`, robots: { index: false, follow: true } }
}

/** Attribution for Creative Commons imagery. This page is a licence condition, not decoration. */
export default async function CreditsPage({ params }: Props) {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  const ar = localeOf(countryCode) === "ar"
  const label: Record<string, string> = {
    hero: ar ? "صورة الأفق في الصفحة الرئيسية" : "Home page skyline",
    "toyota-rush": "Toyota Rush", mpv: ar ? "السيارة العائلية" : "Family MPV", "toyota-hiace": "Toyota Hiace",
    "hyundai-h1": "Hyundai H1", "tesla-model-3": "Tesla Model 3",
  }

  return (
    <ProsePage
      title={t("footer.credits")}
      intro={ar ? "الصور المستخدمة في هذا الموقع بموجب تراخيص المشاع الإبداعي." : "Imagery used on this site under Creative Commons licences."}
    >
      <ul>
        {CREDITS.map((c) => (
          <li key={c.title}>
            <strong>{label[c.subject] ?? c.subject}</strong>: <a href={c.source} rel="noopener noreferrer">{c.title}</a> — {c.author},{" "}
            <a href={c.licenceUrl} rel="license noopener noreferrer">{c.licence}</a>
            {ar ? " (مقتطعة ومصغّرة)" : " (cropped and resized)"}
          </li>
        ))}
      </ul>
    </ProsePage>
  )
}
