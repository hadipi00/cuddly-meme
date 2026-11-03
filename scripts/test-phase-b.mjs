// تست فاز B — آزمون‌ساز: تیکت فایل‌ها، اعتبارسنجی PATCH
const API = 'http://127.0.0.1:4000/api'
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')) }
}
async function req(path, { method = 'GET', body, token, raw, type } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': type || 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  })
  let data = {}
  try { data = await r.json() } catch {}
  return { status: r.status, data, ct: r.headers.get('content-type') }
}
const login = async (email) => {
  const r = await req('/auth/login', { method: 'POST', body: { email, password: '12345678' } })
  return r.data?.token
}
const teacher = await login('reza@demo.ir')
const sara = await login('sara@demo.ir')

console.log('— B2: تیکت فایل‌های آزمون —')
{
  const anon = await req('/exams-files/whatever.png')
  ok('فایل آزمون بدون تیکت → 401', anon.status === 401, 'got ' + anon.status)
  const noAuthTicket = await req('/exams/file-ticket', { method: 'POST' })
  ok('گرفتن تیکت بدون لاگین → 401', noAuthTicket.status === 401)
  const t1 = await req('/exams/file-ticket', { method: 'POST', token: sara })
  ok('دانش‌آموز تیکت می‌گیرد', t1.status === 200 && typeof t1.data.st === 'string' && t1.data.st.includes('.'))
  // آپلود یک PNG واقعی به‌عنوان معلم
  const pngB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='
  const up = await req('/exams/upload', { method: 'POST', token: teacher, body: { name: 't.png', data: 'data:image/png;base64,' + pngB64 } })
  ok('آپلود فایل آزمون', up.status === 200 && up.data.url, JSON.stringify(up.data))
  const url = up.data.url
  const fname = url.split('/').pop()
  const bad = await fetch(`${API}/exams-files/${fname}?st=9999999999.deadbeef`)
  ok('تیکت جعلی رد می‌شود', bad.status === 401, 'got ' + bad.status)
  const good = await fetch(`${API}/exams-files/${fname}?st=${encodeURIComponent(t1.data.st)}`)
  ok('فایل با تیکت معتبر → 200 تصویر', good.status === 200 && (good.headers.get('content-type') || '').includes('image/png'), 'got ' + good.status + ' ' + good.headers.get('content-type'))
}

console.log('— B3: اعتبارسنجی PATCH آزمون —')
{
  const mk = await req('/exams', { method: 'POST', token: teacher, body: { title: 'تست ولیدیشن' } })
  const eid = mk.data.id
  const bad = await req(`/exams/${eid}`, { method: 'PATCH', token: teacher, body: { open_at: 'نه-یک-عدد' } })
  const got = await req(`/exams/${eid}`, { token: teacher })
  ok('open_at نامعتبر → null (نه NaN)', got.data.exam?.open_at === null, 'got ' + JSON.stringify(got.data.exam?.open_at))
  const badKey = await req(`/exams/${eid}`, { method: 'PATCH', token: teacher, body: { answer_key: { 1: 99, 2: 3 } } })
  const got2 = await req(`/exams/${eid}`, { token: teacher })
  ok('کلید خارج از بازه گزینه‌ها فیلتر می‌شود', got2.data.exam?.answer_key?.[1] === undefined && got2.data.exam?.answer_key?.['2'] === 3, JSON.stringify(got2.data.exam?.answer_key))
  await req(`/exams/${eid}`, { method: 'DELETE', token: teacher })
}

console.log(`\n——— نتیجه فاز B: ${pass} موفق، ${fail} ناموفق ———`)
process.exit(fail ? 1 : 0)
