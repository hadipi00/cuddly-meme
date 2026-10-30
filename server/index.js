// =====================================================================
// سرور مدرس‌یار — Express + SQLite + JWT
// ---------------------------------------------------------------------
// بخش ۱ (این نسخه): احراز هویت واقعی + کلاس‌های آنلاین زنده
//   • ثبت‌نام / ورود با رمز هش‌شده (bcrypt) و توکن JWT
//   • CRUD کلاس آنلاین (مدرس/مدیر)
//   • ثبت‌نام دانش‌آموز در کلاس (با کنترل ظرفیت)
//   • موتور کلاس زنده: شروع/پایان توسط مدرس — منبع حقیقت برای همه کلاینت‌ها
//   • حضور و غیاب با heartbeat + دست بلند شده
//   • چت زنده کلاس (polling با ?after=id — سبک و مقاوم)
// در حالت production بیلد فرانت (../dist) را هم سرو می‌کند.
// =====================================================================
import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { db, JWT_SECRET, publicUser, classRow } from './db.js'
import { searchIndex, buildIndex } from './contentIndex.mjs'
import { registerExamRoutes } from './exams.js'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
// برای تصویر پس‌زمینه وایت‌برد (base64) лимیت بالاتر لازم است
app.use(express.json({ limit: '12mb' }))

const PORT = process.env.PORT || 4000
const now = () => Date.now()
const b64 = (buf) => Buffer.from(buf).toString('base64')

/* ---------------- هلپرهای احراز هویت ---------------- */
const signToken = (u) => jwt.sign({ uid: u.id, role: u.role }, JWT_SECRET, { expiresIn: '7d' })

function authUser(req) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    return db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid) || null
  } catch { return null }
}

const requireAuth = (req, res, next) => {
  const u = authUser(req)
  if (!u) return res.status(401).json({ error: 'ابتدا وارد حساب شوید' })
  req.user = u
  next()
}
const requireRole = (...roles) => (req, res, next) => {
  const u = authUser(req)
  if (!u) return res.status(401).json({ error: 'ابتدا وارد حساب شوید' })
  if (!roles.includes(u.role)) return res.status(403).json({ error: 'دسترسی مجاز نیست' })
  req.user = u
  next()
}

/* ---------------- احراز هویت ---------------- */
app.post('/api/auth/register', (req, res) => {
  const { name, email, password } = req.body || {}
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'نام را وارد کنید' })
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'ایمیل معتبر نیست' })
  if (!password || String(password).length < 6) return res.status(400).json({ error: 'رمز عبور باید حداقل ۶ کاراکتر باشد' })

  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(String(email).toLowerCase())
  if (exists) return res.status(409).json({ error: 'با این ایمیل قبلاً حساب ساخته شده — وارد شوید' })

  const id = 'u-' + randomId()
  const colors = ['grad-0', 'grad-1', 'grad-2', 'grad-3', 'grad-4', 'grad-5']
  db.prepare('INSERT INTO users (id, name, email, password_hash, role, color, title, created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(id, String(name).trim(), String(email).toLowerCase(), bcrypt.hashSync(String(password), 8),
      'student', colors[Math.floor(Math.random() * colors.length)], 'دانش‌آموز', now())

  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(id)
  res.json({ token: signToken(u), user: publicUser(u) })
})

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'ایمیل و رمز عبور الزامی است' })
  const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).toLowerCase().trim())
  if (!u || !bcrypt.compareSync(String(password), u.password_hash)) {
    return res.status(401).json({ error: 'ایمیل یا رمز عبور اشتباه است' })
  }
  res.json({ token: signToken(u), user: publicUser(u) })
})

