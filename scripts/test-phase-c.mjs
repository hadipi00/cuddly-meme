// تست فاز C — امنیت عمومی: rate limit، هدرها، ولیدیشن ورودی‌ها
const API = 'http://127.0.0.1:4000/api'
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')) }
}
async function req(path, { method = 'GET', body, token } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = {}
  try { data = await r.json() } catch {}
  return { status: r.status, data, headers: r.headers }
}
const login = async (email) => {
  const r = await req('/auth/login', { method: 'POST', body: { email, password: '12345678' } })
  return r.data?.token
}
const teacher = await login('reza@demo.ir')

console.log('— C2: هدرهای امنیتی —')
{
  const r = await req('/api/health')
  ok('X-Content-Type-Options: nosniff', r.headers.get('x-content-type-options') === 'nosniff')
  ok('Referrer-Policy تنظیم شده', !!r.headers.get('referrer-policy'))
  ok('Permissions-Policy تنظیم شده', (r.headers.get('permissions-policy') || '').includes('camera'))
}

console.log('— C1: rate limit لاگین —')
{
  let last = 0
  for (let i = 0; i < 13; i++) {
    const r = await req('/auth/login', { method: 'POST', body: { email: 'sara@demo.ir', password: 'wrong-' + i } })
    last = r.status
    if (r.status === 429) break
  }
  ok('۱۳ تلاش پشت‌سرهم → 429', last === 429, 'last=' + last)
}

console.log('— C3: ولیدیشن ورودی‌ها —')
{
  const badStart = await req('/classes', { method: 'POST', token: teacher, body: { title: 'تست ساعت', day: 2, start: '۲۵:۹۹' } })
  ok('ساعت ۲۵:۹۹ رد می‌شود', badStart.status === 400, 'got ' + badStart.status)
  const faStart = await req('/classes', { method: 'POST', token: teacher, body: { title: 'تست ساعت فارسی', day: 2, start: '۱۴:۳۰' } })
  ok('ساعت فارسی ۱۴:۳۰ پذیرفته و استاندارد می‌شود', faStart.status === 200 && faStart.data.class?.start === '14:30', 'got ' + faStart.data.class?.start)
  /* [سخت‌سازی فعلی] روز نامعتبر دیگر کلمپ نمی‌شود — با 400 رد می‌شود (امن‌تر از کلمپ خاموش) */
  const badDay = await req('/classes', { method: 'POST', token: teacher, body: { title: 'تست روز', day: 99, start: '10:00' } })
  ok('روز ۹۹ با 400 رد می‌شود (ولیدیشن سخت‌گیرانه)', badDay.status === 400, 'got ' + badDay.status)
  const hugeCap = await req('/classes', { method: 'POST', token: teacher, body: { title: 'تست ظرفیت', day: 1, start: '09:00', cap: 99999999 } })
  ok('ظرفیت نجومی → کلمپ به ۱۰۰۰۰', hugeCap.status === 200 && hugeCap.data.class?.cap === 10000, 'got ' + hugeCap.data.class?.cap)
  // پاک‌سازی کلاس‌های تستی
  for (const id of [faStart.data.class?.id, badDay.data.class?.id, hugeCap.data.class?.id]) {
    if (id) await req(`/classes/${id}`, { method: 'DELETE', token: teacher })
  }
  /* [مسیر قدیمی حذف شده] ثبت‌نام حالا OTP-محور است: /auth/otp/request → verify → register/complete.
     مسیر قدیمی /auth/register باید 404 بدهد و مسیر جدید هم توکن/ورودی زباله را رد کند */
  const oldRoute = await req('/auth/register', { method: 'POST', body: { name: 'x'.repeat(10000), email: `junk${Date.now()}@t.ir`, password: '123456' } })
  ok('مسیر قدیمی /auth/register حذف شده → 404', oldRoute.status === 404, 'got ' + oldRoute.status)
  const junk = await req('/auth/register/complete', { method: 'POST', body: { regToken: 'garbage.token.value', firstName: 'x'.repeat(10000), lastName: 'y', username: `junk${Date.now()}`.slice(0, 20), password: '123456' } })
  ok('ثبت‌نام با regToken جعلی / نام ۱۰هزار حرفی رد می‌شود', junk.status === 400, 'got ' + junk.status)
}

console.log(`\n——— نتیجه فاز C: ${pass} موفق، ${fail} ناموفق ———`)
process.exit(fail ? 1 : 0)
