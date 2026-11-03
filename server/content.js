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
import { db, JWT_SECRET } from './db.js'

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

/* ---------------- هلپرهای نگاشت به شکل mock فرانت ---------------- */
const j = (s, fb) => { try { return JSON.parse(s) } catch { return fb } }
const courseOut = (r) => ({
 id: r.id, title: r.title, teacher: r.teacher, teacherId: r.teacher_id, cat: r.cat,
 price: r.price, oldPrice: r.old_price ?? null, rating: r.rating, students: r.students,
 hours: r.hours, lessonsCount: r.lessons_count, level: r.level, type: r.type,
 badge: r.badge ?? null, icon: r.icon, color: r.color, desc: r.desc,
 features: j(r.features, []), curriculum: j(r.curriculum, []),
})
const productOut = (r) => ({
 id: r.id, name: r.name, cat: r.cat, price: r.price, oldPrice: r.old_price ?? null,
 rating: r.rating, stock: r.stock, icon: r.icon, sold: r.sold, specs: j(r.specs, []),
 color: r.color, badge: r.badge ?? null,
})
const teacherOut = (r) => ({
 id: r.id, name: r.name, role: r.role, bio: r.bio, skills: j(r.skills, []),
 rating: r.rating, students: r.students, classesCount: r.classes_count,
 color: r.color, joined: r.joined, status: r.status,
})
const blogOut = (r) => ({
 id: r.id, title: r.title, cat: r.cat, date: r.date, dateISO: r.date_iso,
 read: r.read, icon: r.icon, color: r.color, excerpt: r.excerpt, body: r.body || '',
})

/* تاریخ شمسی امروز با ارقام ASCII و صفرپُر — «1405/08/12»
   (قبلاً toLocaleDateString('fa-IR') ارقام فارسی برمی‌گرداند و مقایسه رشته‌ای
   با تاریخ‌های ASCII جدول همیشه «منقضی» می‌داد؛ صفرپُری هم برای مقایسه
   رشته‌ای درستِ «1405/8» vs «1405/10» لازم است) */
