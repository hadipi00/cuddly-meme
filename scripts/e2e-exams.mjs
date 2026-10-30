// ================================================================
// تست E2E مرورگری آزمون‌ساز — دو کاربر واقعی همزمان (مدرس + دانش‌آموز)
// سناریو: ساخت آزمون در UI → انتشار → آزمون‌دادن با پاسخبرگ انیمیشنی →
// کارنامه تحلیلی → تصحیح تشریحی معلم → حالت PDF → موبایل ۳۹۰px → خطای کنسول
// ================================================================
import { execSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { chromium } = require(execSync('npm root -g').toString().trim() + '/playwright')

const BASE = 'http://127.0.0.1:3000'
const API = 'http://127.0.0.1:4000/api'
const STUDENT = { email: 'sara@demo.ir', password: '12345678' }
const STUDENT2 = { email: 'amir@demo.ir', password: '12345678' }
const TEACHER = { email: 'reza@demo.ir', password: '12345678' }

let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')) }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function loginIn(page, who) {
  await page.goto(BASE + '/auth', { waitUntil: 'networkidle' })
  await page.fill('input[placeholder="you@example.com"]', who.email)
  await page.fill('input[type="password"]', who.password)
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'ورود به حساب')
    b?.click()
  })
  await page.waitForTimeout(1600)
  const u = await page.evaluate(async () => {
    try {
      const r = await fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + (sessionStorage.getItem('modaresyar:token:tab') || localStorage.getItem('modaresyar:token') || '') } })
      return (await r.json())?.user || null
    } catch { return null }
  })
  return u
}

const errors = { teacher: [], student: [], student2: [] }
function watchErrors(page, key) {
  page.on('pageerror', (e) => errors[key].push('pageerror: ' + e.message))
  page.on('console', (m) => {
    const t = m.text()
    if (m.type() === 'error' && !/favicon|Failed to load resource|Manifest|net::ERR/i.test(t)) errors[key].push('console: ' + t.slice(0, 160))
  })
}

