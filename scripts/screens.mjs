// اسکرین‌شات اتاق کلاس در موبایل (جمع) و با شیت باز + دسکتاپ مدرس
import { chromium } from 'playwright-core'
import { execSync } from 'node:child_process'

try { execSync('node scripts/reset-accounts.js', { cwd: new URL('..', import.meta.url).pathname, stdio: 'pipe' }) } catch { /* noop */ }
const EXE = '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'
const BASE = 'http://localhost:3000'

const b = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage', '--no-sandbox'],
})

// مدرس + شروع کلاس + ارسال رسانه
const ctxT = await b.newContext({ viewport: { width: 1280, height: 800 } })
const pT = await ctxT.newPage()
await pT.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' })
await pT.fill('input[type="text"], input:not([type="password"])', 'reza')
await pT.fill('input[type="password"]', '12345678')
await pT.click('button:has-text("ورود به حساب")')
await pT.waitForURL('**/panel/**', { timeout: 15000 })
await pT.goto(`${BASE}/panel/teacher/live`, { waitUntil: 'domcontentloaded' })
await pT.waitForTimeout(1100)
await pT.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.innerText.includes('آماده') && y.innerText.includes('شروع')); x.click() })
await pT.waitForTimeout(700)
await pT.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.innerText.includes('شروع کلاس زنده')); if (x) x.click() })
await pT.waitForTimeout(3500)
await pT.screenshot({ path: '/tmp/render/teacher-desktop.png' })

// دانش‌آموز موبایل ۳۹۰px
const ctxS = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const pS = await ctxS.newPage()
await pS.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' })
await pS.fill('input[type="text"], input:not([type="password"])', 'sara')
await pS.fill('input[type="password"]', '12345678')
await pS.click('button:has-text("ورود به حساب")')
await pS.waitForURL('**/panel/**', { timeout: 15000 })
await pS.goto(`${BASE}/panel/student/live/l2`, { waitUntil: 'domcontentloaded' })
await pS.waitForTimeout(4500)
await pS.screenshot({ path: '/tmp/render/student-mobile-folded.png' })
await pS.evaluate(() => document.querySelector('.chat-fold-bar')?.click())
await pS.waitForTimeout(1000)
await pS.screenshot({ path: '/tmp/render/student-mobile-sheet.png' })

await b.close()
console.log('screenshots saved')