app.get('/api/auth/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }))

/* ---------------- کلاس‌های آنلاین ---------------- */
const enrolledCount = (classId) =>
  db.prepare('SELECT COUNT(*) AS n FROM enrollments WHERE class_id = ?').get(classId).n +
  (db.prepare('SELECT base_enrolled AS n FROM classes WHERE id = ?').get(classId)?.n || 0)

const classWithMeta = (c, user) => ({
  ...classRow(c),
  teacherName: c.teacher_name,
  teacherTitle: c.teacher_title,
  enrolled: enrolledCount(c.id),
  iAmIn: user ? !!db.prepare('SELECT 1 AS x FROM enrollments WHERE class_id = ? AND user_id = ?').get(c.id, user.id) : false,
  isMine: user ? (c.teacher_id === user.id || user.role === 'admin') : false,
})

const SELECT_CLASSES = `
  SELECT c.*, t.name AS teacher_name, t.title AS teacher_title
  FROM classes c LEFT JOIN users t ON t.id = c.teacher_id`

app.get('/api/classes', (req, res) => {
  const user = authUser(req)
  const { status, teacher } = req.query
  let sql = SELECT_CLASSES
  const cond = [], params = []
  if (status) { cond.push('c.status = ?'); params.push(status) }
  if (teacher) { cond.push('c.teacher_id = ?'); params.push(teacher) }
  if (cond.length) sql += ' WHERE ' + cond.join(' AND ')
  sql += ' ORDER BY c.day, c.start'
  res.json({ classes: db.prepare(sql).all(...params).map((c) => classWithMeta(c, user)) })
})

app.get('/api/classes/:id', (req, res) => {
  const user = authUser(req)
  const c = db.prepare(SELECT_CLASSES + ' WHERE c.id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  res.json({ class: classWithMeta(c, user) })
})

app.post('/api/classes', requireRole('teacher', 'admin'), (req, res) => {
  const { title, desc, icon, color, day, start, dur, cap, price } = req.body || {}
  if (!title || !String(title).trim()) return res.status(400).json({ error: 'عنوان کلاس الزامی است' })
  if (day == null || !start) return res.status(400).json({ error: 'روز و ساعت کلاس الزامی است' })
  const id = 'c' + Date.now().toString(36)
  const room = 'room-' + id
  db.prepare(`INSERT INTO classes (id, title, desc, icon, color, teacher_id, day, start, dur, cap, price, base_enrolled, room, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,0,?,'scheduled',?)`)
    .run(id, String(title).trim(), String(desc || ''), icon || 'video', color || 'grad-0',
      req.user.id, Number(day) || 0, String(start), Math.max(15, Number(dur) || 90),
      Math.max(1, Number(cap) || 30), Math.max(0, Number(price) || 0), room, now())
  const c = db.prepare(SELECT_CLASSES + ' WHERE c.id = ?').get(id)
  res.json({ class: classWithMeta(c, req.user) })
})

app.patch('/api/classes/:id', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس می‌تواند ویرایش کند' })
  const allowed = ['title', 'desc', 'day', 'start', 'dur', 'cap', 'price', 'icon', 'color']
  const sets = [], params = []
  for (const k of allowed) {
    if (req.body?.[k] !== undefined) {
      const numeric = ['day', 'dur', 'cap', 'price'].includes(k)
      sets.push(`${k} = ?`)
      params.push(numeric ? Math.max(0, Number(req.body[k]) || 0) : String(req.body[k]))
    }
  }
  if (!sets.length) return res.json({ ok: true, class: classWithMeta(c, req.user) })
  params.push(c.id)
  db.prepare(`UPDATE classes SET ${sets.join(', ')} WHERE id = ?`).run(...params)
  const row = db.prepare(SELECT_CLASSES + ' WHERE c.id = ?').get(c.id)
  res.json({ ok: true, class: classWithMeta(row, req.user) })
})

app.delete('/api/classes/:id', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (req.user.role !== 'admin' && c.teacher_id !== req.user.id) return res.status(403).json({ error: 'فقط مدرس همان کلاس' })
  db.prepare('DELETE FROM messages WHERE class_id = ?').run(c.id)
  db.prepare('DELETE FROM attendance WHERE class_id = ?').run(c.id)
  db.prepare('DELETE FROM enrollments WHERE class_id = ?').run(c.id)
  db.prepare('DELETE FROM classes WHERE id = ?').run(c.id)
  res.json({ ok: true })
})

/* ثبت‌نام دانش‌آموز در کلاس — فقط کلاس‌های رایگان (کلاس‌های پولی باید خرید شوند) */
app.post('/api/classes/:id/enroll', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (c.status === 'ended') return res.status(400).json({ error: 'این کلاس برگزار شده است' })
  if (c.price > 0) return res.status(402).json({ error: 'این کلاس پولی است — ابتدا خرید/ثبت‌نام انجام دهید', needPurchase: true })
  const cnt = db.prepare('SELECT COUNT(*) AS n FROM enrollments WHERE class_id = ?').get(c.id).n + c.base_enrolled
  if (cnt >= c.cap) return res.status(400).json({ error: 'ظرفیت کلاس تکمیل است' })
  db.prepare('INSERT OR IGNORE INTO enrollments (class_id, user_id, created_at) VALUES (?,?,?)').run(c.id, req.user.id, now())
  res.json({ ok: true, enrolled: cnt + 1 })
})

app.delete('/api/classes/:id/enroll', requireAuth, (req, res) => {
  db.prepare('DELETE FROM enrollments WHERE class_id = ? AND user_id = ?').run(req.params.id, req.user.id)
  res.json({ ok: true })
})

/* ---------------- موتور کلاس زنده — منبع حقیقت سرور ---------------- */
const canControl = (c, u) => u && (u.role === 'admin' || c.teacher_id === u.id)

/** دسترسی ورود به کلاس: مدرس همان کلاس / ادمین / دانش‌آموز ثبت‌نام‌شده (خریدار) */
const isEnrolled = (classId, userId) =>
  !!db.prepare('SELECT 1 AS x FROM enrollments WHERE class_id = ? AND user_id = ?').get(classId, userId)
const classAccess = (c, u) => u && (u.role === 'admin' || c.teacher_id === u.id || isEnrolled(c.id, u.id))

/* ---------------- خرید / ثبت‌نام کلاس (گیت ورود به اتاق) ---------------- */
app.post('/api/classes/:id/purchase', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (c.status === 'ended') return res.status(400).json({ error: 'این کلاس برگزار شده است' })
  if (isEnrolled(c.id, req.user.id)) return res.json({ ok: true, already: true })
  const cnt = db.prepare('SELECT COUNT(*) AS n FROM enrollments WHERE class_id = ?').get(c.id).n + c.base_enrolled
  if (cnt >= c.cap) return res.status(400).json({ error: 'ظرفیت کلاس تکمیل است' })

  let order = null
  if (c.price > 0) {
    // درگاه واقعی (زرین‌پال) در مرحله بعد — فعلاً ثبت پرداخت آزمایشی برای تست کامل جریان خرید
    const code = 'MY-' + Date.now().toString(36).toUpperCase()
    const info = db.prepare(`INSERT INTO orders (code, user_id, kind, item_id, title, amount, status, gateway, created_at)
      VALUES (?,?,?,?,?,?,'paid','test',?)`)
      .run(code, req.user.id, 'class', c.id, c.title, c.price, now())
    order = db.prepare('SELECT code, amount, status, gateway, created_at FROM orders WHERE id = ?').get(info.lastInsertRowid)
  }
  db.prepare('INSERT OR IGNORE INTO enrollments (class_id, user_id, created_at) VALUES (?,?,?)').run(c.id, req.user.id, now())
  res.json({ ok: true, already: false, order, enrolled: cnt + 1, price: c.price })
})