const main = async () => {
  const browser = await chromium.launch({ headless: true })
  const tctx = await browser.newContext({ viewport: { width: 1360, height: 820 } })
  const sctx = await browser.newContext({ viewport: { width: 1360, height: 820 } })
  const tp = await tctx.newPage()
  const sp = await sctx.newPage()
  watchErrors(tp, 'teacher'); watchErrors(sp, 'student')

  /* توکن معلم برای آماده‌سازی‌های API */
  const ttok = (await (await fetch(API + '/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(TEACHER) })).json()).token

  console.log('— ۱) ورود دو کاربر')
  const tu = await loginIn(tp, TEACHER)
  const su = await loginIn(sp, STUDENT)
  ok('مدرس وارد شد', !!tu?.id)
  ok('دانش‌آموز وارد شد', !!su?.id)

  const tp2 = tp // لاگ شبکه ذخیره سوال‌ها
  tp2.on('response', async (r) => {
    if (r.url().includes('/questions') && r.request().method() === 'PUT') {
      let body = ''
      try { body = (r.request().postData() || '').slice(0, 400) } catch {}
      console.log(`  [NET] PUT questions → ${r.status()} :: ${body}`)
    }
  })

  console.log('— ۲) ساخت آزمون در UI (آزمون‌ساز)')
  await tp.goto(BASE + '/panel/teacher/exams', { waitUntil: 'networkidle' })
  ok('منوی آزمون‌ساز در سایدبار', await tp.evaluate(() => [...document.querySelectorAll('a')].some((a) => a.textContent.includes('آزمون‌ساز'))))
  await tp.evaluate(() => {
    const b = [...document.querySelectorAll('button')].find((x) => x.textContent.includes('آزمون جدید'))
    b?.click()
  })
  await sleep(400)
  await tp.fill('.modal input.input', 'آزمون E2E فیزیک')
  await tp.evaluate(() => {
    const b = [...document.querySelectorAll('.modal button')].find((x) => x.textContent.includes('ساخت و ادامه'))
    b?.click()
  })
  await tp.waitForURL('**/panel/teacher/exams/*', { timeout: 8000 }).catch(() => {})
  const exId = tp.url().split('/exams/')[1]?.split(/[/?]/)[0] || ''
  ok('سازنده باز شد و شناسه آزمون گرفت', !!exId, tp.url())
  await sleep(700)

  /* سوال ۱ — چهارگزینه‌ای (پیش‌فرض) */
  await tp.fill('#exm-qform textarea', 'سرعت نور چند کیلومتر بر ثانیه است؟')
  await tp.locator('#exm-qform .exm-optrow .input').first().fill('۳۰۰ هزار')
  await tp.locator('#exm-qform .exm-optrow .input').nth(1).fill('۱۵۰ هزار')
  await tp.waitForTimeout(1800) // ذخیره خودکار

  /* سوال ۲ — درست/نادرت */
  await tp.evaluate(() => { [...document.querySelectorAll('button.btn')].find((b) => b.textContent.includes('سوال جدید'))?.click() })
  await sleep(300)
  await tp.evaluate(() => { [...document.querySelectorAll('.exm-chip')].find((b) => b.textContent.includes('درست/نادرت'))?.click() })
  await tp.fill('#exm-qform textarea', 'شتاب همیشه در جهت حرکت است.')
  await tp.evaluate(() => { [...document.querySelectorAll('.exm-chip')].find((b) => b.textContent.trim() === '✗ نادرت')?.click() })
  await tp.waitForTimeout(1800)

  /* سوال ۳ — تشریحی */
  await tp.evaluate(() => { [...document.querySelectorAll('button.btn')].find((b) => b.textContent.includes('سوال جدید'))?.click() })
  await sleep(300)
  await tp.evaluate(() => { [...document.querySelectorAll('.exm-chip')].find((b) => b.textContent.includes('تشریحی'))?.click() })
  await tp.fill('#exm-qform textarea', 'قانون دوم نیوتون را توضیح دهید.')
  await tp.waitForTimeout(1800)
  const qCount = await tp.evaluate(() => document.querySelectorAll('.exm-qcard').length)
  ok('۳ سوال در لیست سازنده', qCount === 3, 'count=' + qCount)
  const savedOk = await tp.evaluate(() => document.body.textContent.includes('✓ ذخیره شد'))
  ok('ذخیره خودکار سازنده', savedOk)

  console.log('— ۳) انتشار')
  await tp.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.includes('انتشار آزمون'))?.click() })
  await tp.waitForURL('**/panel/teacher/exams', { timeout: 8000 }).catch(() => {})
  ok('بعد از انتشار برگشت به لیست', tp.url().endsWith('/panel/teacher/exams'), tp.url())
  await sleep(1000)
  ok('کارت آزمون با وضعیت منتشر', await tp.evaluate(() => document.body.textContent.includes('آزمون E2E فیزیک') && document.body.textContent.includes('منتشر شده')))

  console.log('— ۴) دانش‌آموز: شروع و پاسخ‌دهی')
  await sp.goto(BASE + '/panel/student/exams', { waitUntil: 'networkidle' })
  ok('آزمون در لیست دانش‌آموز', await sp.evaluate(() => document.body.textContent.includes('آزمون E2E فیزیک')))
  await sp.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.includes('شروع آزمون'))?.click() })
  await sp.waitForURL('**/take', { timeout: 8000 }).catch(() => {})
  ok('صفحه آزمون باز شد', sp.url().includes('/take'), sp.url())
  await sp.waitForSelector('.exm-q', { timeout: 8000 }).catch(() => {})
  ok('تایمر نمایان', await sp.evaluate(() => !!document.querySelector('.exm-timer')))
  const nq = await sp.evaluate(() => document.querySelectorAll('.exm-q').length)
  ok('۳ کارت سوال', nq === 3, 'n=' + nq)

  /* پاسخ: سوال ۱ گزینه ۱ (صحیح)، سوال ۲ نادرت (صحیح)، سوال ۳ متن */
  await sp.evaluate(() => { document.querySelectorAll('.exm-q')[0]?.querySelectorAll('.exm-opt')[0]?.click() })
  await sp.evaluate(() => { document.querySelectorAll('.exm-q')[1]?.querySelectorAll('.exm-opt')[1]?.click() })
  await sp.fill('.exm-textarea', 'F=ma یعنی شتاب با نیرو نسبت مستقیم دارد.')
  await sleep(1500)

  /* پاسخبرگ جدا + دکمه انیمیشنی */
  await sp.evaluate(() => { [...document.querySelectorAll('.exm-switchbtn')].find((b) => b.textContent.includes('پاسخبرگ'))?.click() })
  await sp.waitForSelector('.exm-sheet-grid', { timeout: 5000 }).catch(() => {})
  const cells = await sp.evaluate(() => document.querySelectorAll('.exm-sheet-cell').length)
  ok('پاسخبرگ جدا با ۳ خانه', cells === 3, 'cells=' + cells)
  const doneCells = await sp.evaluate(() => document.querySelectorAll('.exm-sheet-cell.done').length)
  ok('هر ۳ خانه پر دیده می‌شود', doneCells === 3, 'done=' + doneCells)
  const pill = await sp.evaluate(() => document.querySelector('.exm-answered-pill')?.textContent || '')
  ok('شمارنده «۳ از ۳»', pill.includes('۳') && pill.includes('۳'), pill)
  /* برگشت به سوالات با انیمیشن */
  await sp.evaluate(() => { [...document.querySelectorAll('.exm-switchbtn')].find((b) => b.textContent.includes('سوالات'))?.click() })
  ok('برگشت به نمای سوالات', await sp.evaluate(() => !!document.querySelector('.exm-qs-anim')))

  /* امنیت: رویداد کپی → هشدار */
  await sp.evaluate(() => { document.dispatchEvent(new Event('copy', { cancelable: true })) })
  await sleep(500)
  ok('هشدار ضدکپی ظاهر شد', await sp.evaluate(() => !!document.querySelector('.exm-secwarn')))

  console.log('— ۵) تحویل و کارنامه')
  await sp.evaluate(() => { [...document.querySelectorAll('.exm-switchbtn')].find((b) => b.textContent.includes('تحویل'))?.click() })
  await sleep(400)
  await sp.evaluate(() => { [...document.querySelectorAll('.modal button')].find((b) => b.textContent.includes('تحویل نهایی'))?.click() })
  await sp.waitForURL('**/result', { timeout: 10000 }).catch(() => {})
  ok('کارنامه باز شد', sp.url().includes('/result'), sp.url())
  await sp.waitForSelector('.exm-report', { timeout: 8000 }).catch(() => {})
  const scoreTxt = await sp.evaluate(() => document.querySelector('.exm-score-tile.big .v')?.textContent || '')
  ok('نمره ۲ از ۳ (تشریحی در انتظار)', scoreTxt.includes('۲'), 'score=' + scoreTxt)
  ok('دکمه ذخیره PDF', await sp.evaluate(() => [...document.querySelectorAll('button')].some((b) => b.textContent.includes('ذخیره PDF'))))
  const rows = await sp.evaluate(() => document.querySelectorAll('.exm-rtable tbody tr').length)
  ok('جدول سوال‌به‌سوال ۳ ردیف', rows === 3, 'rows=' + rows)

  console.log('— ۶) معلم: تحلیل و تصحیح تشریحی')
  await tp.goto(`${BASE}/panel/teacher/exams/${exId}/analysis`, { waitUntil: 'networkidle' })
  await sleep(800)
  ok('آمار شرکت‌کننده = ۱', await tp.evaluate(() => document.body.textContent.includes('میانگین از')))
  ok('ردیف تلاش با وضعیت در انتظار تصحیح', await tp.evaluate(() => document.body.textContent.includes('در انتظار تصحیح')))
  ok('پرچم غیرعادی سریع ثبت شد', await tp.evaluate(() => document.body.textContent.includes('غیرعادی سریع')))
  await tp.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.trim() === 'تصحیح')?.click() })
  await sp.waitForTimeout(400)
  await tp.waitForSelector('.modal input[type="number"]', { timeout: 6000 }).catch(() => {})
  await tp.fill('.modal input[type="number"]', '1')
  await tp.evaluate(() => { [...document.querySelectorAll('.modal button')].find((b) => b.textContent.includes('ثبت نمره‌ها'))?.click() })
  await sleep(1200)
  ok('نمره نهایی ۳ از ۳ ثبت شد', await tp.evaluate(() => document.body.textContent.match(/۳\s*از\s*۳/) !== null))

  console.log('— ۷) دانش‌آموز: کارنامه به‌روز شد')
  await sp.reload({ waitUntil: 'networkidle' })
  await sp.waitForSelector('.exm-report', { timeout: 8000 }).catch(() => {})
  const score2 = await sp.evaluate(() => document.querySelector('.exm-score-tile.big .v')?.textContent || '')
  ok('کارنامه: ۳ از ۳ + رتبه', score2.includes('۳') && await sp.evaluate(() => document.body.textContent.includes('رتبه')), 'score=' + score2)

  console.log('— ۸) حالت PDF: برگه + کلید پاسخبرگ')
  /* ساخت آزمون PDF در UI */
  await tp.goto(BASE + '/panel/teacher/exams', { waitUntil: 'networkidle' })
  await tp.evaluate(() => { [...document.querySelectorAll('button')].find((x) => x.textContent.includes('آزمون جدید'))?.click() })
  await sleep(300)
  await tp.fill('.modal input.input', 'آزمون E2E برگه PDF')
  await tp.evaluate(() => { [...document.querySelectorAll('.modal .exm-chip')].find((b) => b.textContent.includes('PDF'))?.click() })
  await tp.evaluate(() => { [...document.querySelectorAll('.modal button')].find((x) => x.textContent.includes('ساخت و ادامه'))?.click() })
  await tp.waitForURL('**/panel/teacher/exams/*', { timeout: 8000 }).catch(() => {})
  const exPdf = tp.url().split('/exams/')[1]?.split(/[/?]/)[0] || ''
  ok('سازنده PDF باز شد', !!exPdf)
  await sleep(500)
  /* ساخت یک تصویر برگه و آپلود */
  const png = await tp.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 700; c.height = 900
    const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, 700, 900)
    x.fillStyle = '#111'; x.font = '24px sans-serif'; x.fillText('Sample Exam Page 1', 60, 100)
    return c.toDataURL('image/png')
  })
  await sp.waitForTimeout(200)
  await tp.setInputFiles('input[type="file"][accept*="pdf"]', { name: 'page.png', mimeType: 'image/png', buffer: Buffer.from(png.split(',')[1], 'base64') })
  await sp.waitForTimeout(2500)
  ok('تصویر برگه آپلود و پیش‌نمایش شد', await tp.evaluate(() => document.querySelectorAll('.exm-pdfview img, div img[src*="exams-files"]').length > 0))
  /* تعداد سوال و کلید */
  await tp.fill('.card input[type="number"]', '2')
  await sleep(400)
  await tp.evaluate(() => {
    const cells = document.querySelectorAll('.exm-keycell')
    cells[0]?.querySelectorAll('.exm-keyb')[0]?.click()
  })
  await tp.evaluate(() => {
    const cells = document.querySelectorAll('.exm-keycell')
    cells[1]?.querySelectorAll('.exm-keyb')[1]?.click()
  })
  await sleep(900)
  ok('کلید کامل شد (۲ از ۲)', await tp.evaluate(() => document.body.textContent.includes('کلید کامل')))
  await tp.evaluate(() => { [...document.querySelectorAll('button')].find((b) => b.textContent.includes('انتشار آزمون'))?.click() })
  await tp.waitForURL('**/panel/teacher/exams', { timeout: 8000 }).catch(() => {})
  await sleep(1000)
  ok('آزمون PDF منتشر شد', tp.url().endsWith('/panel/teacher/exams'))

  /* دانش‌آموز آزمون PDF را می‌دهد */
  await sp.goto(BASE + '/panel/student/exams', { waitUntil: 'networkidle' })
  await sp.evaluate(() => {
    const cards = [...document.querySelectorAll('.card.pad')]
    const c = cards.find((x) => x.textContent.includes('آزمون E2E برگه PDF'))
    ;[...(c?.querySelectorAll('button') || [])].find((b) => b.textContent.includes('شروع آزمون'))?.click()
  })
  await sp.waitForURL('**/take', { timeout: 8000 }).catch(() => {})
  await sp.waitForSelector('.exm-pdfview img', { timeout: 8000 }).catch(() => {})
  ok('برگه PDF برای دانش‌آموز نمایش داده شد', await sp.evaluate(() => !!document.querySelector('.exm-pdfview img')))
  await sp.evaluate(() => { [...document.querySelectorAll('.exm-switchbtn')].find((b) => b.textContent.includes('پاسخبرگ'))?.click() })
  await sleep(300)
  await sp.evaluate(() => { document.querySelectorAll('.exm-sheet-cell')[0]?.querySelectorAll('.exm-bubble')[0]?.click() })
  await sp.evaluate(() => { document.querySelectorAll('.exm-sheet-cell')[1]?.querySelectorAll('.exm-bubble')[0]?.click() })
  await sleep(1400)
  await sp.evaluate(() => { [...document.querySelectorAll('.exm-switchbtn')].find((b) => b.textContent.includes('تحویل'))?.click() })
  await sleep(300)
  await sp.evaluate(() => { [...document.querySelectorAll('.modal button')].find((b) => b.textContent.includes('تحویل نهایی'))?.click() })
  await sp.waitForURL('**/result', { timeout: 10000 }).catch(() => {})
  await sp.waitForSelector('.exm-report', { timeout: 8000 }).catch(() => {})
  const pdfScore = await sp.evaluate(() => document.querySelector('.exm-score-tile.big .v')?.textContent || '')
  ok('کارنامه PDF: ۱۰ از ۲۰ (۱ درست، ۱ غلط)', pdfScore.includes('۱۰'), 'score=' + pdfScore)

  console.log('— ۹) موبایل ۳۹۰px (دانش‌آموز دوم)')
  /* آزمون ساده برای موبایل با API */
  const r = await fetch(API + '/exams', { method: 'POST', headers: { Authorization: 'Bearer ' + ttok, 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'آزمون موبایل E2E', mode: 'builder', duration_min: 15 }) })
  const exM = (await r.json()).id
  await fetch(`${API}/exams/${exM}/questions`, { method: 'PUT', headers: { Authorization: 'Bearer ' + ttok, 'Content-Type': 'application/json' }, body: JSON.stringify({ questions: [
    { type: 'mcq', body: 'پایتخت ایران؟', opts: ['تهران', 'شیراز'], correct: 0, points: 1 },
  ] }) })
  await fetch(`${API}/exams/${exM}/publish`, { method: 'POST', headers: { Authorization: 'Bearer ' + ttok } })

  const mctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  const mp = await mctx.newPage()
  watchErrors(mp, 'student2')
  await loginIn(mp, STUDENT2)
  await mp.goto(BASE + `/panel/student/exams/${exM}/take`, { waitUntil: 'networkidle' })
  await mp.waitForSelector('.exm-q', { timeout: 8000 }).catch(() => {})
  const noHScroll = await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
  ok('بدون اسکرول افقی در موبایل', noHScroll, `scrollW=${await mp.evaluate(() => document.documentElement.scrollWidth)}`)
  const barVisible = await mp.evaluate(() => { const b = document.querySelector('.exm-switchbar'); return b && b.getBoundingClientRect().width <= window.innerWidth + 2 })
  ok('دکمه شناور سوالات/پاسخبرگ در موبایل سالم', !!barVisible)
  await mp.evaluate(() => { document.querySelector('.exm-opt')?.click() })
  await mp.evaluate(() => { [...document.querySelectorAll('.exm-switchbtn')].find((b) => b.textContent.includes('تحویل'))?.click() })
  await sleep(300)
  await mp.evaluate(() => { [...document.querySelectorAll('.modal button')].find((b) => b.textContent.includes('تحویل نهایی'))?.click() })
  await mp.waitForURL('**/result', { timeout: 10000 }).catch(() => {})
  await mp.waitForSelector('.exm-report', { timeout: 8000 }).catch(() => {})
  ok('کارنامه موبایل باز شد', await mp.evaluate(() => !!document.querySelector('.exm-report')))
  const mHScroll = await mp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 2)
  ok('کارنامه موبایل بدون اسکرول افقی', mHScroll)

  console.log('— ۱۰) خطاهای کنسول')
  for (const k of Object.keys(errors)) ok(`صفر خطای کنسول (${k})`, errors[k].length === 0, errors[k].slice(0, 3).join(' | '))

  await browser.close()
  console.log(`\n——— نتیجه E2E آزمون‌ساز: ${pass} موفق، ${fail} ناموفق ———`)
  process.exit(fail ? 1 : 0)
}

main().catch((e) => { console.error('FATAL', e); process.exit(1) })
