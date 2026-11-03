// پروب سریع: صفحه‌ی دانش‌آموز — خطای JS + وضعیت feedInfo + عنصر ویدیو
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const BASE = 'http://localhost:3000'
const CLASS_ID = 'l2'

async function apiLogin(email, password) {
  const r = await fetch(BASE + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
  const d = await r.json()
  if (d.user) d.user.mustChangePassword = 0
  return d
}

const t = await apiLogin('reza@demo.ir', '12345678')
const s = await apiLogin('sara@demo.ir', '12345678')
await fetch(`${BASE}/api/classes/${CLASS_ID}/start`, { method: 'POST', headers: { Authorization: 'Bearer ' + t.token } })

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] })
const stripGate = async (route) => {
  const resp = await route.fetch()
  let j = null
  try { j = await resp.json() } catch {}
  if (j?.user) j.user.mustChangePassword = 0
  await route.fulfill({ response: resp, json: j })
}
const mk = async (a) => {
  const ctx = await browser.newContext({ viewport: { width: 1380, height: 860 } })
  await ctx.route('**/api/auth/me', stripGate)
  await ctx.addInitScript(({ t, u }) => {
    localStorage.setItem('modaresyar:token', t)
    localStorage.setItem('modaresyar:v1', JSON.stringify({ user: u }))
  }, { t: a.token, u: a.user })
  return ctx
}

/* مدرس — پیج واقعی تا فرستنده واقعی هم باشد */
const tPage = await (await mk(t)).newPage()
await tPage.goto(BASE + '/panel/teacher/live', { waitUntil: 'domcontentloaded' })
await sleep(4000)
try { await tPage.locator('button', { hasText: 'ادامه کلاس' }).first().click({ timeout: 4000 }) } catch { try { await tPage.locator('button', { hasText: 'آماده‌سازی و شروع' }).first().click({ timeout: 3000 }); await sleep(500); await tPage.locator('button.btn-primary.btn-lg').first().click({ timeout: 3000 }) } catch {} }
await tPage.waitForSelector('.live-grid', { timeout: 15000 }).catch(() => {})
await sleep(8000)

/* دانش‌آموز */
const sPage = await (await mk(s)).newPage()
sPage.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
sPage.on('console', (m) => { const x = m.text(); if (x.toLowerCase().includes('error') || x.includes('Uncaught')) console.log('CONSOLE:', x.slice(0, 200)) })
await sPage.goto(`${BASE}/panel/student/live/${CLASS_ID}`, { waitUntil: 'domcontentloaded' })
await sleep(12000)

const probe = await sPage.evaluate(() => {
  const v = document.querySelector('.live-stage video')
  const strip = document.querySelectorAll('.cam-strip video').length
  const st = document.querySelector('.media-status')?.textContent || ''
  return {
    stageVideo: !!v,
    stripVideos: strip,
    mediaStatus: st.slice(0, 150),
    liveLog: (window.__liveLog || []).slice(0, 40),
    logLen: (window.__liveLog || []).length,
  }
})
console.log('PROBE:', JSON.stringify(probe, null, 1))
await browser.close()
