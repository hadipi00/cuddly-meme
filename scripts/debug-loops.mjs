// دیباگ عمیق: کدام حلقه‌ی پولینگ می‌میرد؟
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')
const BASE = 'http://127.0.0.1:3000'
const API = 'http://127.0.0.1:4000/api'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function loginIn(page, who) {
  await page.goto(BASE + '/auth', { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="you@example.com"]', who.email)
  await page.fill('input[type="password"]', who.password)
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'ورود به حساب')?.click() })
  await page.waitForTimeout(1500)
}

const main = async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--mute-audio'] })
  const tctx = await browser.newContext()
  const sctx = await browser.newContext()
  await tctx.grantPermissions(['camera', 'microphone'], { origin: BASE })
  await sctx.grantPermissions(['camera', 'microphone'], { origin: BASE })
  const tp = await tctx.newPage()
  const sp = await sctx.newPage()
  tp.on('pageerror', (e) => console.log('[T PAGEERROR]', e.message.slice(0, 160)))
  sp.on('console', (m) => { if (m.text().includes('[MSE]')) console.log('[S]', m.text().slice(0, 140)) })
  sp.on('pageerror', (e) => console.log('[S PAGEERROR]', e.message.slice(0, 160)))


  // لاگ پاسخ feeds هر دو طرف
  let tStudentsSeen = 0
  tp.on('response', async (r) => {
    if (!r.url().includes('/media/feeds')) return
    try {
      const j = await r.json()
      if (j.students?.length) tStudentsSeen++
      if (j.students?.length) console.log('[T feeds] students:', j.students.map((s) => s.uid + ' sess' + s.sess + ' q' + s.seq).join(','))
    } catch { console.log('[T feeds] <non-json>', r.status()) }
  })
  let sLast = ''
  sp.on('request', (r) => {
    if (!r.url().includes('/media/feeds')) return
    try { const u = new URL(r.url()); console.log('[S req] cur=' + decodeURIComponent(u.searchParams.get('cur') || '').slice(0, 100)) } catch { }
  })
  sp.on('response', async (r) => {
    if (!r.url().includes('/media/feeds')) return
    try {
      const j = await r.json()
      const s = j.teacher ? `sess${j.teacher.sess} seq${j.teacher.seq} n${j.teacher.chunks.length}${j.teacher.reset ? ' RESET' : ''}` : 'teacher:null'
      if (s !== sLast) { console.log('[S feeds]', s); sLast = s }
    } catch { console.log('[S feeds] <non-json>', r.status()) }
  })
  let boardPosts = 0
  tp.on('request', (r) => { if (r.url().includes('/board') && r.method() === 'POST') boardPosts++ })
  sp.on('request', (r) => { if (r.url().includes('/board/live')) { /* noisy */ } })

  await loginIn(tp, { email: 'reza@demo.ir', password: '12345678' })
  await loginIn(sp, { email: 'sara@demo.ir', password: '12345678' })
  const stok = (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'sara@demo.ir', password: '12345678' }) })).json()).token
  const ttok = (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'reza@demo.ir', password: '12345678' }) })).json()).token
  await fetch(API + '/classes/l2/end', { method: 'POST', headers: { Authorization: 'Bearer ' + ttok } })

  await tp.goto(BASE + '/panel/teacher/live', { waitUntil: 'networkidle' })
  await tp.waitForFunction(() => document.body.textContent.includes('کارگاه React'), { timeout: 8000 })
  await tp.evaluate(() => {
    const c = [...document.querySelectorAll('.card.pad')].find((x) => x.textContent.includes('کارگاه React'))
    ;[...c.querySelectorAll('button')].find((b) => b.textContent.includes('آماده‌سازی و شروع'))?.click()
  })
  await sleep(2200)
  await tp.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.textContent.includes('شروع کلاس زنده'))?.click() })
  await tp.waitForFunction(() => !!document.querySelector('.live-controls'), { timeout: 10000 })
  console.log('>>> teacher in room')

  await sp.goto(BASE + '/panel/student/live/l2', { waitUntil: 'domcontentloaded' })
  await sp.waitForFunction(() => !!document.querySelector('.live-controls'), { timeout: 15000 })
  console.log('>>> student in room')

  // نمونه‌برداری currentTime هر ۲ ثانیه — ۱۲ ثانیه
  for (let i = 0; i < 6; i++) {
    await sleep(2000)
    const st = await sp.evaluate(() => {
      const v = [...document.querySelectorAll('.cam-tile video')].find((x) => typeof x.src === 'string' && x.src.startsWith('blob:'))
      if (!v) return 'no-blob-video'
      const b = v.buffered
      return `t=${v.currentTime.toFixed(2)} bufEnd=${b.length ? b.end(b.length - 1).toFixed(2) : '-'} ready=${v.readyState}`
    })
    console.log(`[S video ${i * 2}s]`, st)
  }

  // اجازه دادن → استریم دانش‌آموز
  await sp.evaluate(() => {
    const ctl = [...document.querySelectorAll('.live-controls .ctl')].find((x) => x.querySelector('.ctl-tip')?.textContent?.includes('بلند کردن دست'))
    ctl?.click()
  })
  await sleep(3500)
  await tp.evaluate(() => { document.querySelector('.hand-chip')?.click() })
  await sleep(700)
  await tp.evaluate(() => {
    const rows = [...document.querySelectorAll('.part-row')]
    const row = rows.find((r) => r.textContent.includes('سارا'))
    ;[...row?.querySelectorAll('button') || []].find((b) => b.textContent.includes('اجازه دادن'))?.click()
  })
  await sleep(1500)
  await sp.evaluate(() => {
    const p = document.querySelector('.speak-panel')
    if (p) [...p.querySelectorAll('button')].find((b) => b.textContent.includes('میکروفون'))?.click()
  })
  await sleep(1200)
  await sp.evaluate(() => {
    const p = document.querySelector('.speak-panel')
    if (p) [...p.querySelectorAll('button')].find((b) => b.textContent.includes('دوربین'))?.click()
  })
  await sleep(4000)
  console.log('[T] students seen in feeds so far:', tStudentsSeen)
  const tTiles = await tp.evaluate(() => [...document.querySelectorAll('.cam-tile')].map((x) => (x.querySelector('.ct-name')?.textContent || '') + (x.querySelector('video') ? ' [v]' : '')))
  console.log('[T tiles]', JSON.stringify(tTiles))

  // تخته
  await tp.evaluate(() => {
    const ctl = [...document.querySelectorAll('.live-controls .ctl')].find((x) => x.querySelector('.ctl-tip')?.textContent?.includes('وایت‌برد'))
    ctl?.click()
  })
  await sleep(1500)
  const box = await tp.locator('.wb-canvas').boundingBox()
  console.log('[T] canvas box', JSON.stringify(box))
  boardPosts = 0
  await tp.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2)
  await tp.mouse.down()
  for (let i = 1; i <= 6; i++) await tp.mouse.move(box.x + box.width * (0.2 + i * 0.05), box.y + box.height * (0.2 + i * 0.04), { steps: 2 })
  await tp.mouse.up()
  await sleep(1200)
  console.log('[T] board POSTs after draw:', boardPosts)
  await sleep(2000)
  const sPix = await sp.evaluate(() => {
    const cv = document.querySelector('.wb-wrap canvas')
    if (!cv) return 'no-canvas'
    const d = cv.getContext('2d').getImageData(Math.round(cv.width * 0.38), Math.round(cv.height * 0.38), 1, 1).data
    return `alpha=${d[3]} rgb=${d[0]},${d[1]},${d[2]}`
  })
  console.log('[S] pixel at stroke:', sPix)

  await browser.close()
}
main().catch((e) => { console.error('CRASH', e); process.exit(1) })
