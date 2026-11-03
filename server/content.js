// =====================================================================
// محتوای عمومی سایت — کاتالوگ دوره‌ها، مدرس‌مارکت، وبلاگ، اساتید، نظرات
// ---------------------------------------------------------------------
// قبلاً همه این داده‌ها فقط در src/data/mock.js (سمت کلاینت) بودند؛
// سرور هیچ جدول و API‌ای نداشت → «ناقصی»: محتوا قابل مدیریت/تغییر نبود
// و همان داده ثابت برای همیشه از باندل جاوااسکریپت خوانده می‌شد.
// حالا: جدول + seed از همان mock (تک‌منبع حقیقت) + API عمومی خواندن.
// شکل خروجی عیناً همان شکل mock است تا صفحات فرانت بدون تغییر شکل داده کار کنند.
// =====================================================================
import jwt from 'jsonwebtoken'
import { db, JWT_SECRET, getSetting, setSetting } from './db.js'
/* هسته مشترک پرداخت — قیمت‌گذاری/کد تخفیف/موجودی، مشترک با درگاه زرین‌پال (server/pay.js)
   تا هر دو جریان خرید دقیقاً یک منطق قیمت داشته باشند */
import { faToday, faNum, evaluateCoupon, priceCart, reserveStock, uniqueOrderCode } from './checkout-core.js'
/* [فیکس F16-d] وضعیت واقعی درگاه/پیامک برای نمایش در پنل ادمین */
import { payMode } from './pay.js'
import { smsConfigured } from './sms.js'

const now = () => Date.now()

import {
 courses as seedCourses, products as seedProducts, teachers as seedTeachers,
 blogPosts as seedBlog, testimonials as seedTestimonials, reviews as seedReviews,
 coupons as seedCoupons,
} from '../src/data/mock.js'

