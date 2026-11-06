/* تست E2E فیکس F38 — شروع کلاس زنده توسط مدرس و دیده‌شدن آن برای دانش‌آموز */
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
  // ۱) وضعیت اولیهٔ کلاس l2 (مدرس: reza) باید scheduled باشد
  const before = await req(null, '/classes/l2/state')
  ok('وضعیت اولیه کلاس = scheduled', before.status === 'scheduled')

  // ۲) دانش‌آموز (sara) قبل از شروع: overview نباید l2 را live بدهد
  const saraT = await login('sara', '12345678')
  const ov0 = await req(saraT, '/live/overview')
  ok('قبل از شروع — دانش‌آموز l2 را live نمی‌بیند', !(ov0.classes || []).some((c) => c.id === 'l2' && c.status === 'live'))

  // ۳) sara در کلاس l2 (رایگان) ثبت‌نام می‌کند
  const enr = await req(saraT, '/classes/l2/purchase', { method: 'POST', body: {} })
  ok('ثبت‌نام دانش‌آموز در کلاس', enr.ok === true || enr.enrolled || enr.order)

  // ۴) معلم (reza) کلاس را شروع می‌کند
  const rezaT = await login('reza', '12345678')
  const st = await req(rezaT, '/classes/l2/start', { method: 'POST' })
  ok('POST /classes/l2/start موفق', st.ok === true && typeof st.startedAt === 'number')

  // ۵) سرور الان live است
  const state = await req(null, '/classes/l2/state')
  ok('وضعیت کلاس بعد از شروع = live', state.status === 'live')

  // ۶) دانش‌آموز از /live/overview کلاس زنده را می‌بیند (منبع حقیقت پنل دانش‌آموز)
  const ov1 = await req(saraT, '/live/overview')
  const l2 = (ov1.classes || []).find((c) => c.id === 'l2')
  ok('دانش‌آموز l2 را live می‌بیند (live/overview)', l2 && l2.status === 'live' && typeof l2.startedAt === 'number')

  // ۷) تایید امنیتی: دانش‌آموز اجازه شروع ندارد
  const noPerms = await req(saraT, '/classes/l2/start', { method: 'POST' })
  ok('دانش‌آموز نمی‌تواند کلاس را شروع کند (403)', noPerms.error && !noPerms.ok)

  // ۸) پایان کلاس + ثبت جلسه
  const end = await req(rezaT, '/classes/l2/end', { method: 'POST' })
  ok('پایان کلاس موفق', end.ok === true)
  const state2 = await req(null, '/classes/l2/state')
  ok('وضعیت بعد از پایان = ended', state2.status === 'ended')
  const det = await req(rezaT, '/classes/l2/detail')
  ok('جلسهٔ برگزارشده در detail ثبت شد', (det.sessions || []).length >= 1)
}

main().catch((e) => { console.error('FAIL — exception:', e.message); process.exitCode = 1 })