/** لیست خریدهای کاربر (برای «دوره‌های من» / سفارش‌ها) */
app.get('/api/me/orders', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT id, code, kind, item_id AS itemId, title, amount, status, gateway, created_at AS createdAt FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 100').all(req.user.id)
  res.json({ orders: rows })
})

/* ---------------- وایت‌برد همگام کلاس ---------------- */
/* رسم زنده (draft) هر کاربر در حافظه نگه داشته می‌شود تا گیرنده‌هایی که
   SSE آن‌ها بافر شده با polling هم قلم زنده را ببینند */
const wbDrafts = new Map() // classId → Map<uid, { userId, stroke, ts }>
const wbBgRev = new Map()  // classId → شماره نسخه پس‌زمینه (عکس/PDF)

function wbDraftRoom(classId) {
  let m = wbDrafts.get(classId)
  if (!m) { m = new Map(); wbDrafts.set(classId, m) }
  return m
}

app.get('/api/classes/:id/board', requireAuth, (req, res) => {
  const c = db.prepare('SELECT id, teacher_id, board_locked, board_bg FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!classAccess(c, req.user)) return res.status(403).json({ error: 'فقط ثبت‌نام‌شده‌های کلاس' })
  const strokes = db.prepare('SELECT id, user_id AS userId, color, size, tool, points, created_at AS createdAt FROM board_strokes WHERE class_id = ? ORDER BY id').all(c.id)
    .map((s) => ({ ...s, points: JSON.parse(s.points) }))
  res.json({ strokes, locked: !!c.board_locked, bg: c.board_bg || null })
})

app.post('/api/classes/:id/board', requireAuth, (req, res) => {
  const c = db.prepare('SELECT id, teacher_id, board_locked FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!classAccess(c, req.user)) return res.status(403).json({ error: 'فقط ثبت‌نام‌شده‌های کلاس' })
  if (c.board_locked && !canControl(c, req.user)) return res.status(403).json({ error: 'تخته توسط مدرس قفل شده است' })
  const { color, size, tool, points } = req.body || {}
  if (!Array.isArray(points) || points.length < 2 || points.length > 800) return res.status(400).json({ error: 'نقاط نامعتبر است' })
  if (points.some((p) => !Array.isArray(p) || p.length !== 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])))
    return res.status(400).json({ error: 'نقاط نامعتبر است' })
  const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(String(color || '')) ? String(color) : '#0f172a'
  const safeSize = Math.min(40, Math.max(1, Number(size) || 4))
  const safeTool = tool === 'erase' ? 'erase' : 'pen'
  const info = db.prepare('INSERT INTO board_strokes (class_id, user_id, color, size, tool, points, created_at) VALUES (?,?,?,?,?,?,?)')
    .run(c.id, req.user.id, safeColor, safeSize, safeTool, JSON.stringify(points.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)])), now())
  const strokeOut = { id: Number(info.lastInsertRowid), userId: req.user.id, color: safeColor, size: safeSize, tool: safeTool, points: points.map(([x, y]) => [+x.toFixed(4), +y.toFixed(4)]) }
  broadcast(c.id, { type: 'board', stroke: strokeOut, at: now() })
  res.json({ ok: true, stroke: strokeOut })
})

app.delete('/api/classes/:id/board', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس' })
  db.prepare('DELETE FROM board_strokes WHERE class_id = ?').run(c.id)
  broadcast(c.id, { type: 'board-clear', at: now() })
  res.json({ ok: true })
})

app.post('/api/classes/:id/board/lock', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس' })
  const locked = req.body?.locked ? 1 : 0
  db.prepare('UPDATE classes SET board_locked = ? WHERE id = ?').run(locked, c.id)
  broadcast(c.id, { type: 'board-lock', locked: !!locked, at: now() })
  res.json({ ok: true, locked: !!locked })
})

/** باز/بسته شدن وایت‌برد توسط مدرس — برای همه کلاس همگام می‌شود (دانش‌آموز هم تخته را می‌بیند) */
app.post('/api/classes/:id/board/open', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس' })
  const open = req.body?.open ? 1 : 0
  db.prepare('UPDATE classes SET board_open = ? WHERE id = ?').run(open, c.id)
  broadcast(c.id, { type: 'board-open', open: !!open, at: now() })
  res.json({ ok: true, open: !!open })
})

/** رسم زنده (لحظه‌ای) — ذخیره نمی‌شود، فقط به بقیه رله می‌شود تا قلم از اول دیده شود
 *  آخرین draft هر کاربر در حافظه هم می‌ماند (تا ۴ ثانیه) برای گیرنده‌های polling */