/* ---------------- اسکیما ---------------- */
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
CREATE TABLE IF NOT EXISTS products (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  cat       TEXT NOT NULL DEFAULT '',
  price     INTEGER NOT NULL DEFAULT 0,
  old_price INTEGER,
  rating    REAL NOT NULL DEFAULT 4.5,
  stock     INTEGER NOT NULL DEFAULT 0,
  icon      TEXT DEFAULT 'pen',
  sold      INTEGER NOT NULL DEFAULT 0,
  specs     TEXT NOT NULL DEFAULT '[]',
  color     TEXT DEFAULT 'grad-0',
  badge     TEXT
);
CREATE TABLE IF NOT EXISTS blog_posts (
  id       TEXT PRIMARY KEY,
  title    TEXT NOT NULL,
  cat      TEXT DEFAULT '',
  date     TEXT DEFAULT '',
  date_iso TEXT DEFAULT '',
  read     INTEGER DEFAULT 5,
  icon     TEXT DEFAULT 'book',
  color    TEXT DEFAULT 'grad-0',
  excerpt  TEXT DEFAULT '',
  body     TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS teacher_profiles (
  id            TEXT PRIMARY KEY,
  user_id       TEXT,
  name          TEXT NOT NULL,
  role          TEXT DEFAULT '',
  bio           TEXT DEFAULT '',
  skills        TEXT NOT NULL DEFAULT '[]',
  rating        REAL NOT NULL DEFAULT 4.5,
  students      INTEGER NOT NULL DEFAULT 0,
  classes_count INTEGER NOT NULL DEFAULT 0,
  color         TEXT DEFAULT 'grad-0',
  joined        TEXT DEFAULT '',
  status        TEXT DEFAULT 'active'
);
CREATE TABLE IF NOT EXISTS reviews (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  kind       TEXT NOT NULL DEFAULT 'course',   -- course | product
  target_id  TEXT NOT NULL,                    -- شناسه دوره/محصول
  user_id    TEXT,
  user_name  TEXT NOT NULL,
  rating     INTEGER NOT NULL DEFAULT 5,
  text       TEXT NOT NULL DEFAULT '',
  status     TEXT NOT NULL DEFAULT 'pending',  -- pending | approved
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS contact_messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  email      TEXT NOT NULL,
  subject    TEXT DEFAULT '',
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL UNIQUE,
  user_id    TEXT NOT NULL,
  subject    TEXT NOT NULL,
  body       TEXT NOT NULL DEFAULT '',
  priority   TEXT NOT NULL DEFAULT 'متوسط',
  status     TEXT NOT NULL DEFAULT 'open',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS coupons (
  code      TEXT PRIMARY KEY,
  kind      TEXT NOT NULL DEFAULT 'percent',  -- percent | amount
  value     INTEGER NOT NULL DEFAULT 0,
  status    TEXT NOT NULL DEFAULT 'active',   -- active | inactive | expired
  expires   TEXT DEFAULT '',
  used      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_reviews_target ON reviews(kind, target_id, status);
CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id, id);
`)

/* مهاجرت سبک — اطلاعات تماس خریدار (نام/موبایل/آدرس) روی ردیف‌های سفارش */
try { db.exec('ALTER TABLE orders ADD COLUMN meta TEXT DEFAULT \'\'') } catch { /* ستون هست */ }
/* [فیکس F14] ستون پاسخ ادمین به تیکت — قبلاً متن پاسخ دور ریخته می‌شد */
try { db.exec('ALTER TABLE tickets ADD COLUMN reply TEXT DEFAULT \'\'') } catch { /* ستون هست */ }
try { db.exec('ALTER TABLE tickets ADD COLUMN replied_at INTEGER') } catch { /* ستون هست */ }
/* [فیکس F31] ستون شماره تماس برای پیام‌های فرم تماس — قبلاً required بود ولی
   سرور ذخیره نمی‌کرد و پشتیبانی هرگز شماره را نمی‌دید */
try { db.exec('ALTER TABLE contact_messages ADD COLUMN phone TEXT DEFAULT \'\'') } catch { /* ستون هست */ }
/* [فیکس F16-a] وضعیت انتشار دوره (published | draft) — «لغو انتشار» قبلاً toast جعلی بود */
try { db.exec("ALTER TABLE courses ADD COLUMN status TEXT NOT NULL DEFAULT 'published'") } catch { /* ستون هست */ }
/* کاور دوره — دوره‌های جدید بدون آن به آدرس عکس ناموجود c{id}.jpg می‌افتند */
try { db.exec("ALTER TABLE courses ADD COLUMN image TEXT DEFAULT ''") } catch { /* ستون هست */ }
/* [فیکس F16-b] روش ارسال سفارش فروشگاه — سلکت AMarket قبلاً فقط state محلی بود */
try { db.exec("ALTER TABLE orders ADD COLUMN ship TEXT DEFAULT ''") } catch { /* ستون هست */ }

/* ---------------- هلپرهای نگاشت به شکل mock فرانت ---------------- */
const j = (s, fb) => { try { return JSON.parse(s) } catch { return fb } }
const courseOut = (r) => ({
 id: r.id, title: r.title, teacher: r.teacher, teacherId: r.teacher_id, cat: r.cat,
 price: r.price, oldPrice: r.old_price ?? null, rating: r.rating, students: r.students,
 hours: r.hours, lessonsCount: r.lessons_count, level: r.level, type: r.type,
 badge: r.badge ?? null, icon: r.icon, color: r.color, desc: r.desc,
 features: j(r.features, []), curriculum: j(r.curriculum, []),
 status: r.status || 'published', image: r.image || '',
})
const productOut = (r) => ({
 id: r.id, name: r.name, cat: r.cat, price: r.price, oldPrice: r.old_price ?? null,
 rating: r.rating, stock: r.stock, icon: r.icon, sold: r.sold, specs: j(r.specs, []),
 color: r.color, badge: r.badge ?? null,
})
const teacherOut = (r) => ({
 id: r.id, userId: r.user_id || null, name: r.name, role: r.role, bio: r.bio,
 skills: j(r.skills, []), rating: r.rating, students: r.students,
 classesCount: r.classes_count, color: r.color, joined: r.joined, status: r.status,
})
const blogOut = (r) => ({
 id: r.id, title: r.title, cat: r.cat, date: r.date, dateISO: r.date_iso,
 read: r.read, icon: r.icon, color: r.color, excerpt: r.excerpt, body: r.body || '',
})

/* faToday → server/checkout-core.js (مشترک با هسته پرداخت) */

/* ---------------- Seed (فقط بار اول — تک‌منبع حقیقت همان mock است) ---------------- */
function seed() {
 if (!db.prepare('SELECT COUNT(*) AS n FROM courses').get().n) {
  const ins = db.prepare(`INSERT INTO courses
   (id, title, teacher, teacher_id, cat, price, old_price, rating, students, hours, lessons_count, level, type, badge, icon, color, desc, features, curriculum, created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const c of seedCourses) {
   ins.run(c.id, c.title, c.teacher, c.teacherId, c.cat, c.price, c.oldPrice ?? null, c.rating,
    c.students, c.hours, c.lessonsCount, c.level || '', c.type || 'recorded', c.badge ?? null,
    c.icon || 'book', c.color || 'grad-0', c.desc || '',
    JSON.stringify(c.features || []), JSON.stringify(c.curriculum || []), now())
  }
  console.log(`[db] seeded ${seedCourses.length} courses`)
 }
 if (!db.prepare('SELECT COUNT(*) AS n FROM products').get().n) {
  const ins = db.prepare(`INSERT INTO products (id, name, cat, price, old_price, rating, stock, icon, sold, specs, color, badge)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const p of seedProducts) {
   ins.run(p.id, p.name, p.cat, p.price, p.oldPrice ?? null, p.rating, p.stock, p.icon || 'pen',
    p.sold || 0, JSON.stringify(p.specs || []), p.color || 'grad-0', p.badge ?? null)
  }
  console.log(`[db] seeded ${seedProducts.length} products`)
 }
 if (!db.prepare('SELECT COUNT(*) AS n FROM blog_posts').get().n) {
  const ins = db.prepare(`INSERT INTO blog_posts (id, title, cat, date, date_iso, read, icon, color, excerpt, body)
   VALUES (?,?,?,?,?,?,?,?,?,?)`)
  for (const b of seedBlog) {
   ins.run(b.id, b.title, b.cat, b.date, b.dateISO || '', b.read || 5, b.icon || 'book',
    b.color || 'grad-0', b.excerpt || '', b.body || '')
  }
  console.log(`[db] seeded ${seedBlog.length} blog posts`)
 }
 if (!db.prepare('SELECT COUNT(*) AS n FROM teacher_profiles').get().n) {
  /* نگاشت پروفایل موک (t1..t5) به حساب واقعی کاربران دمو (u-reza, u-maryam, …) */
  const USER_BY_MOCK = { t1: 'u-reza', t2: 'u-maryam', t3: 'u-ali', t4: 'u-hossein', t5: 'u-negar' }
  const ins = db.prepare(`INSERT INTO teacher_profiles (id, user_id, name, role, bio, skills, rating, students, classes_count, color, joined, status)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
  for (const t of seedTeachers) {
   ins.run(t.id, USER_BY_MOCK[t.id] || null, t.name, t.role, t.bio || '',
    JSON.stringify(t.skills || []), t.rating, t.students, t.classesCount,
    t.color || 'grad-0', t.joined || '', t.status || 'active')
  }
  console.log(`[db] seeded ${seedTeachers.length} teacher profiles`)
 }
 if (!db.prepare('SELECT COUNT(*) AS n FROM reviews').get().n) {
  /* نظرات seed: نام هدف در mock خلاصه‌شده است (مثل «دوره ری‌اکت و Next.js» ولی
     عنوان کامل دوره «دوره جامع ری‌اکت و Next.js — از صفر تا پروژه واقعی» است) —
     پس نگاشت با تطابق زیررشته + کلیدواژه‌های دستی انجام می‌شود؛ قبلاً فقط تطابق دقیق بود
     و هیچ نظری به هیچ دوره‌ای نمی‌چسبید (باگ seed خاموش) */
  const KEYWORD_MAP = { 'ری‌اکت': 1, 'UI/UX': 2, 'آیلتس': 3, 'پایتون': 6, 'مارکتینگ': 5 }
  const findCourseId = (target) => {
   const exact = seedCourses.find((c) => c.title === target)
   if (exact) return exact.id
   const partial = seedCourses.find((c) => c.title.includes(target) || target.includes(c.title))
   if (partial) return partial.id
   for (const [kw, id] of Object.entries(KEYWORD_MAP)) if ((target || '').includes(kw)) return id
   return null
  }
  const ins = db.prepare(`INSERT INTO reviews (kind, target_id, user_id, user_name, rating, text, status, created_at)
   VALUES (?,?,?,?,?,?,?,?)`)
  let n = 0
  for (const r of seedReviews) {
   const courseId = findCourseId(r.target)
   if (!courseId) continue // نظرات بدون هدف معتبر وارد نمی‌شوند
   ins.run('course', String(courseId), null, r.user, r.rating, r.text,
    r.status === 'approved' ? 'approved' : 'pending', now())
   n++
  }
  if (n) console.log(`[db] seeded ${n} reviews`)
 }
 if (!db.prepare('SELECT COUNT(*) AS n FROM coupons').get().n) {
  /* تاریخ‌های انقضای mock مربوط به سال گذشته شمسی (۱۴۰۴) است — کدهای فعال دمو
     (YALDA30/MARKET100 که در UI هم پیشنهاد می‌شوند) به سال جاری منتقل می‌شوند
     تا جریان تخفیف واقعاً قابل استفاده باشد؛ REACT50 عمداً منقضی می‌ماند */
  const EXPIRES_OVERRIDE = { YALDA30: '1405/10/01', MARKET100: '1405/09/30', TEACHER20: '1405/11/20' }
  const ins = db.prepare('INSERT OR REPLACE INTO coupons (code, kind, value, status, expires, used) VALUES (?,?,?,?,?,?)')
  for (const c of seedCoupons) {
   const isPercent = c.type === 'درصدی'
   const value = isPercent ? parseInt(String(c.value).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)), 10) : 100_000
   const expires = EXPIRES_OVERRIDE[c.code] ?? c.expires ?? ''
   ins.run(c.code, isPercent ? 'percent' : 'amount', value || 0, c.status, expires, c.used || 0)
  }
  console.log(`[db] seeded ${seedCoupons.length} coupons`)
 }
}
seed()

/* ---------------- APIهای خواندن عمومی ---------------- */
const PUBLIC_REVIEW = `SELECT id, kind, target_id, user_name, rating, text, status, created_at FROM reviews`

const reviewsFor = (kind, targetId) =>
 db.prepare(`${PUBLIC_REVIEW} WHERE kind = ? AND target_id = ? AND status = 'approved' ORDER BY id DESC LIMIT 50`)
  .all(kind, String(targetId))
  .map((r) => ({ id: r.id, user: r.user_name, rating: r.rating, text: r.text, date: faToday(), status: r.status }))

