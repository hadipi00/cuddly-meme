// چک سریع موبایل ۳۹۰px — اتاق زنده دانش‌آموز و مدرس (سرریز افقی؟)
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')
const BASE = 'http://127.0.0.1:3000'

const main = async () => {
  const browser = await chromium.launch({ headless: true, args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
  for (const [role, email, path, label] of [
    ['student', 'sara@demo.ir', '/panel/student/live/l2', 'دانش‌آموز'],
    ['teacher', 'reza@demo.ir', '/panel/teacher/live', 'مدرس (لیست)'],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
    await ctx.grantPermissions(['camera', 'microphone'], { origin: BASE })
    const p = await ctx.newPage()
    await p.goto(BASE + '/auth', { waitUntil: 'networkidle' })
    await p.fill('input[placeholder="you@example.com"]', email)
    await p.fill('input[type="password"]', '12345678')
    await p.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'ورود به حساب')?.click() })
    await p.waitForTimeout(1500)
    await p.goto(BASE + path, { waitUntil: 'domcontentloaded' })
    await p.waitForTimeout(2500)
    const r = await p.evaluate(() => ({
      sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth,
    }))
    console.log(`${label}: scrollWidth=${r.sw} clientWidth=${r.cw} ${r.sw <= r.cw + 1 ? '✓ بدون سرریز' : '✗ سرریز!'}`)
    await p.screenshot({ path: `/tmp/mob-live-${role}.png` })
    await ctx.close()
  }
  await browser.close()
}
main().catch((e) => { console.error('CRASH', e); process.exit(1) })