app.post('/api/classes/:id/board/draft', requireAuth, (req, res) => {
  const c = db.prepare('SELECT id, teacher_id, board_locked FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!classAccess(c, req.user)) return res.status(403).json({ error: 'فقط ثبت‌نام‌شده‌های کلاس' })
  if (c.board_locked && !canControl(c, req.user)) return res.status(403).json({ error: 'تخته قفل است' })
  const { color, size, tool, points } = req.body || {}
  if (!Array.isArray(points) || !points.length || points.length > 600) return res.json({ ok: false })
  const stroke = {
    color: /^#[0-9a-fA-F]{3,8}$/.test(String(color || '')) ? String(color) : '#0f172a',
    size: Math.min(40, Math.max(1, Number(size) || 4)),
    tool: tool === 'erase' ? 'erase' : 'pen',
    points: points.slice(-600),
  }
  /* نگهداری آخرین draft هر کاربر برای polling + رله لحظه‌ای با SSE */
  const dm = wbDraftRoom(c.id)
  dm.set(req.user.id, { userId: req.user.id, stroke, ts: now() })
  for (const [uid, d] of dm) if (now() - d.ts > 4_000) dm.delete(uid)
  broadcast(c.id, { type: 'board-draft', userId: req.user.id, at: now(), stroke })
  res.json({ ok: true })
})

/** وضعیت زنده تخته — polling مستقل از SSE (مقاوم در برابر پروکسی‌های بافر) */
app.get('/api/classes/:id/board/live', requireAuth, (req, res) => {
  const c = db.prepare('SELECT id, teacher_id, board_locked, board_open, board_bg FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!classAccess(c, req.user)) return res.status(403).json({ error: 'فقط ثبت‌نام‌شده‌های کلاس' })
  const after = Number(req.query.after) || 0
  const dt = Number(req.query.dt) || 0
  const bgr = req.query.bgr == null || req.query.bgr === '' ? -1 : Number(req.query.bgr)
  const strokes = db.prepare(`SELECT id, user_id AS userId, color, size, tool, points FROM board_strokes
    WHERE class_id = ? AND id > ? ORDER BY id LIMIT 200`).all(c.id, after)
    .map((s) => ({ ...s, points: JSON.parse(s.points) }))
  const dmap = wbDrafts.get(c.id)
  const drafts = []
  if (dmap) for (const [uid, d] of dmap) if (d.ts > dt && uid !== req.user.id) drafts.push({ userId: uid, ...d.stroke })
  const rev = wbBgRev.get(c.id) || 0
  const out = { serverTime: now(), open: !!c.board_open, locked: !!c.board_locked, bgRev: rev, strokes, drafts }
  if (bgr !== rev) out.bg = c.board_bg || null
  res.json(out)
})

/** پس‌زمینه تخته (عکس یا صفحه‌ای از PDF) — فقط مدرس؛ dataURL ذخیره و به همه broadcast می‌شود */
const BG_RE = /^data:image\/(png|jpe?g|webp);base64,[A-Za-z0-9+/=]+$/
app.post('/api/classes/:id/board/bg', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس' })
  const img = String(req.body?.img || '')
  if (img.length > 9_000_000) return res.status(413).json({ error: 'فایل خیلی بزرگ است — حداکثر حدود ۶ مگابایت' })
  if (img && !BG_RE.test(img)) return res.status(400).json({ error: 'فرمت تصویر پشتیبانی نمی‌شود' })
  db.prepare('UPDATE classes SET board_bg = ? WHERE id = ?').run(img, c.id)
  wbBgRev.set(c.id, (wbBgRev.get(c.id) || 0) + 1)
  broadcast(c.id, { type: 'board-bg', img: img || null, at: now() })
  res.json({ ok: true })
})
app.delete('/api/classes/:id/board/bg', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس' })
  db.prepare("UPDATE classes SET board_bg = '' WHERE id = ?").run(c.id)
  wbBgRev.set(c.id, (wbBgRev.get(c.id) || 0) + 1)
  broadcast(c.id, { type: 'board-bg', img: null, at: now() })
  res.json({ ok: true })
})

app.post('/api/classes/:id/start', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس می‌تواند شروع کند' })
  const startedAt = now()
  db.prepare(`UPDATE classes SET status='live', started_at=?, ended_at=NULL WHERE id=?`).run(startedAt, c.id)
  // جلسه جدید — دست‌ها و اجازه‌های جلسه قبل پاک می‌شود
  db.prepare('UPDATE attendance SET hand=0, can_speak=0 WHERE class_id=?').run(c.id)
  broadcast(c.id, { type: 'live', status: 'live', startedAt, at: startedAt })
  res.json({ ok: true, startedAt })
})

app.post('/api/classes/:id/end', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس می‌تواند پایان دهد' })
  const endedAt = now()
  const wasLive = c.status === 'live'
  db.prepare(`UPDATE classes SET status='ended', ended_at=? WHERE id=? AND status='live'`).run(endedAt, c.id)
  db.prepare('UPDATE attendance SET hand=0 WHERE class_id=?').run(c.id)
  // ثبت جلسه برگزارشده — برای بخش «جلسات قبلی» پنل دانش‌آموز (ضبط + فایل)
  if (wasLive && c.started_at) {
    db.prepare(`INSERT OR IGNORE INTO class_sessions (class_id, started_at, ended_at, dur, created_at)
      VALUES (?,?,?,?,?)`)
      .run(c.id, c.started_at, endedAt, Math.max(1, Math.floor((endedAt - c.started_at) / 1000)), endedAt)
  }
  broadcast(c.id, { type: 'ended', status: 'ended', endedAt, at: endedAt })
  res.json({ ok: true, endedAt })
})

/* ---------------- جزئیات کامل کلاس (جلسات پیش‌رو/برگزارشده + فایل‌ها) ---------------- */
const httpUrl = (u) => {
  const s = String(u || '').trim()
  return /^https?:\/\/.+/i.test(s) ? s.slice(0, 1000) : null
}

/** نمای کامل کلاس برای دانش‌آموزِ ثبت‌نام‌شده (خریدار) یا مدرس/ادمین */
app.get('/api/classes/:id/detail', requireAuth, (req, res) => {
  const c = db.prepare(SELECT_CLASSES + ' WHERE c.id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  const manage = canControl(c, req.user)
  if (!classAccess(c, req.user)) return res.status(403).json({ error: 'برای دیدن جزئیات کلاس باید در آن ثبت‌نام کنید' })

  const sessions = db.prepare(`SELECT s.id, s.started_at AS startedAt, s.ended_at AS endedAt, s.dur, s.recording_url AS recordingUrl,
      (SELECT COUNT(*) FROM class_materials m WHERE m.session_id = s.id) AS materialsCount
    FROM class_sessions s WHERE s.class_id = ? ORDER BY s.started_at DESC LIMIT 60`).all(c.id)
  const materials = db.prepare(`SELECT id, session_id AS sessionId, title, url, created_at AS createdAt
    FROM class_materials WHERE class_id = ? ORDER BY id DESC LIMIT 200`).all(c.id)

  res.json({
    class: classWithMeta(c, req.user),
    canManage: manage,
    sessions,
    materials,
  })
})

/** ثبت/ویرایش لینک مستقیم ویدیوی ضبط‌شده یک جلسه — فقط مدرس همان کلاس */
app.post('/api/classes/:id/sessions/:sid/recording', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس می‌تواند ضبط را ثبت کند' })
  const s = db.prepare('SELECT id FROM class_sessions WHERE id = ? AND class_id = ?').get(Number(req.params.sid) || 0, c.id)
  if (!s) return res.status(404).json({ error: 'جلسه پیدا نشد' })
  const url = httpUrl(req.body?.url)
  if (!url) return res.status(400).json({ error: 'لینک باید با http:// یا https:// شروع شود' })
  db.prepare('UPDATE class_sessions SET recording_url = ? WHERE id = ?').run(url, s.id)
  res.json({ ok: true, url })
})

