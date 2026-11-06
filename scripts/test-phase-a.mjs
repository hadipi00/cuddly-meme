// ================================================================
// تست فاز A — کلاس آنلاین (بک‌اند): SSE auth، چت auth، clearRev تخته،
// پایان کلاس شروع‌نشده، حذف کامل کلاس، اعتبارسنجی draft
// ================================================================
const API = 'http://127.0.0.1:4000/api'
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')) }
}
async function req(path, { method = 'GET', body, token, raw } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { ...(raw ? { 'Content-Type': 'application/octet-stream' } : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? (raw ? body : JSON.stringify(body)) : undefined,
  })
  let data = {}
  try { data = await r.json() } catch {}
  return { status: r.status, data }
}
const login = async (email) => {
  const r = await req('/auth/login', { method: 'POST', body: { email, password: '12345678' } })
  if (!r.data?.token) throw new Error('login failed ' + email)
  return r.data.token
}

const teacher = await login('reza@demo.ir')   // مدرس l2/l8/l9/l10
const sara = await login('sara@demo.ir')      // دانش‌آموز ثبت‌نام‌شده در همه
const amir = await login('amir@demo.ir')      // فقط l2 و l8
const yalda = await login('yalda@demo.ir')    // فقط l4

console.log('— A2: SSE —')
{
  const r1 = await fetch(`${API}/classes/l2/events`)
  ok('SSE بدون توکن → 401', r1.status === 401, 'got ' + r1.status)
  const r2 = await fetch(`${API}/classes/l2/events?token=${yalda}`) // yalda عضو l2 نیست
  ok('SSE با توکن غیرعضو → 403', r2.status === 403, 'got ' + r2.status)
  const r3 = await fetch(`${API}/classes/l2/events?token=${sara}`)
  ok('SSE با توکن عضو → 200 استریم', r3.status === 200 && (r3.headers.get('content-type') || '').includes('event-stream'), 'got ' + r3.status)
  await r3.body?.cancel().catch(() => {})
}

console.log('— A3: چت —')
{
  const r1 = await req('/classes/l2/messages')
  ok('چت بدون توکن → 401', r1.status === 401, 'got ' + r1.status)
  const r2 = await req('/classes/l2/messages', { token: yalda })
  ok('چت غیرعضو → 403', r2.status === 403, 'got ' + r2.status)
  const r3 = await req('/classes/l2/messages', { token: amir })
  ok('چت عضو → 200', r3.status === 200 && Array.isArray(r3.data.messages), 'got ' + r3.status)
  const r4 = await req('/classes/l2/state')
  ok('state مهمان → participants خالی + فقط شمارش', r4.status === 200 && r4.data.participants.length === 0 && typeof r4.data.participantsCount === 'number')
  const r5 = await req('/classes/l2/state', { token: sara })
  ok('state عضو → لیست کامل حاضران', r5.status === 200 && Array.isArray(r5.data.participants))
}

console.log('— A4: پاک‌سازی تخته (clearRev) —')
{
  const stroke = await req('/classes/l2/board', { method: 'POST', token: teacher, body: { color: '#111111', size: 4, tool: 'pen', points: [[0.1, 0.1], [0.2, 0.2], [0.3, 0.3]] } })
  ok('ثبت خط روی تخته', stroke.status === 200 && stroke.data.stroke?.id)
  const before = await req('/classes/l2/board/live?after=0&clr=0', { token: sara })
  ok('پیش از پاک‌سازی، خط برای دانش‌آموز هست', before.data.strokes.length >= 1)
  const del = await req('/classes/l2/board', { method: 'DELETE', token: teacher })
  ok('پاک‌سازی توسط مدرس + rev برگردانده می‌شود', del.status === 200 && typeof del.data.rev === 'number')
  const after = await req(`/classes/l2/board/live?after=${before.data.strokes.at(-1)?.id || 0}&clr=0`, { token: sara })
  ok('دانش‌آموز با polling هم پاک‌شدن را می‌بیند (clearRev عوض شده)', after.data.clearRev !== 0 && after.data.strokes.length === 0, JSON.stringify({ clearRev: after.data.clearRev, n: after.data.strokes.length }))
  const s2 = await req('/classes/l2/board', { method: 'POST', token: teacher, body: { color: '#111111', size: 4, tool: 'pen', points: [[0.4, 0.4], [0.5, 0.5]] } })
  await req('/classes/l2/board', { method: 'DELETE', token: teacher })
  const after2 = await req(`/classes/l2/board/live?after=0&clr=1`, { token: sara })
  ok('بعد از پاک‌سازی جدید، rev باز هم جلو می‌رود', after2.data.clearRev > 1)
}

console.log('— A7: اعتبارسنجی draft —')
{
  const bad = await req('/classes/l2/board/draft', { method: 'POST', token: teacher, body: { points: [{ x: 1 }, 'str', [1, 2]] } })
  ok('draft با نقاط نامعتبر رد می‌شود', bad.data?.ok === false)
  const good = await req('/classes/l2/board/draft', { method: 'POST', token: teacher, body: { points: [[0.1, 0.1], [0.15, 0.12]] } })
  ok('draft معتبر پذیرفته می‌شود', good.data?.ok === true)
}

console.log('— A5/A6: پایان کلاس شروع‌نشده + حذف کامل —')
{
  const mk = await req('/classes', { method: 'POST', token: teacher, body: { title: 'کلاس تستی موقت', day: 3, start: '23:00', dur: 30, cap: 5, price: 0 } })
  const cid = mk.data.class?.id
  ok('ساخت کلاس تستی', !!cid)
  const end1 = await req(`/classes/${cid}/end`, { method: 'POST', token: teacher })
  const st1 = await req(`/classes/${cid}`, { token: teacher })
  ok('پایان کلاسِ هرگز شروع‌نشده → status واقعاً ended شد', end1.status === 200 && st1.data.class?.status === 'ended', 'status=' + st1.data.class?.status)
  // یک خط + پیام + جلسه بگذار تا حذف کامل تست شود
  await req(`/classes/${cid}/board`, { method: 'POST', token: teacher, body: { color: '#111111', size: 2, tool: 'pen', points: [[0.1, 0.1], [0.2, 0.2]] } })
  await req(`/classes/${cid}/messages`, { method: 'POST', token: teacher, body: { body: 'سلام تست' } })
  const del = await req(`/classes/${cid}`, { method: 'DELETE', token: teacher })
  ok('حذف کلاس', del.status === 200)
  const gone = await req(`/classes/${cid}`, { token: teacher })
  ok('کلاس دیگر نیست', gone.status === 404)
  // چک یتیم نبودن: پیام‌ها و خط‌های کلاس حذف‌شده باید صفر باشند — از طریق ادمین DB مستقیم نمی‌بینیم؛
  // ایندپندنت: tلاش ورود به board کلاس حذف‌شده → 404
  const orphanBoard = await req(`/classes/${cid}/board`, { token: teacher })
  ok('تخته کلاس حذف‌شده هم دیگر نیست', orphanBoard.status === 404)
}

console.log(`\n——— نتیجه فاز A بک‌اند: ${pass} موفق، ${fail} ناموفق ———`)
process.exit(fail ? 1 : 0)
