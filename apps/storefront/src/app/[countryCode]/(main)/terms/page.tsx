import { Metadata } from "next"
import ProsePage from "@modules/common/components/prose-page"
import { getTranslations } from "@lib/i18n/get-translations"
import { localeOf, alternatesFor } from "@lib/util/locale"
import { getBaseURL } from "@lib/util/env"
import { CONTACT } from "@lib/data/contact"

type Props = { params: Promise<{ countryCode: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  const alt = alternatesFor("/terms", getBaseURL())
  return {
    title: `${t("footer.terms")} — ${t("common.brand")}`,
    alternates: { canonical: alt.canonicalFor(countryCode), languages: alt.languages },
  }
}

/**
 * Terms & conditions. A launch blocker: SkipCash merchant onboarding and the
 * card schemes expect this to be public. The STRUCTURE is here; the terms
 * themselves are the owner's and are marked as placeholders — inventing them
 * would be worse than leaving them visibly blank.
 */
export default async function TermsPage({ params }: Props) {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  const ar = localeOf(countryCode) === "ar"

  const draft = ar
    ? "مسودة هيكلية — النص النهائي بانتظار المالك. لا تُعتبر هذه الصفحة شروطًا نافذة حتى تُستبدل الفقرات الموضوعة بين قوسين."
    : "Structural draft — final wording is the owner's. This page is not binding until the bracketed placeholders are replaced."

  return (
    <ProsePage title={t("footer.terms")} draft={draft}>
      {ar ? (
        <>
          <h2>الخدمة</h2>
          <p>
            تقدّم {CONTACT.legalName} ({CONTACT.cr}) خدمة توصيل خاص بسائق من مطار حمد الدولي وإليه داخل دولة قطر. يشكّل الحجز عبر هذا الموقع
            عقدًا بينك وبين الشركة وفق هذه الشروط.
          </p>
          <h2>الحجز والتأكيد</h2>
          <p>يُعد حجزك مؤكدًا فور استلامك رقم الحجز. السعر المعروض عند الحجز هو السعر الذي تدفعه؛ لا رسوم إضافية على الوصول أو الازدحام.</p>
          <h2>وقت الانتظار</h2>
          <p className="placeholder">[المالك: مدة الانتظار المجاني عند الوصول وعند المغادرة، ورسوم الانتظار الإضافي بالساعة.]</p>
          <h2>عدم الحضور والتأخير</h2>
          <p className="placeholder">[المالك: ما يحدث إن لم يحضر الراكب، ومتى يُعد الحجز ملغى، وكيف تُعالج تأخيرات الرحلات الجوية.]</p>
          <h2>الركاب والأمتعة</h2>
          <p>لكل سيارة سعة ركاب وأمتعة معلنة. يحق للسائق رفض تحميل ما يتجاوز السعة الآمنة.</p>
          <h2>الإلغاء والاسترداد</h2>
          <p>
            راجع <a href={`/${countryCode}/cancellation`}>سياسة الإلغاء والاسترداد</a>.
          </p>
          <h2>المسؤولية</h2>
          <p className="placeholder">[المالك / المستشار القانوني: حدود المسؤولية، والتأمين، والقانون الواجب التطبيق (قانون دولة قطر).]</p>
          <h2>التواصل</h2>
          <p>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> · {CONTACT.phone.display}
          </p>
        </>
      ) : (
        <>
          <h2>The service</h2>
          <p>
            {CONTACT.legalName} ({CONTACT.cr}) provides private, chauffeur-driven transfers to and from Hamad International Airport within
            the State of Qatar. A booking made on this website is a contract between you and the company on these terms.
          </p>
          <h2>Booking and confirmation</h2>
          <p>
            Your booking is confirmed as soon as you receive a booking reference. The price shown when you book is the price you pay;
            there are no surcharges on arrival or for traffic.
          </p>
          <h2>Waiting time</h2>
          <p className="placeholder">[Owner: free waiting time on arrivals and on departures, and the hourly charge for additional waiting.]</p>
          <h2>No-shows and delays</h2>
          <p className="placeholder">
            [Owner: what happens if the passenger does not appear, when a booking is treated as cancelled, and how flight delays are handled.]
          </p>
          <h2>Passengers and luggage</h2>
          <p>Each vehicle has a stated passenger and luggage capacity. The driver may decline to carry more than can be carried safely.</p>
          <h2>Cancellation and refunds</h2>
          <p>
            See the <a href={`/${countryCode}/cancellation`}>cancellation and refund policy</a>.
          </p>
          <h2>Liability</h2>
          <p className="placeholder">[Owner / legal adviser: limits of liability, insurance, and governing law (the laws of the State of Qatar).]</p>
          <h2>Contact</h2>
          <p>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> · {CONTACT.phone.display}
          </p>
        </>
      )}
    </ProsePage>
  )
}
