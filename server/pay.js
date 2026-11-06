// =====================================================================
// درگاه پرداخت زرین‌پال — v4 REST
// ---------------------------------------------------------------------
// جریان رسمی (مستندات زرین‌پال):
//   ۱) POST {api}/pg/v4/payment/request.json
//      بدنه: { merchant_id, amount(ریال), currency, description,
//              callback_url, metadata:{ mobile, email } }
//      پاسخ موفق: { data:{ code:100, authority:"A0000…" } }
//   ۲) ریدایرکت کاربر به {pay}/pg/StartPay/{authority}
//   ۳) بازگشت به callback_url با ?Authority=…&Status=OK|NOK
//   ۴) POST {api}/pg/v4/payment/verify.json
//      بدنه: { merchant_id, amount(همان ریال درخواست), authority }
//      پاسخ موفق: { data:{ code:100|101, ref_id, card_pan, fee } }
//      (۱۰۰ = تأیید شد، ۱۰۱ = قبلاً تأیید شده — هر دو یعنی پول گرفته شد)
// ---------------------------------------------------------------------
// سه حالت کارکرد (PAYMENT_MODE):
//   mock     بدون ZARINPAL_MERCHANT_ID → درگاه آزمایشی محلی
//            (/api/pay/mock-gateway) برای تست کامل جریان بدون اینترنت
//   sandbox  ZARINPAL_MERCHANT_ID + ZARINPAL_SANDBOX=true →
//            sandbox.zarinpal.com (پول واقعی جابه‌جا نمی‌شود)
//   real     ZARINPAL_MERCHANT_ID → api.zarinpal.com (پول واقعی)
// ---------------------------------------------------------------------
// نکات امنیتی رعایت‌شده:
//   • مبلغ همیشه از DB (priceCart) — هرگز از کلاینت/کوئری
//   • تأیید نهایی فقط با verify سمت سرور؛ Status=OK کوئری به‌تنهایی
//     هرگز معیار موفقیت نیست (کلاسیک‌ترین حفره درگاه‌ها)
//   • موجودی کالا در شروع رزرو و در شکست/انصراف/انقضای پرداخت برمی‌گردد
//   • پرداخت‌های رهاشده بعد از ۳۰ دقیقه منقضی و آزاد می‌شوند
//   • مرچنت‌کد فقط از env خوانده می‌شود، هرگز در کد/گیت هاردکد نیست
// =====================================================================
import express from 'express'
import jwt from 'jsonwebtoken'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join, basename, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, JWT_SECRET, getSetting } from './db.js'
import { priceCart, reserveStock, restoreStock, uniqueOrderCode, faNum } from './checkout-core.js'
import { smsConfigured, normalizePhone, notifyOrderPaid } from './sms.js'

const nowMs = () => Date.now()

/* ---------------- تنظیمات و حالت کارکرد ----------------
   [فیکس F16-d] منبع تنظیمات: اول DB (پنل ادمین → PUT /api/admin/settings)،
   بعد env. قبلاً فقط env خوانده می‌شد و تغییر مرچنت بدون دیپلوی/ری‌استارت غیرممکن بود */
const merchantCfg = () => (getSetting('zarinpal_merchant', '') || process.env.ZARINPAL_MERCHANT_ID || '').trim()
const sandboxCfg = () => {
  const s = getSetting('zarinpal_sandbox', null)
  if (s !== null) return s === '1'
  return process.env.ZARINPAL_SANDBOX === 'true'
}
export const payMode = () => (merchantCfg() ? (sandboxCfg() ? 'sandbox' : 'real') : 'mock')
/* سازگاری با مصرف‌کننده‌های قدیمی — مقدار هنگام بوت (env) */
export const PAYMENT_MODE = (process.env.ZARINPAL_MERCHANT_ID || '').trim()
  ? (process.env.ZARINPAL_SANDBOX === 'true' ? 'sandbox' : 'real') : 'mock'

const apiBase = () => (payMode() === 'sandbox' ? 'https://sandbox.zarinpal.com' : 'https://api.zarinpal.com')
const payBase = () => (payMode() === 'sandbox' ? 'https://sandbox.zarinpal.com' : 'https://www.zarinpal.com')

/* آدرس عمومی سایت — مقصد ریدایرکت‌های درگاه در حالت واقعی.
   در production حتماً PUBLIC_BASE_URL را روی دامنه واقعی تنظیم کنید؛
   در حالت mock نیازی به آن نیست — از origin خود درخواست مرورگر استفاده می‌شود
   (تا چه روی Vite dev :3000 باشد چه سرور dist :4000 — هر دو درست کار می‌کنند) */
const PUBLIC_BASE = (process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4000}`).replace(/\/+$/, '')
if (payMode() !== 'mock' && !process.env.PUBLIC_BASE_URL)
  console.warn('[pay] هشدار: PUBLIC_BASE_URL تنظیم نشده — callback زرین‌پال روی آدرس محلی ثبت می‌شود و پرداخت کامل نخواهد شد')

/* origin درخواست جاری — در حالت mock مبنای ریدایرکت‌ها (همان جایی که مرورگر است) */
export const reqOrigin = (req) => {
  /* [فیکس امنیتی S4] ضد Host-header injection — مقدار هدرها هرگز مستقیم در
     redirectUrl ساخته‌شده برای مرورگر نمی‌رود: فقط https/http و فقط کاراکترهای
     مجاز hostname؛ در غیر این صورت به PUBLIC_BASE (منبع معتبر) برمی‌گردیم. */
  const proto = req.headers['x-forwarded-proto'] === 'https' || req.protocol === 'https' ? 'https' : 'http'
  const hostRaw = String(req.headers['x-forwarded-host'] || req.headers.host || '')
  const host = /^[a-zA-Z0-9.\-\[\]:]+$/.test(hostRaw) ? hostRaw : ''
  if (!host) return PUBLIC_BASE
  return `${proto}://${host}`
}

