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
  const alt = alternatesFor("/privacy", getBaseURL())
  return {
    title: `${t("footer.privacy")} — ${t("common.brand")}`,
    alternates: { canonical: alt.canonicalFor(countryCode), languages: alt.languages },
  }
}

/**
 * Privacy policy. Unlike terms and cancellation, this one is written from
 * what the system actually does — what is collected, why, who processes it,
 * how long it is kept — so it is accurate rather than a placeholder. The
 * owner should still have it read before launch, and the retention period is
 * a business decision marked as such.
 */
export default async function PrivacyPage({ params }: Props) {
  const { countryCode } = await params
  const t = getTranslations(countryCode)
  const ar = localeOf(countryCode) === "ar"

  return (
    <ProsePage title={t("footer.privacy")} intro={ar ? "ما نجمعه من بيانات، ولماذا، ومن يمكنه الاطلاع عليها." : "What we collect, why, and who can see it."}>
      {ar ? (
        <>
          <h2>ما نجمعه</h2>
          <p>عند الحجز نطلب منك فقط ما يلزم لتنفيذ رحلتك: اسمك، ورقم جوالك، وبريدك الإلكتروني، ورقم رحلتك، ووجهتك، وموعد الاستقبال، وعدد الركاب والحقائب، وأي ملاحظات تضيفها. لا نطلب إنشاء حساب ولا كلمة مرور.</p>
          <h2>سجلات الأمان</h2>
          <p>
            لحماية الموقع من الاحتيال والهجمات، نسجّل لكل زيارة: عنوان IP، والموقع التقريبي المستنتج منه (الدولة والمدينة ومزوّد
            الإنترنت)، ونوع المتصفح، والصفحة التي زرتها. لا يحدد ذلك هويتك ولا عنوانك. لا تتضمن هذه السجلات وجهة رحلتك ولا أي شيء تكتبه
            في النماذج. تحفظها Cloudflare نيابةً عنا وتُحذف تلقائيًا خلال 7 أيام كحد أقصى، ولا نستخدمها إلا لأغراض الأمان.
          </p>
          <h2>لماذا نجمعه</h2>
          <ul>
            <li>لإرسال السائق إلى المكان والوقت الصحيحين، ولمتابعة رحلتك عند التأخير.</li>
            <li>لإرسال تأكيد الحجز إلى بريدك، وليتمكن السائق من الاتصال بك عند الوصول.</li>
            <li>لتحصيل الدفع إن اخترت الدفع بالبطاقة.</li>
          </ul>
          <h2>من يعالج بياناتك</h2>
          <ul>
            <li><strong>سائقك</strong> يرى اسمك ورقم هاتفك ووجهتك ورقم رحلتك وملاحظاتك — وهو ما يحتاجه لتنفيذ الرحلة.</li>
            <li><strong>سكيب كاش (SkipCash)</strong>، مزوّد خدمات الدفع المرخّص من مصرف قطر المركزي، يعالج مدفوعات البطاقات. لا نرى ولا نخزّن بيانات بطاقتك أبدًا.</li>
            <li>يُستضاف الموقع وقاعدة بياناته لدى مزوّدي خدمات سحابية خارج قطر (Railway وSupabase وCloudflare).</li>
          </ul>
          <p>لا نبيع بياناتك ولا نشاركها لأغراض تسويقية.</p>
          <h2>مدة الاحتفاظ</h2>
          <p className="placeholder">[بانتظار قرار المالك: مدة الاحتفاظ بسجلات الحجز بعد اكتمال الرحلة. المعتاد هو الاحتفاظ بها للأغراض المحاسبية والضريبية للمدة التي يقتضيها القانون القطري.]</p>
          <h2>حقوقك</h2>
          <p>يمكنك طلب نسخة من بياناتك أو حذفها في أي وقت بمراسلتنا على <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>. رابط تأكيد الحجز خاص بك؛ لا تشاركه.</p>
          <h2>ملفات تعريف الارتباط</h2>
          <p>نستخدم ملف تعريف ارتباط واحدًا فقط أثناء الحجز لتذكّر رحلتك بين الخطوات، وينتهي خلال ساعتين. لا نستخدم ملفات تتبّع إعلانية.</p>
        </>
      ) : (
        <>
          <h2>What we collect</h2>
          <p>When you book, we ask only for what is needed to run your trip: your name, mobile number, email address, flight number, destination, pickup time, number of passengers and bags, and any notes you add. There is no account and no password.</p>
          <h2>Security logs</h2>
          <p>
            To protect the site against fraud and attacks, we log each visit: your IP address, the approximate location it implies
            (country, city and internet provider), your browser type, and the page you visited. This does not identify you or your
            address. These logs do not include your trip destination or anything you type into a form. Cloudflare keeps them on our
            behalf and deletes them automatically within 7 days, and we use them only for security.
          </p>
          <h2>Why we collect it</h2>
          <ul>
            <li>To send a driver to the right place at the right time, and to track your flight if it is delayed.</li>
            <li>To email you a booking confirmation, and so your driver can call you on arrival.</li>
            <li>To take payment, if you choose to pay by card.</li>
          </ul>
          <h2>Who processes it</h2>
          <ul>
            <li><strong>Your driver</strong> sees your name, phone number, destination, flight number and notes — what they need to do the job.</li>
            <li><strong>SkipCash</strong>, a payment provider licensed by the Qatar Central Bank, processes card payments. We never see or store your card details.</li>
            <li>The website and its database are hosted with cloud providers outside Qatar (Railway, Supabase and Cloudflare).</li>
          </ul>
          <p>We do not sell your data or share it for marketing.</p>
          <h2>How long we keep it</h2>
          <p className="placeholder">[Owner to decide: how long booking records are kept after the trip. The usual answer is for as long as Qatari accounting and tax law requires.]</p>
          <h2>Your rights</h2>
          <p>You can ask for a copy of your data, or for it to be deleted, at any time by emailing <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>. Your booking confirmation link is personal to you; do not share it.</p>
          <h2>Cookies</h2>
          <p>We set one cookie, only while you are booking, to remember your trip between steps. It expires after two hours. We do not use advertising or tracking cookies.</p>
        </>
      )}
    </ProsePage>
  )
}
