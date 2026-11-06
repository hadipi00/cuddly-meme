// =====================================================================
// تست E2E نسخه ۳ کلاس زنده — تمرکز روی دو باگ گزارش کاربر:
//   ۱) اشتراک صفحه برای دانش‌آموز «دیده نمی‌شود» (ویدیو پشت آواتار مخفی است)
//   ۲) تعویض دوربین — نباید «تغییر قلابی» بزند (همان دوربین دوباره باز شود
//      و بگوید عوض شد)؛ اگر دوربین دیگری نیست باید صادقانه بگوید
// اجرا:  node scripts/e2e-live-v3.mjs   (سرور API روی 4000 + vite روی 3000)
// =====================================================================
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright')

const BASE = process.env.BASE || 'http://localhost:3000'
const CLASS_ID = process.env.CLASS_ID || 'l2'
const TEACHER = { email: 'reza@demo.ir', password: '12345678' }
const STUDENT = { email: 'sara@demo.ir', password: '12345678' }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const log = (s, m = '') => console.log(`▸ ${s}${m ? ' — ' + m : ''}`)
let failures = 0
const ok = (cond, label, extra = '') => {
  if (cond) console.log(`  ✅ ${label}${extra ? ' — ' + extra : ''}`)
  else { failures++; console.log(`  ❌ ${label}${extra ? ' — ' + extra : ''}`) }
}

async function apiLogin(email, password) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const d = await r.json()
  if (!d.token) throw new Error('login failed: ' + JSON.stringify(d))
  /* گیت تغییر رمز اجباری دمو — برای تست بی‌طرف می‌شود (DB دست نمی‌خورد) */
  if (d.user) d.user.mustChangePassword = 0
  return d
}

