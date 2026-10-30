// ================================================================
// تست E2E مرورگری کلاس زنده — دو کاربر واقعی همزمان (مدرس + دانش‌آموز)
// دوربین/میکروفون با fake-device کرومیم شبیه‌سازی می‌شود؛ پس MediaRecorder
// واقعاً تکه می‌سازد و رله HTTP واقعاً پخش می‌کند — نه ماک، نه شبیه‌سازی
// سناریو مثل اسکای‌روم: ورود دانش‌آموز → تماشای فوری → دست → اجازه → صحبت
// ================================================================
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')

const BASE = 'http://127.0.0.1:3000'
const API = 'http://127.0.0.1:4000/api'
const CLASS_ID = 'l2'
const STUDENT = { email: 'sara@demo.ir', password: '12345678' }
const TEACHER = { email: 'reza@demo.ir', password: '12345678' }

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}`) }
  else { fail++; console.log(`  ✗ ${name} ${extra}`) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* ورود واقعی از طریق فرم لاگین (state اپ هم درست ست می‌شود) */
async function loginIn(page, who) {
  await page.goto(BASE + '/auth', { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="you@example.com"]', who.email)
  await page.fill('input[type="password"]', who.password)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'ورود به حساب')
    b?.click()
  })
  await page.waitForTimeout(1800)
  const u = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + (sessionStorage.getItem('modaresyar:token:tab') || localStorage.getItem('modaresyar:token') || '') } })
      return (await r.json())?.user || null
    } catch { return null }
  })
  return u
}

const errors = { teacher: [], student: [] }
function watchErrors(page, key) {
  page.on('pageerror', (e) => errors[key].push('pageerror: ' + e.message))
  page.on('console', (m) => { if (m.type() === 'error') errors[key].push('console: ' + m.text()) })
}

async function clickCtl(page, tip) {
  return page.evaluate((t) => {
    const btns = [...document.querySelectorAll('.live-controls .ctl')]
    const b = btns.find((x) => x.querySelector('.ctl-tip')?.textContent?.includes(t))
    if (b) { b.click(); return true }
    return false
  }, tip)
}

/* وضعیت ویدیوی رله در صفحه */
const relayState = () => {
  const vs = [...document.querySelectorAll('.cam-tile video')]
    .filter((v) => typeof v.src === 'string' && v.src.startsWith('blob:'))
  if (!vs.length) return null
  const v = vs[0]
  const b = v.buffered
  return {
    n: vs.length,
    ready: v.readyState, w: v.videoWidth, h: v.videoHeight,
    t: v.currentTime, paused: v.paused, muted: v.muted,
    edge: b.length ? +(b.end(b.length - 1) - v.currentTime).toFixed(2) : null,
  }
}

const main = async () => {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--mute-audio'],
  })
  const tctx = await browser.newContext({ viewport: { width: 1360, height: 820 } })
  const sctx = await browser.newContext({ viewport: { width: 1360, height: 820 } })
  await tctx.grantPermissions(['camera', 'microphone'], { origin: BASE })
  await sctx.grantPermissions(['camera', 'microphone'], { origin: BASE })
  const tp = await tctx.newPage()
  const sp = await sctx.newPage()
  watchErrors(tp, 'teacher'); watchErrors(sp, 'student')
  sp.on('console', (m) => { const t = m.text(); if (t.includes('[MSE]')) console.log('  [S]', t.slice(0, 130)) })
  tp.on('console', (m) => { const t = m.text(); if (t.includes('[MSE]')) console.log('  [T]', t.slice(0, 130)) })

  /* شمارنده آپلود رله + وضعیت پاسخ‌ها */
  let upTeacher = 0, upStudent = 0, upTeacherFail = 0, upStudentFail = 0
  tp.on('request', (r) => { if (r.url().includes('/media/up')) upTeacher++ })
  tp.on('response', (r) => { if (r.url().includes('/media/up') && r.status() >= 400) upTeacherFail++ })
  sp.on('request', (r) => { if (r.url().includes('/media/up')) upStudent++ })
  sp.on('response', (r) => { if (r.url().includes('/media/up') && r.status() >= 400) upStudentFail++ })

  console.log('— ۱) ورود و شروع کلاس توسط مدرس')
  const tuser = await loginIn(tp, TEACHER)
  const suser = await loginIn(sp, STUDENT)
  ok('مدرس وارد شد', !!tuser?.id)
  ok('دانش‌آموز وارد شد', !!suser?.id)
  // اطمینان از ثبت‌نام دانش‌آموز در کلاس (گیت خرید) + پایان جلسات قبلی برای شروع تمیز
  const stok = (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(STUDENT) })).json()).token
  const ttok = tuser && (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(TEACHER) })).json()).token
  await fetch(`${API}/classes/${CLASS_ID}/purchase`, { method: 'POST', headers: { Authorization: 'Bearer ' + stok } })
  await fetch(`${API}/classes/${CLASS_ID}/end`, { method: 'POST', headers: { Authorization: 'Bearer ' + ttok } })
  await fetch(`${API}/classes/${CLASS_ID}/board/open`, { method: 'POST', headers: { Authorization: 'Bearer ' + ttok, 'Content-Type': 'application/json' }, body: JSON.stringify({ open: false }) })

  await tp.goto(BASE + '/panel/teacher/live', { waitUntil: 'networkidle' })
  // فقط کارت «واقعی» کلاس l2 — بعد از رسیدن داده‌ی سرور (نه دموی اولیه)
  const cardReady = await tp.waitForFunction(() => document.body.textContent.includes('کارگاه React — هوک‌های پیشرفته'), { timeout: 10000 }).then(() => true).catch(() => false)
  ok('لیست واقعی کلاس‌های مدرس از سرور رسید', cardReady)
  await tp.waitForTimeout(400)
  const clickedPrep = await tp.evaluate(() => {
    const cards = [...document.querySelectorAll('.card.pad')]
    const c = cards.find((x) => x.textContent.includes('کارگاه React — هوک‌های پیشرفته'))
    const btn = c && [...c.querySelectorAll('button')].find((b) => b.textContent.includes('آماده‌سازی و شروع'))
    if (btn) { btn.click(); return true }
    return false
  })
  ok('کلیک «آماده‌سازی و شروع»', clickedPrep)
  await tp.waitForTimeout(2500) // چک تجهیزات با getUserMedia فیک
  const devOk = await tp.evaluate(() => document.body.textContent.includes('✓ آماده'))
  ok('چک تجهیزات: میکروفون و دوربین آماده (فیک)', devOk)
  await tp.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('شروع کلاس زنده')); b?.click() })
  const inRoom = await tp.waitForFunction(() => !!document.querySelector('.live-controls'), { timeout: 10000 }).then(() => true).catch(() => false)
  ok('مدرس داخل اتاق کلاس است', inRoom)
  const roomClass = await tp.evaluate(() => document.querySelector('h2')?.textContent || '')
  ok('اتاق مدرس همان کلاس l2 است', roomClass.includes('کارگاه React'), roomClass)

  console.log('— ۲) مدرس: دوربین فیک روشن و رله خروجی فعال')
  await tp.waitForTimeout(3000)
  const tSelf = await tp.evaluate(() => {
    const v = [...document.querySelectorAll('.cam-tile video')].find((x) => x.srcObject)
    return v ? { w: v.videoWidth, h: v.videoHeight } : null
  })
  ok('ویدیوی خودِ مدرس (فیک) در حال پخش است', !!tSelf && tSelf.w > 0, JSON.stringify(tSelf))
  await sleep(2500)
  ok('تکه‌های رسانه مدرس در حال آپلود است (رله خروجی)', upTeacher >= 3, `up=${upTeacher}`)
  ok('هیچ آپلود ناموفقی در مسیر مدرس نیست', upTeacherFail === 0, `fail=${upTeacherFail}`)
  await tp.screenshot({ path: '/home/z/my-project/download/e2e-teacher-room.png' })

  console.log('— ۳) دانش‌آموز وارد می‌شود: تماشای فوری، بدون کارت اجازه، بدون دست خودکار')
  await sp.goto(BASE + `/panel/student/live/${CLASS_ID}`, { waitUntil: 'domcontentloaded' })
  const sRoom = await sp.waitForFunction(() => !!document.querySelector('.live-controls'), { timeout: 15000 }).then(() => true).catch(() => false)
  ok('دانش‌آموز داخل اتاق کلاس است', sRoom)
  await sp.waitForTimeout(1200)
  const noCard = await sp.evaluate(() => !document.querySelector('.perm-overlay'))
  ok('کارت «فعال‌سازی دوربین» برای دانش‌آموز نیست', noCard)
  const handDown = await sp.evaluate(() => !document.body.textContent.includes('درخواست شما برای مدرس ارسال شد'))
  ok('دست دانش‌آموز خودکار بلند نشده', handDown)

  // انتظار برای رسیدن ویدیوی رله‌شده مدرس (blob = MediaSource)
  const t0 = Date.now()
  let st = null
  while (Date.now() - t0 < 15000) {
    st = await sp.evaluate(relayState)
    if (st && st.ready >= 2 && st.w > 0) break
    await sleep(400)
  }
  ok(`ویدیوی مدرس برای دانش‌آموز نمایش داده شد (${(((Date.now() - t0) / 1000) || 0).toFixed(1)}s پس از ورود)`, !!st && st.w > 0, JSON.stringify(st))
  ok('پخش در جریان است (paused=false)', !!st && st.paused === false, JSON.stringify(st))
  ok('صدا با سیاست autoplay بی‌صدا شروع شد (muted اول)', !!st && st.muted === true)

  console.log('— ۴) تاخیر پخش (لبه زنده)')
  await sleep(2000)
  const st1 = await sp.evaluate(relayState)
  await sleep(2000)
  const st2 = await sp.evaluate(relayState)
  ok('زمان پخش جلو می‌رود (استریم زنده)', !!st1 && !!st2 && st2.t > st1.t, `${st1?.t} → ${st2?.t}`)
  ok(`تاخیر لبه زنده کم است (${st2?.edge}s ≤ ۲s)`, st2?.edge != null && st2.edge <= 2, `edge=${st2?.edge}`)
  await sp.screenshot({ path: '/home/z/my-project/download/e2e-student-watching.png' })

  console.log('— ۵) فعال شدن صدا با اولین کلیک (سیاست autoplay)')
  await sp.mouse.click(680, 400)
  await sleep(800)
  const unmuted = await sp.evaluate(() => {
    const v = [...document.querySelectorAll('.cam-tile video')].find((x) => typeof x.src === 'string' && x.src.startsWith('blob:'))
    return v ? !v.muted : null
  })
  ok('پس از کلیک، صدای مدرس فعال شد', unmuted === true)

  console.log('— ۶) دانش‌آموز دست بلند می‌کند → مدرس می‌بیند و اجازه می‌دهد')
  const raised = await sp.evaluate(() => {
    const bar = [...document.querySelectorAll('.speak-req-bar button')].find((b) => b.textContent.includes('بلند کردن دست'))
    if (bar) { bar.click(); return 'bar' }
    const ctl = [...document.querySelectorAll('.live-controls .ctl')].find((x) => x.querySelector('.ctl-tip')?.textContent?.includes('بلند کردن دست'))
    if (ctl) { ctl.click(); return 'ctl' }
    return null
  })
  ok('دکمه دست توسط دانش‌آموز کلیک شد', !!raised, String(raised))
  await sleep(500)
  const chip = await tp.waitForFunction(() => !!document.querySelector('.hand-chip'), { timeout: 8000 }).then(() => true).catch(() => false)
  ok('چیپ «✋ دست بالا کرده» روی صحنه مدرس ظاهر شد', chip)
  await tp.screenshot({ path: '/home/z/my-project/download/e2e-teacher-hand.png' })
  // کلیک روی چیپ → تب حاضران → اجازه دادن
  const granted = await tp.evaluate(() => {
    const c = document.querySelector('.hand-chip')
    if (c) c.click()
    return true
  })
  await tp.waitForTimeout(600)
  const did = await tp.evaluate(() => {
    const rows = [...document.querySelectorAll('.part-row')]
    const row = rows.find((r) => r.textContent.includes('سارا') || r.textContent.includes('Sara'))
    const btn = row && [...row.querySelectorAll('button')].find((b) => b.textContent.includes('اجازه دادن'))
    if (btn) { btn.click(); return true }
    return false
  })
  ok('مدرس از تب حاضران «اجازه دادن» را زد', granted && did, `granted=${granted} did=${did}`)

  console.log('— ۷) پنل میکروفون/دوربین در جای خودش برای دانش‌آموز')
  const panel = await sp.waitForFunction(() => !!document.querySelector('.speak-panel'), { timeout: 8000 }).then(() => true).catch(() => false)
  ok('پنل «مدرس اجازه گفتن داد» ظاهر شد', panel)
  await sp.screenshot({ path: '/home/z/my-project/download/e2e-student-speak-panel.png' })
  // روشن کردن میکروفون و دوربین
  const toggles = await sp.evaluate(() => {
    const p = document.querySelector('.speak-panel')
    if (!p) return false
    const mic = [...p.querySelectorAll('button')].find((b) => b.textContent.includes('میکروفون'))
    mic?.click()
    return !!mic
  })
  await sleep(1200)
  const camOn = await sp.evaluate(() => {
    const p = document.querySelector('.speak-panel')
    if (!p) return false
    const cam = [...p.querySelectorAll('button')].find((b) => b.textContent.includes('دوربین'))
    cam?.click()
    return !!cam
  })
  ok('میکروفون روشن شد', toggles)
  ok('دوربین روشن شد', camOn)
  await sleep(1500)
  const selfVid = await sp.evaluate(() => {
    const v = [...document.querySelectorAll('.cam-tile video')].find((x) => x.srcObject && x.videoWidth > 0)
    return v ? { w: v.videoWidth } : null
  })
  ok('کادر کوچک تصویر خودِ دانش‌آموز در نوار ظاهر شد', !!selfVid, JSON.stringify(selfVid))
  ok('رله خروجی دانش‌آموز فعال شد (تکه آپلود می‌شود)', upStudent >= 2, `up=${upStudent}`)
  ok('هیچ آپلود ناموفقی در مسیر دانش‌آموز نیست', upStudentFail === 0, `fail=${upStudentFail}`)

  console.log('— ۸) مدرس استریم دانش‌آموز را می‌بیند (کادر بزرگ برای خودش می‌ماند)')
  const tSees = await tp.waitForFunction(() => {
    const tiles = [...document.querySelectorAll('.cam-tile')]
    return tiles.some((x) => {
      const v = x.querySelector('video')
      const nm = x.querySelector('.ct-name')?.textContent || ''
      return v && typeof v.src === 'string' && v.src.startsWith('blob:') && v.videoWidth > 0 && (nm.includes('سارا') || nm.includes('Sara'))
    })
  }, { timeout: 12000 }).then(() => true).catch(() => false)
  ok('کاشی زنده‌ی دانش‌آموز در صفحه مدرس پخش می‌شود', tSees)
  await tp.screenshot({ path: '/home/z/my-project/download/e2e-teacher-sees-student.png' })

  console.log('— ۹) وایت‌برد: باز شدن + رسم با تاخیر کم')
  await clickCtl(tp, 'وایت‌برد')
  await sleep(1200)
  const sBoard = await sp.waitForFunction(() => !!document.querySelector('.wb-wrap canvas'), { timeout: 6000 }).then(() => true).catch(() => false)
  ok('تخته روی صفحه دانش‌آموز باز شد', sBoard)
  // مدرس می‌کشد
  const box = await tp.locator('.wb-canvas').boundingBox()
  await tp.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)
  await tp.mouse.down()
  for (let i = 1; i <= 8; i++) await tp.mouse.move(box.x + box.width * (0.2 + i * 0.04), box.y + box.height * (0.2 + i * 0.035))
  await tp.mouse.up()
  await sleep(1000)
  // بررسی سمت سرور: خط واقعا ثبت شده است؟
  const strokeSrv = await (await fetch(`${API}/classes/${CLASS_ID}/board`, { headers: { Authorization: 'Bearer ' + ttok } }).then((r) => r.json()).catch(() => ({})))
  ok('خط مدرس در سرور ثبت شد', (strokeSrv.strokes?.length || 0) > 0, `n=${strokeSrv.strokes?.length}`)
  const bT0 = Date.now()
  let strokeSeen = false
  while (Date.now() - bT0 < 5000) {
    strokeSeen = await sp.evaluate(() => {
      const cv = document.querySelector('.wb-wrap canvas')
      if (!cv) return false
      // اسکن نمونه‌ای کل بوم — هر پیکسل غیرشفاف یعنی خط رسیده
      const img = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data
      for (let i = 3; i < img.length; i += 200) if (img[i] > 10) return true
      return false
    })
    if (strokeSeen) break
    await sleep(150)
  }
  ok(`خط مدرس روی تخته دانش‌آموز ظاهر شد (${((Date.now() - bT0) / 1000).toFixed(1)}s)`, strokeSeen)
  await sp.screenshot({ path: '/home/z/my-project/download/e2e-student-board.png' })

  console.log('— ۱۰) سلامت کنسول')
  ok('بدون خطای صفحه در مرورگر مدرس', errors.teacher.length === 0, errors.teacher.slice(0, 2).join(' | '))
  ok('بدون خطای صفحه در مرورگر دانش‌آموز', errors.student.length === 0, errors.student.slice(0, 2).join(' | '))

  await browser.close()
  console.log(`\nنتیجه نهایی: ${pass} ✓ / ${fail} ✗`)
  if (fail) process.exit(1)
}

main().catch((e) => { console.error('CRASH', e); process.exit(1) })