const MERCHANT_OK = () => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(merchantCfg())
if (payMode() !== 'mock' && !MERCHANT_OK())
  console.warn('[pay] هشدار: ZARINPAL_MERCHANT_ID باید یک UUID معتبر ۳۶ کاراکتری باشد')

export const PAYMENT_TTL_MS = 30 * 60 * 1000 // عمر authority زرین‌پال ~۳۰ دقیقه
export const C2C_TTL_MS = 24 * 60 * 60 * 1000 // مهلت آپلود رسید کارت‌به‌کارت — ۲۴ ساعت
const MIN_AMOUNT = 1000                      // حداقل مبلغ قابل پرداخت (تومان)

/* ---------------- [کارت‌به‌کارت] روش‌های پرداخت — کنترل از پنل ادمین ----------------
 * هر روش با تنظیم DB روشن/خاموش می‌شود (پیش‌فرض: هر دو روشن).
 * کارت‌به‌کارت: کاربر مبلغ را کارت‌به‌کارت (مثلاً رایگان از طریق اپ بله‌پی) واریز
 * می‌کند، تصویر رسید را آپلود می‌کند و مدیر از پنل تأیید/رد می‌کند. */
const sOn = (k) => getSetting(k, '1') === '1'
export const payMethodsCfg = () => ({
  zarinpal: sOn('pay_zarinpal_enabled'),
  card2card: sOn('pay_card2card_enabled'),
  card: {
    number: (getSetting('c2c_card_number', '') || '').trim(),
    bank: (getSetting('c2c_card_bank', '') || '').trim(),
    holder: (getSetting('c2c_card_holder', '') || '').trim(),
    note: (getSetting('c2c_note', '') || '').trim(),
  },
})
const c2cAuthority = (code) => 'C2C-' + String(code || '').trim().toUpperCase()

/* ---------------- مهاجرت سبک: ستون qty برای ردیف سفارش ----------------
   برای برگرداندن صحیح موجودی در انصراف/انقضای پرداخت، تعداد هر قلم باید
   در خود ردیف سفارش ذخیره شود (قبلاً فقط در متن «× ۲» بود و قابل پارس نبود) */
try { db.exec('ALTER TABLE orders ADD COLUMN qty INTEGER NOT NULL DEFAULT 1') } catch { /* ستون هست */ }

/* ---------------- اسکیمای پرداخت‌ها (دفتر تراکنش‌های درگاه) ---------------- */
db.exec(`
CREATE TABLE IF NOT EXISTS payments (
  authority   TEXT PRIMARY KEY,          -- شناسه پرداخت زرین‌پال
  code        TEXT NOT NULL,             -- کد سفارش (ORD-XXXXXX)
  user_id     TEXT NOT NULL,
  amount      INTEGER NOT NULL,          -- تومان
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending|paid|failed|expired
  mode        TEXT NOT NULL DEFAULT 'mock',
  ref_id      TEXT,                      -- شماره مرجع بانکی
  card_pan    TEXT,                      -- ۴ رقم آخر کارت خریدار
  created_at  INTEGER NOT NULL,
  verified_at INTEGER,
  fulfilled_at INTEGER                 -- [فیکس B10] زمان انجام تسویه (ثبت‌نام/دسترسی)
);
CREATE INDEX IF NOT EXISTS idx_payments_code ON payments(code);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
`)
try { db.exec('ALTER TABLE payments ADD COLUMN fulfilled_at INTEGER') } catch { /* ستون هست */ }
/* [کارت‌به‌کارت] مسیر نسبی تصویر رسید آپلودشده */
try { db.exec('ALTER TABLE payments ADD COLUMN receipt TEXT') } catch { /* ستون هست */ }

/* پوشهٔ رسیدهای کارت‌به‌کارت — کنار آپلودی آزمون‌ها (gitignore شده) */
const c2cDir = join(dirname(fileURLToPath(import.meta.url)), 'uploads', 'c2c')

/* [فیکس B5] دسترسی دورهٔ ضبط‌شده — قبلاً خرید دوره هیچ دسترسی‌ای فعال نمی‌کرد */
db.exec(`
CREATE TABLE IF NOT EXISTS course_access (
  course_id  INTEGER NOT NULL,
  user_id    TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (course_id, user_id)
);
`)

/* [فیکس اولین‌اجرا] ستون‌های meta و ship روی جدول orders.
   قبلاً این مهاجرت‌ها فقط در content.js بود، اما content.js تابع payMode را از
   همین فایل ایمپورت می‌کند → pay.js قبل از بدنهٔ content.js ارزیابی می‌شود و
   آماده‌سازیِ کوئری‌های meta روی دیتابیس تازه (بدون ستون meta) کرش می‌کرد.
   حالا مهاجرت پیش از همهٔ prepareهای این فایل انجام می‌شود (idempotent). */
try { db.exec("ALTER TABLE orders ADD COLUMN meta TEXT DEFAULT ''") } catch { /* ستون هست */ }
try { db.exec("ALTER TABLE orders ADD COLUMN ship TEXT DEFAULT ''") } catch { /* ستون هست */ }

