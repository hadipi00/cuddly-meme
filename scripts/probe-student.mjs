/** تشخیص: چرا دانش‌آموز فید مدرس را نمی‌گیرد؟ */
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

const backend = spawn('node', ['server/index.js'], { cwd: ROOT, env: { ...process.env, PORT: '4000' } })
const vite = spawn('npx', ['vite', '--port', '3000', '--strictPort'], { cwd: ROOT })
await waitHttp(`${API}/api/classes`); await waitHttp(BASE); await sleep(500)

const login = await (await fetch(`${API}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: 'sara', password: '12345678' }) })).json()
console.log('login ok:', !!login.token, 'user:', JSON.stringify(login.user))

const browser = await chromium.launch({ executablePath: EXEC, headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--no-sandbox'] })
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } })
await ctx.addInitScript(([tk, rf]) => {
  localStorage.setItem('modaresyar:token', tk)
  localStorage.setItem('modaresyar:refresh', rf)
  sessionStorage.setItem('modaresyar:token:tab', tk)
}, [login.token, login.refreshToken])
const p = await ctx.newPage()
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('[console]', m.type(), m.text().slice(0, 200)) })
p.on('request', (r) => { const u = r.url(); if (u.includes('/media/feeds') || u.includes('/classes/l8/state') || u.includes('/events')) console.log('[req]', r.method(), u.replace(BASE, '').slice(0, 110)) })
p.on('requestfailed', (r) => console.log('[fail]', r.url().replace(BASE, '').slice(0, 110), r.failure()?.errorText))

await p.goto(`${BASE}/panel/student/live/l8`, { waitUntil: 'domcontentloaded' })
await sleep(6000)

const probe = await p.evaluate(async () => {
  const tk = sessionStorage.getItem('modaresyar:token:tab') || localStorage.getItem('modaresyar:token')
  const me = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${tk}` } }).then((r) => r.json()).catch((e) => ({ err: String(e) }))
  const feeds = await fetch('/api/classes/l8/media/feeds?cur=' + encodeURIComponent('{}'), { headers: { Authorization: `Bearer ${tk}` } }).then((r) => r.json()).catch((e) => ({ err: String(e) }))
  return {
    lsToken: !!tk,
    meUser: me?.user ? { id: me.user.id, role: me.user.role } : me,
    teacherFeed: feeds.teacher ? { sess: feeds.teacher.sess, seq: feeds.teacher.seq, chunks: feeds.teacher.chunks?.length, fmt: feeds.teacher.fmt, reset: feeds.teacher.reset } : null,
    feedKeys: Object.keys(feeds),
    gridHtml: document.querySelector('.live-grid') ? document.querySelector('.live-grid').className : null,
    stageText: document.querySelector('.live-label')?.textContent || null,
    chip: document.querySelector('.media-chip')?.textContent?.slice(0, 90) || null,
    videos: [...document.querySelectorAll('video')].map((v) => ({ rs: v.readyState, t: v.currentTime })),
  }
})
console.log('PROBE:', JSON.stringify(probe, null, 2))
await p.screenshot({ path: '/tmp/student-probe.png' })

await browser.close(); backend.kill(); vite.kill(); process.exit(0)
