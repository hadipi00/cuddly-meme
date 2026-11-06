// تست E2E اتاق کلاس زنده با رسانهٔ مجازی واقعی (fake device کرومیوم)
// دو مرورگر جدا: مدرس (reza) و دانش‌آموز (sara) — دقیقاً سناریوی کاربر
import { chromium } from 'playwright-core'
import { execSync } from 'node:child_process'

// حالت تمیز: کلاس‌ها به «زمان‌بندی شده» و سشن‌ها ابطال — تست همیشه تکرارپذیر
try { execSync('node scripts/reset-accounts.js', { cwd: new URL('..', import.meta.url).pathname, stdio: 'pipe' }) } catch { /* noop */ }

const EXE = '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'
const BASE = 'http://localhost:3000'
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ✗ FAIL: ${name} ${extra}`) }
}
const results = { teacher: [], student: [] }

const mkBrowser = () => chromium.launch({
  executablePath: EXE,
  headless: true,
  args: [
    '--use-fake-device-for-media-stream',
    '--use-fake-ui-for-media-stream',
    '--autoplay-policy=no-user-gesture-required',
    '--disable-dev-shm-usage',
    '--no-sandbox',
  ],
})

const login = async (page, id, pw) => {
  await page.goto(`${BASE}/auth`, { waitUntil: 'networkidle' })
  await page.fill('input[type="text"], input:not([type="password"])', id)
  await page.fill('input[type="password"]', pw)
  await page.click('button:has-text("ورود به حساب")')
  await page.waitForURL('**/panel/**', { timeout: 15000 })
}

// ---------- مرورگر مدرس ----------
const bT = await mkBrowser()
const ctxT = await bT.newContext({ viewport: { width: 1280, height: 800 } })
const pT = await ctxT.newPage()
pT.on('pageerror', (e) => results.teacher.push('PAGEERROR: ' + e.message))
console.log('— ورود مدرس (reza) —')
await login(pT, 'reza', '12345678')
ok('ورود مدرس به پنل', pT.url().includes('/panel/teacher'))

console.log('— شروع کلاس l2 از صفحه برگزاری —')
await pT.goto(`${BASE}/panel/teacher/live`, { waitUntil: 'networkidle' })
await pT.waitForTimeout(1200)
// کلاس کارگاه React (l2) — اولین کارت
await pT.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('آماده') && x.innerText.includes('شروع'))
  b.click()
})
await pT.waitForTimeout(800)
await pT.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('شروع کلاس زنده'))
  if (b) b.click()
})
await pT.waitForTimeout(2500)
const roomText = await pT.evaluate(() => document.body.innerText)
ok('اتاق کلاس باز شد', roomText.includes('پخش زنده'), roomText.includes('ReferenceError') ? 'CRASH!' : '')

// دوربین مجازی — خودکار با useEffect گرفته می‌شود (fake device)
await pT.waitForTimeout(6000) // چند تکه ۱ ثانیه‌ای ارسال شود
const chipT = await pT.evaluate(() => document.querySelector('.media-status')?.innerText || '')
console.log('  چیپ وضعیت مدرس:', JSON.stringify(chipT.slice(0, 80)))
ok('مدرس در حال ارسال صدا/تصویر', chipT.includes('در حال ارسال'), chipT.slice(0, 60))

// ---------- مرورگر دانش‌آموز ----------
const bS = await mkBrowser()
const ctxS = await bS.newContext({ viewport: { width: 1280, height: 800 } })
const pS = await ctxS.newPage()
pS.on('pageerror', (e) => results.student.push('PAGEERROR: ' + e.message))
console.log('— ورود دانش‌آموز (sara) —')
await login(pS, 'sara', '12345678')
ok('ورود دانش‌آموز به پنل', pS.url().includes('/panel/student'))

await pS.goto(`${BASE}/panel/student/live/l2`, { waitUntil: 'domcontentloaded' })
await pS.waitForTimeout(3500) // poll وضعیت + heartbeat
const stText = await pS.evaluate(() => document.body.innerText)
ok('دانش‌آموز اتاق زنده را می‌بیند (روی زمان‌بندی نمی‌ماند)', stText.includes('پخش زنده'), stText.includes('زمان‌بندی') && !stText.includes('پخش زنده') ? 'STUCK AT SCHEDULE' : '')

// دانش‌آموز دست بلند می‌کند (درخواست اجازه)
await pS.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('سوال دارم') || x.innerText.includes('بلند کردن دست'))
  if (b) b.click()
})
await pS.waitForTimeout(1500)

// مدرس از تب حاضران اجازه می‌دهد
console.log('— مدرس اجازه صدا/تصویر به سارا می‌دهد —')
await pT.evaluate(() => {
  const tb = [...document.querySelectorAll('.tab-btn')].find((x) => x.innerText.includes('حاضران'))
  if (tb) tb.click()
})
await pT.waitForTimeout(1500)
const perm = await pT.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('اجازه دادن'))
  if (b) { b.click(); return 'granted' }
  return document.body.innerText.includes('اجازه داده شده') ? 'already' : 'no-row'
})
ok('مدرس اجازه داد', perm !== 'no-row', perm)
await pT.waitForTimeout(1500)

// دانش‌آموز میکروفون و دوربین را روشن می‌کند
console.log('— دانش‌آموز میکروفون/دوربین را روشن می‌کند —')
await pS.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('روشن کردن میکروفون'))
  if (b) b.click()
})
await pS.waitForTimeout(1200)
await pS.evaluate(() => {
  const b = [...document.querySelectorAll('button')].find((x) => x.innerText.includes('روشن کردن دوربین'))
  if (b) b.click()
})
await pS.waitForTimeout(5000) // چند تکه آپلود شود

// ---------- بررسی رله دوطرفه ----------
console.log('— بررسی رله رسانه دوطرفه —')
// از دید سرور (توکن دانش‌آموز): فید مدرس باید زنده باشد
const feedsFromStudent = await pS.evaluate(async () => {
  const tok = sessionStorage.getItem('modaresyar:token:tab') || localStorage.getItem('modaresyar:token')
  const r = await fetch('/api/classes/l2/media/feeds?cur=%7B%7D', { headers: { Authorization: 'Bearer ' + tok } })
  return r.json()
})
ok('فید دوربین مدرس روی سرور زنده است', !!feedsFromStudent.teacher, `sess=${feedsFromStudent.teacher?.sess} seq=${feedsFromStudent.teacher?.seq} chunks=${feedsFromStudent.teacher?.chunks?.length}`)
ok('تکه‌های واقعی ضبط می‌شوند', (feedsFromStudent.teacher?.chunks?.length || 0) > 0 && (feedsFromStudent.teacher?.init?.length || 0) > 100, `init=${feedsFromStudent.teacher?.init?.length}B`)

// از دید مدرس: فید دانش‌آموز باید بیاید
const feedsFromTeacher = await pT.evaluate(async () => {
  const tok = sessionStorage.getItem('modaresyar:token:tab') || localStorage.getItem('modaresyar:token')
  const r = await fetch('/api/classes/l2/media/feeds?cur=%7B%7D', { headers: { Authorization: 'Bearer ' + tok } })
  return r.json()
})
ok('فید دانش‌آموز به سرور رسیده', (feedsFromTeacher.students?.length || 0) > 0, JSON.stringify(feedsFromTeacher.students?.map((s) => s.name)))
const s0 = feedsFromTeacher.students?.[0]
ok('فید دانش‌آموز تکهٔ واقعی دارد', (s0?.chunks?.length || 0) > 0 && (s0?.init?.length || 0) > 100)

// تایل دانش‌آموز در DOM مدرس باید رندر شود (کام-گرید یا نوار پایین)
await pT.waitForTimeout(2500)
const tilesT = await pT.evaluate(() => ({
  grid: document.querySelectorAll('.cam-grid .cam-tile').length,
  strip: document.querySelectorAll('.cam-strip .cam-tile').length,
  names: [...document.querySelectorAll('.ct-name')].map((x) => x.innerText).join(','),
}))
ok('تایل ویدیوی دانش‌آموز در پنل مدرس رندر شده', tilesT.grid + tilesT.strip > 1, `grid=${tilesT.grid} strip=${tilesT.strip} names=[${tilesT.names}]`)

// تایل مدرس در DOM دانش‌آموز
await pS.waitForTimeout(2500)
const tilesS = await pS.evaluate(() => ({
  grid: document.querySelectorAll('.cam-grid .cam-tile').length,
  strip: document.querySelectorAll('.cam-strip .cam-tile').length,
  names: [...document.querySelectorAll('.ct-name')].map((x) => x.innerText).join(','),
}))
ok('تایل ویدیوی مدرس در پنل دانش‌آموز رندر شده', tilesS.grid + tilesS.strip >= 1, `grid=${tilesS.grid} strip=${tilesS.strip} names=[${tilesS.names}]`)

// صدای مدرس: عنصر ویدیو باید unmuted شود (autoplay policy غیرفعال شده)
const audioS = await pS.evaluate(() => [...document.querySelectorAll('video')].map((v) => ({ muted: v.muted, playing: !v.paused, t: v.currentTime })))
ok('پخش تصویر در جریان است (currentTime پیش می‌رود)', audioS.some((v) => v.playing && v.t > 0), JSON.stringify(audioS.slice(0, 3)))

console.log('\n— خلاصهٔ پایداری ارسال (۱۰ ثانیهٔ دیگر) —')
await pT.waitForTimeout(10000)
const chipT2 = await pT.evaluate(() => document.querySelector('.media-status')?.innerText || '')
const feeds2 = await pS.evaluate(async () => {
  const tok = sessionStorage.getItem('modaresyar:token:tab') || localStorage.getItem('modaresyar:token')
  const r = await fetch('/api/classes/l2/media/feeds?cur=%7B%7D', { headers: { Authorization: 'Bearer ' + tok } })
  return r.json()
})
ok('ارسال مدرس بعد از ۱۰ ثانیه هم پایدار', chipT2.includes('در حال ارسال') || chipT2.includes('مکث'), chipT2.slice(0, 60))
ok('سشن فید مدرس ری‌استارت بی‌دلیل نکرده', feeds2.teacher?.sess === feedsFromStudent.teacher?.sess, `sess ${feedsFromStudent.teacher?.sess} → ${feeds2.teacher?.sess}`)

const errs = [...results.teacher, ...results.student].filter((e) => !e.includes('favicon'))
ok('هیچ خطای صفحه‌ای رخ نداد', errs.length === 0, errs.slice(0, 2).join(' | '))

await bT.close()
await bS.close()
console.log(`\nنتیجه نهایی: ${pass} موفق، ${fail} ناموفق`)
process.exit(fail ? 1 : 0)
