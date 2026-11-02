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
 * Privacy policy, written from what the system actually does, so keep the two
 * in step. Owner's changes of 2 Nov 2026: the per-visit security log was
 * switched OFF (and its paragraph removed — the policy must not describe a log
 * that does not exist, nor omit one that does); "Who processes it" became the
 * MOCI licence line; WhatsApp offers were added (opt-in on the details step);
 * retention is "as long as Qatari accounting and tax law requires".
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
          <h2>لماذا نجمعه</h2>
          <ul>
            <li>لإرسال السائق إلى المكان والوقت الصحيحين، ولمتابعة رحلتك عند التأخير.</li>
            <li>لإرسال تأكيد الحجز إلى بريدك، وليتمكن السائق من الاتصال بك عند الوصول.</li>
            <li>لتحصيل الدفع إن اخترت الدفع بالبطاقة.</li>
            <li>لإرسال العروض إليك عبر واتساب، فقط إذا طلبت ذلك.</li>
          </ul>
          <h2>من نحن</h2>
          <p>{CONTACT.legalName} مرخّصة من وزارة التجارة والصناعة في دولة قطر (سجل تجاري رقم 211743).</p>
          <h2>عروض واتساب</h2>
          <p>
            إذا اخترت &laquo;أرسلوا لي العروض عبر واتساب&raquo; عند الحجز، نستخدم رقم جوالك لإرسال عروض من حين لآخر عبر واتساب. هذا
            اختياري ولا يؤثر على حجزك. لإيقافها، ردّ بكلمة STOP أو راسلنا، وسنحذف رقمك من القائمة.
          </p>
          <p>لا نبيع بياناتك ولا نشاركها مع أي جهة أخرى لأغراض تسويقية.</p>
          <h2>مدة الاحتفاظ</h2>
          <p>نحتفظ بسجلات الحجز للمدة التي يقتضيها قانون المحاسبة والضرائب في قطر، ثم نحذفها.</p>
          <h2>حقوقك</h2>
          <p>يمكنك طلب نسخة من بياناتك أو حذفها في أي وقت بمراسلتنا على <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>. رابط تأكيد الحجز خاص بك؛ لا تشاركه.</p>
          <h2>ملفات تعريف الارتباط</h2>
          <p>نستخدم ملف تعريف ارتباط واحدًا فقط أثناء الحجز لتذكّر رحلتك بين الخطوات، وينتهي خلال ساعتين. لا نستخدم ملفات تتبّع إعلانية.</p>
        </>
      ) : (
        <>
          <h2>What we collect</h2>
          <p>When you book, we ask only for what is needed to run your trip: your name, mobile number, email address, flight number, destination, pickup time, number of passengers and bags, and any notes you add. There is no account and no password.</p>
          <h2>Why we collect it</h2>
          <ul>
            <li>To send a driver to the right place at the right time, and to track your flight if it is delayed.</li>
            <li>To email you a booking confirmation, and so your driver can call you on arrival.</li>
            <li>To take payment, if you choose to pay by card.</li>
            <li>To send you offers on WhatsApp, only if you ask for them.</li>
          </ul>
          <h2>Who we are</h2>
          <p>{CONTACT.legalName} is licensed by the Ministry of Commerce and Industry of the State of Qatar (CR 211743).</p>
          <h2>WhatsApp offers</h2>
          <p>
            If you tick &ldquo;Send me offers on WhatsApp&rdquo; when you book, we use your mobile number to send you occasional
            offers on WhatsApp. It is optional and does not affect your booking. To stop, reply STOP or message us, and we take
            your number off the list.
          </p>
          <p>We do not sell your data or share it with anyone else for marketing.</p>
          <h2>How long we keep it</h2>
          <p>We keep booking records for as long as Qatari accounting and tax law requires, then delete them.</p>
          <h2>Your rights</h2>
          <p>You can ask for a copy of your data, or for it to be deleted, at any time by emailing <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>. Your booking confirmation link is personal to you; do not share it.</p>
          <h2>Cookies</h2>
          <p>We set one cookie, only while you are booking, to remember your trip between steps. It expires after two hours. We do not use advertising or tracking cookies.</p>
        </>
      )}
    </ProsePage>
  )
}
