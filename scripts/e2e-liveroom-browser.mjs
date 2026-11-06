/**
 * E2E مرورگر واقعی — اتاق کلاس زنده با دستگاه رسانهٔ جعلی کروم
 * ------------------------------------------------------------------
 * سناریو:
 *   ۱) مدرس وارد اتاق می‌شود (دوربین/میکروفون جعلی کروم) → رله آپلود شروع می‌شود
 *   ۲) دانش‌آموز وارد می‌شود → ویدیوی مدرس واقعاً «دکود» می‌شود (readyState≥2، currentTime جلو می‌رود)
 *   ۳) [رگرسیون باگ اصلی] مدرس وایت‌برد را باز می‌کند → کاشی ویدیو از صحنه به نوار
 *      می‌رود (عنصر نو + reset سرور) → پخش باید «ادامه» یابد، نه سیاه شود
 *   ۴) فول‌اسکرین → چت باید «کلاً» غیب شود
 *   ۵) موبایل → خارج از فول‌اسکرین چت جمع است (نوار)، در فول‌اسکرین مطلقاً نیست
 *   ۶) پایان کلاس → تایید داخل اتاق دیده می‌شود و کلاس واقعاً تمام می‌شود
 *
 * اجرا: node scripts/e2e-liveroom-browser.mjs
 */
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import fs from 'node:fs'
import http from 'node:http'
import { chromium } from 'playwright-core'

const ROOT = join(import.meta.dirname, '..')
const EXEC = join(homedir(), '.cache/ms-playwright/chromium-1200/chrome-linux64/chrome')
const BASE = 'http://127.0.0.1:3000'
const API = 'http://127.0.0.1:4000'
const CLASS_ID = 'l8'