/* [فیکس اولین‌اجرا ۲] جدول courses هم در content.js ساخته می‌شد ولی
   courseExists در همین فایل (قبل از content.js) prepare می‌شود → روی
   دیتابیس تازه «no such table: courses». همین اسکیما را اینجا هم با
   IF NOT EXISTS می‌سازیم؛ مهاجرت‌های status/image هنوز کار content.js است. */
db.exec(`
CREATE TABLE IF NOT EXISTS courses (
  id            INTEGER PRIMARY KEY,
  title         TEXT NOT NULL,
  teacher       TEXT NOT NULL DEFAULT '',
  teacher_id    TEXT NOT NULL DEFAULT 't1',
  cat           TEXT NOT NULL DEFAULT '',
  price         INTEGER NOT NULL DEFAULT 0,
  old_price     INTEGER,
  rating        REAL NOT NULL DEFAULT 4.5,
  students      INTEGER NOT NULL DEFAULT 0,
  hours         INTEGER NOT NULL DEFAULT 0,
  lessons_count INTEGER NOT NULL DEFAULT 0,
  level         TEXT DEFAULT '',
  type          TEXT DEFAULT 'recorded',
  badge         TEXT,
  icon          TEXT DEFAULT 'book',
  color         TEXT DEFAULT 'grad-0',
  desc          TEXT DEFAULT '',
  features      TEXT NOT NULL DEFAULT '[]',
  curriculum    TEXT NOT NULL DEFAULT '[]',
  created_at    INTEGER NOT NULL
);
`)

const q = {
  paymentByAuthority: db.prepare('SELECT * FROM payments WHERE authority = ?'),
  /* [کارت‌به‌کارت] review هم به paid می‌رود (رسید آپلودشده)؛ زرین‌پال همیشه pending است */
  markPaid: db.prepare("UPDATE payments SET status='paid', ref_id=?, card_pan=?, verified_at=? WHERE authority=? AND status IN ('pending','review')"),
  markFulfilled: db.prepare('UPDATE payments SET fulfilled_at = ? WHERE authority = ? AND fulfilled_at IS NULL'),
  paidUnfulfilled: db.prepare("SELECT authority, code, user_id, amount FROM payments WHERE status='paid' AND fulfilled_at IS NULL ORDER BY verified_at LIMIT 50"),
  markFailed: db.prepare("UPDATE payments SET status='failed', verified_at=? WHERE authority=? AND status='pending'"),
  markExpired: db.prepare("UPDATE payments SET status='expired', verified_at=? WHERE authority=? AND status='pending'"),
  pendingOrders: db.prepare("SELECT kind, item_id, qty FROM orders WHERE code = ? AND status = 'pending'"),
  deletePendingOrders: db.prepare("DELETE FROM orders WHERE code = ? AND status = 'pending'"),
  payOrders: db.prepare("UPDATE orders SET status='paid' WHERE code = ? AND status = 'pending'"),
  firstMeta: db.prepare('SELECT meta FROM orders WHERE code = ? AND meta IS NOT NULL LIMIT 1'),
  orderTitles: db.prepare('SELECT kind, item_id, title FROM orders WHERE code = ?'),
  enroll: db.prepare('INSERT OR IGNORE INTO enrollments (class_id, user_id, created_at) VALUES (?,?,?)'),
  enrollUsed: db.prepare('SELECT 1 AS x FROM enrollments WHERE class_id = ? AND user_id = ?'),
  classExists: db.prepare('SELECT id FROM classes WHERE id = ?'),
  classCap: db.prepare('SELECT cap, base_enrolled, (SELECT COUNT(*) FROM enrollments WHERE class_id = classes.id) AS enrolled FROM classes WHERE id = ?'),
  courseAccessAdd: db.prepare('INSERT OR IGNORE INTO course_access (course_id, user_id, created_at) VALUES (?,?,?)'),
  courseExists: db.prepare('SELECT id, title FROM courses WHERE id = ?'),
  markRefunded: db.prepare("UPDATE orders SET status='refunded' WHERE code = ? AND status = 'paid'"),
  /* [کارت‌به‌کارت] TTL بر اساس روش — زرین‌پال ۳۰ دقیقه، کارت‌به‌کارت ۲۴ ساعت */
  pendingSweep: db.prepare("SELECT authority, mode, created_at FROM payments WHERE status='pending'"),
  markReview: db.prepare("UPDATE payments SET status='review', receipt=? WHERE authority=? AND status IN ('pending','review')"),
  markRejected: db.prepare("UPDATE payments SET status='rejected', verified_at=? WHERE authority=? AND status IN ('pending','review')"),
  c2cList: db.prepare(`SELECT p.*, u.name AS user_name, u.phone AS user_phone FROM payments p
    LEFT JOIN users u ON u.id = p.user_id WHERE p.mode='card2card'
    ORDER BY CASE p.status WHEN 'review' THEN 0 WHEN 'pending' THEN 1 ELSE 2 END, p.created_at DESC LIMIT 100`),
  orderTitlesByCode: db.prepare('SELECT kind, item_id, title FROM orders WHERE code = ?'),
}

/* ---------------- احراز هویت (همان قرارداد index.js) ---------------- */
const authUser = (req) => {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    return db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid) || null
  } catch { return null }
}

