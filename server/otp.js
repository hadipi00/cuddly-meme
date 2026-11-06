// =====================================================================
// کد تأیید پیامکی (OTP) مدرس‌یار — ورود، ثبت‌نام و بازیابی رمز با شماره موبایل
// ---------------------------------------------------------------------
// ملاحظات امنیتی:
//   • کد ۶رقمی فقط به‌صورت هش bcrypt در DB ذخیره می‌شود (نه متن خام)
//   • انقضای ۲ دقیقه + سقف ۵ تلاشِ اشتباه → بعد از آن کد می‌سوزد
//   • مصرف یک‌بارمصرف: با تأیید موفق، ردیف کد حذف می‌شود
//   • ضد بمباران پیامک: فاصلهٔ ۶۰ثانیه‌ای بین ارسال‌ها + سقف ۵ کد در ساعت
//     و ۱۲ کد در شبانه‌روز برای هر شماره (از روی ledger واقعی sms_log)
//   • در حالت بدون پنل پیامک (توسعه/دمو)، کد در پاسخ به‌عنوان devCode برمی‌گردد
//     تا جریان کامل تست‌پذیر باشد؛ با تنظیم پنل پیامک، کد فقط با SMS می‌رود
// =====================================================================
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { db, getSetting } from './db.js'
import { normalizePhone, sendSms, smsConfigured } from './sms.js'

const now = () => Date.now()
export const OTP_TTL = 120_000        // اعتبار کد: ۲ دقیقه
const RESEND_COOLDOWN = 60_000        // فاصلهٔ حداقلی دو ارسال
const MAX_ATTEMPTS = 5                // سقف کدِ اشتباه
const HOURLY_CAP = 5                  // سقف ارسال در ساعت برای هر شماره
const DAILY_CAP = 12                  // سقف ارسال در شبانه‌روز برای هر شماره
export const PURPOSES = ['login', 'register', 'reset']

const sentCount = (phone, sinceMs) =>
  db.prepare('SELECT COUNT(*) AS n FROM sms_log WHERE to_phone = ? AND created_at > ?').get(phone, sinceMs).n

/**
 * درخواست ارسال کد — خروجی:
 *   { ok:true, phone, sent, devCode?, expiresIn }
 *   { ok:false, error, wait? }
 */
export async function requestOtp(rawPhone, purpose) {
  const phone = normalizePhone(rawPhone)
  if (!phone) return { ok: false, error: 'شماره موبایل معتبر نیست — باید با ۰۹ شروع شود و ۱۱ رقم باشد' }
  if (!PURPOSES.includes(purpose)) return { ok: false, error: 'درخواست نامعتبر است' }

  /* [فیکس F39] چک ثبت‌نام «قبل از ارسال کد» — درخواست مستقیم کاربر:
     • ورود/بازیابی رمز → اگر شماره ثبت‌نام نشده باشد، نه پیامکی می‌رود نه ردیف
       کدی ساخته می‌شود؛ کلاینت با پرچم notRegistered کاربر را به ثبت‌نام می‌برد.
     • ثبت‌نام → اگر شماره قبلاً گرفته شده باشد، به‌جای هدر دادن پیامک، پرچم
       alreadyRegistered برمی‌گردد تا کلاینت به جریان «ورود با کد پیامکی» برود.
     (چک هم‌ارز در مرحلهٔ verify هم باقی است — برای مسابقهٔ هم‌زمانی) */
  const reg = db.prepare('SELECT id FROM users WHERE phone = ?').get(phone)
  if (purpose === 'register' && reg) {
    return { ok: false, alreadyRegistered: true, error: 'این شماره قبلاً ثبت شده — از «ورود با کد پیامکی» استفاده کنید' }
  }
  if (purpose !== 'register' && !reg) {
    return { ok: false, notRegistered: true, error: 'این شماره ثبت‌نام نشده — ابتدا حساب بسازید' }
  }

  /* ضد بمباران — از ledger واقعی ارسال‌ها (sms_log) */
  const hourN = sentCount(phone, now() - 3600_000)
  if (hourN >= HOURLY_CAP) return { ok: false, error: 'تعداد کد‌های ارسالی به این شماره زیاد بوده — یک ساعت دیگر تلاش کنید' }
  const dayN = sentCount(phone, now() - 86400_000)
  if (dayN >= DAILY_CAP) return { ok: false, error: 'سقف ارسال روزانهٔ این شماره پر شده — فردا تلاش کنید' }

  const row = db.prepare('SELECT * FROM otps WHERE phone = ? AND purpose = ?').get(phone, purpose)
  if (row) {
    const wait = RESEND_COOLDOWN - (now() - row.created_at)
    if (wait > 0) return { ok: false, wait: Math.ceil(wait / 1000), error: `کد قبلاً ارسال شده — ${Math.ceil(wait / 1000)} ثانیه دیگر می‌توانید کد جدید بگیرید` }
  }

  const code = String(crypto.randomInt(100000, 1000000)) // ۶ رقم — بدون صفرِ پیش‌واضع
  db.prepare(`INSERT INTO otps (phone, purpose, code_hash, attempts, expires_at, created_at) VALUES (?,?,?,?,?,?)
    ON CONFLICT(phone, purpose) DO UPDATE SET code_hash = excluded.code_hash, attempts = 0,
      expires_at = excluded.expires_at, created_at = excluded.created_at`)
    .run(phone, purpose, bcrypt.hashSync(code, 8), 0, now() + OTP_TTL, now())

  /* ارسال پیامک — در حالت دمو (بدون پنل پیامک) در کنسول لاگ می‌شود */
  const text = `کد تأیید مدرسیار: ${code}\nاعتبار: ۲ دقیقه — این کد را به هیچ‌کس ندهید`
  const r = await sendSms(phone, text, `otp-${purpose}`)

  /* [امنیت] کد هرگز در پاسخ نمی‌آید مگر وقتی پنل پیامک تنظیم نشده (حالت توسعه/دمو) */
  const mock = !smsConfigured()
  if (!mock && !r.ok) {
    db.prepare('DELETE FROM otps WHERE phone = ? AND purpose = ?').run(phone, purpose)
    return { ok: false, error: 'ارسال پیامک ناموفق بود — چند لحظه بعد دوباره تلاش کنید' }
  }
  return { ok: true, phone, sent: !mock, expiresIn: OTP_TTL / 1000, ...(mock ? { devCode: code } : {}) }
}