const results = []
const step = (name, ok, extra = '') => {
  results.push({ name, ok })
  console.log(`${ok ? '✅' : '❌'} ${name}${extra ? ' — ' + extra : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const waitHttp = (url, tries = 80) => new Promise((resolve) => {
  const t0 = Date.now()
  const tick = (n) => {
    http.get(url, (r) => { r.resume(); resolve(true) })
      .on('error', () => {
        if (n <= 0 || Date.now() - t0 > 60000) return resolve(false)
        setTimeout(() => tick(n - 1), 500)
      })
  }
  tick(tries)
})

const apiLogin = async (id, password) => {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, password }),
  })
  if (!res.ok) throw new Error(`login ${id}: ${res.status}`)
  return res.json()
}

/* پاک‌سازی وضعیت کلاس و نشست‌های قبلی — خنثی‌سازی اثر اجرای قبلی تست */
const { DatabaseSync } = await import('node:sqlite')
{
  const db = new DatabaseSync(join(ROOT, 'server/data/modaresyar.db'))
  db.prepare("UPDATE classes SET status='scheduled', started_at=NULL, ended_at=NULL WHERE id=?").run(CLASS_ID)
  try { db.prepare('DELETE FROM sessions').run() } catch { /* noop */ }
  db.close()
}

/* ---------------- ۱) راه‌اندازی سرورها ---------------- */
console.log('— شروع بک‌اند…')
const backend = spawn('node', ['server/index.js'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PORT: '4000' } })
backend.stdout.on('data', (d) => { if (String(d).includes('ERROR')) console.log('[be]', String(d).trim().slice(0, 160)) })
backend.stderr.on('data', (d) => console.log('[be!]', String(d).trim().slice(0, 200)))
if (!(await waitHttp(`${API}/api/classes`))) { console.error('بک‌اند بالا نیامد'); process.exit(1) }

console.log('— شروع vite dev…')
const vite = spawn('npx', ['vite', '--port', '3000', '--strictPort'], { cwd: ROOT, stdio: ['ignore', 'pipe', 'pipe'] })
if (!(await waitHttp(BASE))) { console.error('vite بالا نیامد'); backend.kill(); process.exit(1) }
await sleep(800)

let browser
try {
  /* ---------------- ۲) ورودها ---------------- */
  const t = await apiLogin('reza', '12345678')
  const s = await apiLogin('sara', '12345678')
  if (!t.token || !s.token) throw new Error('توکن ورود نگرفتیم')
  console.log('— ورود API موفق (مدرس + دانش‌آموز)')

  browser = await chromium.launch({
    executablePath: EXEC,
    headless: true,
    args: [
      '--use-fake-device-for-media-stream',
      '--use-fake-ui-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
      '--no-sandbox',
    ],
  })
  console.log('— کروم جعلی آماده')

  const seed = (tok, ref, user) => async (ctx) => {
    await ctx.addInitScript(([tk, rf, u]) => {
      try {
        localStorage.setItem('modaresyar:token', tk)
        localStorage.setItem('modaresyar:refresh', rf)
        localStorage.setItem('modaresyar:user', JSON.stringify(u))
        sessionStorage.setItem('modaresyar:token:tab', tk)
      } catch { /* noop */ }
    }, [tok, ref, user])
  }
  const userShape = (r) => r.user
  const teacherSeed = seed(t.token, t.refreshToken, userShape(t))
  const studentSeed = seed(s.token, s.refreshToken, userShape(s))

  /* ---------------- ۳) مدرس وارد اتاق ---------------- */
  const tctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await teacherSeed(tctx)
  const tp = await tctx.newPage()
  tp.on('pageerror', (e) => console.log('[t-pageerror]', String(e).slice(0, 160)))
  tp.on('response', (r) => { const u = r.url(); if (u.includes('/start') || u.includes('/end')) console.log('[t-net]', r.status(), u.replace('', '')) })
  await tp.goto(`${BASE}/panel/teacher/live`, { waitUntil: 'domcontentloaded' })
  await tp.waitForSelector('.card', { timeout: 20000 })

  /* کلاس l8 «زنده» است → دکمهٔ «ادامه کلاس»؛ اگر نمایش زنده نیامده بود → مسیر آماده‌سازی */
  const cont = tp.locator('button', { hasText: 'ادامه کلاس' }).first()
  if (await cont.count() && await cont.isVisible().catch(() => false)) {
    await cont.click()
  } else {
    await tp.locator('button', { hasText: 'آماده‌سازی و شروع' }).first().click()
    await sleep(1200)
    await tp.locator('button', { hasText: 'شروع کلاس زنده' }).first().click()
  }
  await tp.waitForSelector('.live-grid', { timeout: 20000 })
  step('مدرس وارد اتاق کلاس شد', true)

  /* دوربین جعلی کروم → آپلود باید شروع شود (media-chip ok) */
  let sending = false
  try {
    await tp.waitForSelector('.media-chip.ok', { timeout: 18000 })
    sending = true
  } catch { /* noop */ }
  step('مدرس در حال ارسال صدا/تصویر (fake cam → رله)', sending, await tp.locator('.media-chip').first().textContent().catch(() => ''))

  /* ---------------- ۴) دانش‌آموز وارد می‌شود و پخش دکود می‌شود ---------------- */
  const sctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await studentSeed(sctx)
  const sp = await sctx.newPage()
  sp.on('pageerror', (e) => console.log('[s-pageerror]', String(e).slice(0, 160)))
  await sp.goto(`${BASE}/panel/student/live/${CLASS_ID}`, { waitUntil: 'domcontentloaded' })
  await sp.waitForSelector('.live-grid', { timeout: 25000 })

  const decodeState = () => sp.evaluate(() => {
    const vids = [...document.querySelectorAll('video')]
    return vids.map((v) => ({ rs: v.readyState, t: +v.currentTime.toFixed(2), bl: v.buffered.length, cls: v.closest('.cam-tile')?.className || '' }))
  })
  const waitForDecode = async (selFn, timeoutMs) => {
    const t0 = Date.now()
    while (Date.now() - t0 < timeoutMs) {
      const st = await decodeState()
      if (st.some((v) => v.rs >= 2 && v.bl > 0 && v.t > 0)) return st
      await sleep(700)
    }
    return null
  }
  const st1 = await waitForDecode(decodeState, 30000)
  if (!st1) {
    const diag = await sp.evaluate(async () => ({
      chip: document.querySelector('.media-chip')?.textContent?.slice(0, 80) || null,
      stage: document.querySelector('.live-label')?.textContent || null,
      feeds: await fetch('/api/classes/' + location.pathname.split('/').pop() + '/media/feeds?cur=' + encodeURIComponent('{}'), { headers: { Authorization: 'Bearer ' + (sessionStorage.getItem('modaresyar:token:tab') || localStorage.getItem('modaresyar:token')) } }).then((r) => r.json()).then((j) => ({ t: j.teacher ? { sess: j.teacher.sess, seq: j.teacher.seq, n: j.teacher.chunks?.length, reset: j.teacher.reset } : null })).catch((e) => ({ err: String(e) })),
      log: (window.__liveLog || []).slice(-10),
      url: location.pathname,
    }))
    console.log('   [diag student]', JSON.stringify(diag))
    await sp.screenshot({ path: '/tmp/e2e-student-fail.png' }).catch(() => {})
  }
  step('ویدیوی مدرس روی دستگاه دانش‌آموز دکود شد', !!st1, st1 ? JSON.stringify(st1) : 'هیچ ویدیویی دکود نشد')

  /* صدا: پس از autoplay-no-gesture، صدا هم باید فعال شود (muted=false تلاش می‌شود) */

  /* ---------------- ۵) [رگرسیون باگ اصلی] باز کردن وایت‌برد ---------------- */
  const boardBtn = tp.locator('.live-controls button', { hasText: 'وایت‌برد دیجیتال' }).first()
  await boardBtn.click()
  await sleep(400)
  const boardOpenTeacher = await tp.locator('.wb-wrap').count()
  step('تخته روی دستگاه مدرس باز شد', boardOpenTeacher > 0)

  /* دانش‌آموز: صحنه → تخته؛ ویدیوی مدرس به نوار پایین می‌رود و باید به پخش ادامه دهد */
  let stripAlive = null
  try { await sp.waitForSelector('.wb-wrap', { timeout: 12000 }) } catch { /* noop */ }
  const wbStudent = await sp.locator('.wb-wrap').count()
  step('تخته برای دانش‌آموز همگام شد', wbStudent > 0)

  {
    /* حالا ویدیوی مدرس باید در cam-strip باشد و «همچنان در حال دکود» */
    const t0 = Date.now()
    while (Date.now() - t0 < 15000) {
      const st = await decodeState()
      const stripVid = st.find((v) => v.cls.includes('cam-tile') && v.rs >= 2 && v.bl > 0)
      if (stripVid) { stripAlive = stripVid; break }
      await sleep(600)
    }
    if (!stripAlive) {
      const dg = await sp.evaluate(async () => ({
        vids: document.querySelectorAll('video').length,
        chip: document.querySelector('.media-chip')?.textContent?.slice(0, 90) || null,
        strip: !!document.querySelector('.cam-strip'),
        feedKeys: Object.keys(window.__feeds || {}),
        log: (window.__liveLog || []).slice(-12),
      }))
      const dt = await tp.evaluate(() => ({ chip: document.querySelector('.media-chip')?.textContent?.slice(0, 90) || null }))
      console.log('   [diag strip]', JSON.stringify(dg), '| TEACHER:', JSON.stringify(dt))
    }
    step('ویدیوی مدرس بعد از جابه‌جایی صحنه→نوار دکود شد', !!stripAlive, stripAlive ? JSON.stringify(stripAlive) : 'سیاه/مرده')
  }
  {
    /* پیشرفت واقعی پخش — currentTime باید جلو برود (نه سیاه ابدی) */
    const a = await decodeState()
    await sleep(4000)
    const b = await decodeState()
    const prog = b.some((v, i) => a[i] && v.t > a[i].t + 0.3 && v.rs >= 2)
    step('پخش بعد از باز کردن تخته ادامه دارد (currentTime جلو می‌رود)', prog, `${JSON.stringify(a.slice(0,2))} → ${JSON.stringify(b.slice(0,2))}`)
  }

  /* ---------------- ۵ب) مسیر بالاروندهٔ دانش‌آموز → مدرس ---------------- */
  {
    /* دست بلند کردن دانش‌آموز */
    await sp.locator('.live-controls button', { hasText: 'بلند کردن دست' }).first().click()
    /* مدرس: تب حاضران → دکمهٔ اجازه دادن */
    await tp.locator('.tab-btn', { hasText: 'حاضران' }).first().click()
    let granted = false
    try {
      await tp.locator('button', { hasText: 'اجازه دادن' }).first().waitFor({ state: 'visible', timeout: 12000 })
      await tp.locator('button', { hasText: 'اجازه دادن' }).first().click()
      granted = true
    } catch { /* noop */ }
    step('مدرس اجازهٔ صدا/تصویر دانش‌آموز را داد (دست بلند کردن → تایید)', granted)
    /* دانش‌آموز: پنل میکروفون/دوربین فعال می‌شود */
    let micOn = false, camOn = false
    try {
      await sp.locator('button', { hasText: 'روشن کردن میکروفون' }).first().waitFor({ state: 'visible', timeout: 10000 })
      await sp.locator('button', { hasText: 'روشن کردن میکروفون' }).first().click()
      micOn = true
    } catch { /* noop */ }
    try {
      await sp.locator('button', { hasText: 'روشن کردن دوربین' }).first().click({ timeout: 8000 })
      camOn = true
    } catch { /* noop */ }
    step('دانش‌آموز میکروفون و دوربین خود را روشن کرد', micOn && camOn, 'mic=' + micOn + ' cam=' + camOn)
    /* مدرس: ویدیوی دانش‌آموز باید دکود شود */
    const t0 = Date.now()
    let studentVid = null
    while (Date.now() - t0 < 25000) {
      studentVid = await tp.evaluate(() => {
        const tiles = [...document.querySelectorAll('.cam-tile')]
        for (const el of tiles) {
          if (!el.textContent.includes('سارا')) continue
          const v = el.querySelector('video')
          if (v && v.readyState >= 2 && v.buffered.length > 0 && v.currentTime > 0) return { rs: v.readyState, t: +v.currentTime.toFixed(1) }
        }
        return null
      })
      if (studentVid) break
      await sleep(800)
    }
    step('ویدیوی دانش‌آموز روی دستگاه مدرس دکود شد (بالارونده دوطرفه)', !!studentVid, studentVid ? JSON.stringify(studentVid) : 'فید دانش‌آموز به مدرس نرسید')
  }

  /* ---------------- ۶) فول‌اسکرین — چت باید کلاً غیب شود ---------------- */
  await tp.locator('.live-controls button', { hasText: 'نمایش تمام‌صفحه' }).first().click().catch(() => {})
  await sleep(1200)
  const fsState = await tp.evaluate(() => ({
    fsEl: !!(document.fullscreenElement || document.webkitFullscreenElement),
    pseudo: !!document.querySelector('.live-grid.pseudo-fs'),
    sideDisplay: (() => { const el = document.querySelector('.live-grid .live-side'); return el ? getComputedStyle(el).display : 'no-el' })(),
    foldBar: (() => { const el = document.querySelector('.chat-fold-bar'); return el ? getComputedStyle(el).display : 'no-el' })(),
  }))
  const fsOn = fsState.fsEl || fsState.pseudo
  step('فول‌اسکرین فعال شد (واقعی یا شبه)', fsOn, JSON.stringify(fsState))
  step('چت در فول‌اسکرین کلاً غیب است', fsOn && fsState.sideDisplay === 'none' && (fsState.foldBar === 'no-el' || fsState.foldBar === 'none'), JSON.stringify(fsState))

  /* خروج از فول‌اسکرین برای ادامهٔ تست */
  await tp.locator('.live-controls button', { hasText: 'خروج از تمام‌صفحه' }).first().click().catch(() => {})
  await sleep(800)

  /* ---------------- ۷) موبایل — چت فقط بیرون فول‌اسکرین ---------------- */
  const sctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' })
  await studentSeed(sctx2)
  const mp = await sctx2.newPage()
  await mp.goto(`${BASE}/panel/student/live/${CLASS_ID}`, { waitUntil: 'domcontentloaded' })
  await mp.waitForSelector('.live-grid', { timeout: 25000 }).catch(() => {})
  await sleep(1500)
  const mob = await mp.evaluate(() => ({
    grid: !!document.querySelector('.live-grid'),
    foldable: document.querySelector('.live-grid')?.className.includes('foldable') || false,
    foldBarVisible: (() => { const el = document.querySelector('.chat-fold-bar'); return el ? getComputedStyle(el).display !== 'none' : false })(),
    sideHidden: (() => { const el = document.querySelector('.live-grid .live-side'); return el ? getComputedStyle(el).display === 'none' : true })(),
    screenShareBtn: [...document.querySelectorAll('.live-controls button')].some((b) => b.textContent.includes('اشتراک صفحه')),
  }))
  step('موبایل: چت جمع است (نوار گفتگو + پنل مخفی)', mob.grid && mob.foldable && mob.foldBarVisible && mob.sideHidden, JSON.stringify(mob))
  step('موبایل: دکمهٔ اشتراک صفحه حذف شده (پشتیبانی نمی‌شود)', !mob.screenShareBtn)
  await sctx2.close()

  /* ---------------- ۸) پایان کلاس — تایید داخل اتاق ---------------- */
  await tp.locator('.live-controls button', { hasText: 'پایان کلاس' }).first().click()
  await sleep(300)
  const confirmVisible = await tp.locator('.room-confirm').isVisible().catch(() => false)
  step('کارت تایید پایان کلاس داخل اتاق دیده می‌شود', confirmVisible)
  await tp.locator('button', { hasText: 'ثبت و پایان' }).first().click()
  let endedShown = false
  try { await tp.waitForSelector('text=به پایان رسید', { timeout: 10000 }); endedShown = true } catch { /* noop */ }
  step('صفحهٔ پایان کلاس نشان داده شد', endedShown)

  /* دانش‌آموز هم باید پایان را ببیند (poll وضعیت/SSE) */
  let studentEnded = false
  try { await sp.waitForSelector('text=به پایان رسید', { timeout: 15000 }); studentEnded = true } catch { /* noop */ }
  step('دانش‌آموز هم صفحهٔ پایان را دید', studentEnded)
} catch (e) {
  console.error('❌ خطای غیرمنتظره:', e?.message || e)
  results.push({ name: 'بدون خطای غیرمنتظره', ok: false })
} finally {
  try { await browser?.close() } catch { /* noop */ }
  backend.kill(); vite.kill()
}

const fails = results.filter((r) => !r.ok).length
console.log(`\n=== نتیجه: ${results.length - fails}/${results.length} موفق ===`)
process.exit(fails ? 1 : 0)