/** افزودن فایل/جزوه به کلاس (یا به یک جلسه خاص) — فقط مدرس همان کلاس */
app.post('/api/classes/:id/materials', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس می‌تواند فایل اضافه کند' })
  const title = String(req.body?.title || '').trim().slice(0, 120)
  const url = httpUrl(req.body?.url)
  const sessionId = req.body?.sessionId ? Number(req.body.sessionId) : null
  if (!title) return res.status(400).json({ error: 'عنوان فایل الزامی است' })
  if (!url) return res.status(400).json({ error: 'لینک باید با http:// یا https:// شروع شود' })
  if (sessionId) {
    const s = db.prepare('SELECT id FROM class_sessions WHERE id = ? AND class_id = ?').get(sessionId, c.id)
    if (!s) return res.status(404).json({ error: 'جلسه پیدا نشد' })
  }
  const info = db.prepare('INSERT INTO class_materials (class_id, session_id, title, url, created_at) VALUES (?,?,?,?,?)')
    .run(c.id, sessionId, title, url, now())
  const m = db.prepare('SELECT id, session_id AS sessionId, title, url, created_at AS createdAt FROM class_materials WHERE id = ?').get(info.lastInsertRowid)
  res.json({ ok: true, material: m })
})

/** حذف فایل/جزوه — فقط مدرس همان کلاس */
app.delete('/api/classes/:id/materials/:mid', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس می‌تواند فایل حذف کند' })
  const info = db.prepare('DELETE FROM class_materials WHERE id = ? AND class_id = ?').run(Number(req.params.mid) || 0, c.id)
  if (!info.changes) return res.status(404).json({ error: 'فایل پیدا نشد' })
  res.json({ ok: true })
})

/** وضعیت لحظه‌ای کلاس — polling عمومی (تایمر + حاضران + وضعیت تخته) */
app.get('/api/classes/:id/state', (req, res) => {
  const c = db.prepare('SELECT id, status, started_at, ended_at, board_open, board_locked FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  res.json({
    id: c.id, status: c.status, startedAt: c.started_at, endedAt: c.ended_at,
    boardOpen: !!c.board_open, boardLocked: !!c.board_locked,
    participants: liveParticipants(c.id), serverTime: now(),
  })
})

/** نمای کلی برای poller فرانت — همه کلاس‌های live/ended اخیر */
app.get('/api/live/overview', (req, res) => {
  const rows = db.prepare(`SELECT id, status, started_at, ended_at FROM classes
    WHERE status != 'scheduled' OR (started_at IS NOT NULL AND started_at > ?)
    ORDER BY COALESCE(started_at, 0) DESC LIMIT 50`).all(now() - 7 * 86400_000)
  res.json({ classes: rows.map((r) => ({ id: r.id, status: r.status, startedAt: r.started_at, endedAt: r.ended_at })), serverTime: now() })
})

/* ---------------- حضور و غیاب (heartbeat) ---------------- */
app.post('/api/classes/:id/heartbeat', requireAuth, (req, res) => {
  const c = db.prepare('SELECT id, status, teacher_id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!classAccess(c, req.user)) return res.status(403).json({ error: 'برای حضور در کلاس باید ثبت‌نام کنید' })
  const hand = req.body?.hand ? 1 : 0
  db.prepare(`INSERT INTO attendance (class_id, user_id, hand, first_seen, last_seen) VALUES (?,?,?,?,?)
    ON CONFLICT(class_id, user_id) DO UPDATE SET last_seen=excluded.last_seen, hand=excluded.hand`)
    .run(c.id, req.user.id, hand, now(), now())
  res.json({ ok: true, participants: liveParticipants(c.id) })
})

const ONLINE_WINDOW = 25_000 // ۲۵ ثانیه — با heartbeat هر ۸ ثانیه
function liveParticipants(classId) {
  return db.prepare(`SELECT a.user_id AS id, u.name, u.role, u.color, a.hand, a.can_speak, a.first_seen
    FROM attendance a JOIN users u ON u.id = a.user_id
    WHERE a.class_id = ? AND a.last_seen > ? ORDER BY a.first_seen`).all(classId, now() - ONLINE_WINDOW)
    .map((p) => ({ id: p.id, name: p.name, role: p.role, color: p.color, hand: !!p.hand, canSpeak: !!p.can_speak, joinedAt: p.first_seen }))
}

/** اجازه صدا/تصویر به دانش‌آموز — فقط مدرس همان کلاس (یا ادمین)
 *  دانش‌آموز بدون این اجازه نمی‌تواند دوربین/میکروفونش را باز کند */
app.post('/api/classes/:id/permit', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس می‌تواند اجازه بدهد' })
  const userId = String(req.body?.userId || '')
  const allow = req.body?.allow ? 1 : 0
  const info = db.prepare('UPDATE attendance SET can_speak=?, hand=0 WHERE class_id=? AND user_id=?').run(allow, c.id, userId)
  if (!info.changes) return res.status(404).json({ error: 'این دانش‌آموز در کلاس حاضر نیست' })
  const u = db.prepare('SELECT name FROM users WHERE id = ?').get(userId)
  broadcast(c.id, { type: 'perm', userId, name: u?.name || '', canSpeak: !!allow, at: now() })
  res.json({ ok: true, participants: liveParticipants(c.id) })
})

