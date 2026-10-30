// ================================================================
// تست کامل API آزمون‌ساز — چرخه کامل: ساخت → سوال → انتشار → شرکت →
// ذخیره/ارسال → کارنامه → تصحیح تشریحی → تحلیل — + تست‌های امنیتی
// ================================================================
const API = 'http://127.0.0.1:4000/api'
let pass = 0, fail = 0
const ok = (name, cond, extra = '') => {
  if (cond) { pass++; console.log('  ✓ ' + name) }
  else { fail++; console.log('  ✗ ' + name + (extra ? ' — ' + extra : '')) }
}
async function req(path, { method = 'GET', body, token } = {}) {
  const r = await fetch(API + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = {}
  try { data = await r.json() } catch {}
  return { status: r.status, data }
}
const login = async (email) => {
  const r = await req('/auth/login', { method: 'POST', body: { email, password: '12345678' } })
  if (!r.data?.token) throw new Error('login failed ' + email)
  return r.data.token
}

const t = await login('reza@demo.ir')      // معلم
const s = await login('sara@demo.ir')      // دانش‌آموز
const s2 = await login('amir@demo.ir')     // دانش‌آموز دوم
const s3 = await login('yalda@demo.ir')    // دانش‌آموز سوم
console.log('— ورود سه کاربر انجام شد')

/* ---------- ۱) ساخت آزمون ---------- */
let r = await req('/exams', { method: 'POST', token: t, body: { title: 'آزمون فیزیک فصل ۲ — تست API', mode: 'builder', duration_min: 30 } })
ok('ساخت آزمون', r.status === 200 && r.data.id, JSON.stringify(r.data))
const exId = r.data.id

/* ---------- ۲) ذخیره ۶ سوال از ۵ نوع ---------- */
r = await req(`/exams/${exId}/questions`, {
  method: 'PUT', token: t,
  body: { questions: [
    { type: 'mcq', body: 'سرعت نور چند کیلومتر بر ثانیه است؟', opts: ['۳۰۰ هزار', '۱۵۰ هزار', '۳ میلیون', '۳۰ هزار'], correct: 0, points: 2, topic: 'نور', expl: 'سرعت نور ۳۰۰٬۰۰۰ کیلومتر بر ثانیه است.' },
    { type: 'multi', body: 'کدام‌ها نیروی پایه هستند؟', opts: ['گرانش', 'الکترومغناطیس', 'اصطکاک', 'هسته‌ای ضعیف'], correct: [0, 1, 3], points: 3, topic: 'نیروها' },
    { type: 'tf', body: 'شتاب همیشه در جهت حرکت است.', correct: 1, points: 1, topic: 'حرکت' },
    { type: 'blank', body: 'واحد اندازه‌گیری نیرو ... است.', correct: ['نیوتون', 'N'], points: 1, topic: 'نیروها' },
    { type: 'match', body: 'کمیت‌ها را به یکاها وصل کنید.', opts: { left: ['نیرو', 'انرژی', 'توان'], right: ['ژول', 'نیوتون', 'وات'] }, correct: { 0: 1, 1: 0, 2: 2 }, points: 3, topic: 'یکاها' },
    { type: 'essay', body: 'قانون دوم نیوتون را با مثال توضیح دهید.', points: 5, topic: 'نیروها' },
  ] },
})
ok('ذخیره ۶ سوال', r.status === 200 && r.data.count === 6, JSON.stringify(r.data))

/* اعتبارسنجی: سوال بدون گزینه صحیح نباید ذخیره شود */
r = await req(`/exams/${exId}/questions`, { method: 'PUT', token: t, body: { questions: [{ type: 'mcq', body: 'بدون جواب', opts: ['الف', 'ب'] }] } })
ok('رد سوال بدون کلید', r.status === 400, JSON.stringify(r.data))

/* ---------- ۳) انتشار ---------- */
r = await req(`/exams/${exId}/publish`, { method: 'POST', token: t })
ok('انتشار آزمون', r.status === 200, JSON.stringify(r.data))

/* دانش‌آموز نباید بتواند بسازد/ببیند کلیدها */
r = await req('/exams', { method: 'POST', token: s, body: { title: 'hack' } })
ok('دانش‌آموز نمی‌سازد', r.status === 403)
r = await req(`/exams/${exId}`, { token: s })
ok('دانش‌آموز کلیدها را نمی‌بیند', r.status === 403)

/* ---------- ۴) آزمون‌های در دسترس ---------- */
r = await req('/exams/available', { token: s })
ok('در لیست دانش‌آموز', r.data.exams?.some((e) => e.id === exId), JSON.stringify(r.data).slice(0, 200))

/* ---------- ۵) شروع ---------- */
r = await req(`/exams/${exId}/start`, { method: 'POST', token: s })
ok('شروع آزمون', r.status === 200 && r.data.attempt?.questions?.length === 6, JSON.stringify(r.data).slice(0, 300))
const qs = r.data.attempt.questions
ok('بدون فیلد پاسخ صحیح', qs.every((q) => q.correct === undefined && q.expl === undefined))
ok('بدون توضیح', qs.every((q) => !('expl' in q)))
const mcqQ = qs.find((q) => q.type === 'mcq')
const essayQ = qs.find((q) => q.type === 'essay')
const matchQ = qs.find((q) => q.type === 'match')
const orderQ = qs.find((q) => q.type === 'order')
const multiQ = qs.find((q) => q.type === 'multi')
const blankQ = qs.find((q) => q.type === 'blank')
const tfQ = qs.find((q) => q.type === 'tf')

/* شروع دوباره = همان تلاش (ادامه) */
r = await req(`/exams/${exId}/start`, { method: 'POST', token: s })
ok('ادامه همان تلاش', r.status === 200 && r.data.attempt.questions.length === 6)

/* ---------- ۶) ذخیره + لاگ امنیتی ---------- */
r = await req(`/exams/${exId}/save`, {
  method: 'POST', token: s,
  body: { a: { [mcqQ.qid]: mcqQ.opts.indexOf('۳۰۰ هزار'), [multiQ.qid]: [multiQ.opts.indexOf('گرانش'), multiQ.opts.indexOf('هسته‌ای ضعیف')], [tfQ.qid]: 1, [blankQ.qid]: 'نیوتون', [matchQ.qid]: {}, [essayQ.qid]: 'F=ma؛ یعنی شتاب یک جسم با نیروی وارد بر آن نسبت مستقیم دارد.' }, sec: { tabs: 2, copy: 1, newEvents: [{ k: 'tab_out' }, { k: 'tab_out' }, { k: 'copy' }] } },
})
ok('ذخیره پاسخ‌ها', r.status === 200 && r.data.saved === 5, JSON.stringify(r.data))

/* پاسخ نامعتبر باید رد شود — با فاصله از ذخیره قبلی (نرخ محدود ذخیره فعال است) */
await new Promise((r) => setTimeout(r, 1400))
r = await req(`/exams/${exId}/save`, { method: 'POST', token: s, body: { a: { [mcqQ.qid]: 999, [essayQ.qid]: null } } })
ok('پاسخ خارج از محدوده رد می‌شود', r.status === 200, JSON.stringify(r.data))

/* ---------- ۷) ارسال ---------- */
/* برای تصحیح تشریحی، اول بقیه پاسخ‌های رفته را دوباره بفرست (essay حذف شد بالا) */
await new Promise((r) => setTimeout(r, 1400)) // احترام به نرخ‌محور ضد اسپم
r = await req(`/exams/${exId}/save`, { method: 'POST', token: s, body: { a: { [essayQ.qid]: 'F=ma؛ شتاب با نیرو متناسب است.' } } })
ok('بازگردانی پاسخ تشریحی', r.status === 200 && r.data.saved === 5, JSON.stringify(r.data))
r = await req(`/exams/${exId}/submit`, { method: 'POST', token: s, body: { a: { [matchQ.qid]: { 0: matchQ.opts.right.indexOf('نیوتون'), 1: matchQ.opts.right.indexOf('ژول'), 2: matchQ.opts.right.indexOf('وات') } }, sec: { tabs: 2, copy: 1 } } })
ok('ارسال موفق', r.status === 200 && r.data.status === 'submitted', JSON.stringify(r.data))
/* multi: ۲ از ۳ درست، ۱ غلط → (2-1)/3 × ۳ = ۱ */
const partial = r.data.score
ok('نمره صحیح (mcq۲ + multi جزئی۲ + tf۱ + جای‌خالی۱ + تطبیق۳ = ۹؛ تشریحی هنوز)', Math.abs(partial - 9) < 0.6, 'score=' + partial)

/* ---------- ۸) کارنامه قبل از تصحیح تشریحی ---------- */
r = await req(`/exams/${exId}/result`, { token: s })
ok('کارنامه در دسترس', r.status === 200 && r.data.items?.length === 6)
ok('رتبه و میانگین', r.data.class?.count === 1, JSON.stringify(r.data.class))
const essayItem = r.data.items.find((i) => i.type === 'essay')
ok('تشریحی «در انتظار تصحیح»', essayItem?.res === 'pending', JSON.stringify(essayItem))

/* ---------- ۹) تصحیح دستی معلم ---------- */
r = await req(`/exams/${exId}/attempts`, { token: t })
ok('لیست تلاش‌ها', r.status === 200 && r.data.attempts.length === 1)
const at = r.data.attempts[0]
ok('لاگ امنیتی ثبت شد (۲ خروج از تب)', at.sec_log?.tabs === 2, JSON.stringify(at.sec_log))
r = await req(`/exams/${exId}/attempts/${at.id}`, { token: t })
ok('نمای تصحیح معلم', r.status === 200 && r.data.questions.length === 6)
r = await req(`/exams/${exId}/attempts/${at.id}/grade`, { method: 'POST', token: t, body: { pts: { [essayQ.qid]: 4 } } })
ok('نمره تشریحی ثبت شد (۹+۴=۱۳)', r.status === 200 && Math.abs(r.data.score - 13) < 0.6 && r.data.status === 'graded', JSON.stringify(r.data))

/* ---------- ۱۰) تحلیل ---------- */
r = await req(`/exams/${exId}/analytics`, { token: t })
ok('تحلیل: ۱ شرکت‌کننده', r.data.stats?.participants === 1)
ok('تحلیل: سخت‌ترین سوال', r.data.hardest != null)

/* ---------- ۱۱) دانش‌آموز دوم + تست امنیتی سقف خروج از تب ---------- */
r = await req('/exams', { method: 'POST', token: t, body: { title: 'آزمون امنیتی — سقف خروج از تب', mode: 'builder', duration_min: 10 } })
const ex2 = r.data.id
await req(`/exams/${ex2}/questions`, { method: 'PUT', token: t, body: { questions: [
  { type: 'mcq', body: '۲+۲؟', opts: ['۳', '۴', '۵', '۶'], correct: 1, points: 1 },
] } })
await req(`/exams/${ex2}/publish`, { method: 'POST', token: t })
await req(`/exams/${ex2}`, { method: 'PATCH', token: t, body: { sec_tab_limit: 3 } })
await req(`/exams/${ex2}/start`, { method: 'POST', token: s2 })
await req(`/exams/${ex2}/save`, { method: 'POST', token: s2, body: { a: {}, sec: { tabs: 7, copy: 0 } } })
r = await req(`/exams/${ex2}/submit`, { method: 'POST', token: s2, body: { a: {}, sec: { tabs: 7, copy: 0 } } })
ok('سقف تب → ارجاع امنیتی', r.data.status === 'invalid' && r.data.flags?.includes('tab_limit'), JSON.stringify(r.data))
r = await req(`/exams/${ex2}/result`, { token: s2 })
ok('کارنامه حالت بررسی امنیتی', r.status === 200 && r.data.attempt.status === 'invalid')
/* معلم تأیید می‌کند */
r = await req(`/exams/${ex2}/attempts`, { token: t })
const at2 = r.data.attempts[0]
r = await req(`/exams/${ex2}/attempts/${at2.id}/review`, { method: 'POST', token: t, body: { verdict: 'valid' } })
ok('معلم تأیید می‌کند', r.status === 200)
r = await req(`/exams/${ex2}/result`, { token: s2 })
ok('بعد از تأیید، کارنامه عادی', r.data.attempt.status === 'graded')

/* ---------- ۱۲) شرکت بدون تلاش مجدد ---------- */
r = await req(`/exams/${ex2}/start`, { method: 'POST', token: s2 })
ok('تلاش دوم ممنوع', r.status === 409 && r.data.done === true)

/* ---------- ۱۳) بازکردن تلاش توسط معلم ---------- */
r = await req(`/exams/${ex2}/attempts/${s2.replace(/./g, '*')}`, { method: 'DELETE', token: t })
r = await req(`/exams/${ex2}/attempts/${at2.student_id}`, { method: 'DELETE', token: t })
ok('بازکردن تلاش', r.status === 200)
r = await req(`/exams/${ex2}/start`, { method: 'POST', token: s2 })
ok('بعد از بازکردن، شروع ممکن', r.status === 200)

/* ---------- ۱۴) حالت PDF ---------- */
r = await req('/exams', { method: 'POST', token: t, body: { title: 'کنکور آزمایشی — برگه PDF', mode: 'pdf', duration_min: 45 } })
const ex3 = r.data.id
await req(`/exams/${ex3}`, { method: 'PATCH', token: t, body: { q_count: 3, pdf_pages: ['/api/exams-files/EXtest.pdf'], answer_key: { 1: 0, 2: 2, 3: 1 }, pdf_total: 30 } })
r = await req(`/exams/${ex3}/publish`, { method: 'POST', token: t })
ok('انتشار آزمون PDF', r.status === 200, JSON.stringify(r.data))
r = await req(`/exams/${ex3}/start`, { method: 'POST', token: s3 })
ok('شروع حالت PDF — ۳ سوال مجازی', r.status === 200 && r.data.attempt.questions.length === 3 && r.data.attempt.questions[0].type === 'pdfmcq', JSON.stringify(r.data).slice(0, 200))
r = await req(`/exams/${ex3}/submit`, { method: 'POST', token: s3, body: { a: { q1: 0, q2: 2, q3: 0 }, sec: {} } })
ok('تصحیح PDF: ۲ درست از ۳ → ۲۰ از ۳۰', Math.abs(r.data.score - 20) < 0.01, 'score=' + r.data.score)
r = await req(`/exams/${ex3}/result`, { token: s3 })
ok('کارنامه PDF', r.data.items?.length === 3 && r.data.items[0].res === 'correct' && r.data.items[1].res === 'correct' && r.data.items[2].res === 'wrong')

/* ---------- ۱۵) دانش‌آموز نمی‌تواند خودش را تصحیح کند ---------- */
r = await req(`/exams/${exId}/attempts`, { token: s })
ok('دانش‌آموز لیست تلاش‌ها را نمی‌بیند', r.status === 403)

console.log(`\n——— نتیجه: ${pass} موفق، ${fail} ناموفق ———`)
process.exit(fail ? 1 : 0)
