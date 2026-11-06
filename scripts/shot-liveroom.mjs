/**
 * اسکرین‌شات اتاق کلاس زنده — برای مقایسهٔ چشمی قبل/بعد تغییرات ظاهری
 * usage: node scripts/shot-liveroom.mjs /tmp/before
 * فقط خواندنی: هیچ تغییری در داده تولید نمی‌کند جز status کلاس l8 و سشن‌ها
 */
import { homedir } from 'node:os'
import { join } from 'node:path'
import fs from 'node:fs'
import { chromium } from 'playwright-core'

const OUT = process.argv[2] || '/tmp/shots'
const ROOT = join(import.meta.dirname, '..')
const EXEC = join(homedir(), '.cache/ms-playwright/chromium-1200/chrome-linux64/chrome')
const BASE = 'http://127.0.0.1:3000'
const API = 'http://127.0.0.1:4000'
const CLASS_ID = 'l2'
fs.mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

/* آماده‌سازی کلاس */
const { DatabaseSync } = await import('node:sqlite')
{
  const db = new DatabaseSync(join(ROOT, 'server/data/modaresyar.db'))
  db.prepare("UPDATE classes SET status='scheduled', started_at=NULL, ended_at=NULL WHERE id=?").run(CLASS_ID)
  db.prepare('UPDATE auth_sessions SET revoked=1').run()
}

const apiLogin = async (id, password) => {
  const res = await fetch(`${API}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id, password }),
  })
  if (!res.ok) throw new Error(`login ${id}: ${res.status}`)
  return res.json()
}

const t = await apiLogin('reza', '12345678')
const s = await apiLogin('sara', '12345678')

const browser = await chromium.launch({
  executablePath: EXEC,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--no-sandbox',
  ],
})

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

const shoot = async (page, name) => {
  await sleep(700)
  await page.screenshot({ path: join(OUT, name) })
  console.log('📸', name)
}

/* ---------- مدرس دسکتاپ ---------- */
const tctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await seed(t.token, t.refreshToken, userShape(t))(tctx)
const tp = await tctx.newPage()
await tp.goto(`${BASE}/panel/teacher/live`, { waitUntil: 'domcontentloaded' })
await tp.waitForSelector('.card', { timeout: 20000 })
/* ری‌لود بعد از ریست DB تا UI وضعیت تازه را ببیند */
await tp.reload({ waitUntil: 'domcontentloaded' })
await tp.waitForSelector('.card', { timeout: 20000 })
await sleep(1500)
const cont = tp.locator('button', { hasText: 'ادامه کلاس' }).first()
if (await cont.isVisible().catch(() => false)) {
  console.log('class already live → ادامه کلاس')
  await cont.click()
} else {
  const prep = tp.locator('button', { hasText: 'آماده‌سازی و شروع' }).first()
  await prep.click({ timeout: 15000 })
  await tp.locator('h2', { hasText: 'آماده‌سازی کلاس زنده' }).waitFor({ timeout: 15000 })
  await tp.locator('button', { hasText: 'شروع کلاس زنده' }).first().click({ timeout: 15000 })
}
await tp.waitForSelector('.live-grid', { timeout: 20000 })
await sleep(2500)

await shoot(tp, '1-teacher-normal-camera.png')

/* فول‌اسکرین — دوربین */
await tp.locator('.live-controls button', { hasText: 'نمایش تمام‌صفحه' }).first().click().catch(() => {})
await sleep(1200)
await shoot(tp, '2-teacher-fs-camera.png')

/* فول‌اسکرین — تخته */
await tp.locator('.live-controls button', { hasText: 'وایت‌برد دیجیتال' }).first().click().catch(() => {})
await sleep(1200)
await shoot(tp, '3-teacher-fs-board.png')

/* خروج از فول‌اسکرین با تختهٔ باز */
await tp.locator('.live-controls button', { hasText: 'خروج از تمام‌صفحه' }).first().click().catch(() => {})
await sleep(800)
await shoot(tp, '4-teacher-normal-board.png')

/* ---------- دانش‌آموز دسکتاپ (تختهٔ مدرس باز است) ---------- */
const sctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await seed(s.token, s.refreshToken, userShape(s))(sctx)
const sp = await sctx.newPage()
await sp.goto(`${BASE}/panel/student/live/${CLASS_ID}`, { waitUntil: 'domcontentloaded' })
await sp.waitForSelector('.live-grid', { timeout: 25000, state: 'attached' })
await sleep(2500)
await shoot(sp, '5-student-normal-board.png')

await sp.locator('.live-controls button', { hasText: 'نمایش تمام‌صفحه' }).first().click().catch(() => {})
await sleep(1200)
await shoot(sp, '6-student-fs-board.png')

/* ---------- دانش‌آموز موبایل ---------- */
const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
await seed(s.token, s.refreshToken, userShape(s))(mctx)
const mp = await mctx.newPage()
await mp.goto(`${BASE}/panel/student/live/${CLASS_ID}`, { waitUntil: 'domcontentloaded' })
await mp.waitForSelector('.live-grid', { timeout: 25000, state: 'attached' })
await sleep(2000)
await shoot(mp, '7-mobile-normal.png')

await mp.locator('.live-controls button', { hasText: 'نمایش تمام‌صفحه' }).first().click().catch(() => {})
await sleep(1200)
await shoot(mp, '8-mobile-fs.png')

await browser.close()
console.log('DONE →', OUT)