/* ---------------- چت زنده کلاس ---------------- */
app.get('/api/classes/:id/messages', (req, res) => {
  const after = Number(req.query.after) || 0
  const rows = db.prepare(`SELECT id, user_id, name, role, body, created_at FROM messages
    WHERE class_id = ? AND id > ? ORDER BY id DESC LIMIT 80`).all(req.params.id, after)
  res.json({ messages: rows.reverse(), serverTime: now() })
})

app.post('/api/classes/:id/messages', requireAuth, (req, res) => {
  const body = String(req.body?.body || '').trim().slice(0, 500)
  if (!body) return res.status(400).json({ error: 'متن پیام خالی است' })
  const c = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!classAccess(c, req.user)) return res.status(403).json({ error: 'برای گفتگو در کلاس باید ثبت‌نام کنید' })
  const info = db.prepare('INSERT INTO messages (class_id, user_id, name, role, body, created_at) VALUES (?,?,?,?,?,?)')
    .run(c.id, req.user.id, req.user.name, req.user.role, body, now())
  const msg = db.prepare('SELECT id, user_id, name, role, body, created_at FROM messages WHERE id = ?').get(info.lastInsertRowid)
  broadcast(c.id, { type: 'message', message: msg, at: now() })
  res.json({ ok: true, message: msg })
})

/* ---------------- کلاس‌های من ---------------- */
app.get('/api/me/classes', requireAuth, (req, res) => {
  const rows = db.prepare(`${SELECT_CLASSES} JOIN enrollments e ON e.class_id = c.id
    WHERE e.user_id = ? ORDER BY c.day, c.start`).all(req.user.id)
  res.json({ classes: rows.map((c) => classWithMeta(c, req.user)) })
})

app.get('/api/me/teaching', requireRole('teacher', 'admin'), (req, res) => {
  const rows = db.prepare(`${SELECT_CLASSES} WHERE c.teacher_id = ? ORDER BY c.day, c.start`).all(req.user.id)
  res.json({ classes: rows.map((c) => classWithMeta(c, req.user)) })
})

/* ---------------- SSE — رویدادهای لحظه‌ای (چت/تخته/وضعیت) ---------------- */
const sseClients = new Map() // classId → Set(res)

function broadcast(classId, event) {
  const set = sseClients.get(classId)
  if (!set) return
  const payload = `data: ${JSON.stringify(event)}\n\n`
  for (const r of set) { try { r.write(payload) } catch { set.delete(r) } }
}

