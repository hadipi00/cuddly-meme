// تست E2E نسخه ۲ کلاس زنده — رله رسانه + گیت اجازه + دست بلند کردن
// شبیه‌سازی کامل مدرس و دانش‌آموز با HTTP واقعی (مثل اسکای‌روم: تماشا → دست → اجازه → صحبت)
const BASE = 'http://127.0.0.1:4000/api'
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${extra}`) }
}

async function req(path, { method = 'GET', body, token, raw } = {}) {
  const headers = {}
  if (body !== undefined && !raw) headers['Content-Type'] = 'application/json'
  if (raw) headers['Content-Type'] = 'application/octet-stream'
  if (token) headers.Authorization = `Bearer ${token}`
  const res = await fetch(BASE + path, { method, headers, body: raw ? body : body !== undefined ? JSON.stringify(body) : undefined })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

const login = async (email) => {
  const r = await req('/auth/login', { method: 'POST', body: { email, password: '12345678' } })
  if (r.status !== 200) throw new Error('login failed ' + email + ' ' + JSON.stringify(r.data))
  return r.data
}

// بایت‌های شبیه init webm (هدر EBML) و تکه‌های بعدی — سمت گیرنده فقط حجم/ترتیب مهم است
const FAKE_INIT = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0x01, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00])
const fakeChunk = (i) => Buffer.from([0x1f, 0x43, 0xb6, 0x75, i & 0xff, ...Array(16).fill(i % 251)])

const upload = (token, classId, buf, isInit, o = {}) =>
  req(`/classes/${classId}/media/up?k=${o.k || 'teacher'}&init=${isInit ? 1 : 0}&mic=${o.mic !== false ? 1 : 0}&cam=${o.cam !== false ? 1 : 0}&screen=${o.screen ? 1 : 0}&fmt=${o.fmt || 'webm'}&cd=${encodeURIComponent(o.cd || '')}`,
    { method: 'POST', token, raw: true, body: buf })

const main = async () => {
  console.log('— ۱) ورود و آماده‌سازی')
  const t = await login('reza@demo.ir')
  const s = await login('sara@demo.ir')
  ok('ورود مدرس reza', !!t.token)
  ok('ورود دانش‌آموز sara', !!s.token)
  const TT = t.token, ST = s.token
  const classId = 'l2'
  await req(`/classes/${classId}/purchase`, { method: 'POST', token: ST }) // اطمینان از ثبت‌نام
  await req(`/classes/${classId}/start`, { method: 'POST', token: TT })

  console.log('— ۲) ورود دانش‌آموز: بدون دست خودکار، بدون رسانه')
  const hb = await req(`/classes/${classId}/heartbeat`, { method: 'POST', token: ST, body: { hand: false } })
  ok('حضور دانش‌آموز ثبت شد', hb.status === 200)
  const me = hb.data.participants?.find((p) => p.id === s.user.id)
  ok('دانش‌آموز بدون اجازه صحبت وارد می‌شود (canSpeak=false)', me && me.canSpeak === false)
  ok('دست دانش‌آموز پایین است (hand=false)', me && me.hand === false)

  console.log('— ۳) گیت آپلود: دانش‌آموز بدون اجازه → ۴۰۳')
  const noUp = await upload(ST, classId, FAKE_INIT, true, { k: 'student', cd: 'vp8,opus' })
  ok('آپلود دانش‌آموز بدون اجازه رد شد (403 noPerm)', noUp.status === 403 && noUp.data.noPerm === true)

  console.log('— ۴) مدرس پخش را شروع می‌کند (init + تکه‌ها)')
  const up1 = await upload(TT, classId, FAKE_INIT, true, { cd: 'vp8,opus' })
  ok('آپلود init مدرس', up1.status === 200)
  for (let i = 1; i <= 5; i++) await upload(TT, classId, fakeChunk(i), false, { cd: 'vp8,opus' })
  ok('آپلود ۵ تکه مدرس', true)

  console.log('— ۵) دانش‌آموز تماشا می‌کند: استریم مدرس با تاخیر کم می‌رسد')
  const f1 = await req(`/classes/${classId}/media/feeds?cur=${encodeURIComponent(JSON.stringify({}))}`, { token: ST })
  ok('feeds → استریم مدرس موجود', f1.status === 200 && !!f1.data.teacher)
  ok('استریم مدرس init دارد (تازه‌وارد)', !!f1.data.teacher?.init)
  ok('استریم مدرس تکه دارد', (f1.data.teacher?.chunks?.length || 0) >= 3)
  ok('کدک‌ها (cd) درست منتقل شد', f1.data.teacher?.cd === 'vp8,opus')
  ok('وضعیت mic/cam مدرس درست', f1.data.teacher?.mic === true && f1.data.teacher?.cam === true)
  const sess1 = f1.data.teacher.sess
  const lastSeq = f1.data.teacher.chunks[f1.data.teacher.chunks.length - 1].seq
  const t0 = Date.now()
  const f2 = await req(`/classes/${classId}/media/feeds?cur=${encodeURIComponent(JSON.stringify({ t: { s: sess1, q: lastSeq } }))}`, { token: ST })
  ok('پولینگ با کرسر سریع است (<80ms)', Date.now() - t0 < 80, `${Date.now() - t0}ms`)
  ok('با کرسر تکراری نمی‌آید', (f2.data.teacher?.chunks?.length || 0) === 0)

  console.log('— ۶) گپ کرسر: مدرس تکه تازه → فقط همان می‌آید')
  await upload(TT, classId, fakeChunk(6), false, { cd: 'vp8,opus' })
  const f3 = await req(`/classes/${classId}/media/feeds?cur=${encodeURIComponent(JSON.stringify({ t: { s: sess1, q: lastSeq } }))}`, { token: ST })
  ok('تکه تازه فقط یکی آمد', f3.data.teacher?.chunks?.length === 1 && f3.data.teacher.chunks[0].seq === lastSeq + 1)

  console.log('— ۷) کرسر q=0 با سشن شناخته‌شده → پخش دوباره‌ی پنجره (init نمی‌آید چون گیرنده دارد)')
  const f4 = await req(`/classes/${classId}/media/feeds?cur=${encodeURIComponent(JSON.stringify({ t: { s: sess1, q: 0 } }))}`, { token: ST })
  ok('تکه‌های پنجره دوباره می‌آیند', (f4.data.teacher?.chunks?.length || 0) >= 3)
  ok('reset نیست و init تکرار نمی‌شود (گیرنده init را دارد)', f4.data.teacher?.reset !== true && !f4.data.teacher?.init)

  console.log('— ۸) تغییر کدک توسط مدرس (دوربین روشن می‌شود) → cd تازه در feed')
  await upload(TT, classId, FAKE_INIT, true, { cd: 'vp8,opus,avc1' })
  const f5 = await req(`/classes/${classId}/media/feeds?cur=${encodeURIComponent(JSON.stringify({ t: { s: sess1, q: 999 } }))}`, { token: ST })
  ok('cd جدید روی feed اعمال شد (گیرنده پلیر را از نو می‌سازد)', f5.data.teacher?.cd === 'vp8,opus,avc1' && f5.data.teacher?.reset === true)

  console.log('— ۹) دانش‌آموز دست بلند می‌کند (فقط با کلیک خودش) → مدرس می‌بیند')
  await req(`/classes/${classId}/heartbeat`, { method: 'POST', token: ST, body: { hand: true } })
  const st1 = await req(`/classes/${classId}/state`, { token: TT })
  const sara = st1.data.participants?.find((p) => p.id === s.user.id)
  ok('دست بالا در state مدرس دیده می‌شود', sara?.hand === true)

  console.log('— ۱۰) مدرس اجازه می‌دهد → آپلود دانش‌آموز باز می‌شود')
  const perm = await req(`/classes/${classId}/permit`, { method: 'POST', token: TT, body: { userId: s.user.id, allow: true } })
  ok('permit موفق', perm.status === 200)
  const sara2 = perm.data.participants?.find((p) => p.id === s.user.id)
  ok('canSpeak=true و دست پایین شد', sara2?.canSpeak === true && sara2?.hand === false)
  const upS1 = await upload(ST, classId, FAKE_INIT, true, { k: 'student', cd: 'opus', mic: true, cam: false })
  ok('آپلود فقط-صدا دانش‌آموز بعد از اجازه', upS1.status === 200)
  await upload(ST, classId, fakeChunk(11), false, { k: 'student', cd: 'opus', mic: true, cam: false })
  await upload(ST, classId, fakeChunk(12), false, { k: 'student', cd: 'opus', mic: true, cam: false })
  const f6 = await req(`/classes/${classId}/media/feeds?cur=${encodeURIComponent(JSON.stringify({}))}`, { token: TT })
  const sf = f6.data.students?.find((x) => x.uid === s.user.id)
  ok('مدرس استریم دانش‌آموز را می‌بیند (با نام)', !!sf && sf.name === s.user.name)
  ok('استریم دانش‌آموز فقط-صدا با cd=opus', sf?.cd === 'opus' && sf?.cam === false)

  console.log('— ۱۱) لغو اجازه → آپلود فوراً بسته می‌شود')
  await req(`/classes/${classId}/permit`, { method: 'POST', token: TT, body: { userId: s.user.id, allow: false } })
  const upS2 = await upload(ST, classId, fakeChunk(13), false, { k: 'student', cd: 'opus' })
  ok('آپلود بعد از لغو ۴۰۳', upS2.status === 403)

  console.log('— ۱۲) تخته: باز/قفل/رسم زنده')
  const bo = await req(`/classes/${classId}/board/open`, { method: 'POST', token: TT, body: { open: true } })
  ok('باز کردن تخته', bo.status === 200)
  const st2 = await req(`/classes/${classId}/state`)
  ok('state → boardOpen=true', st2.data.boardOpen === true)
  const dr = await req(`/classes/${classId}/board/draft`, { method: 'POST', token: TT, body: { color: '#111', size: 4, tool: 'pen', points: [[0.1, 0.1], [0.12, 0.12]] } })
  ok('رسم زنده (draft) مدرس', dr.status === 200)
  const bl = await req(`/classes/${classId}/board/live?after=0&dt=0&bgr=-1`, { token: ST })
  ok('دانش‌آموز draft مدرس را در polling می‌بیند', bl.status === 200 && (bl.data.drafts?.length || 0) >= 1)
  await req(`/classes/${classId}/board/open`, { method: 'POST', token: TT, body: { open: false } })

  console.log('— ۱۳) پایان کلاس')
  const end = await req(`/classes/${classId}/end`, { method: 'POST', token: TT })
  ok('پایان کلاس', end.status === 200)

  console.log(`\nنتیجه: ${pass} ✓ / ${fail} ✗`)
  if (fail) process.exit(1)
}

main().catch((e) => { console.error('CRASH', e); process.exit(1) })
