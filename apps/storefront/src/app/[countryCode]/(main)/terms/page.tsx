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
          <h2>مهلة الحجز</h2>
          <p>
            يمكن حجز الاستقبال عبر الموقع قبل <strong>12 ساعة</strong> على الأقل، وقبل <strong>24 ساعة</strong> على الأقل لسياراتنا
            الفاخرة. ولأي موعد أقرب راسلنا على واتساب وسنخبرك إن كان ذلك ممكنًا.
          </p>
          <h2>الدفع</h2>
          <p>
            يتم الدفع بالبطاقة عند الحجز عبر سكيب كاش. تُعرض الأسعار بالدولار الأمريكي، وتُخصم من بطاقتك بما يعادلها بالريال القطري
            بسعر ثابت قدره 3.64 ريال للدولار، ويظهر لك قبل الدفع.
          </p>
          <h2>وقت الانتظار</h2>
          <p>
            عند الاستقبال من المطار ينتظرك السائق حتى <strong>90 دقيقة</strong> من وقت هبوط رحلتك فعليًا، دون رسوم إضافية.
            نتابع رقم الرحلة الذي تزوّدنا به، فتأخّر الوصول لا يكلّفك التوصيلة &mdash; مدة الـ90 دقيقة تبدأ من لحظة الهبوط،
            لا من الوقت الذي حجزته.
          </p>
          <p className="placeholder">[المالك: مدة الانتظار المجاني عند الاستقبال للمغادرة، ورسوم الانتظار الإضافي بالساعة.]</p>
          <h2>عدم الحضور</h2>
          <p>
            إذا لم تلتقِ بالسائق خلال الـ90 دقيقة وتعذّر الوصول إليك على رقم الهاتف المدوّن في الحجز، يُعامَل الحجز على أنه
            عدم حضور.
          </p>
          <p className="placeholder">[المالك: الرسوم المطبّقة عند عدم الحضور.]</p>
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
          <h2>Booking notice</h2>
          <p>
            Pickups can be booked online at least <strong>12 hours</strong> ahead, and at least <strong>24 hours</strong> ahead for our
            luxury vehicles. For anything sooner, message us on WhatsApp and we will tell you whether we can do it.
          </p>
          <h2>Payment</h2>
          <p>
            Bookings are paid by card when you book, through SkipCash. Prices are shown in US dollars and your card is charged the
            equivalent in Qatari riyals at the fixed rate of 3.64 riyals to the dollar, shown before you pay.
          </p>
          <h2>Waiting time</h2>
          <p>
            On an airport pickup your driver waits up to <strong>90 minutes</strong> from the time your flight actually
            lands, at no extra charge. We track the flight number you give us, so a delayed arrival does not cost you
            the transfer &mdash; the 90 minutes starts when you land, not at the time you booked.
          </p>
          <p className="placeholder">[Owner: free waiting time on a departure pickup, and the hourly charge beyond the free period.]</p>
          <h2>No-shows</h2>
          <p>
            If you have not met your driver within the 90 minutes and we cannot reach you on the phone number on the
            booking, the booking is treated as a no-show.
          </p>
          <p className="placeholder">[Owner: the charge that applies to a no-show.]</p>
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