/** اتصال SSE — توکن از کوئری چون EventSource هدر نمی‌فرستد */
app.get('/api/classes/:id/events', (req, res) => {
  const c = db.prepare('SELECT id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).end()

  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  res.flushHeaders()
  res.write(`data: ${JSON.stringify({ type: 'hello', at: now() })}\n\n`)

  if (!sseClients.has(c.id)) sseClients.set(c.id, new Set())
  sseClients.get(c.id).add(res)

  const ping = setInterval(() => { try { res.write(`: ping\n\n`) } catch {} }, 20_000)
  req.on('close', () => {
    clearInterval(ping)
    sseClients.get(c.id)?.delete(res)
  })
})

/* ================================================================
   رله رسانه زنده — جایگزین قطعیِ WebRTC (بدون دردسر NAT/TURN)
   ----------------------------------------------------------------
   • فرستنده (مدرس یا دانش‌آموزِ دارای اجازه) استریمش را با MediaRecorder
     به تکه‌های ~۱ ثانیه‌ای webm می‌شکند و با POST (octet-stream) می‌فرستد.
   • گیرنده با GET /media/feeds و «کرسر» (شماره آخرین تکه) تکه‌های تازه
     را می‌گیرد و به MediaSource اضافه می‌کند — تاخیر ~۱.۵ ثانیه.
   • این روش از همان مسیر HTTP چت عبور می‌کند؛ اگر چت کار کند، صدا و
     تصویر هم صددرصد کار می‌کند (برخلاف WebRTC که پشت NAT گیر می‌کند).
   ================================================================ */
const MEDIA_CHUNK_TTL = 9_000 // نگهداری تکه‌های اخیر برای تازه‌واردها
const mediaRooms = new Map()  // classId → { teacher: Feed|null, students: Map<uid, Feed>, lastActivity }

/** آیا این تکه واقعاً «هدرِ» استریم است؟
 *  webm → بایت‌های جادویی EBML (0x1A45DFA3) • mp4 → باکس ftyp در آفست ۴
 *  تکه‌ی وسط استریم هدر ندارد؛ اگر به‌جای init ذخیره شود دکودر همه گیرنده‌ها
 *  برای همیشه می‌شکند (چون هدرِ گم‌شده هیچ‌وقت جبران نمی‌شود) — پس رد می‌شود */
const looksLikeHeader = (buf, fmt) => {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return false
  if (fmt === 'mp4') return buf.slice(4, 8).toString('latin1') === 'ftyp'
  return buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3
}

function mediaRoom(classId) {
  let r = mediaRooms.get(classId)
  if (!r) { r = { teacher: null, students: new Map(), lastActivity: now() }; mediaRooms.set(classId, r) }
  r.lastActivity = now()
  return r
}

function feedPush(feed, buf, isInit, meta, fmt, cd) {
  const t = now()
  /* خود-ترمیمی: تکه‌ای که خودش هدر کامل دارد ولی «init» اعلام نشده
     (مثلاً ری‌استارت فرستنده بدون پرچم init) — به‌عنوان init واقعی پردازش می‌شود
     تا گیرنده‌ها هیچ‌وقت بدون هدر بمانند */
  if (!isInit && !feed.init && looksLikeHeader(buf, fmt)) isInit = true
  if (isInit) {
    /* تکه‌ی init (هدر webm/mp4) فقط به‌عنوان init ذخیره می‌شود و هرگز وارد صف تکه‌ها
       نمی‌شود — فرستادن دوباره‌ی همان هدر در گیرنده، SourceBuffer را خراب می‌کند و
       پخش برای همیشه می‌میرد (باگ «صدا/تصویر اصلا پخش نمی‌شود») */
    feed.sess = (feed.sess || 0) + 1
    feed.init = buf
    feed.chunks = []
    feed.seq = 0
  } else {
    feed.seq += 1
    feed.chunks.push({ seq: feed.seq, buf, ts: t })
  }
  if (meta) feed.meta = meta
  if (fmt) feed.fmt = fmt
  /* کدک‌های واقعی استریم — با هر init تازه به‌روز می‌شود تا گیرنده SourceBuffer را
     دقیقاً با همین ترکیب بسازد (وگرنه استریمِ فقط-صدا با خطای codec رد می‌شد) */
  if (cd) feed.cd = cd
  feed.updatedAt = t
  while (feed.chunks.length && t - feed.chunks[0].ts > MEDIA_CHUNK_TTL) feed.chunks.shift()
}

function feedAlive(f) { return f && f.init && f.updatedAt && now() - f.updatedAt < 6_000 }

app.post('/api/classes/:id/media/up', requireAuth, express.raw({ type: 'application/octet-stream', limit: '4mb' }), (req, res) => {
  const c = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!classAccess(c, req.user)) return res.status(403).json({ error: 'برای حضور در کلاس باید ثبت‌نام کنید' })
  const room = mediaRoom(c.id)
  const meta = { mic: req.query.mic !== '0', cam: req.query.cam !== '0', screen: req.query.screen === '1' }
  const fmt = req.query.fmt === 'mp4' ? 'mp4' : 'webm' // قالب استریم فرستنده (webm در کروم، mp4 در سافاری)
  const cd = /^[a-z0-9.,]{1,40}$/i.test(String(req.query.cd || '')) ? String(req.query.cd) : '' // کدک‌های واقعی داخل استریم
  if (req.query.k === 'teacher') {
    if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس' })
    if (!req.body || !Buffer.isBuffer(req.body) || req.body.length < 8) return res.status(400).json({ error: 'تکه رسانه نامعتبر است' })
    /* تکه‌ی اعلام‌شده به‌عنوان init حتماً باید هدر واقعی داشته باشد — وگرنه ۴۰۰
       می‌خورد تا فرستنده رکوردر را از نو بسازد (باگ «صدا/تصویر برای همیشه می‌میرد») */
    if (req.query.init === '1' && !looksLikeHeader(req.body, fmt)) {
      return res.status(400).json({ error: 'تکه init بدون هدر است — جلسه تازه لازم است', badInit: true })
    }
    if (!room.teacher) room.teacher = { sess: 0, seq: 0, init: null, chunks: [], meta, updatedAt: 0, fmt, cd }
    feedPush(room.teacher, req.body, req.query.init === '1', meta, fmt, cd)
    return res.json({ ok: true })
  }
  // دانش‌آموز — فقط با اجازه فعال مدرس (گیت سمت سرور؛ دور زدن کلاینت بی‌فایده است)
  const att = db.prepare('SELECT can_speak FROM attendance WHERE class_id = ? AND user_id = ?').get(c.id, req.user.id)
  if (!att?.can_speak) return res.status(403).json({ error: 'مدرس اجازه فعال‌سازی صدا/تصویر نداده است', noPerm: true })
  if (!req.body || !Buffer.isBuffer(req.body) || req.body.length < 8) return res.status(400).json({ error: 'تکه رسانه نامعتبر است' })
  if (req.query.init === '1' && !looksLikeHeader(req.body, fmt)) {
    return res.status(400).json({ error: 'تکه init بدون هدر است — جلسه تازه لازم است', badInit: true })
  }
  let feed = room.students.get(req.user.id)
  if (!feed) { feed = { sess: 0, seq: 0, init: null, chunks: [], meta, updatedAt: 0, name: req.user.name, fmt, cd }; room.students.set(req.user.id, feed) }
  feed.name = req.user.name
  feedPush(feed, req.body, req.query.init === '1', meta, fmt, cd)
  res.json({ ok: true })
})

app.get('/api/classes/:id/media/feeds', requireAuth, (req, res) => {
  const c = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!classAccess(c, req.user)) return res.status(403).json({ error: 'برای حضور در کلاس باید ثبت‌نام کنید' })
  let cur = {}
  try { cur = JSON.parse(req.query.cur || '{}') || {} } catch { cur = {} }
  const room = mediaRooms.get(c.id)
  const out = { serverTime: now(), teacher: null, students: [] }

  const shapeFeed = (c0, f) => {
    if (!feedAlive(f)) return null
    // اگر گیرنده تازه وارد است یا جا مانده (گپ) → از سر: init + چند تکه اخیر
    const stale = !c0 || c0.s !== f.sess || (f.chunks.length && c0.q < f.chunks[0].seq - 1)
    const base = { sess: f.sess, seq: f.seq, mic: !!f.meta?.mic, cam: !!f.meta?.cam, screen: !!f.meta?.screen, fmt: f.fmt || 'webm', cd: f.cd || '' }
    if (stale) {
      return { ...base, reset: true, init: b64(f.init), chunks: f.chunks.slice(-6).map((x) => ({ seq: x.seq, b64: b64(x.buf) })) }
    }
    const fresh = f.chunks.filter((x) => x.seq > (c0.q || 0)).slice(0, 12)
    return { ...base, init: null, chunks: fresh.map((x) => ({ seq: x.seq, b64: b64(x.buf) })) }
  }

  if (room) {
    const t = shapeFeed(cur.t, room.teacher)
    if (t) out.teacher = t
    for (const [uid, f] of room.students) {
      if (!feedAlive(f)) { room.students.delete(uid); continue }
      if (uid === req.user.id) continue // استریم خودم را نمی‌خواهم
      const sf = shapeFeed(cur.s?.[uid], f)
      if (sf) out.students.push({ uid, name: f.name, ...sf })
    }
  }
  res.json(out)
})

