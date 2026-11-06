/** بازتولید قطعی سناریوی «ورود خیلی زود» + ضبط پیوستهٔ داخل صفحه */
import { spawn } from 'node:child_process'
import { homedir } from 'node:os'
import { join } from 'node:path'
import http from 'node:http'
import { chromium } from 'playwright-core'

const ROOT = join(import.meta.dirname, '..')
const EXEC = join(homedir(), '.cache/ms-playwright/chromium-1200/chrome-linux64/chrome')
const BASE = 'http://127.0.0.1:3000'
const API = 'http://127.0.0.1:4000'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const waitHttp = (url) => new Promise((resolve) => {
  const tick = (n) => http.get(url, (r) => { r.resume(); resolve(true) }).on('error', () => n > 0 ? setTimeout(() => tick(n - 1), 400) : resolve(false))
  tick(100)
})
const login = async (id) => (await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, password: '12345678' }) })).json())

const backend = spawn('node', ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: '4000' } })
const vite = spawn('npx', ['vite', '--port', '3000', '--strictPort'], { cwd: ROOT })
await waitHttp(`${API}/api/classes`); await waitHttp(BASE); await sleep(500)

const teacher = await login('reza'); const student = await login('sara')
const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'] })

const mkPage = async (l, path) => {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
  await ctx.addInitScript(([tk, rf]) => {
    localStorage.setItem('modaresyar:token', tk); localStorage.setItem('modaresyar:refresh', rf)
    sessionStorage.setItem('modaresyar:token:tab', tk)
  }, [l.token, l.refreshToken])
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 140)))
  await p.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
  await sleep(2200)
  return p
}

/* حلقهٔ ضبط داخل صفحهٔ دانش‌آموز — هر ۷۰۰ms یک رکورد */
const armRecorder = async (p) => {
  await p.evaluate(() => {
    window.__rec = []
    window.__recT = setInterval(() => {
      const f = window.__feeds || {}
      const vs = [...document.querySelectorAll('video')].map((v) => ({ rs: v.readyState, t: +v.currentTime.toFixed(1) }))
      window.__rec.push({ at: Date.now() % 1000000, f, v: vs })
      if (window.__rec.length > 400) window.__rec.shift()
    }, 700)
  })
}

const tp = await mkPage(teacher, '/panel/teacher/live')
const cont = tp.locator('button', { hasText: 'ادامه کلاس' }).first()
if (await cont.count() && await cont.isVisible().catch(() => false)) await cont.click()
else { await tp.locator('button', { hasText: 'آماده‌سازی و شروع' }).first().click(); await sleep(900); await tp.locator('button', { hasText: 'شروع کلاس زنده' }).first().click() }
await tp.waitForSelector('.live-grid', { timeout: 20000 })
console.log('teacher room up — دانش‌آموز بعد از ۱٫۵ ثانیه وارد می‌شود (سناریوی ورود خیلی زود)')

await sleep(12000) // شبیه تایمینگ E2E — ۱ تا ۲ تکه روی سرور
const sp = await mkPage(student, '/panel/student/live/l8')
await armRecorder(sp)
console.log('student room up — ۲۰ ثانیه ضبط…')

for (let i = 0; i < 6; i++) {
  await sleep(5000)
  const s = await sp.evaluate(() => ({
    v: [...document.querySelectorAll('video')].map((v) => ({ rs: v.readyState, t: +v.currentTime.toFixed(1), bl: v.buffered.length })),
    lg: (window.__liveLog || []).slice(-8),
  }))
  console.log(`t=${i * 5 + 5}s`, JSON.stringify(s))
}

const rec = await sp.evaluate(() => { clearInterval(window.__recT); return window.__rec })
/* فشرده‌سازی رکورد برای نمایش */
const compact = rec.map((r) => {
  const k = Object.entries(r.f || {}).map(([pid, x]) => `${pid}:${x.mode[0]} upd=${x.upd ? 1 : 0} q=${x.q} end=${x.end} cur=${x.cur} rs=${x.rs}`).join(' | ')
  return `${r.at} v=[${r.v.map((x) => `rs${x.rs}/t${x.t}`).join(',')}] ${k}`
})
console.log('--- REC TIMELINE ---')
console.log(compact.join('\n'))
const lg = await sp.evaluate(() => (window.__liveLog || []).filter((x) => !x.startsWith('applyFeed')).slice(-60))
console.log('--- PLAYER LOG (بدون applyFeed) ---')
console.log(lg.join('\n'))

await browser.close(); backend.kill(); vite.kill(); process.exit(0)