export function registerContentRoutes(app) {
 /* ---- دوره‌ها ---- */
 /* [فیکس F16-a] دورهٔ draft فقط برای خودش و ادمین دیده می‌شود — قبلاً وضعیت انتشار اصلاً وجود نداشت */
 const isAdminReq = (req) => {
  try { return authUser(req)?.role === 'admin' } catch { return false }
 }
 app.get('/api/courses', (req, res) => {
  const showAll = isAdminReq(req)
  const rows = db.prepare(`SELECT * FROM courses ${showAll ? '' : "WHERE status = 'published'"} ORDER BY id`).all()
  res.json({ courses: rows.map(courseOut) })
 })

 app.get('/api/courses/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM courses WHERE id = ?').get(Number(req.params.id) || 0)
  if (!r) return res.status(404).json({ error: 'دوره یافت نشد' })
  if ((r.status || 'published') !== 'published' && !isAdminReq(req)) return res.status(404).json({ error: 'دوره یافت نشد' })
  const teacher = r.teacher_id
   ? db.prepare('SELECT * FROM teacher_profiles WHERE id = ?').get(r.teacher_id)
   : null
  res.json({ course: courseOut(r), teacher: teacher ? teacherOut(teacher) : null, reviews: reviewsFor('course', r.id) })
 })

 /* ---- مدرس‌مارکت ---- */
 app.get('/api/products', (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY id').all()
  const cats = [...new Set(rows.map((p) => p.cat))]
  res.json({ products: rows.map(productOut), cats })
 })

 app.get('/api/products/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM products WHERE id = ?').get(String(req.params.id || ''))
  if (!r) return res.status(404).json({ error: 'محصول یافت نشد' })
  res.json({ product: productOut(r), reviews: reviewsFor('product', r.id) })
 })

 /* ---- وبلاگ ---- */
 app.get('/api/blog', (req, res) => {
  const rows = db.prepare('SELECT * FROM blog_posts ORDER BY date_iso DESC').all()
  res.json({ posts: rows.map(blogOut) })
 })

 app.get('/api/blog/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(String(req.params.id || ''))
  if (!r) return res.status(404).json({ error: 'مقاله یافت نشد' })
  res.json({ post: blogOut(r) })
 })

 /* ---- اساتید ---- */
 app.get('/api/teachers', (req, res) => {
  const rows = db.prepare('SELECT * FROM teacher_profiles ORDER BY id').all()
  res.json({ teachers: rows.map(teacherOut) })
 })

 app.get('/api/teachers/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM teacher_profiles WHERE id = ?').get(String(req.params.id || ''))
  if (!r) return res.status(404).json({ error: 'استاد یافت نشد' })
  const courses = db.prepare('SELECT * FROM courses WHERE teacher_id = ? ORDER BY id').all(r.id).map(courseOut)
  /* کلاس‌های زنده استاد — از جدول واقعی کلاس‌ها (نگاشت به شکل کارت‌های فرانت) */
  const liveClasses = db.prepare(`
    SELECT c.*, u.name AS teacher_name FROM classes c LEFT JOIN users u ON u.id = c.teacher_id
    WHERE c.teacher_id = ? ORDER BY c.day, c.start`).all(r.user_id || '###').map((c) => ({
   id: c.id, title: c.title, teacher: c.teacher_name || r.name, teacherId: r.id, day: c.day,
   start: c.start, dur: c.dur, price: c.price, cap: c.cap,
   enrolled: db.prepare('SELECT COUNT(*) AS n FROM enrollments WHERE class_id = ?').get(c.id).n + c.base_enrolled,
   status: 'open', icon: c.icon, color: c.color, desc: c.desc,
  }))
  const reviews = db.prepare(`
    SELECT r.id, r.rating, r.text, r.user_name, r.created_at FROM reviews r
    JOIN courses c ON c.id = CAST(r.target_id AS INTEGER)
    WHERE r.kind = 'course' AND r.status = 'approved' AND c.teacher_id = ? ORDER BY r.id DESC LIMIT 20`).all(r.id)
   .map((x) => ({ id: x.id, user: x.user_name, rating: x.rating, text: x.text, date: faToday() }))
  res.json({ teacher: teacherOut(r), courses, liveClasses, reviews })
 })

 /* ---- نظرها (عمومی خواندن، لاگین نوشتن) ---- */
 app.get('/api/testimonials', (req, res) => res.json({ items: seedTestimonials }))

 /** احراز هویت دستی برای ثبت نظر — همان قوانین authUser در index.js */
 const authUser = (req) => {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return null
  try {
   const payload = jwt.verify(token, JWT_SECRET)
   return db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid) || null
  } catch { return null }
 }

 app.post('/api/reviews', (req, res) => {
  const u = authUser(req)
  if (!u) return res.status(401).json({ error: 'برای ثبت نظر وارد حساب شوید' })
  /* [فیکس B14] سقف نرخ ثبت نظر — قبلاً برای هر کاربر لاگین‌شده بی‌محدودیت بود (اسپم صف مودریشن) */
  const rl = rateLimitSoft(`reviews|${u.id}`, 5, 10 * 60_000)
  if (rl) return res.status(429).json({ error: 'تعداد نظرهای اخیر زیاد است — کمی بعد تلاش کنید' })
  const { kind, targetId, rating, text } = req.body || {}
  if (kind !== 'course' && kind !== 'product') return res.status(400).json({ error: 'نوع نظر نامعتبر است' })
  const okTarget = kind === 'course'
   ? db.prepare('SELECT 1 AS x FROM courses WHERE id = ?').get(Number(targetId) || 0)
   : db.prepare('SELECT 1 AS x FROM products WHERE id = ?').get(String(targetId || ''))
  if (!okTarget) return res.status(404).json({ error: 'هدف نظر یافت نشد' })
  const rate = Math.min(5, Math.max(1, Math.round(Number(rating) || 0)))
  if (!rate) return res.status(400).json({ error: 'امتیاز بین ۱ تا ۵ انتخاب کنید' })
  const body = String(text || '').trim().slice(0, 800)
  if (body.length < 4) return res.status(400).json({ error: 'متن نظر خیلی کوتاه است' })
  const info = db.prepare('INSERT INTO reviews (kind, target_id, user_id, user_name, rating, text, status, created_at) VALUES (?,?,?,?,?,?,?,?)')
   .run(kind, String(targetId), u.id, u.name, rate, body, 'pending', now())
  res.json({ ok: true, id: Number(info.lastInsertRowid), status: 'pending',
   message: 'نظر شما ثبت شد و پس از تأیید مدیر نمایش داده می‌شود' })
 })

 /* ================================================================
    پرداخت واقعی سبد خرید — قیمت/تخفیف/موجودی فقط سرور
    ----------------------------------------------------------------
    قبلاً Checkout کل محاسبه را به کلاینت می‌سپرد: قیمت‌ها از state
    مرورگر خوانده می‌شد (دستکاری‌پذیر)، کدهای تخفیف هاردکد فرانت بودند
    (YALDA30/WELCOME در جاوااسکریپت!)، سفارش فقط در localStorage می‌رفت
    و موجودی انبار هیچ‌وقت کم نمی‌شد. حالا سرور قیمت واقعی DB را ملاک
    می‌گیرد، تخفیف را از جدول coupons می‌خواند، موجودی را چک و کم می‌کند
    و سفارش را در جدول orders ثبت می‌کند (دیده‌شدن در «سفارش‌های من» و پنل).
    ================================================================ */

 /* روش‌های ارسال / کد تخفیف / قیمت‌گذاری سبد → server/checkout-core.js
    (مشترک با درگاه زرین‌پال تا هر دو جریان یک منطق قیمت داشته باشند) */

 app.post('/api/coupons/check', (req, res) => {
  /* [فیکس B14] سقف نرخ چک کد تخفیف — قبلاً عمومی و بی‌محدودیت بود (بروت‌فورس کدها ممکن بود) */
  const ip = req.ip || req.socket?.remoteAddress || 'x'
  if (rateLimitSoft(`coupon|${ip}`, 20, 60_000)) return res.status(429).json({ error: 'تلاش‌های زیاد — چند لحظه بعد تلاش کنید' })
  const subtotal = Math.max(0, Number(req.body?.subtotal) || 0)
  const r = evaluateCoupon(req.body?.code, subtotal)
  if (r.error) return res.status(400).json({ error: r.error })
  res.json({ ok: true, discount: r.discount, label: r.label })
 })

 /* سقف نرخ سبک محلی — الگوی rateLimit در index.js (این فایل قبل از آن ثبت نمی‌شود) */
 const rlBuckets = new Map()
 function rateLimitSoft(key, max, windowMs) {
  const t = now()
  const arr = (rlBuckets.get(key) || []).filter((x) => t - x < windowMs)
  if (arr.length >= max) return true
  arr.push(t); rlBuckets.set(key, arr)
  if (rlBuckets.size > 4000) for (const [k, v] of rlBuckets) if (!v.length || t - v[v.length - 1] > windowMs) rlBuckets.delete(k)
  return false
 }

 const requireAuthC = (req, res, next) => {
  const u = authUser(req)
  if (!u) return res.status(401).json({ error: 'برای پرداخت ابتدا وارد حساب شوید' })
  req.user = u
  next()
 }

 /* ثبت مستقیم سفارش (بدون درگاه — سبد رایگان یا حالت آزمایشی).
    برای پرداخت واقعی زرین‌پال: POST /api/pay/zarinpal/start (server/pay.js) */
 app.post('/api/checkout', requireAuthC, (req, res) => {
  /* ۱) قیمت/تخفیف/ارسال/اطلاعات تماس — همه از هسته مشترک (منبع حقیقت DB) */
  const p = priceCart(req.user, req.body)
  if (p.error) return res.status(p.status || 400).json({ error: p.error })
  const { lines: finalLines, subtotal, discount, ship, shipCost, total, meta, couponCode } = p

  /* ۲) کاهش موجودی و افزایش فروش کالاهای فیزیکی — قبل از ثبت سفارش تا
        اگر موجودی وسط کار تمام شد، هیچ ردیف سفارش یتیم ثبت نشود (اتمیک‌بودن منطقی) */
  const stockErr = reserveStock(finalLines)
  if (stockErr) return res.status(409).json({ error: stockErr })

  /* ۳) کد سفارش یکتا + ثبت در orders (یک ردیف برای هر قلم + ردیف ارسال)
        [فیکس B4] سبدِ رایگان (total===0) مستقیم 'paid' ثبت می‌شود — قبلاً 'pending'
        می‌ماند و هیچ مسیری آن را paid نمی‌کرد: در «سفارش‌های من» برای همیشه
        «در انتظار پرداخت» و موجودی رزروشده هرگز آزاد نمی‌شد */
  const code = uniqueOrderCode()
  if (!code) return res.status(500).json({ error: 'خطا در تولید کد سفارش — دوباره تلاش کنید' })
  const finalStatus = total === 0 ? 'paid' : 'pending'

  const insOrder = db.prepare(`INSERT INTO orders (code, user_id, kind, item_id, title, amount, status, gateway, meta, created_at, qty)
   VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
  try {
   db.exec('BEGIN')
   for (const l of finalLines) {
    insOrder.run(code, req.user.id, l.kind, l.id, `${l.title}${l.qty > 1 ? ` × ${faNum(l.qty)}` : ''}`, l.final, finalStatus, 'test', meta, now(), l.qty || 1)
   }
   if (shipCost > 0) {
    insOrder.run(code, req.user.id, 'shipping', 'ship', `هزینه ارسال (${ship.label})`, shipCost, finalStatus, 'test', meta, now(), 1)
   }
   if (couponCode) db.prepare('UPDATE coupons SET used = used + 1 WHERE code = ?').run(couponCode.toUpperCase())
   db.exec('COMMIT')
  } catch (e) {
   try { db.exec('ROLLBACK') } catch { }
   console.error('[checkout] insert failed:', e.message)
   return res.status(500).json({ error: 'خطا در ثبت سفارش — دوباره تلاش کنید' })
  }

  res.json({ ok: true, code, subtotal, discount, shipCost, total, shipLabel: ship.label, items: finalLines.length, status: finalStatus })
 })

 /* ---------------- فرم تماس — قبلاً کاملاً جعلی بود (api.submitContact فقط delay+ok) ---------------- */
 const contactBuckets = new Map()
 app.post('/api/contact', (req, res) => {
  /* rate limit سبک برای فرم عمومی (ضد اسپم) */
  const ip = req.ip || req.socket?.remoteAddress || 'x'
  const t = now()
  const arr = (contactBuckets.get(ip) || []).filter((x) => t - x < 60_000)
  if (arr.length >= 5) return res.status(429).json({ error: 'تلاش‌های زیاد — چند دقیقه بعد تلاش کنید' })
  arr.push(t)
  contactBuckets.set(ip, arr)

  const name = String(req.body?.name || '').trim().slice(0, 60)
  const email = String(req.body?.email || '').trim().slice(0, 120)
  const subject = String(req.body?.subject || '').trim().slice(0, 120)
  const body = String(req.body?.body || req.body?.message || req.body?.msg || '').trim().slice(0, 2000)
  /* [فیکس F31] شماره تماس نرمال‌سازی و ذخیره می‌شود (ارقام فارسی هم پذیرفته) */
  const fa2en = (s) => s.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  const phoneRaw = fa2en(String(req.body?.phone || '').trim())
  const phone = phoneRaw.replace(/[^+\d]/g, '').slice(0, 16)
  if (!name) return res.status(400).json({ error: 'نام را وارد کنید' })
  /* ایمیل اختیاری است (فرم تماس شماره تماس هم دارد) — ولی اگر داده شود باید معتبر باشد */
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'ایمیل معتبر نیست' })
  if (body.length < 10) return res.status(400).json({ error: 'متن پیام حداقل ۱۰ حرف باشد' })
  if (phone && !/^(\+?98|0)?9\d{9}$/.test(phone.replace(/^\+98/, '0').replace(/^98/, '0'))) {
   return res.status(400).json({ error: 'شماره تماس معتبر نیست' })
  }

  db.prepare('INSERT INTO contact_messages (name, email, subject, body, phone, created_at) VALUES (?,?,?,?,?,?)')
   .run(name, email || '—', subject, body, phone || '—', now())
  res.json({ ok: true })
 })

 /* لیست پیام‌های تماس — فقط مدیر (برای اتصال پنل پشتیبانی) */
 app.get('/api/contact', (req, res) => {
  const u = authUser(req)
  if (!u || u.role !== 'admin') return res.status(403).json({ error: 'فقط مدیر' })
  const rows = db.prepare('SELECT id, name, email, phone, subject, body, created_at AS createdAt FROM contact_messages ORDER BY id DESC LIMIT 200').all()
  res.json({ messages: rows })
 })

 /* [فیکس F31] خبرنامه واقعی — قبلاً Footer فقط توست موفقیت می‌زد و هیچ endpointای نبود.
    ایمیل‌ها به‌صورت پیام تماس با موضوع «عضویت در خبرنامه» ثبت می‌شوند تا پشتیبانی ببیند. */
 const newsBuckets = new Map()
 app.post('/api/newsletter', (req, res) => {
  const ip = req.ip || '؟'
  const t = now()
  const arr = (newsBuckets.get(ip) || []).filter((x) => t - x < 60_000)
  if (arr.length >= 5) return res.status(429).json({ error: 'تلاش‌های زیاد — چند دقیقه بعد تلاش کنید' })
  arr.push(t)
  newsBuckets.set(ip, arr)

  const email = String(req.body?.email || '').trim().toLowerCase().slice(0, 120)
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'ایمیل معتبر وارد کنید' })
  const dup = db.prepare("SELECT id FROM contact_messages WHERE email = ? AND subject = 'عضویت در خبرنامه'").get(email)
  if (dup) return res.json({ ok: true, message: 'این ایمیل قبلاً در خبرنامه ثبت شده است' })
  db.prepare("INSERT INTO contact_messages (name, email, subject, body, created_at) VALUES (?,?,?,?,?)")
   .run('مشترک خبرنامه', email, 'عضویت در خبرنامه', 'درخواست عضویت در خبرنامه مدرس‌یار', now())
  res.json({ ok: true, message: 'عضویت شما در خبرنامه ثبت شد' })
 })

 /* [فیکس F31/F34] ستون بخش (دستهٔ تیکت) — قبلاً سلکت «بخش» در فرم نبود در payload
   و سرور هم ذخیره نمی‌کرد؛ پشتیبانی هرگز دستهٔ تیکت را نمی‌دید */
try { db.exec('ALTER TABLE tickets ADD COLUMN category TEXT DEFAULT \'سایر\'') } catch { /* ستون هست */ }

/* ---------------- تیکت پشتیبانی واقعی — قبلاً submitTicket فقط id تصادفی برمی‌گرداند ---------------- */
 app.post('/api/tickets', requireAuthC, (req, res) => {
  const subject = String(req.body?.subject || '').trim().slice(0, 120)
  const body = String(req.body?.body || '').trim().slice(0, 2000)
  const priority = ['بالا', 'متوسط', 'کم'].includes(req.body?.priority) ? req.body.priority : 'متوسط'
  const category = String(req.body?.category || 'سایر').slice(0, 40)
  if (subject.length < 3) return res.status(400).json({ error: 'موضوع تیکت حداقل ۳ حرف باشد' })
  if (body.length < 10) return res.status(400).json({ error: 'متن تیکت حداقل ۱۰ حرف باشد' })

  let code
  for (let tries = 0; tries < 10; tries++) {
   const candidate = 'TK-' + Math.floor(230 + Math.random() * 770)
   if (!db.prepare('SELECT 1 AS x FROM tickets WHERE code = ?').get(candidate)) { code = candidate; break }
  }
  if (!code) return res.status(500).json({ error: 'خطا در تولید کد تیکت — دوباره تلاش کنید' })

  db.prepare('INSERT INTO tickets (code, user_id, subject, body, priority, category, status, created_at) VALUES (?,?,?,?,?,?,?,?)')
   .run(code, req.user.id, subject, body, priority, category, 'open', now())
  res.json({ ok: true, ticket: { id: code, subject, date: faToday(), status: 'open', replies: 0 } })
 })

 app.get('/api/me/tickets', requireAuthC, (req, res) => {
  const rows = db.prepare('SELECT code, subject, body, status, priority, category, reply, replied_at, created_at FROM tickets WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(req.user.id)
  res.json({ tickets: rows.map((t) => ({
   id: t.code, subject: t.subject, date: new Date(t.created_at).toLocaleDateString('fa-IR'),
   status: t.status === 'open' ? 'open' : t.status, replies: t.reply ? 1 : 0, priority: t.priority,
   category: t.category || 'سایر',
   /* [فیکس F14] پاسخ واقعی ادمین برگردانده می‌شود — قبلاً تاریخچه جعلی هاردکد بود */
   reply: t.reply || '', repliedAt: t.replied_at || null,
  })) })
 })

 /* ================================================================
    پنل مدیریت — مودریشن نظرات، همه تیکت‌ها، کاربران واقعی
    (قبلاً پنل ادمین فقط داده موک ثابت نشان می‌داد و هیچ نظری قابل
    تأیید نبود — نظری که تأیید نشود هیچ‌وقت در سایت دیده نمی‌شود)
    ================================================================ */
 const requireAdminC = (req, res, next) => {
  const u = authUser(req)
  if (!u || u.role !== 'admin') return res.status(403).json({ error: 'فقط مدیر' })
  req.user = u
  next()
 }

 /* همه نظرات برای مودریشن — جدیدترین اول، فیلتر وضعیت */
 app.get('/api/admin/reviews', requireAdminC, (req, res) => {
  const status = ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : null
  const rows = db.prepare(`SELECT r.id, r.kind, r.target_id AS targetId, r.user_name AS user, r.rating, r.text, r.status, r.created_at AS createdAt,
      CASE r.kind WHEN 'course' THEN (SELECT title FROM courses WHERE id = CAST(r.target_id AS INTEGER)) ELSE (SELECT name FROM products WHERE id = r.target_id) END AS targetTitle
    FROM reviews r ${status ? 'WHERE r.status = ?' : ''} ORDER BY r.id DESC LIMIT 200`)
   .all(...(status ? [status] : []))
  res.json({ reviews: rows.map((r) => ({ ...r, date: new Date(r.createdAt).toLocaleDateString('fa-IR') })) })
 })

 /* تأیید/رد نظر — فقط ادمین */
 app.post('/api/admin/reviews/:id', requireAdminC, (req, res) => {
  const id = Number(req.params.id) || 0
  const st = req.body?.status
  if (!['approved', 'rejected', 'pending'].includes(st)) return res.status(400).json({ error: 'وضعیت نامعتبر است' })
  const info = db.prepare('UPDATE reviews SET status = ? WHERE id = ?').run(st, id)
  if (!info.changes) return res.status(404).json({ error: 'نظر پیدا نشد' })
  res.json({ ok: true, status: st })
 })

 /* همه تیکت‌ها برای پنل پشتیبانی ادمین */
 app.get('/api/admin/tickets', requireAdminC, (req, res) => {
  const rows = db.prepare(`SELECT t.code, t.subject, t.body, t.priority, t.status, t.reply, t.replied_at AS repliedAt, t.created_at AS createdAt, u.name AS user
    FROM tickets t LEFT JOIN users u ON u.id = t.user_id ORDER BY t.id DESC LIMIT 200`).all()
  res.json({ tickets: rows.map((t) => ({
   id: t.code, user: t.user || '—', subject: t.subject, msg: t.body,
   priority: t.priority, status: t.status, date: new Date(t.createdAt).toLocaleDateString('fa-IR'),
   reply: t.reply || '', repliedAt: t.repliedAt || null,
  })) })
 })

 /* تغییر وضعیت تیکت (باز → پاسخ‌داده → بسته) + ثبت متن پاسخ واقعی — ادمین
    [فیکس F14] قبلاً فقط status عوض می‌شد و متن پاسخ دور ریخته می‌شد */
 app.post('/api/admin/tickets/:code', requireAdminC, (req, res) => {
  const st = String(req.body?.status || '')
  if (!['open', 'answered', 'closed'].includes(st)) return res.status(400).json({ error: 'وضعیت نامعتبر است' })
  const reply = String(req.body?.reply ?? '').trim().slice(0, 2000)
  const code = String(req.params.code || '')
  const t = db.prepare('SELECT code, user_id FROM tickets WHERE code = ?').get(code)
  if (!t) return res.status(404).json({ error: 'تیکت پیدا نشد' })
  if (st === 'answered' && !reply) return res.status(400).json({ error: 'متن پاسخ خالی است' })
  if (reply) db.prepare('UPDATE tickets SET status = ?, reply = ?, replied_at = ? WHERE code = ?').run(st, reply, now(), code)
  else db.prepare('UPDATE tickets SET status = ? WHERE code = ?').run(st, code)
  res.json({ ok: true, status: st })
 })

 /* ================================================================
    [فیکس F15] کوپن‌ساز ادمین واقعی — قبلاً AFinance فقط به state محلی
    اضافه می‌کرد و کدِ ساخته‌شده در پرداخت «نامعتبر» می‌خورد
    ================================================================ */
 app.get('/api/admin/coupons', requireAdminC, (req, res) => {
  const rows = db.prepare('SELECT code, kind, value, status, expires, used FROM coupons ORDER BY rowid DESC LIMIT 200').all()
  res.json({ coupons: rows })
 })
 app.post('/api/admin/coupons', requireAdminC, (req, res) => {
  const code = String(req.body?.code || '').trim().toUpperCase()
  const kind = req.body?.kind === 'amount' ? 'amount' : 'percent'
  const value = Math.max(0, Math.min(100_000_000, Math.round(Number(req.body?.value) || 0)))
  if (!/^[A-Z0-9-]{3,24}$/.test(code)) return res.status(400).json({ error: 'کد باید ۳ تا ۲۴ حرف انگلیسی/عدد باشد' })
  if (kind === 'percent' && (value < 1 || value > 90)) return res.status(400).json({ error: 'درصد تخفیف باید بین ۱ تا ۹۰ باشد' })
  if (kind === 'amount' && value < 1000) return res.status(400).json({ error: 'مبلغ تخفیف حداقل ۱۰۰۰ تومان است' })
  const status = req.body?.status === 'inactive' ? 'inactive' : 'active'
  const expires = String(req.body?.expires || '').slice(0, 10)
  db.prepare(`INSERT INTO coupons (code, kind, value, status, expires, used) VALUES (?,?,?,?,?,0)
    ON CONFLICT(code) DO UPDATE SET kind=excluded.kind, value=excluded.value, status=excluded.status, expires=excluded.expires`)
   .run(code, kind, value, status, expires)
  res.json({ ok: true, coupon: { code, kind, value, status, expires } })
 })
 app.delete('/api/admin/coupons/:code', requireAdminC, (req, res) => {
  const info = db.prepare('DELETE FROM coupons WHERE code = ?').run(String(req.params.code || '').toUpperCase())
  if (!info.changes) return res.status(404).json({ error: 'کد تخفیف پیدا نشد' })
  res.json({ ok: true })
 })

 /* کاربران واقعی سیستم — قبلاً پنل «مدیریت کاربران» فقط ردیف‌های موک ثابت نشان می‌داد */
 app.get('/api/admin/users', requireAdminC, (req, res) => {
  const q = String(req.query.q || '').trim()
  const rows = db.prepare(`SELECT u.id, u.name, u.email, u.role, u.title, u.created_at AS createdAt,
     (SELECT COUNT(*) FROM enrollments e WHERE e.user_id = u.id) AS enrollCount,
     (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status != 'refunded') AS ordersCount,
     (SELECT COALESCE(SUM(o.amount), 0) FROM orders o WHERE o.user_id = u.id AND o.status = 'paid') AS spent
   FROM users u ${q ? "WHERE u.name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\'" : ''}
   ORDER BY u.created_at DESC LIMIT 300`)
   .all(...(q ? [`%${q.replace(/[\\%_]/g, '\\$&')}%`, `%${q.replace(/[\\%_]/g, '\\$&')}%`] : []))
  res.json({ users: rows.map((r) => ({
   id: r.id, name: r.name, email: r.email, role: r.role, title: r.title,
   courses: r.role === 'teacher'
    ? db.prepare('SELECT COUNT(*) AS n FROM classes WHERE teacher_id = ?').get(r.id).n
    : r.enrollCount,
   teacherStudents: r.role === 'teacher'
    ? db.prepare('SELECT COUNT(DISTINCT e.user_id) AS n FROM enrollments e JOIN classes c ON c.id = e.class_id WHERE c.teacher_id = ?').get(r.id).n
    : 0,
   orders: r.ordersCount, spent: r.spent || 0,
   joined: new Date(r.createdAt).toLocaleDateString('fa-IR'),
  })) })
 })

 /* تغییر نقش کاربر (فقط ادمین؛ ادمین نمی‌تواند نقش خودش را کم کند تا قفل بیرون نشود) */
 app.post('/api/admin/users/:id/role', requireAdminC, (req, res) => {
  const role = String(req.body?.role || '')
  if (!['student', 'teacher', 'admin'].includes(role)) return res.status(400).json({ error: 'نقش نامعتبر است' })
  const target = db.prepare('SELECT id, role FROM users WHERE id = ?').get(String(req.params.id || ''))
  if (!target) return res.status(404).json({ error: 'کاربر پیدا نشد' })
  if (target.id === req.user.id && role !== 'admin') return res.status(400).json({ error: 'نمی‌توانید نقش خودتان را کاهش دهید' })
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, target.id)
  const ROLE_LABELS = { student: 'دانش‌آموز', teacher: 'مدرس', admin: 'مدیر' }
  db.prepare('UPDATE users SET title = ? WHERE id = ?').run(ROLE_LABELS[role], target.id)
  res.json({ ok: true, role })
 })

 /* ================================================================
    [فیکس F16] CRUD واقعی ادمین — دوره‌ها، محصولات، وبلاگ، سفارش‌های فروشگاه
    و تنظیمات سیستم. قبلاً صفحات ACourses/AMarket/AContent/ASettings فقط روی
    state محلی (دادهٔ mock) کار می‌کردند: «ذخیره» با هر رفرش پریده و هیچ
    تغییری واقعاً در سایت دیده نمی‌شد.
    ================================================================ */

 /* ---------- اعتبارسنجی مشترک ---------- */
 const clampInt = (v, min, max, fb = 0) => {
  const n = Math.round(Number(String(v ?? '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))) || fb)
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : fb))
 }
 const clampFloat = (v, min, max, fb = 0) => {
  const n = Number(String(v ?? '').replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
  return Math.max(min, Math.min(max, Number.isFinite(n) ? n : fb))
 }
 const cleanStr = (v, max = 300) => String(v ?? '').trim().slice(0, max)
 /* رشتهٔ چندخطی یا آرایه → آرایهٔ سرفصل تمیز (هر خط یک درس) */
 const lineList = (v, maxItems = 100, maxLen = 160) => {
  const arr = Array.isArray(v) ? v : String(v ?? '').split(/\r?\n/)
  return arr.map((s) => cleanStr(s, maxLen)).filter(Boolean).slice(0, maxItems)
 }

 /* ---------- دوره‌ها (F16-a) ---------- */
 const COURSE_VALID = {
  title: (v) => cleanStr(v, 140), teacher: (v) => cleanStr(v, 80), teacher_id: (v) => cleanStr(v, 40),
  cat: (v) => cleanStr(v, 60), level: (v) => cleanStr(v, 40), type: (v) => (['recorded', 'live'].includes(v) ? v : 'recorded'),
  icon: (v) => cleanStr(v, 30) || 'book', color: (v) => cleanStr(v, 20) || 'grad-0',
  badge: (v) => cleanStr(v, 30) || null, desc: (v) => cleanStr(v, 3000),
 }
 app.get('/api/admin/courses', requireAdminC, (req, res) => {
  const rows = db.prepare('SELECT * FROM courses ORDER BY id DESC').all()
  res.json({ courses: rows.map(courseOut) })
 })
 app.post('/api/admin/courses', requireAdminC, (req, res) => {
  const b = req.body || {}
  const title = cleanStr(b.title, 140)
  if (!title) return res.status(400).json({ error: 'عنوان دوره الزامی است' })
  const id = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS n FROM courses').get().n
  const cur = lineList(b.curriculum)
  const feats = lineList(b.features, 20, 120)
  db.prepare(`INSERT INTO courses (id, title, teacher, teacher_id, cat, price, old_price, rating, students, hours, lessons_count, level, type, badge, icon, color, desc, features, curriculum, status, image, created_at)
   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
   .run(id, title, cleanStr(b.teacher, 80), cleanStr(b.teacher_id, 40) || 't1', cleanStr(b.cat, 60),
    clampInt(b.price, 0, 100_000_000), clampInt(b.oldPrice, 0, 100_000_000, 0) || null,
    clampFloat(b.rating, 0, 5, 5), clampInt(b.students, 0, 10_000_000), clampInt(b.hours, 0, 1000),
    clampInt(b.lessonsCount, 0, 1000), cleanStr(b.level, 40), COURSE_VALID.type(b.type),
    COURSE_VALID.badge(b.badge), COURSE_VALID.icon(b.icon), COURSE_VALID.color(b.color),
    cleanStr(b.desc, 3000), JSON.stringify(feats), JSON.stringify(cur),
    b.status === 'draft' ? 'draft' : 'published', cleanStr(b.cover, 200), now())
  res.json({ ok: true, course: courseOut(db.prepare('SELECT * FROM courses WHERE id = ?').get(id)) })
 })
 app.patch('/api/admin/courses/:id', requireAdminC, (req, res) => {
  const id = Number(req.params.id) || 0
  const row = db.prepare('SELECT * FROM courses WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'دوره پیدا نشد' })
  const b = req.body || {}
  const sets = [], args = []
  const put = (col, val) => { sets.push(`${col} = ?`); args.push(val) }
  if (b.title !== undefined) { const t = cleanStr(b.title, 140); if (!t) return res.status(400).json({ error: 'عنوان نمی‌تواند خالی باشد' }); put('title', t) }
  if (b.teacher !== undefined) put('teacher', cleanStr(b.teacher, 80))
  if (b.teacher_id !== undefined) put('teacher_id', cleanStr(b.teacher_id, 40) || row.teacher_id)
  if (b.cat !== undefined) put('cat', cleanStr(b.cat, 60))
  if (b.price !== undefined) put('price', clampInt(b.price, 0, 100_000_000))
  if (b.oldPrice !== undefined) put('old_price', clampInt(b.oldPrice, 0, 100_000_000) || null)
  if (b.hours !== undefined) put('hours', clampInt(b.hours, 0, 1000))
  if (b.lessonsCount !== undefined) put('lessons_count', clampInt(b.lessonsCount, 0, 1000))
  if (b.level !== undefined) put('level', cleanStr(b.level, 40))
  if (b.desc !== undefined) put('desc', cleanStr(b.desc, 3000))
  if (b.icon !== undefined) put('icon', COURSE_VALID.icon(b.icon))
  if (b.color !== undefined) put('color', COURSE_VALID.color(b.color))
  if (b.badge !== undefined) put('badge', COURSE_VALID.badge(b.badge))
  if (b.status !== undefined) {
   if (!['published', 'draft'].includes(b.status)) return res.status(400).json({ error: 'وضعیت نامعتبر است' })
   put('status', b.status)
  }
  if (b.cover !== undefined) put('image', cleanStr(b.cover, 200))
  if (b.curriculum !== undefined) put('curriculum', JSON.stringify(lineList(b.curriculum)))
  if (b.features !== undefined) put('features', JSON.stringify(lineList(b.features, 20, 120)))
  if (sets.length) db.prepare(`UPDATE courses SET ${sets.join(', ')} WHERE id = ?`).run(...args, id)
  res.json({ ok: true, course: courseOut(db.prepare('SELECT * FROM courses WHERE id = ?').get(id)) })
 })
 app.delete('/api/admin/courses/:id', requireAdminC, (req, res) => {
  const id = Number(req.params.id) || 0
  const row = db.prepare('SELECT id FROM courses WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'دوره پیدا نشد' })
  /* نظرات و دسترسی‌های دوره هم پاک می‌شوند تا ردیف یتیم نماند */
  db.prepare("DELETE FROM reviews WHERE kind = 'course' AND target_id = ?").run(String(id))
  try { db.prepare('DELETE FROM course_access WHERE course_id = ?').run(String(id)) } catch { /* جدول/ستون هست */ }
  db.prepare('DELETE FROM courses WHERE id = ?').run(id)
  res.json({ ok: true })
 })

 /* ---------- محصولات مدرس‌مارکت (F16-b) ---------- */
 const ID_OK = (s) => /^[A-Za-z0-9_-]{1,40}$/.test(String(s || ''))
 app.get('/api/admin/products', requireAdminC, (req, res) => {
  const rows = db.prepare('SELECT * FROM products ORDER BY rowid DESC').all()
  res.json({ products: rows.map(productOut) })
 })
 app.post('/api/admin/products', requireAdminC, (req, res) => {
  const b = req.body || {}
  const name = cleanStr(b.name, 120)
  if (!name) return res.status(400).json({ error: 'نام محصول الزامی است' })
  let id = cleanStr(b.id, 40)
  if (!ID_OK(id)) id = 'm' + now().toString(36)
  if (db.prepare('SELECT 1 AS x FROM products WHERE id = ?').get(id)) return res.status(409).json({ error: 'شناسه محصول تکراری است' })
  db.prepare(`INSERT INTO products (id, name, cat, price, old_price, rating, stock, icon, sold, specs, color, badge)
   VALUES (?,?,?,?,?,?,?,?,0,'[]',?,?)`)
   .run(id, name, cleanStr(b.cat, 60), clampInt(b.price, 0, 100_000_000),
    clampInt(b.oldPrice, 0, 100_000_000) || null, clampFloat(b.rating, 0, 5, 4.5),
    clampInt(b.stock, 0, 1_000_000), cleanStr(b.icon, 30) || 'pen',
    cleanStr(b.color, 20) || 'grad-0', cleanStr(b.badge, 30) || null)
  res.json({ ok: true, product: productOut(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) })
 })
 app.patch('/api/admin/products/:id', requireAdminC, (req, res) => {
  const id = String(req.params.id || '')
  const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'محصول پیدا نشد' })
  const b = req.body || {}
  const sets = [], args = []
  const put = (col, val) => { sets.push(`${col} = ?`); args.push(val) }
  if (b.name !== undefined) { const n = cleanStr(b.name, 120); if (!n) return res.status(400).json({ error: 'نام نمی‌تواند خالی باشد' }); put('name', n) }
  if (b.cat !== undefined) put('cat', cleanStr(b.cat, 60))
  if (b.price !== undefined) put('price', clampInt(b.price, 0, 100_000_000))
  if (b.oldPrice !== undefined) put('old_price', clampInt(b.oldPrice, 0, 100_000_000) || null)
  if (b.stock !== undefined) put('stock', clampInt(b.stock, 0, 1_000_000))
  if (b.desc !== undefined) {
   /* توضیح محصول در specs[0] نگهداری می‌شود (شکل دادهٔ mock حفظ شده) */
   const specs = j(row.specs, [])
   specs[0] = cleanStr(b.desc, 500)
   put('specs', JSON.stringify(specs))
  }
  if (sets.length) db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).run(...args, id)
  res.json({ ok: true, product: productOut(db.prepare('SELECT * FROM products WHERE id = ?').get(id)) })
 })
 app.delete('/api/admin/products/:id', requireAdminC, (req, res) => {
  const id = String(req.params.id || '')
  if (!db.prepare('SELECT 1 AS x FROM products WHERE id = ?').get(id)) return res.status(404).json({ error: 'محصول پیدا نشد' })
  db.prepare("DELETE FROM reviews WHERE kind = 'product' AND target_id = ?").run(id)
  db.prepare('DELETE FROM products WHERE id = ?').run(id)
  res.json({ ok: true })
 })

 /* ---------- سفارش‌های فروشگاه (F16-b) — وضعیت/روش ارسال واقعی ---------- */
 app.get('/api/admin/market-orders', requireAdminC, (req, res) => {
  const rows = db.prepare(`SELECT o.id, o.code, o.user_id, o.title, o.amount, o.qty, o.status, o.ship, o.meta, o.created_at, u.name AS user
   FROM orders o LEFT JOIN users u ON u.id = o.user_id
   WHERE o.kind = 'market' ORDER BY o.id DESC LIMIT 200`).all()
  res.json({ orders: rows.map((o) => {
   const meta = j(o.meta || '', {})
   return {
    id: o.code || ('ORD-' + o.id), user: o.user || meta.name || '—',
    items: o.title + (o.qty > 1 ? ` ×${o.qty}` : ''), total: o.amount, qty: o.qty,
    status: o.status === 'pending' ? 'pending' : o.status === 'refunded' ? 'canceled' : o.status === 'paid' ? 'processing' : o.status,
    ship: o.ship || '', date: new Date(o.created_at).toLocaleDateString('fa-IR'),
    addr: meta.address || '', phone: meta.phone || '',
   }
  }) })
 })
 app.post('/api/admin/market-orders/:code', requireAdminC, (req, res) => {
  const code = String(req.params.code || '')
  const row = db.prepare("SELECT id, status FROM orders WHERE code = ? AND kind = 'market'").get(code)
  if (!row) return res.status(404).json({ error: 'سفارش پیدا نشد' })
  const b = req.body || {}
  const STATUS_MAP = { pending: 'pending', processing: 'paid', shipped: 'paid', delivered: 'paid', canceled: 'refunded' }
  if (b.status !== undefined) {
   if (!Object.keys(STATUS_MAP).includes(b.status)) return res.status(400).json({ error: 'وضعیت نامعتبر است' })
   db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(STATUS_MAP[b.status], row.id)
  }
  if (b.ship !== undefined) db.prepare('UPDATE orders SET ship = ? WHERE id = ?').run(cleanStr(b.ship, 40), row.id)
  res.json({ ok: true })
 })

 /* ---------- وبلاگ (F16-c) ---------- */
 app.get('/api/admin/posts', requireAdminC, (req, res) => {
  const rows = db.prepare('SELECT * FROM blog_posts ORDER BY date_iso DESC, rowid DESC').all()
  res.json({ posts: rows.map(blogOut) })
 })
 app.post('/api/admin/posts', requireAdminC, (req, res) => {
  const b = req.body || {}
  const title = cleanStr(b.title, 160)
  if (!title) return res.status(400).json({ error: 'عنوان مقاله الزامی است' })
  let id = cleanStr(b.id, 40)
  if (!ID_OK(id)) id = 'b' + now().toString(36)
  if (db.prepare('SELECT 1 AS x FROM blog_posts WHERE id = ?').get(id)) return res.status(409).json({ error: 'شناسه مقاله تکراری است' })
  const dateISO = cleanStr(b.dateISO, 24) || new Date().toISOString().slice(0, 10)
  const date = cleanStr(b.date, 24) || faToday()
  db.prepare(`INSERT INTO blog_posts (id, title, cat, date, date_iso, read, icon, color, excerpt, body)
   VALUES (?,?,?,?,?,?,?,?,?,?)`)
   .run(id, title, cleanStr(b.cat, 60), date, dateISO, clampInt(b.read, 1, 120, 5),
    cleanStr(b.icon, 30) || 'filetext', cleanStr(b.color, 20) || 'grad-2',
    cleanStr(b.excerpt, 400), cleanStr(b.body, 60000))
  res.json({ ok: true, post: blogOut(db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id)) })
 })
 app.patch('/api/admin/posts/:id', requireAdminC, (req, res) => {
  const id = String(req.params.id || '')
  const row = db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id)
  if (!row) return res.status(404).json({ error: 'مقاله پیدا نشد' })
  const b = req.body || {}
  const sets = [], args = []
  const put = (col, val) => { sets.push(`${col} = ?`); args.push(val) }
  if (b.title !== undefined) { const t = cleanStr(b.title, 160); if (!t) return res.status(400).json({ error: 'عنوان نمی‌تواند خالی باشد' }); put('title', t) }
  if (b.cat !== undefined) put('cat', cleanStr(b.cat, 60))
  if (b.excerpt !== undefined) put('excerpt', cleanStr(b.excerpt, 400))
  if (b.body !== undefined) put('body', cleanStr(b.body, 60000))
  if (b.read !== undefined) put('read', clampInt(b.read, 1, 120, 5))
  if (sets.length) db.prepare(`UPDATE blog_posts SET ${sets.join(', ')} WHERE id = ?`).run(...args, id)
  res.json({ ok: true, post: blogOut(db.prepare('SELECT * FROM blog_posts WHERE id = ?').get(id)) })
 })
 app.delete('/api/admin/posts/:id', requireAdminC, (req, res) => {
  const info = db.prepare('DELETE FROM blog_posts WHERE id = ?').run(String(req.params.id || ''))
  if (!info.changes) return res.status(404).json({ error: 'مقاله پیدا نشد' })
  res.json({ ok: true })
 })

 /* ---------- تنظیمات سیستم (F16-d) ----------
    کلیدهای مجاز سفید Lists شده‌اند تا کلاینت نتواند کلیدهای سیستمی دیگر را بنویسد */
 const SETTINGS_KEYS = {
  /* عمومی — Footer/Contact از /api/settings/public می‌خوانند */
  site_name: 120, site_tagline: 160, site_phone: 40, site_email: 120,
  site_address: 240, site_working_hours: 120,
  maintenance_mode: 1, registration_open: 1,
  /* درگاه پرداخت — fallback زرین‌پال (pay.js) */
  zarinpal_merchant: 64, zarinpal_sandbox: 1,
  /* پیامک — fallback ملی پیامک (sms.js) */
  sms_username: 80, sms_password: 120, sms_from: 40, sms_admin: 40,
 }
 app.get('/api/admin/settings', requireAdminC, (req, res) => {
  const values = {}
  for (const k of Object.keys(SETTINGS_KEYS)) {
   const v = getSetting(k, null)
   /* رمز پیامک هرگز به‌صورت خام برنمی‌گردد */
   values[k] = k === 'sms_password' && v ? '••••••••' : (v ?? '')
  }
  res.json({
   settings: values,
   payMode: payMode(),
   smsConfigured: smsConfigured(),
  })
 })
 app.put('/api/admin/settings', requireAdminC, (req, res) => {
  const b = req.body || {}
  let n = 0
  for (const [k, maxLen] of Object.entries(SETTINGS_KEYS)) {
   if (b[k] === undefined) continue
   let v = String(b[k] ?? '').trim().slice(0, maxLen)
   /* رمز ماسک‌شدهٔ برگشتی را ذخیره نمی‌کنیم (یعنی «بدون تغییر») */
   if (k === 'sms_password' && /^•+$/.test(v)) continue
   if (k === 'zarinpal_merchant' && v && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) {
    return res.status(400).json({ error: 'مرچنت‌کد زرین‌پال باید یک UUID معتبر ۳۶ کاراکتری باشد' })
   }
   if (k === 'site_email' && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return res.status(400).json({ error: 'ایمیل معتبر نیست' })
   if ((k === 'maintenance_mode' || k === 'registration_open' || k === 'zarinpal_sandbox')) v = (v === '1' || v === 'true' || v === true) ? '1' : ''
   setSetting(k, v)
   n++
  }
  res.json({ ok: true, saved: n, note: 'برای درگاه/پیامک، تنظیم ذخیره‌شده پس از ری‌استارت سرور هم بدون env اعمال می‌شود' })
 })

 /* تنظیمات عمومی سایت — عمومی (بدون اطلاعات حساس) برای Footer/Contact */
 app.get('/api/settings/public', (req, res) => {
  res.json({
   site: {
    name: getSetting('site_name', '') || undefined,
    tagline: getSetting('site_tagline', '') || undefined,
    phone: getSetting('site_phone', '') || undefined,
    email: getSetting('site_email', '') || undefined,
    address: getSetting('site_address', '') || undefined,
    workingHours: getSetting('site_working_hours', '') || undefined,
   },
   registrationOpen: getSetting('registration_open', '1') !== '',
   maintenance: getSetting('maintenance_mode', '') === '1',
  })
 })
}