/** قطع پخش خودم (خروج از کلاس / خاموشی کامل) */
app.post('/api/classes/:id/media/stop', requireAuth, (req, res) => {
  const room = mediaRooms.get(req.params.id)
  if (!room) return res.json({ ok: true })
  const c = db.prepare('SELECT id, teacher_id FROM classes WHERE id = ?').get(req.params.id)
  if (c && canControl(c, req.user)) room.teacher = null
  else room.students.delete(req.user.id)
  res.json({ ok: true })
})

/* پاک‌سازی خودکار اتاق‌های رسانه‌ای بی‌مصرف */
setInterval(() => {
  const t = now()
  for (const [cid, room] of mediaRooms) {
    for (const [uid, f] of room.students) if (t - (f.updatedAt || 0) > 10_000) room.students.delete(uid)
    if (room.teacher && t - (room.teacher.updatedAt || 0) > 10_000) room.teacher = null
    if (!room.teacher && !room.students.size && t - room.lastActivity > 30_000) mediaRooms.delete(cid)
  }
}, 10_000).unref()

/* =====================================================================
   ابزار ویرایش متون سایت (شبیه المنتور) — جستجوی متن در همه صفحات
   + جایگزینی/حذف زنده از پنل مدیریت. متن اصلی در کد نمی‌سوزد؛
   یک لایه «جایگزینی» در مرورگر همه‌جا اعمال می‌شود.
   ===================================================================== */
app.get('/api/content/overrides', (req, res) => {
  const overrides = db.prepare(
    'SELECT id, find_text AS find, replace_text AS replace, created_at AS at FROM content_overrides ORDER BY id DESC'
  ).all()
  res.json({ overrides })
})

app.post('/api/content/overrides', requireRole('admin'), (req, res) => {
  const find = String(req.body?.find || '').trim()
  const replace = String(req.body?.replace ?? '')
  if (find.length < 2) return res.status(400).json({ error: 'متن اصلی حداقل ۲ حرف باید باشد' })
  if (replace.includes(find)) return res.status(400).json({ error: 'متن جایگزین نباید شامل متن اصلی باشد (حلقه بی‌نهایت)' })
  if (overridesFreeze(replace, find)) return res.status(400).json({ error: 'این تغییر با یک جایگزینی دیگر تداخل چرخه‌ای دارد' })
  db.prepare(
    'INSERT INTO content_overrides (find_text, replace_text, created_at) VALUES (?,?,?) ' +
    'ON CONFLICT(find_text) DO UPDATE SET replace_text = excluded.replace_text, created_at = excluded.created_at'
  ).run(find, replace, now())
  res.json({ ok: true })
})

app.delete('/api/content/overrides/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM content_overrides WHERE id = ?').run(Number(req.params.id) || 0)
  res.json({ ok: true })
})

app.get('/api/content/texts', requireRole('admin'), (req, res) => {
  const q = String(req.query.q || '')
  res.json(searchIndex(q))
})

app.post('/api/content/reindex', requireRole('admin'), (req, res) => {
  const r = buildIndex(true)
  res.json({ ok: true, texts: r.items.length, files: r.files })
})

/* تشخیص چرخه: A→B و B→A نباید هم‌زمان مجاز باشند */
function overridesFreeze(replace, find) {
  if (!replace) return false
  const rows = db.prepare('SELECT find_text, replace_text FROM content_overrides').all()
  const map = new Map(rows.map((r) => [r.find_text, r.replace_text]))
  map.set(find, replace)
  // اگر زنجیره از هر کلید بیشتر از تعداد کلیدها طول کشید → چرخه
  for (const start of map.keys()) {
    let cur = start, seen = new Set()
    while (map.has(cur)) {
      if (seen.has(cur)) return true
      seen.add(cur)
      cur = map.get(cur)
      if (seen.size > map.size) return true
    }
  }
  return false
}

/* ---------------- موتور آزمون‌ساز (کاملاً مجزا از کلاس آنلاین) ---------------- */
registerExamRoutes(app)

/* ---------------- سلام سرور ---------------- */
app.get('/api/health', (req, res) => res.json({ ok: true, name: 'modaresyar-api', time: now() }))

/* ---------------- سرو فرانت در production ---------------- */
const distDir = join(__dirname, '..', 'dist')
if (existsSync(distDir)) {
  app.use(express.static(distDir))
  app.get(/^\/(?!api\/).*/, (req, res) => res.sendFile(join(distDir, 'index.html')))
  console.log('[server] serving production build from ../dist')
}

app.use((err, req, res, next) => {
  console.error('[server]', err?.message || err)
  res.status(500).json({ error: 'خطای داخلی سرور' })
})

function randomId() { return Math.random().toString(36).slice(2, 10) }

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[server] مدرس‌یار API روی پورت ${PORT} اجرا شد — ${new Date().toLocaleString('fa-IR')}`)
})
