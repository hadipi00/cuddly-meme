// =====================================================================
// تست E2E نهایی کلاس زنده — دو کاربر همزمان در مرورگر واقعی (Playwright)
// صدا + تصویر + اشتراک صفحه + جریان اجازه (دست → تایید → میکروفون دانش‌آموز)
// + اندازه‌گیری تاخیر رله (آپلود تکه تا دیده‌شدن برای گیرنده)
// اجرا:  node scripts/e2e-live-final.mjs
// =====================================================================
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright')

const BASE = 'http://localhost:3000'
const CLASS_ID = process.env.CLASS_ID || 'l10'
const TEACHER = { email: 'reza@demo.ir', password: '12345678' }
const STUDENT = { email: 'sara@demo.ir', password: '12345678' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (step, msg = '') => console.log(`▸ ${step}${msg ? ' — ' + msg : ''}`)
let failures = 0
const ok = (cond, label, extra = '') => {
  if (cond) console.log(`  ✅ ${label}${extra ? ' — ' + extra : ''}`)
  else { failures++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`) }
}

/* ---------- ورود از طریق API برای گرفتن توکن + کاربر ---------- */
async function apiLogin(email, password) {
  const r = await fetch(BASE + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  const d = await r.json()
  if (!d.token) throw new Error('login failed for ' + email + ': ' + JSON.stringify(d))
  /* گیت تغییر رمز اجباری دمو — فقط برای این تست بی‌طرف می‌شود (DB دست نمی‌خورد) */
  if (d.user) d.user.mustChangePassword = 0
  return d // { token, user }
}

/* ---------- شروع کلاس از API (مدرس) ---------- */
async function apiStart(token) {
  /* [فیکس F37-e] قطعی تست — جلسات زنده‌ی باقی‌مانده از ران‌های قبلی همه پایان می‌یابند
   * تا «تنها کلاس زنده» همان کلاس هدف باشد؛ وگرنه کلیک ردیف، کلاس دیگری را باز می‌کرد
   * و مدرس و دانش‌آموز در دو اتاق متفاوت قرار می‌گرفتند (شکست مبهم «ویدیو نیامد») */
  try {
    const list = await (await fetch(`${BASE}/api/classes`, { headers: { Authorization: `Bearer ${token}` } })).json()
    for (const c of list.classes || list || []) {
      if (c.status === 'live' && c.id !== CLASS_ID) {
        await fetch(`${BASE}/api/classes/${c.id}/end`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
      }
    }
  } catch { /* noop */ }
  const r = await fetch(`${BASE}/api/classes/${CLASS_ID}/start`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + token },
  })
  const d = await r.json()
  log('API start class', JSON.stringify(d))
  return d
}

async function main() {
  const teacherAuth = await apiLogin(TEACHER.email, TEACHER.password)
  const studentAuth = await apiLogin(STUDENT.email, STUDENT.password)
  const teacherToken = teacherAuth.token
  const studentToken = studentAuth.token
  await apiStart(teacherToken)

  const browser = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',      // اجازه خودکار دوربین/میکروفون
      '--use-fake-device-for-media-stream',  // دوربین/میکروفون فیک (الگوی متحرک + تُن صدا)
      '--auto-select-desktop-capture-source=Entire screen', // اشتراک صفحه بدون دیالوگ
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio', // خروجی اسپیکر بی‌صدا — تحلیل صدا با WebAudio انجام می‌شود
    ],
  })

  const mkCtx = ({ token, user }) => browser.newContext({ viewport: { width: 1380, height: 860 } })
    .then(async (ctx) => {
      /* پاسخ auth/me هم بی‌طرف می‌شود */
      await ctx.route('**/api/auth/me', async (route) => {
        const resp = await route.fetch()
        let j = null
        try { j = await resp.json() } catch { /* noop */ }
        if (j?.user) j.user.mustChangePassword = 0
        await route.fulfill({ response: resp, json: j })
      })
      await ctx.addInitScript(({ t, u }) => {
        try {
          localStorage.setItem('modaresyar:token', t)
          localStorage.setItem('modaresyar:v1', JSON.stringify({ user: u })) // گارد پنل به user هم نیاز دارد
        } catch {}
      }, { t: token, u: user })
      return ctx
    })

  const tCtx = await mkCtx(teacherAuth)
  const sCtx = await mkCtx(studentAuth)
  const tPage = await tCtx.newPage()
  const sPage = await sCtx.newPage()

  /* ---------- جمع‌آوری خطاهای کنسول ---------- */
  const tErrors = [], sErrors = []
  tPage.on('pageerror', (e) => tErrors.push(String(e?.message || e)))
  sPage.on('pageerror', (e) => sErrors.push(String(e?.message || e)))

  /* ---------- ردیابی آپلود تکه‌ها (سمت فرستنده/مدرس) ---------- */
  // tUploads[i] = { t, size, init } — ترتیب = ترتیب تکه‌ها (init اولین تکه است)
  const tUploads = []
  tPage.on('request', (req) => {
    if (req.url().includes('/media/up') && req.method() === 'POST') {
      tUploads.push({ t: Date.now(), size: req.postDataBuffer()?.length || 0, init: req.url().includes('init=1') })
    }
  })

  /* ---------- ردیابی تکه‌های دیده‌شده (سمت گیرنده/دانش‌آموز) ---------- */
  // firstSeen[seq] = اولین زمانی که تکه در پاسخ feeds رسید
  const firstSeen = new Map()
  sPage.on('response', async (res) => {
    if (!res.url().includes('/media/feeds')) return
    try {
      const j = await res.json()
      const t = Date.now()
      for (const c of j.teacher?.chunks || []) if (!firstSeen.has(c.seq)) firstSeen.set(c.seq, t)
    } catch { /* noop */ }
  })

  /* ================= ۱) ورود مدرس ================= */
  log('1) ورود مدرس به اتاق زنده')
  await tPage.goto(BASE + '/panel/teacher/live', { waitUntil: 'domcontentloaded' })
  await sleep(4500) // poll وضعیت زنده + لود کلاس‌های واقعی
  // دکمه ورود (کلاس زنده است) یا مسیر آماده‌سازی
  let entered = false
  try {
    /* [فیکس F37-e] کلیک فقط در «کارت همان کلاس» — قبلاً div با hasText همه‌ی
       والدها را هم می‌گرفت و اولین دکمه‌ی قرمز، کلاس دیگری را باز می‌کرد */
    const row = tPage.locator('.card', { hasText: 'پرسش و پاسخ پروژه نهایی' }).locator('button.btn-danger').first()
    await row.click({ timeout: 6000 })
    entered = true
  } catch {
    try {
      await tPage.locator('button', { hasText: 'ادامه کلاس' }).first().click({ timeout: 4000 })
      entered = true
    } catch {
      try {
        const prep = tPage.locator('button', { hasText: 'آماده‌سازی و شروع' }).first()
        await prep.click({ timeout: 4000 })
        await sleep(600)
        await tPage.locator('button.btn-primary.btn-lg').first().click({ timeout: 4000 })
        entered = true
      } catch { entered = false }
    }
  }
  ok(entered, 'ورود مدرس به اتاق')
  await tPage.waitForSelector('.live-grid', { timeout: 15000 })
  await sleep(2500) // getUserMedia فیک + شروع رکوردر و آپلود

  /* ================= ۲) آپلود تکه‌ها شروع شده؟ ================= */
  log('2) بررسی آپلود تکه‌های رسانه از سمت مدرس')
  await sleep(4000)
  const ups = tUploads.length
  const upsAfterInit = tUploads.filter((u) => !u.init).length
  const totalBytes = tUploads.reduce((a, u) => a + u.size, 0)
  /* [فیکس F37-d] تکه‌ها ۱ ثانیه‌ای‌اند (قبلاً ۰٫۵s) — آستانه نصف شد */
  ok(ups >= 4, 'تکه‌های آپلودشده ≥ ۴ (تکه‌های ۱ ثانیه‌ای)', `${ups} تکه، ${Math.round(totalBytes / 1024)}KB`)
  ok(upsAfterInit >= 3, 'تکه‌های بعد از init جریان دارد', `${upsAfterInit} تکه`)
  ok(tUploads[0]?.init, 'اولین تکه init (هدر) است')
  const badInit = tUploads.filter((u) => u.init).length - 1 // init های اضافه = ری‌ست‌های مداوم
  ok(badInit <= 2, 'ری‌ست جلسه ≤ ۲ (پایداری)', `${badInit} ری‌ست`)

  /* ================= ۳) ورود دانش‌آموز و دریافت تصویر ================= */
  log('3) ورود دانش‌آموز — باید فوراً ویدیوی مدرس را ببیند')
  await sPage.goto(`${BASE}/panel/student/live/${CLASS_ID}`, { waitUntil: 'domcontentloaded' })
  await sPage.waitForSelector('.live-grid', { timeout: 20000 })
  try {
    await sPage.waitForSelector('.live-stage video', { timeout: 12000 })
  } catch {
    /* [دیباگ F37-e] dump وضعیت دانش‌آموز هنگام شکست — به‌جای فال خام */
    const dump = await sPage.evaluate(async () => {
      let feedProbe = null
      try {
        const tk = sessionStorage.getItem('modaresyar:token:tab') || localStorage.getItem('modaresyar:token') || ''
        const r = await fetch('/api/classes/l2/media/feeds?cur=%7B%7D', { headers: { Authorization: 'Bearer ' + tk } })
        feedProbe = { status: r.status, head: JSON.stringify(await r.json()).slice(0, 220) }
      } catch (e) { feedProbe = { err: String(e) } }
      return {
        stageChildren: [...document.querySelectorAll('.live-stage > *')].map((e) => e.className).slice(0, 8),
        mediaStatus: document.querySelector('.media-status')?.textContent?.slice(0, 140) || null,
        liveLogLen: (window.__liveLog || []).length,
        liveLogHead: (window.__liveLog || []).slice(0, 14),
        feedsReqs: performance.getEntriesByType('resource').filter((x) => x.name.includes('/media/feeds')).length,
        stateReqs: performance.getEntriesByType('resource').filter((x) => x.name.includes('/state')).length,
        feedProbe,
        bodyText: document.body.innerText.slice(0, 240),
      }
    })
    console.log('   [dump دانش‌آموز]', JSON.stringify(dump, null, 1))
    throw new Error('عنصر ویدیو در صحنه ظاهر نشد')
  }
  ok(true, 'عنصر ویدیو در صحنه دانش‌آموز ظاهر شد')

  let vidState = null
  for (let i = 0; i < 15 && !vidState; i++) {
    await sleep(1000)
    const vids = await sPage.evaluate(() => [...document.querySelectorAll('.live-stage video')].map((v, i) => ({
      i, inStrip: !!v.closest('.cam-strip'), hasSrc: !!v.src, rs: v.readyState, vw: v.videoWidth,
      bufLen: v.buffered.length, bufEnd: v.buffered.length ? v.buffered.end(v.buffered.length - 1) : -1,
      cur: +v.currentTime.toFixed(2),
    })))
    const good = vids.find((v) => v.vw > 0 && v.rs >= 2)
    if (i === 3 || i === 8) console.log('   [dump]', JSON.stringify(vids))
    if (good) vidState = good
  }
  ok(!!vidState, 'فریم واقعی در حال دکود است', vidState ? `${vidState.vw}px rs=${vidState.rs} bufEnd=${vidState.bufEnd}` : 'no frames')

  // پخش جلو می‌رود؟
  const t1 = await sPage.evaluate(() => [...document.querySelectorAll('.live-stage video')].reduce((a, v) => Math.max(a, v.currentTime), 0))
  await sleep(2000)
  const t2 = await sPage.evaluate(() => [...document.querySelectorAll('.live-stage video')].reduce((a, v) => Math.max(a, v.currentTime), 0))
  ok(t2 > t1 + 1, 'پخش زنده جلو می‌رود (نه فریز)', `${t1.toFixed(2)}s → ${t2.toFixed(2)}s`)

  /* ================= ۴) صدا واقعاً می‌رسد؟ (WebAudio RMS) ================= */
  log('4) تحلیل صدا با WebAudio — RMS باید > 0.01 باشد')
  await sPage.evaluate(() => { const v = document.querySelector('.live-stage video'); if (v) v.muted = false })
  await sleep(400)
  const rms = await sPage.evaluate(async () => {
    const v = document.querySelector('.live-stage video')
    if (!v) return -1
    try {
      const AC = window.AudioContext || window.webkitAudioContext
      const ctx = new AC()
      const src = ctx.createMediaElementSource(v)
      const an = ctx.createAnalyser()
      an.fftSize = 1024
      src.connect(an)
      const buf = new Float32Array(an.fftSize)
      let peak = 0
      /* [فیکس F37-e] پنجره ۳ ثانیه‌ای — صدای فیک کروم «بوق متناوب» است
       * (بین بوق‌ها سکوت مطلق)؛ پنجره‌ی ۰٫۷ ثانیه‌ای قبلی در فاز سکوت می‌افتاد
       * و تست سالم‌ترین خط لوله صدا را هم قرمز می‌کرد */
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 100))
        an.getFloatTimeDomainData(buf)
        let s = 0
        for (let k = 0; k < buf.length; k++) s += buf[k] * buf[k]
        peak = Math.max(peak, Math.sqrt(s / buf.length))
      }
      ctx.close().catch(() => {})
      return peak
    } catch (e) { return -2 }
  })
  ok(rms > 0.01, 'صدای مدرس به دانش‌آموز می‌رسد', `RMS peak=${rms.toFixed(4)}`)

  /* ================= ۵) اندازه‌گیری تاخیر رله ================= */
  log('5) اندازه‌گیری تاخیر رله (آپلود → ظاهرشدن برای گیرنده)')
  await sleep(3000) // جمع‌آوری نمونه بیشتر
  const latencies = []
  // آپلودها: اولین init، بعدی‌ها seq=1,2,3...
  let seq = 0
  for (const u of tUploads) {
    if (u.init) continue
    seq++
    const seen = firstSeen.get(seq)
    if (seen) latencies.push(seen - u.t)
  }
  const measured = latencies.length >= 5
  if (measured) {
    const avg = Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    const min = Math.min(...latencies), max = Math.max(...latencies)
    ok(avg < 2500, 'تاخیر متوسط رله < ۲.۵ ثانیه', `avg=${avg}ms • min=${min} • max=${max} • n=${latencies.length}`)
  } else {
    ok(false, 'نمونه تاخیر کافی نیست', `matched=${latencies.length}`)
  }

  /* ================= ۶) اشتراک صفحه مدرس → دانش‌آموز ================= */
  log('6) اشتراک صفحه مدرس')
  const beforeScreen = firstSeen.size
  // دکمه چهارم کنترل‌ها = اشتراک صفحه (mic, cam, flip, screen)
  await tPage.evaluate(() => {
    const btns = [...document.querySelectorAll('.live-controls .ctl')]
    const b = btns[3]
    if (b) b.click()
  })
  await sleep(5000)
  const sLabel = await sPage.evaluate(() => document.querySelector('.live-label')?.textContent || '')
  ok(/اشتراک صفحه/.test(sLabel), 'صحنه دانش‌آموز به اشتراک صفحه مدرس سوییچ شد', sLabel.trim())
  const screenVid = await sPage.evaluate(() => {
    const v = document.querySelector('.live-stage video')
    return v ? { w: v.videoWidth, rs: v.readyState, t: v.currentTime } : null
  })
  ok(!!screenVid && screenVid.w > 0, 'ویدیوی اشتراک صفحه در حال دکود است', JSON.stringify(screenVid))

  /* ================= ۷) جریان اجازه: دست → تایید → میکروفون دانش‌آموز ================= */
  log('7) جریان اجازه — دست دانش‌آموز، تایید مدرس، روشن شدن میکروفون')
  // دست بلند کردن دانش‌آموز (دکمه ctl آخر قبل از خروج)
  await sPage.evaluate(() => {
    const btns = [...document.querySelectorAll('.live-controls .ctl')]
    const handBtn = btns.find((b) => (b.textContent || '').includes('بلند کردن دست'))
    if (handBtn) handBtn.click()
  })
  await sleep(1200)
  // تایید مدرس از API (مثل کلیک دکمه اجازه در تب حاضران)
  /* [فیکس تست] state به احراز نیاز دارد — قبلاً بدون توکن صدا زده می‌شد و «سارا پیدا نشد» */
  const parts = await (await fetch(`${BASE}/api/classes/${CLASS_ID}/state`, { headers: { Authorization: 'Bearer ' + teacherToken } })).json()
  const sara = (parts.participants || []).find((p) => p.role === 'student')
  ok(!!sara && sara.hand, 'دست دانش‌آموز برای مدرس دیده می‌شود', sara ? `${sara.name} ✋` : 'not found')
  if (sara) {
    await fetch(`${BASE}/api/classes/${CLASS_ID}/permit`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + teacherToken },
      body: JSON.stringify({ userId: sara.id, allow: true }),
    })
    await sleep(1500)
    // پنل میکروفون/دوربین باید در جای خود (صحنه دانش‌آموز) ظاهر شود
    const panel = await sPage.evaluate(() => !!document.querySelector('.speak-panel'))
    ok(panel, 'پنل میکروفون/دوربین بعد از اجازه ظاهر شد')
    // روشن کردن میکروفون توسط خود دانش‌آموز
    await sPage.evaluate(() => {
      const b = [...document.querySelectorAll('.speak-panel button')].find((x) => /میکروفون/.test(x.textContent || ''))
      if (b) b.click()
    })
    await sleep(4000)
    // استریم دانش‌آموز باید در اتاق مدرس ظاهر شود
    const stFeed = await tPage.evaluate(() => {
      const tiles = [...document.querySelectorAll('.cam-strip .cam-tile, .cam-grid .cam-tile')]
      return { tiles: tiles.length, names: tiles.map((x) => (x.querySelector('.ct-name')?.textContent || '').trim()).slice(0, 5) }
    })
    ok(stFeed.tiles >= 2, 'کادر کوچک دانش‌آموز در اتاق مدرس ظاهر شد', JSON.stringify(stFeed.names))
  }

  /* ================= ۸) سلامت کنسول ================= */
  log('8) خطاهای کنسول')
  const tErr = tErrors.filter((e) => !/ResizeObserver|favicon/i.test(e))
  const sErr = sErrors.filter((e) => !/ResizeObserver|favicon/i.test(e))
  ok(tErr.length === 0, 'صفر خطای uncaught در صفحه مدرس', tErr.slice(0, 2).join(' | '))
  ok(sErr.length === 0, 'صفر خطای uncaught در صفحه دانش‌آموز', sErr.slice(0, 2).join(' | '))

  console.log('\n========== نتیجه ==========')
  if (failures === 0) console.log('🎉 همه‌ی بررسی‌ها سبز — صدا/تصویر/اسکرین/اجازه/تاخیر کار می‌کند')
  else console.log(`⚠️ ${failures} بررسی قرمز`)
  await browser.close()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2) })
