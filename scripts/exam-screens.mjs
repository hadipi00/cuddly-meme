// اسکرین‌شات صفحات کلیدی آزمون‌ساز برای بازبینی بصری
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire(import.meta.url)
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')
const BASE = 'http://127.0.0.1:3000'
const API = 'http://127.0.0.1:4000/api'
const OUT = '/home/z/my-project/download/exam-shots'
mkdirSync(OUT, { recursive: true })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function loginIn(page, who) {
  await page.goto(BASE + '/auth', { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="you@example.com"]', who.email)
  await page.fill('input[type="password"]', who.password)
  await page.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'ورود به حساب')?.click() })
  await page.waitForTimeout(1500)
}

const main = async () => {
  const browser = await chromium.launch({ headless: true })

  /* --- معلم: سازنده --- */
  const tctx = await browser.newContext({ viewport: { width: 1360, height: 850 } })
  const tp = await tctx.newPage()
  await loginIn(tp, { email: 'reza@demo.ir', password: '12345678' })
  await tp.goto(BASE + '/panel/teacher/exams', { waitUntil: 'networkidle' })
  await sleep(700)
  await tp.screenshot({ path: OUT + '/1-teacher-list.png', fullPage: false })
  // آخرین آزمون طراحی‌شده E2E را باز کن
  await tp.evaluate(() => {
    const cards = [...document.querySelectorAll('.card.pad')]
    const c = cards.find((x) => x.textContent.includes('آزمون E2E فیزیک'))
    ;[...(c?.querySelectorAll('button') || [])].find((b) => b.textContent.includes('ویرایش'))?.click()
  })
  await sleep(1200)
  await tp.screenshot({ path: OUT + '/2-teacher-builder.png', fullPage: false })
  // تب تنظیمات امنیتی
  await tp.evaluate(() => { [...document.querySelectorAll('.tab')].find((b) => b.textContent.includes('تنظیمات و امنیت'))?.click() })
  await sleep(600)
  await tp.screenshot({ path: OUT + '/3-teacher-security.png', fullPage: false })
  // تحلیل
  await tp.goto(BASE + '/panel/teacher/exams', { waitUntil: 'networkidle' })
  await tp.evaluate(() => {
    const cards = [...document.querySelectorAll('.card.pad')]
    const c = cards.find((x) => x.textContent.includes('آزمون E2E فیزیک'))
    ;[...(c?.querySelectorAll('button') || [])].find((b) => b.textContent.includes('تحلیل'))?.click()
  })
  await sleep(1300)
  await tp.screenshot({ path: OUT + '/4-teacher-analysis.png', fullPage: false })
  await tctx.close()

  /* --- دانش‌آموز: صفحه آزمون PDF (برگه + پاسخبرگ) --- */
  const sctx = await browser.newContext({ viewport: { width: 1360, height: 850 } })
  const sp = await sctx.newPage()
  await loginIn(sp, { email: 'yalda@demo.ir', password: '12345678' })
  // آزمون PDF هنوز توسط yalda داده نشده — شروع کن
  await sp.goto(BASE + '/panel/student/exams', { waitUntil: 'networkidle' })
  await sp.evaluate(() => {
    const cards = [...document.querySelectorAll('.card.pad')]
    const c = cards.find((x) => x.textContent.includes('آزمون E2E برگه PDF'))
    ;[...(c?.querySelectorAll('button') || [])].find((b) => b.textContent.includes('شروع آزمون'))?.click()
  })
  await sleep(1800)
  await sp.screenshot({ path: OUT + '/5-student-pdf-page.png', fullPage: false })
  await sp.evaluate(() => { [...document.querySelectorAll('.exm-switchbtn')].find((b) => b.textContent.includes('پاسخبرگ'))?.click() })
  await sleep(700)
  await sp.screenshot({ path: OUT + '/6-student-answer-sheet.png', fullPage: false })
  await sctx.close()

  /* --- کارنامه سارا --- */
  const rctx = await browser.newContext({ viewport: { width: 1360, height: 900 } })
  const rp = await rctx.newPage()
  await loginIn(rp, { email: 'sara@demo.ir', password: '12345678' })
  await rp.goto(BASE + '/panel/student/exams', { waitUntil: 'networkidle' })
  await rp.evaluate(() => {
    const cards = [...document.querySelectorAll('.card.pad')]
    const c = cards.find((x) => x.textContent.includes('آزمون E2E فیزیک'))
    ;[...(c?.querySelectorAll('button') || [])].find((b) => b.textContent.includes('کارنامه'))?.click()
  })
  await sleep(1500)
  await rp.screenshot({ path: OUT + '/7-student-report.png', fullPage: true })
  await rctx.close()

  /* --- موبایل: اجرای آزمون --- */
  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const mp = await mctx.newPage()
  await loginIn(mp, { email: 'sara@demo.ir', password: '12345678' })
  await mp.goto(BASE + '/panel/student/exams', { waitUntil: 'networkidle' })
  await sleep(800)
  await mp.screenshot({ path: OUT + '/8-mobile-exams-list.png' })
  await mctx.close()

  await browser.close()
  console.log('screenshots saved to', OUT)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
