// =====================================================================
// پیامک مدرس‌یار — پنل ملی پیامک (Melipayamak)
// ---------------------------------------------------------------------
// سرویس REST رسمی:
//   POST https://rest.payamak-panel.com/api/SendSMS/SendSMS
//   بدنه JSON: { username, password, to, from, text, isFlash: false }
//     (طبق مستندات رسمی، مقدار password همان «کلید API وب‌سرویس» تنظیم‌شده
//      در پنل است — نه رمز ورود سامانه)
//   پاسخ: { Value: [recId,…] | عدد, RetStatus: 1, StrRetStatus: "Ok" }
//   اعتبار: POST …/GetCredit با { username, password }
// ---------------------------------------------------------------------
// متغیرهای محیطی:
//   SMS_USERNAME  نام کاربری پنل ملی پیامک
//   SMS_PASSWORD  کلید API وب‌سرویس (در پنل: تنظیمات → وب‌سرویس)
//   SMS_FROM      شماره خط ارسال (اختصاصی یا خدماتی، مثلاً 50004001234567)
//   SMS_ADMIN     (اختیاری) موبایل مدیر برای اطلاع‌رسانی سفارش‌ها
//   SMS_DEBUG=1   لاگ پیامک‌ها در کنسول حتی وقتی تنظیمات کامل است
// ---------------------------------------------------------------------
// حالت بدون تنظیمات (توسعه محلی): هیچ درخواستی به بیرون زده نمی‌شود؛
// متن پیام در کنسول لاگ و در جدول sms_log با ok=0 ثبت می‌شود تا
// جریان خرید بدون پنل پیامک هم کامل تست‌پذیر باشد.
// =====================================================================
import { db } from './db.js'

const now = () => Date.now()

const MELI_USER = process.env.SMS_USERNAME || ''
const MELI_PASS = process.env.SMS_PASSWORD || ''
const MELI_FROM = process.env.SMS_FROM || ''
const ADMIN_TO = String(process.env.SMS_ADMIN || '').trim()
const SMS_DEBUG = process.env.SMS_DEBUG === '1'

const SEND_URL = 'https://rest.payamak-panel.com/api/SendSMS/SendSMS'

/* لاگ پیامک در DB — برای «سفارش‌ها»ی پنل ادمین و دیباگ */
db.exec(`
CREATE TABLE IF NOT EXISTS sms_log (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  to_phone   TEXT NOT NULL,
  text       TEXT NOT NULL,
  tag        TEXT NOT NULL DEFAULT 'general',
  ok         INTEGER NOT NULL DEFAULT 0,
  mock       INTEGER NOT NULL DEFAULT 0,
  rec_id     TEXT,
  error      TEXT,
  created_at INTEGER NOT NULL
)`)

export const smsConfigured = () => !!(MELI_USER && MELI_PASS && MELI_FROM)

/** نرمال‌سازی موبایل ایرانی → «09xxxxxxxxx» یا null */
export const normalizePhone = (raw) => {
  const s = String(raw || '')
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[\s\-()]/g, '')
  const m = s.match(/^(?:\+98|0098|98|0)?(9\d{9})$/)
  return m ? '0' + m[1] : null
}

const logSms = (to, text, tag, ok, mock, recId, error) => {
  try {
    db.prepare('INSERT INTO sms_log (to_phone, text, tag, ok, mock, rec_id, error, created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(to, text, tag, ok ? 1 : 0, mock ? 1 : 0, recId || null, error || null, now())
  } catch (e) { console.error('[sms] log failed:', e.message) }
  if (!ok || mock || SMS_DEBUG) console.log(`[sms${mock ? ':dev' : ''}] → ${to} (${tag}) ${ok ? '✓' : '✗ ' + (error || '')}\n    ${text.replace(/\n/g, ' | ')}`)
}

/* [فیکس B25] جدول sms_log بدون prune بود — هر پیامک (حتی mock) یک ردیف دائمی.
   دوره‌ای ردیف‌های قدیمی‌تر از ۹۰ روز حذف می‌شوند */
setInterval(() => {
  try { db.prepare('DELETE FROM sms_log WHERE created_at < ?').run(now() - 90 * 86400_000) }
  catch (e) { console.error('[sms] prune failed:', e.message) }
}, 24 * 3600_000).unref()

/**
 * ارسال پیامک — هرگز throw نمی‌کند (خرابی پیامک نباید جریان خرید را بشکند)
 * خروجی: { ok, mock?, recId?, error? }
 */
export async function sendSms(rawTo, text, tag = 'general') {
  const to = normalizePhone(rawTo)
  if (!to) return { ok: false, error: 'no-phone' }
  if (!smsConfigured()) { logSms(to, text, tag, false, true, null, 'not-configured'); return { ok: false, mock: true, error: 'not-configured' } }
  try {
    const r = await fetch(SEND_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ username: MELI_USER, password: MELI_PASS, to, from: MELI_FROM, text, isFlash: false }),
      signal: AbortSignal.timeout(15_000),
    })
    const j = await r.json().catch(() => null)
    /* پاسخ موفق رسمی: RetStatus=1 و Value حاوی شناسه پیام */
    const recId = Array.isArray(j?.Value) ? j.Value[0] : j?.Value
    if (j && Number(j.RetStatus) === 1 && recId) {
      logSms(to, text, tag, true, false, String(recId), null)
      return { ok: true, recId: String(recId) }
    }
    const err = `RetStatus=${j?.RetStatus ?? r.status} ${j?.StrRetStatus || ''}`.trim()
    logSms(to, text, tag, false, false, null, err)
    return { ok: false, error: err }
  } catch (e) {
    logSms(to, text, tag, false, false, null, e.message)
    return { ok: false, error: e.message }
  }
}

/* ---------------- قالب پیام‌ها (کوتاه — هر پیامک فارسی ۷۰ کاراکتر) ---------------- */

export const smsTemplates = {
  orderPaid: ({ code, total, items }) =>
    `خرید شما در مدرسیار ثبت شد.\nکد سفارش: ${code}\nمبلغ: ${Number(total || 0).toLocaleString('en-US')} تومان\n` +
    (items ? `اقلام: ${String(items).slice(0, 60)}\n` : '') +
    `modaresyar.ir`,
  orderFailed: ({ code }) =>
    `پرداخت سفارش ${code} در مدرسیار ناموفق بود.\nدر صورت کسر وجه، مبلغ حداکثر تا ۷۲ ساعت برمی‌گردد.\nmodaresyar.ir`,
  classEnrolled: ({ title }) =>
    `ثبت‌نام شما در کلاس «${String(title || '').slice(0, 40)}» در مدرسیار انجام شد.\nجزئیات در پنل: modaresyar.ir`,
}

/** اطلاع‌رسانی آتش‌وفراموش — منتظر نماند (خرابی شبکه پیامک‌گذار نباید ریدایرکت درگاه را نگه دارد) */
export const notify = (to, text, tag) => { sendSms(to, text, tag).catch(() => {}) }

/** پیامک خرید موفق به خریدار + مدیر (اگر SMS_ADMIN تنظیم شده باشد) */
export const notifyOrderPaid = ({ phone, code, total, items }) => {
  const tpl = smsTemplates.orderPaid({ code, total, items })
  if (phone) notify(phone, tpl, 'order-paid')
  if (ADMIN_TO) notify(ADMIN_TO, `سفارش جدید در مدرسیار\nکد: ${code}\nمبلغ: ${Number(total || 0).toLocaleString('en-US')} تومان`, 'order-paid-admin')
}
