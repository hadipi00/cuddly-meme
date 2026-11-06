/* تست E2E فیکس F38 — شروع کلاس زنده توسط مدرس و دیده‌شدن آن برای دانش‌آموز
   [اصلاح idempotent] قبلاً روی کلاس دموی l2 بود که بعد از «پایان» برای همیشه
   ended می‌ماند و اجرای دومِ تست FAIL می‌شد (رفتار درست سرور: ثبت‌نام در کلاس
   پایان‌یافته رد می‌شود). حالا تست کلاس اختصاصی خودش را می‌سازد، چرخهٔ کامل
   scheduled→live→ended را آزمایش می‌کند و در پایان آن را حذف می‌کند —
   روی هر دیتابیسی قابل اجرای مکرر است و دیتابیس را هم تمیز می‌گذارد. */
const B = 'http://localhost:4000/api'
const j = (r) => r.json()
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' — ' + name); if (!cond) process.exitCode = 1 }

const login = async (id, pw) => {
  const r = await fetch(`${B}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, password: pw }) }).then(j)
  if (!r.token) throw new Error('login failed: ' + JSON.stringify(r))
  return r.token
}
const req = (t, path, opts = {}) => fetch(B + path, {
  ...opts,
  body: opts.body && typeof opts.body === 'object' ? JSON.stringify(opts.body) : opts.body,
  headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
}).then(j)

const main = async () => {
  const rezaT = await login('reza', '12345678')
  const saraT = await login('sara', '12345678')

  // ۱) ساخت کلاس آزمایشی رایگان توسط مدرس — همیشه scheduled و تمیز
  const created = await req(rezaT, '/classes', { method: 'POST', body: {
    title: 'تست F38 — کلاس موقت', desc: 'ساخته‌شده توسط تست خودکار؛ در پایان حذف می‌شود',
    day: 0, start: '08:00', dur: 30, cap: 5, price: 0,
  } })
  const cid = created.class?.id
  ok('ساخت کلاس آزمایشی توسط مدرس', !!cid)
  if (!cid) return

  // ۲) وضعیت اولیه = scheduled
  const before = await req(null, `/classes/${cid}/state`)
  ok('وضعیت اولیه کلاس = scheduled', before.status === 'scheduled')

  // ۳) ثبت‌نام دانش‌آموز در کلاس رایگان
  const enr = await req(saraT, `/classes/${cid}/purchase`, { method: 'POST', body: {} })
  ok('ثبت‌نام دانش‌آموز در کلاس', enr.ok === true || enr.enrolled || enr.order)

  // ۴) قبل از شروع: دانش‌آموز کلاس را live نمی‌بیند (منبع حقیقت: live/overview)
  const ov0 = await req(saraT, '/live/overview')
  ok('قبل از شروع — دانش‌آموز کلاس را live نمی‌بیند', !(ov0.classes || []).some((c) => c.id === cid && c.status === 'live'))

  // ۵) معلم کلاس را شروع می‌کند
  const st = await req(rezaT, `/classes/${cid}/start`, { method: 'POST' })
  ok('POST /classes/:id/start موفق', st.ok === true && typeof st.startedAt === 'number')

  // ۶) سرور الان live است
  const state = await req(null, `/classes/${cid}/state`)
  ok('وضعیت کلاس بعد از شروع = live', state.status === 'live')

  // ۷) دانش‌آموز از /live/overview کلاس زنده را می‌بیند
  const ov1 = await req(saraT, '/live/overview')
  const c1 = (ov1.classes || []).find((c) => c.id === cid)
  ok('دانش‌آموز کلاس را live می‌بیند (live/overview)', c1 && c1.status === 'live' && typeof c1.startedAt === 'number')

  // ۸) تایید امنیتی: دانش‌آموز اجازه شروع ندارد
  const noPerms = await req(saraT, `/classes/${cid}/start`, { method: 'POST' })
  ok('دانش‌آموز نمی‌تواند کلاس را شروع کند (403)', noPerms.error && !noPerms.ok)

  // ۹) پایان کلاس + ثبت جلسهٔ برگزارشده
  const end = await req(rezaT, `/classes/${cid}/end`, { method: 'POST' })
  ok('پایان کلاس موفق', end.ok === true)
  const state2 = await req(null, `/classes/${cid}/state`)
  ok('وضعیت بعد از پایان = ended', state2.status === 'ended')
  const det = await req(rezaT, `/classes/${cid}/detail`)
  ok('جلسهٔ برگزارشده در detail ثبت شد', (det.sessions || []).length >= 1)

  // ۱۰) پاک‌سازی — حذف کلاس آزمایشی تا دیتابیس تمیز بماند
  const del = await req(rezaT, `/classes/${cid}`, { method: 'DELETE' })
  ok('پاک‌سازی کلاس آزمایشی', del.ok === true || del.deleted === true)
}

main().catch((e) => { console.error('FAIL — exception:', e.message); process.exitCode = 1 })
