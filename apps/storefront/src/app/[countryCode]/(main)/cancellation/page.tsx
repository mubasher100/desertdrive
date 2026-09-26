import { Metadata } from "next"
import ProsePage from "@modules/common/components/prose-page"
import { getTranslations } from "@lib/i18n/get-translations"
import { localeOf, alternatesFor } from "@lib/util/locale"
import { getBaseURL } from "@lib/util/env"
import { CONTACT, whatsappLink } from "@lib/data/contact"

type Props = { params: Promise<{ countryCode: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  const alt = alternatesFor("/cancellation", getBaseURL())
  return {
    title: `${t("footer.cancellation")} — ${t("common.brand")}`,
    alternates: { canonical: alt.canonicalFor(countryCode), languages: alt.languages },
  }
}

/**
 * Cancellation & refund policy — required for SkipCash onboarding, and it
 * cannot be invented (CLAUDE.md, "Needs input" #8). Structure only; every
 * number is the owner's.
 */
export default async function CancellationPage({ params }: Props) {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  const ar = localeOf(countryCode) === "ar"
  const draft = ar
    ? "مسودة هيكلية — المهل والمبالغ بانتظار المالك. مطلوبة لتفعيل حساب سكيب كاش."
    : "Structural draft — the windows and amounts are the owner's. Required for SkipCash merchant onboarding."

  return (
    <ProsePage title={t("footer.cancellation")} draft={draft}>
      {ar ? (
        <>
          <h2>كيفية الإلغاء</h2>
          <p>
            راسلنا على <a href={whatsappLink()}>واتساب</a> أو <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> مع رقم حجزك (مثل
            DD-123).
          </p>
          <h2>الإلغاء المجاني</h2>
          <p>
            يمكنك الإلغاء مجانًا حتى <strong>24 ساعة قبل موعد الاستقبال</strong>، وتسترد كامل المبلغ المدفوع.
          </p>
          <h2>الإلغاء المتأخر وعدم الحضور</h2>
          <p className="placeholder">[المالك: الرسوم المطبقة عند الإلغاء بعد المهلة أو عند عدم الحضور.]</p>
          <h2>الاسترداد للمدفوعات بالبطاقة</h2>
          <p>
            تُعاد المبالغ إلى البطاقة التي دفعت بها عبر سكيب كاش. نبدأ الاسترداد فور تأكيد الإلغاء، ومدة ظهوره في كشف الحساب تعود إلى بنكك.
          </p>
          <h2>الإلغاء من طرفنا</h2>
          <p>إذا تعذّر علينا تنفيذ رحلتك، نُعيد لك كامل المبلغ المدفوع ونبلغك في أقرب وقت.</p>
        </>
      ) : (
        <>
          <h2>How to cancel</h2>
          <p>
            Message us on <a href={whatsappLink()}>WhatsApp</a> or email <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> with
            your booking reference (for example DD-123).
          </p>
          <h2>Free cancellation</h2>
          <p>
            Cancel free of charge up to <strong>24 hours before your pickup time</strong>. You receive a full
            refund of everything you paid.
          </p>
          <h2>Late cancellation and no-shows</h2>
          <p className="placeholder">[Owner: the charge that applies to cancellation inside the window, and to no-shows.]</p>
          <h2>Refunds for card payments</h2>
          <p>
            Refunds go back to the card you paid with, through SkipCash. We start the refund as soon as we
            confirm the cancellation; how quickly it appears on your statement is up to your bank.
          </p>
          <h2>If we cancel</h2>
          <p>If we cannot provide your transfer, you receive a full refund of anything paid and we tell you as early as we can.</p>
        </>
      )}
    </ProsePage>
  )
}