/* ---------------- فراخوانی REST زرین‌پال ---------------- */
async function zarinCall(path, body) {
  const r = await fetch(`${apiBase()}/pg/v4/payment/${path}.json`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'Modaresyar/1.0' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  return r.json().catch(() => null)
}

/* ایجاد درخواست پرداخت → { authority } یا { error } */
async function zarinRequest({ amountRial, callbackUrl, description, mobile, email }) {
  const payload = {
    merchant_id: merchantCfg() || '00000000-0000-0000-0000-000000000000', // مقدار صوری فقط برای sandbox
    amount: amountRial,
    currency: 'IRR', // مبلغ درخواست همیشه ریال است (تومان × ۱۰)
    description: String(description || 'پرداخت مدرس‌یار').slice(0, 255),
    callback_url: callbackUrl,
  }
  const meta = {}
  if (mobile) meta.mobile = mobile
  if (email) meta.email = email
  if (Object.keys(meta).length) payload.metadata = meta

  const j = await zarinCall('request', payload)
  const authority = j?.data?.authority
  if (j?.data?.code === 100 && authority) return { authority }
  const errCode = j?.errors?.code ?? j?.data?.code ?? '؟'
  const errMsg = j?.errors?.message || j?.data?.message || 'پاسخ نامعتبر از درگاه'
  return { error: `زرین‌پال [${errCode}]: ${errMsg}` }
}

/* تأیید پرداخت → { ok, refId, cardPan, already } یا { error } */
async function zarinVerify({ amountRial, authority }) {
  const j = await zarinCall('verify', {
    merchant_id: merchantCfg() || '00000000-0000-0000-0000-000000000000',
    amount: amountRial,
    authority,
  })
  const code = j?.data?.code
  if ((code === 100 || code === 101) && j?.data?.ref_id)
    return { ok: true, refId: String(j.data.ref_id), cardPan: j?.data?.card_pan || '', already: code === 101 }
  const errCode = j?.errors?.code ?? code ?? '؟'
  const errMsg = j?.errors?.message || j?.data?.message || 'تأیید پرداخت ناموفق بود'
  return { error: `زرین‌پال [${errCode}]: ${errMsg}` }
}

/* ---------------- تکمیل سفارش پرداخت‌شده ---------------- */
/* سفارش را «paid» می‌کند، ثبت‌نام کلاس‌ها را انجام می‌دهد و پیامک می‌زند.
   موجودی رزروشده کالای فیزیکی باقی می‌ماند (خرید قطعی شده است).
   [فیکس B10] تابع idempotent است — fulfilled_at بعد از موفقیت ست می‌شود و
   سوییپ دوره‌ای ردیف‌های paid-بدون-fulfill را دوباره اجرا می‌کند (پنجرهٔ
   کرش بین markPaid و fulfill دیگر سفارش را گم نمی‌کند) */
function fulfillPaidOrder({ code, userId, amount }) {
  q.payOrders.run(code)
  const rows = q.orderTitles.all(code)
  const titles = []
  for (const r of rows) {
    if (r.kind === 'class' && q.classExists.get(r.item_id)) {
      /* [فیکس B6] چک ظرفیت در لحظهٔ تکمیل پرداخت — در شروع پرداخت فقط چک می‌شد و
         تا callback (تا ۳۰ دقیقه بعد) هر تعداد نفر دیگر هم می‌خریدند */
      const cap = q.classCap.get(r.item_id)
      if (cap && (cap.enrolled + cap.base_enrolled) >= cap.cap && !q.enrollUsed.get(r.item_id, userId)) {
        q.markRefunded.run(code)
        console.error(`[pay] کلاس ${r.item_id} تکمیل است — سفارش ${code} برای برگشت وجه علامت خورد`)
      } else {
        q.enroll.run(r.item_id, userId, nowMs())
      }
    }
    /* [فیکس B5] دورهٔ ضبط‌شده — دسترسی واقعی فعال می‌شود */
    if (r.kind === 'course' && q.courseExists.get(r.item_id))
      q.courseAccessAdd.run(r.item_id, userId, nowMs())
    titles.push(r.title)
  }
  let phone = ''
  try { phone = JSON.parse(q.firstMeta.get(code)?.meta || '{}').phone || '' } catch { }
  notifyOrderPaid({ phone, code, total: amount, items: titles.join('، ') })
  return rows.length
}

/* شکست/انصراف/ردِ رسید — حذف ردیف‌های pending سفارش + برگرداندن موجودی رزرو */
function failPendingPayment(authority, { expired = false, rejected = false } = {}) {
  const p = q.paymentByAuthority.get(authority)
  if (!p) return false
  /* گارد وضعیت: زرین‌پال فقط pending؛ ردِ رسید از pending و review هر دو */
  if (rejected ? !['pending', 'review'].includes(p.status) : p.status !== 'pending') return false
  /* گارد اتمیک: فقط یک بار اجازهٔ آزادسازی (جلوگیری از دوبار برگشت موجودی) */
  const res = rejected ? q.markRejected.run(nowMs(), authority)
    : expired ? q.markExpired.run(nowMs(), authority)
    : q.markFailed.run(nowMs(), authority)
  if (res.changes === 0) return false
  /* [فیکس B11] برگشت موجودی + حذف ردیف‌ها در تراکنش — قبلاً کرش بین آن‌ها
     یعنی یا موجودی برای همیشه رزرو می‌ماند یا ردیف pending یتیم می‌ماند */
  try {
    db.exec('BEGIN')
    restoreStock(q.pendingOrders.all(p.code).map((r) => ({ kind: r.kind, id: r.item_id, qty: r.qty })))
    q.deletePendingOrders.run(p.code)
    db.exec('COMMIT')
  } catch (e) {
    try { db.exec('ROLLBACK') } catch { }
    console.error('[pay] fail rollback failed:', e.message)
  }
  return true
}

/* گردگیری پرداخت‌های رهاشده — منقضی و آزادسازی موجودی
   [فیکس B10] ردیف‌های paid-بدون-fulfill هم دوباره تسویه می‌شوند (جبران کرش)
   [فیکس B16] با تایمر دوره‌ای ۵ دقیقه‌ای هم اجرا می‌شود (پایین) — قبلاً فقط lazy */
function sweepExpiredPayments() {
  /* TTL بر اساس روش پرداخت — زرین‌پال ۳۰ دقیقه، کارت‌به‌کارت ۲۴ ساعت */
  const rows = q.pendingSweep.all()
  for (const p of rows) {
    const ttl = p.mode === 'card2card' ? C2C_TTL_MS : PAYMENT_TTL_MS
    if (p.created_at < nowMs() - ttl) failPendingPayment(p.authority, { expired: true })
  }
  /* سفارش‌هایی که پولشان گرفته شده ولی fulfill نشده‌اند (کرش بین markPaid و fulfill) */
  for (const p of q.paidUnfulfilled.all()) {
    try {
      fulfillPaidOrder({ code: p.code, userId: p.user_id, amount: p.amount })
      q.markFulfilled.run(nowMs(), p.authority)
    } catch (e) { console.error('[pay] re-fulfill failed:', e.message) }
  }
  return rows.length
}

/* ---------------- شروع پرداخت (مشترک بین سبد خرید و خرید مستقیم کلاس) ---------------- */
/**
 * ردیف‌های pending سفارش را می‌سازد، درخواست زرین‌پال می‌زند و پرداخت را ثبت می‌کند.
 * خطا → همه‌چیز برمی‌گردد به عقب (موجودی آزاد، ردیف‌ها حذف).
 * خروجی: { ok, authority, redirectUrl, code } | { error }
 */
export async function startZarinPayment({ user, lines, total, description, meta, origin }) {
  const code = uniqueOrderCode()
  if (!code) return { error: 'خطا در تولید کد سفارش — دوباره تلاش کنید' }

  const res = reserveStock(lines)
  if (res) return { error: res }

  const insOrder = db.prepare(`INSERT INTO orders (code, user_id, kind, item_id, title, amount, status, gateway, meta, created_at, qty)
    VALUES (?,?,?,?,?,?,'pending','zarinpal',?,?,?)`)
  try {
    /* node:sqlite تراکنش آماده ندارد → BEGIN/COMMIT دستی */
    db.exec('BEGIN')
    for (const l of lines)
      insOrder.run(code, user.id, l.kind, l.id, `${l.title}${l.qty > 1 ? ` × ${faNum(l.qty)}` : ''}`, l.final, meta, nowMs(), l.qty || 1)
    db.exec('COMMIT')
  } catch (e) {
    try { db.exec('ROLLBACK') } catch { }
    restoreStock(lines)
    console.error('[pay] insert order failed:', e.message)
    return { error: 'خطا در ثبت سفارش — دوباره تلاش کنید' }
  }

  /* مبلغ زرین‌پال ریال است — قیمت‌های پروژه تومان‌اند → ×۱۰ */
  const amountRial = total * 10
  const desc = `پرداخت سفارش ${code} — ${String(description || 'مدرسیار').slice(0, 200)}`

  let authority = null
  let redirectUrl = null
  if (payMode() === 'mock') {
    /* درگاه آزمایشی محلی — همان قرارداد callback (Authority/Status)؛
       [فیکس امنیتی S4] مقصد ریدایرکت عمداً **مسیر نسبی** است: قبلاً base از
       هدرهای درخواست (X-Forwarded-Host/Host) ساخته می‌شد و مهاجم می‌توانست با
       هدر جعلی، redirectUrl را به دامنهٔ خودش بفرستد (فیشینگ درگاه).
       مسیر نسبی همیشه روی همان اصلی که مرورگر در آن است رزولو می‌شود. */
    authority = 'MOCK' + Math.random().toString(36).slice(2, 12).toUpperCase()
    redirectUrl = `/api/pay/mock-gateway?authority=${authority}&code=${code}&amount=${total}`
  } else {
    let phone = '', email = ''
    try { const m = JSON.parse(meta || '{}'); phone = normalizePhone(m.phone) || ''; email = m.email || '' } catch { }
    const rq = await zarinRequest({ amountRial, callbackUrl: `${PUBLIC_BASE}/api/pay/zarinpal/callback`, description: desc, mobile: phone, email })
    if (rq.error) {
      restoreStock(lines)
      q.deletePendingOrders.run(code)
      return { error: rq.error }
    }
    authority = rq.authority
    redirectUrl = `${payBase()}/pg/StartPay/${authority}`
  }

  db.prepare(`INSERT INTO payments (authority, code, user_id, amount, status, mode, created_at)
    VALUES (?,?,?,?,'pending',?,?)`).run(authority, code, user.id, total, payMode(), nowMs())

  return { ok: true, authority, redirectUrl, code }
}

/* ---------------- روت‌ها ---------------- */
export function registerPayRoutes(app) {
  const payRoutes = express.Router()

  /* گارد ادمین برای مسیرهای رسیدهای کارت‌به‌کارت */
  const requirePayAdmin = (req, res, next) => {
    const u = authUser(req)
    if (!u || u.role !== 'admin') return res.status(403).json({ error: 'فقط مدیر سامانه' })
    req.user = u
    next()
  }

  /* وضعیت پیکربندی پرداخت/پیامک — برای نمایش حالت آزمایشی در UI (بدون داده حساس)
     [کارت‌به‌کارت] روش‌های فعال + اطلاعات کارت برای صفحهٔ تسویه */
  payRoutes.get('/config', (req, res) => {
    const m = payMethodsCfg()
    res.json({ mode: payMode(), minAmount: MIN_AMOUNT, sms: smsConfigured(), methods: { zarinpal: m.zarinpal, card2card: m.card2card }, card: m.card })
  })

  /* شروع پرداخت سبد خرید — همان بدنهٔ /api/checkout */
  payRoutes.post('/zarinpal/start', async (req, res) => {
    const u = authUser(req)
    if (!u) return res.status(401).json({ error: 'برای پرداخت ابتدا وارد حساب شوید' })
    if (!payMethodsCfg().zarinpal) return res.status(400).json({ error: 'درگاه زرین‌پال توسط مدیر غیرفعال شده است' })
    if (payMode() !== 'mock' && !MERCHANT_OK())
      return res.status(500).json({ error: 'مرچنت‌کد زرین‌پال معتبر نیست — تنظیمات سرور را بررسی کنید' })
    sweepExpiredPayments()

    const p = priceCart(u, req.body)
    if (p.error) return res.status(p.status || 400).json({ error: p.error })
    if (p.total < MIN_AMOUNT)
      return res.status(400).json({ error: `حداقل مبلغ قابل پرداخت ${faNum(MIN_AMOUNT)} تومان است` })

    try {
      const r = await startZarinPayment({
        user: u,
        lines: p.lines,
        total: p.total,
        description: `سبد خرید مدرسیار (${faNum(p.lines.length)} قلم)`,
        meta: p.meta,
        origin: reqOrigin(req),
      })
      if (r.error) return res.status(502).json({ error: r.error })
      res.json({ ok: true, code: r.code, total: p.total, redirectUrl: r.redirectUrl, mode: payMode() })
    } catch (e) {
      console.error('[pay] start failed:', e.message)
      res.status(502).json({ error: 'خطا در اتصال به درگاه پرداخت — دوباره تلاش کنید' })
    }
  })

  /* ---------------- کارت‌به‌کارت (بله‌پی / هر بانکی) ----------------
   * سفارش pending با gateway='card2card' ثبت و موجودی رزرو می‌شود (مهلت ۲۴ ساعت)،
   * کاربر رسید تصویری را آپلود می‌کند و مدیر از پنل مالی تأیید/رد می‌کند.
   * تأیید = همان fulfillPaidOrder زرین‌پال (ثبت‌نام کلاس/دسترسی دوره + پیامک) */
  payRoutes.post('/card2card/start', (req, res) => {
    const u = authUser(req)
    if (!u) return res.status(401).json({ error: 'برای ثبت سفارش ابتدا وارد حساب شوید' })
    const m = payMethodsCfg()
    if (!m.card2card) return res.status(400).json({ error: 'روش کارت‌به‌کارت توسط مدیر غیرفعال شده است' })
    sweepExpiredPayments()

    const p = priceCart(u, req.body)
    if (p.error) return res.status(p.status || 400).json({ error: p.error })
    if (p.total < MIN_AMOUNT)
      return res.status(400).json({ error: `حداقل مبلغ سفارش ${faNum(MIN_AMOUNT)} تومان است` })

    const code = uniqueOrderCode()
    if (!code) return res.status(500).json({ error: 'خطا در تولید کد سفارش — دوباره تلاش کنید' })
    const rs = reserveStock(p.lines)
    if (rs) return res.status(400).json({ error: rs })

    const insOrder = db.prepare(`INSERT INTO orders (code, user_id, kind, item_id, title, amount, status, gateway, meta, created_at, qty)
      VALUES (?,?,?,?,?,?,'pending','card2card',?,?,?)`)
    try {
      db.exec('BEGIN')
      for (const l of p.lines)
        insOrder.run(code, u.id, l.kind, l.id, `${l.title}${l.qty > 1 ? ` × ${faNum(l.qty)}` : ''}`, l.final, p.meta, nowMs(), l.qty || 1)
      db.exec('COMMIT')
    } catch (e) {
      try { db.exec('ROLLBACK') } catch { }
      restoreStock(p.lines)
      console.error('[pay] c2c insert order failed:', e.message)
      return res.status(500).json({ error: 'خطا در ثبت سفارش — دوباره تلاش کنید' })
    }

    const authority = c2cAuthority(code)
    db.prepare(`INSERT INTO payments (authority, code, user_id, amount, status, mode, created_at)
      VALUES (?,?,?,?,'pending','card2card',?)`).run(authority, code, u.id, p.total, nowMs())
    res.json({ ok: true, code, total: p.total, method: 'card2card', card: m.card })
  })

  /* وضعیت سفارش کارت‌به‌کارت — فقط برای صاحب سفارش */
  payRoutes.get('/card2card/status/:code', (req, res) => {
    const u = authUser(req)
    if (!u) return res.status(401).json({ error: 'ابتدا وارد حساب شوید' })
    const p = q.paymentByAuthority.get(c2cAuthority(req.params.code))
    if (!p || p.user_id !== u.id) return res.status(404).json({ error: 'سفارش پیدا نشد' })
    res.json({ code: p.code, status: p.status, amount: p.amount, hasReceipt: !!p.receipt, refId: p.ref_id || '' })
  })

  /* آپلود رسید تصویری (dataURL ≤ ۴MB) — کاربر مالک سفارش */
  payRoutes.post('/card2card/:code/receipt', (req, res) => {
    const u = authUser(req)
    if (!u) return res.status(401).json({ error: 'ابتدا وارد حساب شوید' })
    const p = q.paymentByAuthority.get(c2cAuthority(req.params.code))
    if (!p || p.user_id !== u.id) return res.status(404).json({ error: 'سفارش پیدا نشد' })
    if (p.status === 'paid') return res.status(400).json({ error: 'این سفارش قبلاً تأیید شده است' })
    if (!['pending', 'review'].includes(p.status))
      return res.status(400).json({ error: 'این سفارش قابل رسیدگذاری نیست — دوباره سفارش ثبت کنید' })

    const img = String(req.body?.image || '')
    const mm = img.match(/^data:image\/(png|jpe?g|webp);base64,([A-Za-z0-9+/=\s]+)$/)
    if (!mm) return res.status(400).json({ error: 'فقط تصویر رسید (JPG/PNG/WebP) پذیرفته می‌شود' })
    const buf = Buffer.from(mm[2].replace(/\s+/g, ''), 'base64')
    if (!buf.length) return res.status(400).json({ error: 'تصویر رسید خالی است' })
    if (buf.length > 4 * 1024 * 1024) return res.status(400).json({ error: 'حجم رسید باید کمتر از ۴ مگابایت باشد' })

    mkdirSync(c2cDir, { recursive: true })
    const ext = mm[1] === 'jpeg' ? 'jpg' : mm[1]
    const fname = `${p.authority.replace(/[^A-Za-z0-9-]/g, '')}.${ext}`
    writeFileSync(join(c2cDir, fname), buf)
    const upd = q.markReview.run(`uploads/c2c/${fname}`, p.authority)
    if (upd.changes === 0) return res.status(409).json({ error: 'وضعیت سفارش تغییر کرده — صفحه را تازه کنید' })
    res.json({ ok: true, status: 'review' })
  })

  /* ---- ادمین: صف رسیدهای کارت‌به‌کارت ---- */
  payRoutes.get('/admin/c2c', requirePayAdmin, (req, res) => {
    const rows = q.c2cList.all().map((p) => ({
      authority: p.authority, code: p.code, userName: p.user_name || '—', userPhone: p.user_phone || '',
      amount: p.amount, status: p.status, hasReceipt: !!p.receipt,
      createdAt: p.created_at, refId: p.ref_id || '',
      items: q.orderTitlesByCode.all(p.code).map((o) => o.title).join('، '),
    }))
    res.json({ payments: rows })
  })

  /* تصویر رسید — فقط ادمین (basename برای ضد path-traversal) */
  payRoutes.get('/admin/c2c/:authority/receipt', requirePayAdmin, (req, res) => {
    const p = q.paymentByAuthority.get(String(req.params.authority))
    if (!p?.receipt) return res.status(404).json({ error: 'رسیدی ثبت نشده است' })
    res.sendFile(join(c2cDir, basename(p.receipt)))
  })

  /* تأیید رسید → همان مسیر تکمیل زرین‌پال (سفارش paid + ثبت‌نام/دسترسی + پیامک) */
  payRoutes.post('/admin/c2c/:authority/approve', requirePayAdmin, (req, res) => {
    const p = q.paymentByAuthority.get(String(req.params.authority))
    if (!p || p.mode !== 'card2card') return res.status(404).json({ error: 'پرداخت کارت‌به‌کارت پیدا نشد' })
    if (p.status === 'paid') return res.json({ ok: true, already: true })
    if (p.status !== 'review') return res.status(400).json({ error: 'اول باید رسید آپلود شود' })
    const refId = String(req.body?.refId || '').trim().slice(0, 40) || `C2C-${String(nowMs()).slice(-9)}`
    const marked = q.markPaid.run(refId, '', nowMs(), p.authority)
    if (marked.changes === 0) return res.status(409).json({ error: 'وضعیت پرداخت تغییر کرده — صفحه را تازه کنید' })
    fulfillPaidOrder({ code: p.code, userId: p.user_id, amount: p.amount })
    q.markFulfilled.run(nowMs(), p.authority)
    res.json({ ok: true, code: p.code, refId })
  })

  /* رد رسید → موجودی برمی‌گردد، ردیف‌های سفارش حذف می‌شوند، وضعیت rejected */
  payRoutes.post('/admin/c2c/:authority/reject', requirePayAdmin, (req, res) => {
    const p = q.paymentByAuthority.get(String(req.params.authority))
    if (!p || p.mode !== 'card2card') return res.status(404).json({ error: 'پرداخت کارت‌به‌کارت پیدا نشد' })
    const done = failPendingPayment(p.authority, { rejected: true })
    if (!done) return res.status(400).json({ error: 'این سفارش در وضعیت قابل رد نیست' })
    res.json({ ok: true })
  })

  /* بازگشت از درگاه — GET ریدایرکتی با Authority/Status در کوئری.
     مقصد ریدایرکت: mock → origin جاری مرورگر؛ real/sandbox → PUBLIC_BASE */
  payRoutes.get('/zarinpal/callback', async (req, res) => {
    sweepExpiredPayments()
    const base = payMode() === 'mock' ? reqOrigin(req) : PUBLIC_BASE
    const authority = String(req.query.Authority || req.query.authority || '').trim()
    const status = String(req.query.Status || req.query.status || '').trim().toUpperCase()
    const fail = (reason, code) =>
      res.redirect(302, `${base}/order-success?status=failed&reason=${encodeURIComponent(reason)}${code ? `&code=${encodeURIComponent(code)}` : ''}`)

    if (!authority) return fail('unknown')
    const p = q.paymentByAuthority.get(authority)
    if (!p) return fail('unknown')
    if (p.status === 'paid')
      return res.redirect(302, `${base}/order-success?status=ok&code=${encodeURIComponent(p.code)}&ref=${encodeURIComponent(p.ref_id || '')}&total=${p.amount}`)
    if (p.status !== 'pending') return fail('expired', p.code)

    /* انصراف کاربر یا شکست در درگاه */
    if (status !== 'OK') {
      failPendingPayment(authority)
      return fail('canceled', p.code)
    }

    /* تأیید سمت سرور — مبلغ از DB، نه از کوئری.
       در حالت mock تأیید محلی شبیه‌سازی می‌شود (درگاه آزمایشی «پول را گرفته»)؛
       در sandbox/real تأیید واقعی نزد زرین‌پال انجام می‌شود */
    const v = payMode() === 'mock'
      ? { ok: true, refId: 'MR' + String(nowMs()).slice(-9), cardPan: '6037******9999' }
      : await zarinVerify({ amountRial: p.amount * 10, authority })
    if (!v.ok) {
      failPendingPayment(authority)
      console.error('[pay] verify failed:', v.error)
      return fail('verify', p.code)
    }

    const marked = q.markPaid.run(v.refId, v.cardPan, nowMs(), authority)
    if (marked.changes === 0) {
      /* رقابت دو callback هم‌زمان: یکی قبلاً paid کرده → همان مسیر موفق */
      const done = q.paymentByAuthority.get(authority)
      return res.redirect(302, `${base}/order-success?status=ok&code=${encodeURIComponent(done?.code || p.code)}&ref=${encodeURIComponent(v.refId)}&total=${done?.amount ?? p.amount}`)
    }
    fulfillPaidOrder({ code: p.code, userId: p.user_id, amount: p.amount })
    /* [فیکس B10] تسویه ثبت شد — سوییپ دوره‌ای دیگر دوباره انجامش نمی‌دهد */
    q.markFulfilled.run(nowMs(), authority)
    res.redirect(302, `${base}/order-success?status=ok&code=${encodeURIComponent(p.code)}&ref=${encodeURIComponent(v.refId)}&total=${p.amount}`)
  })

  /* درگاه آزمایشی محلی — فقط در حالت mock؛ قرارداد دقیقاً مثل زرین‌پال */
  if (payMode() === 'mock') {
    payRoutes.get('/mock-gateway', (req, res) => {
      const a = String(req.query.authority || '')
      const code = String(req.query.code || '')
      const amount = Number(req.query.amount || 0)
      if (!a || !q.paymentByAuthority.get(a)) return res.status(404).send('تراکنش پیدا نشد')
      /* [فیکس B2] escape کامل HTML — قبلاً code بدون escape در قالب درج می‌شد
         و بازتاب اسکریپت (XSS) ممکن بود: ?code=<script>alert(1)</script> */
      const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')
      const codeSafe = esc(code.slice(0, 40))
      const aSafe = esc(a.slice(0, 60))
      const amountSafe = esc(amount.toLocaleString('en-US'))
      res.set('Content-Type', 'text/html; charset=utf-8').send(`<!doctype html>
<html lang="fa" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>درگاه پرداخت آزمایشی — مدرسیار</title>
<style>
 body{font-family:Tahoma,Vazirmatn,sans-serif;background:#f2f5f7;display:grid;place-items:center;min-height:100vh;margin:0}
 .box{background:#fff;border-radius:16px;padding:32px 40px;box-shadow:0 8px 30px rgba(0,0,0,.08);text-align:center;max-width:420px}
 .logo{font-size:22px;font-weight:800;color:#0f766e;margin-bottom:4px}
 .tag{color:#94a3b8;font-size:12px;margin-bottom:20px}
 .amt{font-size:26px;font-weight:800;margin:12px 0 4px}
 .muted{color:#64748b;font-size:13px}
 .btns{display:flex;gap:12px;margin-top:24px}
 a.btn{flex:1;padding:12px 0;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px}
 .ok{background:#0f766e;color:#fff}.nok{background:#eef2f5;color:#475569;border:1px solid #e2e8f0}
 code{background:#f1f5f9;padding:2px 8px;border-radius:6px;font-size:13px}
</style></head><body>
<div class="box">
 <div class="logo">درگاه پرداخت آزمایشی</div>
 <div class="tag">شبیه‌ساز زرین‌پال — پول واقعی جابه‌جا نمی‌شود</div>
 <div class="amt">${faNum(amountSafe)} تومان</div>
 <div class="muted">کد سفارش: <code dir="ltr">${codeSafe}</code></div>
 <div class="btns">
  <a class="btn ok" href="/api/pay/zarinpal/callback?authority=${encodeURIComponent(a)}&Status=OK">پرداخت موفق (تست)</a>
  <a class="btn nok" href="/api/pay/zarinpal/callback?authority=${encodeURIComponent(a)}&Status=NOK">انصراف</a>
 </div>
</div>
</body></html>`)
    })
  }

  app.use('/api/pay', payRoutes)
}

/* [فیکس B16] سوییپ دوره‌ای — قبلاً فقط lazy بود و در روزهای بی‌تراکنش،
   موجودی رزروشدهٔ سفارش‌های رهاشده ساعت‌ها قفل می‌ماند */
setInterval(() => { try { sweepExpiredPayments() } catch (e) { console.error('[pay] sweep failed:', e.message) } }, 5 * 60_000).unref()