/**
 * تأیید کد — مصرف یک‌بارمصرف؛ خروجی:
 *   { ok:true } | { ok:false, error, left? }
 */
export function verifyOtp(rawPhone, purpose, code) {
  const phone = normalizePhone(rawPhone)
  if (!phone) return { ok: false, error: 'شماره موبایل معتبر نیست' }
  if (!PURPOSES.includes(purpose)) return { ok: false, error: 'درخواست نامعتبر است' }
  const c = String(code || '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).trim()
  if (!/^\d{6}$/.test(c)) return { ok: false, error: 'کد ۶رقمی را کامل وارد کنید' }

  const row = db.prepare('SELECT * FROM otps WHERE phone = ? AND purpose = ?').get(phone, purpose)
  if (!row) return { ok: false, error: 'کدی برای این شماره فعال نیست — کد جدید بگیرید' }
  if (row.expires_at < now()) {
    db.prepare('DELETE FROM otps WHERE phone = ? AND purpose = ?').run(phone, purpose)
    return { ok: false, error: 'کد منقضی شده — کد جدید بگیرید' }
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    db.prepare('DELETE FROM otps WHERE phone = ? AND purpose = ?').run(phone, purpose)
    return { ok: false, error: 'تلاش‌های زیاد — کد جدید بگیرید' }
  }
  if (!bcrypt.compareSync(c, row.code_hash)) {
    const attempts = row.attempts + 1
    db.prepare('UPDATE otps SET attempts = ? WHERE phone = ? AND purpose = ?').run(attempts, phone, purpose)
    const left = Math.max(0, MAX_ATTEMPTS - attempts)
    return { ok: false, error: `کد نادرست است${left ? ` — ${left} تلاش باقی مانده` : ' — کد جدید بگیرید'}`, left }
  }
  /* موفق — کد می‌سوزد (یک‌بارمصرف) */
  db.prepare('DELETE FROM otps WHERE phone = ? AND purpose = ?').run(phone, purpose)
  return { ok: true, phone }
}

/* پاکسازی دوره‌ای کدهای منقضی (خوده‌وار مهلت ۲ دقیقه‌ای دارند) */
setInterval(() => {
  try { db.prepare('DELETE FROM otps WHERE expires_at < ?').run(now()) } catch { /* noop */ }
}, 10 * 60_000).unref()

/* برای نمایش وضعیت در تست‌ها — استفادهٔ production ندارد */
export const _debug = { getSetting }
