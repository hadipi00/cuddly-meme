// دیباگ: صفحه مدرس چه می‌بیند؟
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
  p.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE:', m.text().slice(0, 200)) })
  await p.goto(BASE + '/auth', { waitUntil: 'domcontentloaded' })
  const r = await fetch('http://127.0.0.1:4000/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'reza@demo.ir', password: '12345678' }) })
  const d = await r.json()
  await p.evaluate((tok) => { localStorage.setItem('modaresyar:token', tok); sessionStorage.setItem('modaresyar:token:tab', tok) }, d.token)
  await p.goto(BASE + '/panel/teacher/live', { waitUntil: 'networkidle' })
  await p.waitForTimeout(2500)
  console.log('URL:', p.url())
  const txt = await p.evaluate(() => document.body.innerText.slice(0, 800))
  console.log('--- BODY ---')
  console.log(txt)
  const btns = await p.evaluate(() => [...document.querySelectorAll('button')].map((b) => b.textContent.trim().slice(0, 40)))
  console.log('--- BUTTONS ---', JSON.stringify(btns))
  await p.screenshot({ path: '/tmp/debug-teacher.png' })
  await browser.close()
}
main().catch((e) => { console.error('CRASH', e); process.exit(1) })
