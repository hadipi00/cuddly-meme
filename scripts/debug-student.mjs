// دیباگ: ترافیک شبکه صفحه دانش‌آموز + پاسخ‌های واقعی feeds
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')
const BASE = 'http://127.0.0.1:3000'

const main = async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
  const ctx = await browser.newContext({ viewport: { width: 1360, height: 820 } })
  const p = await ctx.newPage()
  p.on('pageerror', (e) => console.log('PAGEERROR:', e.message))
  p.on('response', async (r) => {
    const u = r.url()
    if (u.includes('/media/feeds') || u.includes('/heartbeat') || u.includes('/state')) {
      let body = ''
      try { body = (await r.text()).slice(0, 220) } catch { body = '<body err>' }
      console.log(r.status(), u.replace(BASE, '').slice(0, 90), '::', body)
    }
  })

  await p.goto(BASE + '/auth', { waitUntil: 'networkidle' })
  await p.fill('input[placeholder="you@example.com"]', 'sara@demo.ir')
  await p.fill('input[type="password"]', '12345678')
  await p.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'ورود به حساب')?.click() })
  await p.waitForTimeout(1800)
  await p.goto(BASE + '/panel/student/live/l2', { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(9000)
  const dom = await p.evaluate(() => ({
    controls: !!document.querySelector('.live-controls'),
    tiles: document.querySelectorAll('.cam-tile').length,
    videos: document.querySelectorAll('video').length,
    bodySnippet: document.querySelector('.live-view')?.innerText?.slice(0, 200) || document.body.innerText.slice(0, 300),
  }))
  console.log('DOM:', JSON.stringify(dom, null, 1))
  await browser.close()
}
main().catch((e) => { console.error('CRASH', e); process.exit(1) })
