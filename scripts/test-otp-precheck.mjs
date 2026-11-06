/* تست E2E فیکس F39 — چک ثبت‌نام قبل از ارسال کد پیامکی (OTP) */
import { DatabaseSync } from 'node:sqlite'
const B = 'http://localhost:4000/api'
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' — ' + name); if (!cond) process.exitCode = 1 }
const otpReq = (phone, purpose) =>
  fetch(`${B}/auth/otp/request`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone, purpose }) })

const main = async () => {
  /* [اصلاح idempotent] سقف ۵ کد در ساعت برای هر شماره (ضد بمباران پیامک — رفتار درست سرور)
     قبلاً تست با شمارهٔ ثابت سارا کد می‌گرفت و در اجراهای مکرر قفل می‌شد.
     حالا کاربر با شمارهٔ یکتا در هر اجرا ساخته می‌شود. */
  const S = Date.now().toString(36)
  const PH = `0936${String(Date.now()).slice(-7)}`   // شمارهٔ یکتای این اجرا
  const UN = `t_otp_${S}`
  const admin = await (await fetch(`${B}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'admin', password: '12345678' }) })).json()
  if (!admin.token) throw new Error('admin login failed')
  const mk = await fetch(`${B}/admin/users`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${admin.token}` }, body: JSON.stringify({ role: 'student', name: 'کاربر OTP تست', username: UN, password: 'OtpTest99', phone: PH, email: '' }) }).then((r) => r.json())
  ok('ساخت کاربر یکتا برای تست OTP', mk.ok === true && mk.user?.username === UN)

  // ۱) ورود با شمارهٔ ثبت‌نام‌نشده → نه کد می‌آید نه ردیف OTP ساخته می‌شود
  const r1 = otpReq('09351112233', 'login')
  const s1 = await (await r1).json()
  ok('ورود با شمارهٔ ثبت‌نام‌نشده → notRegistered + بدون devCode', s1.notRegistered === true && !s1.devCode && !s1.ok)
  ok('پیام فارسی مناسب', /ثبت‌نام نشده/.test(s1.error || ''))

  // ۲) بازیابی رمز با شمارهٔ ثبت‌نام‌نشده → همان رفتار
  const s2 = await (await otpReq('09354445566', 'reset')).json()
  ok('بازیابی رمز با شمارهٔ ثبت‌نام‌نشده → notRegistered', s2.notRegistered === true && !s2.ok)

  // ۳) ثبت‌نام با شمارهٔ قبلاً ثبت‌شده (sara: 09120000002) → alreadyRegistered بدون ارسال
  const s3 = await (await otpReq('09120000002', 'register')).json()
  ok('ثبت‌نام با شمارهٔ ثبت‌شده → alreadyRegistered + بدون devCode', s3.alreadyRegistered === true && !s3.devCode && !s3.ok)

  // ۴) ورود با شمارهٔ ثبت‌شده → کد واقعاً ساخته/ارسال می‌شود (حالت دمو: devCode)
  const s4 = await (await otpReq(PH, 'login')).json()
  ok('ورود با شمارهٔ ثبت‌شده → کد صادر شد', s4.ok === true && !!s4.devCode)

  // ۵) هیچ ردیف OTP یا پیامکی برای شماره‌های ثبت‌نام‌نشده ساخته نشده باشد
  const db = new DatabaseSync('server/data/modaresyar.db', { readOnly: true })
  const otpRows = db.prepare("SELECT COUNT(*) n FROM otps WHERE phone IN ('09351112233','09354445566')").get().n
  const smsRows = db.prepare("SELECT COUNT(*) n FROM sms_log WHERE to_phone IN ('09351112233','09354445566')").get().n
  ok('بدون ردیف OTP برای شمارهٔ ثبت‌نام‌نشده', otpRows === 0)
  ok('بدون پیامک برای شمارهٔ ثبت‌نام‌نشده', smsRows === 0)

  // ۶) جریان کامل ورود پیامکی با شمارهٔ ثبت‌شده (کد دمو → توکن)
  const v = await (await fetch(`${B}/auth/otp/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: PH, code: s4.devCode, purpose: 'login' }) })).json()
  ok('تأیید کد → ورود موفق کاربر جدید', v.ok === true && v.user?.username === UN)
}

main().catch((e) => { console.error('FAIL — exception:', e.message); process.exitCode = 1 })
