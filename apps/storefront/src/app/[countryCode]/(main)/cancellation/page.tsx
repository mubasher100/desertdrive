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
 * Cancellation & refund policy — required for SkipCash onboarding. Every
 * window and charge here is the owner's: free cancellation to 24 hours, no
 * refund inside it or for a no-show (31 Oct 2026).
 */
export default async function CancellationPage({ params }: Props) {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  const ar = localeOf(countryCode) === "ar"

  return (
    <ProsePage title={t("footer.cancellation")}>
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
          <h2>عدم الحضور</h2>
          <p>
            عند الاستقبال من المطار ينتظرك السائق حتى <strong>90 دقيقة</strong> من وقت هبوط رحلتك فعليًا، دون رسوم إضافية
            &mdash; نتابع رقم الرحلة المدوّن في حجزك، فالتأخير لا يكلّفك التوصيلة. وإذا لم تلتقِ بالسائق خلال هذه المدة
            وتعذّر الوصول إليك على رقم الهاتف الذي زوّدتنا به، يُعامَل الحجز على أنه عدم حضور.
          </p>
          <h2>الإلغاء المتأخر</h2>
          <p>
            الإلغاء خلال <strong>24 ساعة</strong> من موعد الاستقبال <strong>غير قابل للاسترداد</strong>، ويُحتسب كامل المبلغ
            المدفوع. وينطبق الأمر نفسه على عدم الحضور.
          </p>
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
          <h2>No-shows</h2>
          <p>
            On an airport pickup your driver waits up to <strong>90 minutes</strong> from the time your flight actually
            lands, at no extra charge &mdash; we track the flight number on your booking, so a delay does not cost you the
            transfer. If you have not met your driver within that time and we cannot reach you on the phone number you
            gave us, the booking is treated as a no-show.
          </p>
          <h2>Late cancellation</h2>
          <p>
            A cancellation made <strong>less than 24 hours before your pickup time is not refunded</strong> &mdash; the
            full amount paid is charged. The same applies to a no-show.
          </p>
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