const faToday = () => {
 try {
  const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
  const g = (t) => parts.find((x) => x.type === t)?.value || ''
  return `${g('year')}/${g('month')}/${g('day')}`
 } catch { return '' }
}

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
 app.get('/api/courses', (req, res) => {
  const rows = db.prepare('SELECT * FROM courses ORDER BY id').all()
  res.json({ courses: rows.map(courseOut) })
 })

 app.get('/api/courses/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM courses WHERE id = ?').get(Number(req.params.id) || 0)
  if (!r) return res.status(404).json({ error: 'دوره یافت نشد' })
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

 /* روش‌های ارسال — منبع حقیقت سرور (قبلاً فقط در فرانت تعریف شده بود) */
 const SHIP_METHODS = {
  prepaid:  { label: 'پست پیش‌کرایه', cost: 49_000, freeOver: 1_000_000 },
  postpaid: { label: 'پس‌کرایه',      cost: 69_000, freeOver: null },
  express:  { label: 'پیک فوری تهران', cost: 89_000, freeOver: null },
 }

 const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
 const money = (n) => faNum(Number(n || 0).toLocaleString('en-US')) + ' تومان'

 /** اعتبارسنجی کد تخفیف سمت سرور → { discount, label } یا null */
 const evaluateCoupon = (code, subtotal) => {
  const c = db.prepare('SELECT * FROM coupons WHERE code = ?').get(String(code || '').trim().toUpperCase())
  if (!c) return { error: 'کد تخفیف نامعتبر است' }
  if (c.status !== 'active') return { error: 'این کد تخفیف فعال نیست' }
  if (c.expires && c.expires !== '—') {
   /* انقضای شمسی «1404/10/01» — مقایسه رشته‌ای تاریخ شمسی معتبر است (قالب یکسان) */
   if (c.expires < faToday()) return { error: 'این کد تخفیف منقضی شده است' }
  }
  const discount = c.kind === 'percent'
   ? Math.round((subtotal || 0) * Math.min(100, c.value) / 100)
   : Math.min(c.value, subtotal || 0)
  return {
   discount: Math.max(0, discount),
   label: c.kind === 'percent' ? `${faNum(c.value)}٪` : money(c.value),
  }
 }

 app.post('/api/coupons/check', (req, res) => {
  const subtotal = Math.max(0, Number(req.body?.subtotal) || 0)
  const r = evaluateCoupon(req.body?.code, subtotal)
  if (r.error) return res.status(400).json({ error: r.error })
  res.json({ ok: true, discount: r.discount, label: r.label })
 })

 const requireAuthC = (req, res, next) => {
  const u = authUser(req)
  if (!u) return res.status(401).json({ error: 'برای پرداخت ابتدا وارد حساب شوید' })
  req.user = u
  next()
 }

 app.post('/api/checkout', requireAuthC, (req, res) => {
  const itemsIn = req.body?.items
  if (!Array.isArray(itemsIn) || itemsIn.length < 1 || itemsIn.length > 50)
   return res.status(400).json({ error: 'سبد خرید نامعتبر است' })

  /* ۱) قیمت واقعی هر قلم از DB — قیمتِ ادعایی کلاینت هرگز ملاک نیست */
  const lines = []
  for (const it of itemsIn) {
   const qty = Math.min(20, Math.max(1, Math.round(Number(it?.qty) || 1)))
   const kind = it?.kind === 'course' ? 'course' : 'market'
   if (kind === 'course') {
    const c = db.prepare('SELECT id, title, price FROM courses WHERE id = ?').get(Number(it?.id) || 0)
    if (!c) return res.status(400).json({ error: 'یکی از دوره‌های سبد دیگر موجود نیست' })
    lines.push({ kind: 'course', id: String(c.id), title: c.title, price: c.price, qty })
   } else {
    const p = db.prepare('SELECT id, name, price, stock FROM products WHERE id = ?').get(String(it?.id || ''))
    if (!p) return res.status(400).json({ error: 'یکی از محصولات سبد دیگر موجود نیست' })
    if (p.stock < qty) return res.status(400).json({ error: `موجودی «${p.name}» کافی نیست (${faNum(p.stock)} عدد)` })
    lines.push({ kind: 'market', id: p.id, title: p.name, price: p.price, qty, stock: p.stock })
   }
  }

  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0)
  const marketSub = lines.filter((l) => l.kind === 'market').reduce((a, l) => a + l.price * l.qty, 0)
  const hasMarket = marketSub > 0

  /* ۲) تخفیف از جدول coupons — نه از رشته‌های هاردکد فرانت */
  let discount = 0
  const couponCode = String(req.body?.coupon || '').trim()
  if (couponCode) {
   const r = evaluateCoupon(couponCode, subtotal)
   if (r.error) return res.status(400).json({ error: r.error })
   discount = r.discount
  }

  /* ۳) هزینه ارسال — فقط برای کالای فیزیکی، با سقف رایگان خود روش */
  const ship = SHIP_METHODS[String(req.body?.shipKey || 'prepaid')] || SHIP_METHODS.prepaid
  const shipCost = !hasMarket ? 0 : (ship.freeOver && marketSub >= ship.freeOver ? 0 : ship.cost)
  const total = Math.max(0, subtotal - discount) + shipCost

  /* ۳) اطلاعات تماس خریدار (برای ارسال/فاکتور) — سقف‌دار و پاک‌شده */
  const contact = req.body?.contact || {}
  const meta = JSON.stringify({
   name: String(contact.name || req.user.name || '').trim().slice(0, 80),
   phone: String(contact.phone || '').trim().slice(0, 20),
   email: String(contact.email || '').trim().slice(0, 120),
   address: String(contact.address || '').trim().slice(0, 300),
  })

  /* ۴) کاهش سقف تخفیف به‌صورت متناسب روی هر قلم (مجموع دقیق حفظ می‌شود) */
  const factor = subtotal > 0 ? (subtotal - discount) / subtotal : 1
  let allocated = 0
  const finalLines = lines.map((l, i) => {
   if (i === lines.length - 1) {
    const lineFinal = Math.max(0, subtotal - discount) - allocated
    return { ...l, final: lineFinal }
   }
   const lineFinal = Math.round(l.price * l.qty * factor)
   allocated += lineFinal
   return { ...l, final: lineFinal }
  })

  /* ۵) کاهش موجودی و افزایش فروش کالاهای فیزیکی — قبل از ثبت سفارش تا
        اگر موجودی وسط کار تمام شد، هیچ ردیف سفارش یتیم ثبت نشود (اتمیک‌بودن منطقی) */
  const updStock = db.prepare('UPDATE products SET stock = stock - ?, sold = sold + ? WHERE id = ? AND stock >= ?')
  for (const l of finalLines) {
   if (l.kind === 'market' && updStock.run(l.qty, l.qty, l.id, l.qty).changes === 0)
    return res.status(409).json({ error: `موجودی «${l.title}» همین الان تمام شد — سبد را به‌روز کنید` })
  }

  /* ۶) کد سفارش یکتا + ثبت در orders (یک ردیف برای هر قلم + ردیف ارسال) */
  let code
  for (let tries = 0; tries < 10; tries++) {
   const candidate = 'ORD-' + Math.floor(100000 + Math.random() * 900000)
   if (!db.prepare('SELECT 1 AS x FROM orders WHERE code = ?').get(candidate)) { code = candidate; break }
  }
  if (!code) return res.status(500).json({ error: 'خطا در تولید کد سفارش — دوباره تلاش کنید' })

  const insOrder = db.prepare(`INSERT INTO orders (code, user_id, kind, item_id, title, amount, status, gateway, meta, created_at)
   VALUES (?,?,?,?,?,?,'pending','test',?,?)`)
  for (const l of finalLines) {
   insOrder.run(code, req.user.id, l.kind, l.id, `${l.title} × ${faNum(l.qty)}`, l.final, meta, now())
  }
  if (shipCost > 0) {
   insOrder.run(code, req.user.id, 'shipping', 'ship', `هزینه ارسال (${ship.label})`, shipCost, meta, now())
  }

  if (couponCode) db.prepare('UPDATE coupons SET used = used + 1 WHERE code = ?').run(couponCode.toUpperCase())

  res.json({ ok: true, code, subtotal, discount, shipCost, total, shipLabel: ship.label, items: finalLines.length })
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
  if (!name) return res.status(400).json({ error: 'نام را وارد کنید' })
  /* ایمیل اختیاری است (فرم تماس شماره تماس هم دارد) — ولی اگر داده شود باید معتبر باشد */
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'ایمیل معتبر نیست' })
  if (body.length < 10) return res.status(400).json({ error: 'متن پیام حداقل ۱۰ حرف باشد' })

  db.prepare('INSERT INTO contact_messages (name, email, subject, body, created_at) VALUES (?,?,?,?,?)')
   .run(name, email || '—', subject, body, now())
  res.json({ ok: true })
 })

 /* لیست پیام‌های تماس — فقط مدیر (برای اتصال پنل پشتیبانی) */
 app.get('/api/contact', (req, res) => {
  const u = authUser(req)
  if (!u || u.role !== 'admin') return res.status(403).json({ error: 'فقط مدیر' })
  const rows = db.prepare('SELECT id, name, email, subject, body, created_at AS createdAt FROM contact_messages ORDER BY id DESC LIMIT 200').all()
  res.json({ messages: rows })
 })

 /* ---------------- تیکت پشتیبانی واقعی — قبلاً submitTicket فقط id تصادفی برمی‌گرداند ---------------- */
 app.post('/api/tickets', requireAuthC, (req, res) => {
  const subject = String(req.body?.subject || '').trim().slice(0, 120)
  const body = String(req.body?.body || '').trim().slice(0, 2000)
  const priority = ['بالا', 'متوسط', 'کم'].includes(req.body?.priority) ? req.body.priority : 'متوسط'
  if (subject.length < 3) return res.status(400).json({ error: 'موضوع تیکت حداقل ۳ حرف باشد' })
  if (body.length < 10) return res.status(400).json({ error: 'متن تیکت حداقل ۱۰ حرف باشد' })

  let code
  for (let tries = 0; tries < 10; tries++) {
   const candidate = 'TK-' + Math.floor(230 + Math.random() * 770)
   if (!db.prepare('SELECT 1 AS x FROM tickets WHERE code = ?').get(candidate)) { code = candidate; break }
  }
  if (!code) return res.status(500).json({ error: 'خطا در تولید کد تیکت — دوباره تلاش کنید' })

  db.prepare('INSERT INTO tickets (code, user_id, subject, body, priority, status, created_at) VALUES (?,?,?,?,?,?,?)')
   .run(code, req.user.id, subject, body, priority, 'open', now())
  res.json({ ok: true, ticket: { id: code, subject, date: faToday(), status: 'open', replies: 0 } })
 })

 app.get('/api/me/tickets', requireAuthC, (req, res) => {
  const rows = db.prepare('SELECT code, subject, body, status, priority, created_at FROM tickets WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(req.user.id)
  res.json({ tickets: rows.map((t) => ({
   id: t.code, subject: t.subject, date: new Date(t.created_at).toLocaleDateString('fa-IR'),
   status: t.status === 'open' ? 'open' : t.status, replies: 0, priority: t.priority,
  })) })
 })
}