async function main() {
  const teacherAuth = await apiLogin(TEACHER.email, TEACHER.password)
  const studentAuth = await apiLogin(STUDENT.email, STUDENT.password)
  await fetch(`${BASE}/api/classes/${CLASS_ID}/start`, { method: 'POST', headers: { Authorization: 'Bearer ' + teacherAuth.token } })

  const browser = await chromium.launch({
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--auto-select-desktop-capture-source=Entire screen',
      '--autoplay-policy=no-user-gesture-required',
      '--mute-audio',
    ],
  })

  /* هر پاسخ auth/me هم بی‌طرف می‌شود */
  const stripGate = async (route) => {
    const resp = await route.fetch()
    let j = null
    try { j = await resp.json() } catch { /* noop */ }
    if (j?.user) j.user.mustChangePassword = 0
    await route.fulfill({ response: resp, json: j })
  }

  const mkCtx = async ({ token, user }) => {
    const ctx = await browser.newContext({ viewport: { width: 1380, height: 860 } })
    await ctx.route('**/api/auth/me', stripGate)
    await ctx.addInitScript(({ t, u }) => {
      try {
        localStorage.setItem('modaresyar:token', t)
        localStorage.setItem('modaresyar:v1', JSON.stringify({ user: u }))
      } catch {}
    }, { t: token, u: user })
    return ctx
  }

  const tCtx = await mkCtx(teacherAuth)
  const sCtx = await mkCtx(studentAuth)
  const tPage = await tCtx.newPage()
  const sPage = await sCtx.newPage()
  const tErrors = [], sErrors = []
  tPage.on('pageerror', (e) => tErrors.push(String(e?.message || e)))
  sPage.on('pageerror', (e) => sErrors.push(String(e?.message || e)))

  let tUploads = 0, tInitUploads = 0
  tPage.on('request', (req) => {
    if (req.url().includes('/media/up') && req.method() === 'POST') {
      tUploads++
      if (req.url().includes('init=1')) tInitUploads++
    }
  })

  /** وضعیت همه ویدیوهای صحنه دانش‌آموز: دکود + «دیده‌شدن واقعی» */
  const stageVideos = (page) => page.evaluate(() => {
    return [...document.querySelectorAll('.live-stage video')].map((v) => {
      const tile = v.closest('.cam-tile')
      const overlay = tile ? tile.querySelector('.cam-off-ov') : null
      const st = getComputedStyle(v)
      return {
        inStrip: !!v.closest('.cam-strip'),
        vw: v.videoWidth, rs: v.readyState, cur: +v.currentTime.toFixed(2),
        visibility: st.visibility, display: st.display,
        hidden: st.visibility === 'hidden' || st.display === 'none',
        avatarOverlay: !!overlay,
        name: tile ? (tile.querySelector('.ct-name')?.textContent || '').trim() : '',
      }
    })
  })

  /* ================= ۱) ورود مدرس ================= */
  log('1) ورود مدرس به اتاق زنده')
  await tPage.goto(BASE + '/panel/teacher/live', { waitUntil: 'domcontentloaded' })
  await sleep(4000)
  let entered = false
  try {
    await tPage.locator('button', { hasText: 'ادامه کلاس' }).first().click({ timeout: 5000 })
    entered = true
  } catch {
    try {
      await tPage.locator('button', { hasText: 'آماده‌سازی و شروع' }).first().click({ timeout: 3000 })
      await sleep(800)
      await tPage.locator('button.btn-primary.btn-lg').first().click({ timeout: 3000 })
      entered = true
    } catch { /* noop */ }
  }
  ok(entered, 'ورود مدرس به اتاق')
  await tPage.waitForSelector('.live-grid', { timeout: 15000 })
  await sleep(3000)

  /* ================= ۲) آپلود رسانه ================= */
  log('2) آپلود تکه‌های رسانه از مدرس')
  await sleep(3000)
  /* [فیکس F37-d] تکه‌ها ۱ ثانیه‌ای‌اند (قبلاً ۰٫۵s) — آستانه نصف شد */
  ok(tUploads >= 4, 'تکه‌های آپلودی ≥ ۴ (تکه‌های ۱ ثانیه‌ای)', `${tUploads} تکه`)
  ok(tInitUploads >= 1, 'init (هدر) ارسال شد', `${tInitUploads} init`)

  /* ================= ۳) دانش‌آموز: ویدیوی مدرس دکود و «دیده‌شده» ================= */
  log('3) ورود دانش‌آموز — ویدیوی مدرس باید واقعاً «دیده شود»')
  await sPage.goto(`${BASE}/panel/student/live/${CLASS_ID}`, { waitUntil: 'domcontentloaded' })
  await sPage.waitForSelector('.live-grid', { timeout: 20000 })
  let camState = null
  for (let i = 0; i < 15 && !camState; i++) {
    await sleep(1000)
    const vids = await stageVideos(sPage)
    camState = vids.find((v) => !v.inStrip && v.vw > 0 && v.rs >= 2)
  }
  ok(!!camState, 'ویدیوی مدرس در صحنه دانش‌آموز دکود می‌شود', camState ? `${camState.vw}px` : 'no frames')
  ok(!camState?.hidden && !camState?.avatarOverlay, 'ویدیوی مدرس «پیدا و بدون پوشش» است', JSON.stringify(camState))

  /* ================= ۴) اشتراک صفحه → دانش‌آموز باید «ببیند» ================= */
  log('4) اشتراک صفحه مدرس — نمایش به دانش‌آموز')
  await tPage.evaluate(() => {
    const btns = [...document.querySelectorAll('.live-controls .ctl')]
    const b = btns.find((x) => (x.getAttribute('aria-pressed') != null) && (x.querySelector('.ctl-tip')?.textContent || '').includes('اشتراک صفحه'))
    if (b) b.click()
  })
  await sleep(6000)
  const sLabel = await sPage.evaluate(() => document.querySelector('.live-label')?.textContent || '')
  ok(/اشتراک صفحه/.test(sLabel), 'صحنه دانش‌آموز به اشتراک صفحه سوییچ شد', sLabel.trim())
  let scrState = null
  for (let i = 0; i < 10 && !scrState; i++) {
    await sleep(1000)
    const vids = await stageVideos(sPage)
    scrState = vids.find((v) => !v.inStrip && v.vw > 0 && v.rs >= 2)
  }
  ok(!!scrState, 'ویدیوی اشتراک صفحه در حال دکود است', JSON.stringify(scrState))
  ok(!scrState?.hidden, 'ویدیوی اشتراک صفحه «مخفی نیست» (visibility)', scrState ? `visibility=${scrState.visibility}` : '—')
  ok(!scrState?.avatarOverlay, 'ویدیوی اشتراک صفحه زیر «آواتار پوشاننده» دفن نیست', scrState ? `overlay=${scrState.avatarOverlay}` : '—')

  /* ================= ۵) تعویض دوربین — بدون تغییر قلابی ================= */
  log('5) تعویض دوربین (تک‌دوربین فیک → باید پیام صادقانه بدهد و استریم ننشند)')
  const upsBefore = tUploads
  await tPage.evaluate(() => {
    const btns = [...document.querySelectorAll('.live-controls .ctl')]
    const b = btns.find((x) => (x.querySelector('.ctl-tip')?.textContent || '').includes('تعویض دوربین'))
    if (b) b.click()
  })
  await sleep(3000)
  const toasts = await tPage.evaluate(() => [...document.querySelectorAll('.toast')].map((x) => x.textContent?.trim()))
  const fakeSwap = toasts.some((t) => t.includes('دوربین عوض شد') || t.includes('دوربین عقب فعال شد') || t.includes('دوربین جلو فعال شد'))
  const honest = toasts.some((t) => t.includes('پیدا نشد'))
  ok(!fakeSwap, 'تغییر قلابی رخ نداد (همان دوربین دوباره باز نشده و «عوض شد» نگفته)', JSON.stringify(toasts))
  ok(honest, 'پیام صادقانه «دوربین دیگری پیدا نشد» نمایش داده شد', JSON.stringify(toasts))
  const upsAfterFlip = tUploads - upsBefore
  ok(upsAfterFlip < 14, 'بعد از فلپ، ری‌ست/بازسازی انبوه رخ نداد', `تکه‌های ۳ثانیه بعد: ${upsAfterFlip}`)

  /* ================= ۶) سلامت کنسول ================= */
  log('6) خطاهای کنسول')
  const tErr = tErrors.filter((e) => !/ResizeObserver|favicon/i.test(e))
  const sErr = sErrors.filter((e) => !/ResizeObserver|favicon/i.test(e))
  ok(tErr.length === 0, 'صفر خطای uncaught در صفحه مدرس', tErr.slice(0, 2).join(' | '))
  ok(sErr.length === 0, 'صفر خطای uncaught در صفحه دانش‌آموز', sErr.slice(0, 2).join(' | '))

  console.log('\n========== نتیجه ==========')
  if (failures === 0) console.log('🎉 همه بررسی‌ها سبز — اشتراک صفحه برای دانش‌آموز دیده می‌شود و تعویض دوربین صادقانه است')
  else console.log(`⚠️ ${failures} بررسی قرمز`)
  await browser.close()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((e) => { console.error('FATAL:', e); process.exit(2) })
