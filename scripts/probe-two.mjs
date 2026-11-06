/** تشخیص کامل: مدرس + دانش‌آموز هم‌زمان — چرا فید به دانش‌آموز نمی‌رسد؟ */
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
  if (path.includes('teacher')) {
    p.on('response', async (r) => { if (r.url().includes('/media/up') && r.status() >= 400) console.log('[up!]', r.status(), r.url().slice(-70), (await r.text().catch(() => '')).slice(0, 80)) })
    p.on('requestfailed', (r) => { if (r.url().includes('/media/up')) console.log('[up-fail]', r.failure()?.errorText, r.url().slice(-60)) })
  }
  await p.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' })
  await sleep(2500)
  return p
}

const tp = await mkPage(teacher, '/panel/teacher/live')
const cont = tp.locator('button', { hasText: 'ادامه کلاس' }).first()
if (await cont.count() && await cont.isVisible().catch(() => false)) await cont.click()
else { await tp.locator('button', { hasText: 'آماده‌سازی و شروع' }).first().click(); await sleep(1000); await tp.locator('button', { hasText: 'شروع کلاس زنده' }).first().click() }
await tp.waitForSelector('.live-grid', { timeout: 20000 })
console.log('teacher room up')

const sp = await mkPage(student, '/panel/student/live/l8')
console.log('student room up')

for (let i = 0; i < 8; i++) {
  await sleep(3000)
  const t = await tp.evaluate(() => ({
    chip: document.querySelector('.media-chip')?.textContent?.slice(0, 100) || null,
    tracks: [...(window.__tTracks || [])],
  }))
  const s = await sp.evaluate(async () => {
    const tk = sessionStorage.getItem('modaresyar:token:tab')
    const feeds = await fetch('/api/classes/l8/media/feeds?cur=' + encodeURIComponent('{}'), { headers: { Authorization: `Bearer ${tk}` } }).then((r) => r.json()).catch(() => null)
    return {
      teacherSess: feeds?.teacher ? { sess: feeds.teacher.sess, seq: feeds.teacher.seq, n: feeds.teacher.chunks?.length } : null,
      vids: [...document.querySelectorAll('video')].map((v) => ({ rs: v.readyState, t: +v.currentTime.toFixed(1), bl: v.buffered.length })),
      feeds: window.__feeds, logTail: (window.__liveLog || []).slice(-14),
    }
  })
  console.log("t="+(i*3+6)+"s TEACHER:", t.chip, "| STUDENT:", JSON.stringify({v:s.vids, f:s.feeds, lg:s.logTail}))
}

await browser.close(); backend.kill(); vite.kill(); process.exit(0)
