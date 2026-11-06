// دیباگ گیرکردن پلیر MSE — سناریوی مشابه e2e-live-final + لاگ __liveLog
import { createRequire } from 'module'
const require = createRequire(import.meta.url)
const { chromium } = require('/home/z/.npm-global/lib/node_modules/playwright')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const BASE = 'http://localhost:3000'
const CLASS_ID = process.env.CLASS_ID || 'l2'

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
const tPage = await (await mk(t)).newPage()
const sPage = await (await mk(s)).newPage()

/* لاگ پاسخ‌های feeds سمت دانش‌آموز — ۱۲ پاسخ آخر */
const feedLog = []
sPage.on('response', async (res) => {
  if (!res.url().includes('/media/feeds')) return
  try {
    const j = await res.json()
    feedLog.push({
      at: Date.now() % 100000,
      t: j.teacher ? { reset: !!j.teacher.reset, sess: j.teacher.sess, seq: j.teacher.seq, n: j.teacher.chunks?.length ?? 0 } : null,
    })
    if (feedLog.length > 12) feedLog.shift()
  } catch { /* noop */ }
})

await tPage.goto(BASE + '/panel/teacher/live', { waitUntil: 'domcontentloaded' })
await sleep(4500)
try { await tPage.locator('button', { hasText: 'ادامه کلاس' }).first().click({ timeout: 4000 }) } catch { try { await tPage.locator('button', { hasText: 'آماده‌سازی و شروع' }).first().click({ timeout: 3000 }); await sleep(600); await tPage.locator('button.btn-primary.btn-lg').first().click({ timeout: 3000 }) } catch {} }
await tPage.waitForSelector('.live-grid', { timeout: 15000 })
await sleep(7000) // مدرس ~۱۱ ثانیه در کلاس است (مثل e2e قدیمی)

await sPage.goto(`${BASE}/panel/student/live/${CLASS_ID}`, { waitUntil: 'domcontentloaded' })
await sPage.waitForSelector('.live-stage video', { timeout: 20000 })
await sleep(parseInt(process.env.SOAK_MS || '24000', 10)) // [F37-e] SOAK_MS=70000 برای تست پایداری بلندمدت

const sample = () => sPage.evaluate(() => {
  const v = document.querySelector('.live-stage video')
  return v ? { rs: v.readyState, vw: v.videoWidth, cur: +v.currentTime.toFixed(2) } : null
})
const A = await sample()
await new Promise((r) => setTimeout(r, 4000))
const B = await sample()
const state = await sPage.evaluate(() => {
  const v = document.querySelector('.live-stage video')
  const b = v?.buffered
  const lg = window.__liveLog || []
  return {
    log: lg.slice(0, 400),
    total: lg.length,
    video: v ? { rs: v.readyState, vw: v.videoWidth, cur: +v.currentTime.toFixed(2), paused: v.paused,
      ranges: b ? Array.from({ length: b.length }, (_, i) => [b.start(i), b.end(i)]) : [] } : null,
  }
})
state.progress = A && B ? +(B.cur - A.cur).toFixed(2) : -1
console.log('VIDEO:', JSON.stringify(state.video), 'PROGRESS:', state.progress)
console.log('FEEDS (last 12):', JSON.stringify(feedLog))
console.log('LOG (ALL ' + state.log.length + '):')
for (const l of state.log) console.log('  ', l)
/* خطای عنصر ویدیو — MEDIA_ERR_DECODE و … */
try {
  const elErr = await sPage.evaluate(() => {
    const v = document.querySelector('.live-stage video')
    const players = window.__livePlayers || {}
    return { mediaError: v?.error ? { code: v.error.code, msg: v.error.message } : null }
  })
  console.log('VIDEO-ERROR:', JSON.stringify(elErr))
} catch { /* noop */ }
await browser.close()
