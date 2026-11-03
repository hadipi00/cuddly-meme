// رپلیکای مسیر e2e-live-final با dump وضعیت دانش‌آموز هنگام شکست
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

const teacherAuth = await apiLogin('reza@demo.ir', '12345678')
const studentAuth = await apiLogin('sara@demo.ir', '12345678')
await fetch(`${BASE}/api/classes/${CLASS_ID}/start`, { method: 'POST', headers: { Authorization: 'Bearer ' + teacherAuth.token } })

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--mute-audio'] })
const mkCtx = async ({ token, user }) => {
  const ctx = await browser.newContext({ viewport: { width: 1380, height: 860 } })
  await ctx.route('**/api/auth/me', async (route) => {
    const resp = await route.fetch()
    let j = null
    try { j = await resp.json() } catch {}
    if (j?.user) j.user.mustChangePassword = 0
    await route.fulfill({ response: resp, json: j })
  })
  await ctx.addInitScript(({ t, u }) => {
    localStorage.setItem('modaresyar:token', t)
    localStorage.setItem('modaresyar:v1', JSON.stringify({ user: u }))
  }, { t: token, u: user })
  return ctx
}
const tCtx = await mkCtx(teacherAuth)
const sCtx = await mkCtx(studentAuth)
const tPage = await tCtx.newPage()
const sPage = await sCtx.newPage()

/* همان trackerهای e2e-live-final — مشکوک اصلی */
const tUploads = []
tPage.on('request', (req) => {
  if (req.url().includes('/media/up') && req.method() === 'POST') {
    tUploads.push({ t: Date.now(), size: req.postDataBuffer()?.length || 0, init: req.url().includes('init=1') })
  }
})
const firstSeen = new Map()
sPage.on('response', async (res) => {
  if (!res.url().includes('/media/feeds')) return
  try {
    const j = await res.json()
    const t = Date.now()
    for (const c of j.teacher?.chunks || []) if (!firstSeen.has(c.seq)) firstSeen.set(c.seq, t)
  } catch { /* noop */ }
})

/* مدرس — همان مسیر e2e */
await tPage.goto(BASE + '/panel/teacher/live', { waitUntil: 'domcontentloaded' })
await sleep(4500)
let entered = false
try {
  const row = tPage.locator('div', { hasText: 'پرسش و پاسخ پروژه نهایی' }).locator('button.btn-danger').first()
  await row.click({ timeout: 6000 })
  entered = true
} catch {
  try { await tPage.locator('button', { hasText: 'ادامه کلاس' }).first().click({ timeout: 4000 }); entered = true } catch { entered = false }
}
console.log('teacher entered:', entered)
await tPage.waitForSelector('.live-grid', { timeout: 15000 })
await sleep(6500)

/* دانش‌آموز — همان مسیر */
await sPage.goto(`${BASE}/panel/student/live/${CLASS_ID}`, { waitUntil: 'domcontentloaded' })
await sPage.waitForSelector('.live-grid', { timeout: 20000 })
console.log('student live-grid OK, waiting for stage video…')

let seen = false
for (let i = 0; i < 12; i++) {
  await sleep(1000)
  const okV = await sPage.evaluate(() => !!document.querySelector('.live-stage video'))
  if (okV) { console.log(`stage video appeared after ${i + 1}s`); seen = true; break }
}
if (!seen) {
  const dump = await sPage.evaluate(() => ({
    url: location.href,
    liveStageHtmlLen: document.querySelector('.live-stage')?.innerHTML.length || 0,
    stageClasses: [...document.querySelectorAll('.live-stage > *')].map((e) => e.className).slice(0, 8),
    mediaStatus: document.querySelector('.media-status')?.textContent?.slice(0, 120) || null,
    liveLogLen: (window.__liveLog || []).length,
    liveLogHead: (window.__liveLog || []).slice(0, 12),
    bodySnippet: document.body.innerText.slice(0, 300),
  }))
  console.log('DUMP:', JSON.stringify(dump, null, 1))
}
await browser.close()
