// تست چیدمان موبایل اتاق کلاس زنده — دقیقاً طبق عکس گزارش کاربر (390x844)
import { chromium } from 'playwright-core'

const EXE = '/home/z/.cache/ms-playwright/chromium-1200/chrome-linux64/chrome'
const BASE = 'http://localhost:3000'
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✓ ${name}${extra ? ' — ' + extra : ''}`) }
  else { fail++; console.log(`  ✗ FAIL: ${name} ${extra}`) }
}

const b = await chromium.launch({
  executablePath: EXE, headless: true,
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', '--disable-dev-shm-usage', '--no-sandbox'],
})

// مدرس
const ctxT = await b.newContext({ viewport: { width: 1280, height: 800 } })
const pT = await ctxT.newPage()
await pT.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' })
await pT.fill('input[type="text"], input:not([type="password"])', 'reza')
await pT.fill('input[type="password"]', '12345678')
await pT.click('button:has-text("ورود به حساب")')
await pT.waitForURL('**/panel/**', { timeout: 15000 })
await pT.goto(`${BASE}/panel/teacher/live`, { waitUntil: 'domcontentloaded' })
await pT.waitForTimeout(1200)
await pT.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.innerText.includes('آماده') && y.innerText.includes('شروع')); x.click() })
await pT.waitForTimeout(700)
await pT.evaluate(() => { const x = [...document.querySelectorAll('button')].find((y) => y.innerText.includes('شروع کلاس زنده')); if (x) x.click() })
await pT.waitForTimeout(2000)

// دانش‌آموز روی موبایل (همان ابعاد عکس کاربر)
const ctxS = await b.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
const pS = await ctxS.newPage()
await pS.goto(`${BASE}/auth`, { waitUntil: 'domcontentloaded' })
await pS.fill('input[type="text"], input:not([type="password"])', 'sara')
await pS.fill('input[type="password"]', '12345678')
await pS.click('button:has-text("ورود به حساب")')
await pS.waitForURL('**/panel/**', { timeout: 15000 })
await pS.goto(`${BASE}/panel/student/live/l2`, { waitUntil: 'domcontentloaded' })
await pS.waitForTimeout(4000)

console.log('— چیدمان موبایل (۳۹۰px) —')
const m1 = await pS.evaluate(() => {
  const grid = document.querySelector('.live-grid')
  const side = document.querySelector('.live-side')
  const bar = document.querySelector('.chat-fold-bar')
  const view = document.querySelector('.live-view')
  return {
    cls: grid?.className || '',
    sideVisible: side ? side.offsetParent !== null : false,
    sideW: side ? side.getBoundingClientRect().width : 0,
    barVisible: bar ? bar.offsetParent !== null : false,
    barText: bar?.innerText?.replace(/\n/g, ' ').slice(0, 60) || '',
    stageW: view?.getBoundingClientRect().width || 0,
    vw: window.innerWidth,
  }
})
ok('کلاس chat-fold فعال است (چت جمع)', m1.cls.includes('chat-fold'), m1.cls)
ok('پنل چت در موبایل پیش‌فرض مخفی است', !m1.sideVisible, `sideW=${m1.sideW}`)
ok('نوار بازکردن گفتگو دیده می‌شود', m1.barVisible, m1.barText)
ok('صحنه تمام عرض صفحه است', m1.stageW > m1.vw - 40, `stage=${Math.round(m1.stageW)} vw=${m1.vw}`)

console.log('— باز کردن شیت گفتگو —')
await pS.evaluate(() => { document.querySelector('.chat-fold-bar').click() })
await pS.waitForTimeout(900)
const m2 = await pS.evaluate(() => {
  const side = document.querySelector('.live-side')
  const r = side?.getBoundingClientRect()
  const closeBtn = document.querySelector('.sheet-close')
  return {
    cls: document.querySelector('.live-grid')?.className || '',
    /* توجه: برای position:fixed همان offsetParent همیشه null است — دیداری بودن با display چک می‌شود */
    visible: side ? getComputedStyle(side).display !== 'none' : false,
    fixed: side ? getComputedStyle(side).position === 'fixed' : false,
    box: r ? `x=${Math.round(r.x)} w=${Math.round(r.width)} h=${Math.round(r.height)} bottom=${Math.round(r.bottom)}` : '',
    hasClose: !!closeBtn,
    chatInput: !!document.querySelector('.chat-input input'),
  }
})
ok('چت به‌صورت شیت باز شد', m2.visible && m2.fixed, `${m2.box} cls=${m2.cls}`)
ok('دکمهٔ بستن شیت وجود دارد', m2.hasClose)
ok('ورودی پیام در دسترس است', m2.chatInput)

// ارسال پیام از شیت چت موبایل
await pS.fill('.chat-input input', 'سلام استاد از موبایل')
await pS.evaluate(() => { document.querySelector('.chat-input button')?.click() })
await pS.waitForTimeout(1500)
const sent = await pS.evaluate(() => [...document.querySelectorAll('.chat-msg')].some((x) => x.innerText.includes('سلام استاد از موبایل')))
ok('ارسال پیام از شیت موبایل کار می‌کند', sent)

console.log('— بستن شیت —')
await pS.evaluate(() => { document.querySelector('.sheet-close').click() })
await pS.waitForTimeout(600)
const m3 = await pS.evaluate(() => ({
  visible: document.querySelector('.live-side')?.offsetParent !== null,
  cls: document.querySelector('.live-grid')?.className || '',
}))
ok('شیت بسته شد و صحنه برمی‌گردد', !m3.visible && m3.cls.includes('chat-fold'))

console.log('— مدرس روی دسکتاپ: چت همیشه باز (بدون تغییر) —')
const d = await pT.evaluate(() => {
  const side = document.querySelector('.live-side')
  return { visible: side ? side.offsetParent !== null : false, cls: document.querySelector('.live-grid')?.className || '' }
})
ok('چیدمان دسکتاپ دست‌نخورده است', d.visible && !d.cls.includes('chat-fold'), d.cls)

await b.close()
console.log(`\nنتیجه: ${pass} موفق، ${fail} ناموفق`)
process.exit(fail ? 1 : 0)
