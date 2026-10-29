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
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const app = express()
app.use(cors())
app.use(express.json({ limit: '256kb' }))

const PORT = process.env.PORT || 4000
const now = () => Date.now()

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

/* ثبت‌نام دانش‌آموز در کلاس */
app.post('/api/classes/:id/enroll', requireAuth, (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (c.status === 'ended') return res.status(400).json({ error: 'این کلاس برگزار شده است' })
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

app.post('/api/classes/:id/start', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس می‌تواند شروع کند' })
  const startedAt = now()
  db.prepare(`UPDATE classes SET status='live', started_at=?, ended_at=NULL WHERE id=?`).run(startedAt, c.id)
  broadcast(c.id, { type: 'live', status: 'live', startedAt, at: startedAt })
  res.json({ ok: true, startedAt })
})

app.post('/api/classes/:id/end', requireRole('teacher', 'admin'), (req, res) => {
  const c = db.prepare('SELECT * FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  if (!canControl(c, req.user)) return res.status(403).json({ error: 'فقط مدرس همان کلاس می‌تواند پایان دهد' })
  const endedAt = now()
  db.prepare(`UPDATE classes SET status='ended', ended_at=? WHERE id=? AND status='live'`).run(endedAt, c.id)
  db.prepare('UPDATE attendance SET hand=0 WHERE class_id=?').run(c.id)
  broadcast(c.id, { type: 'ended', status: 'ended', endedAt, at: endedAt })
  res.json({ ok: true, endedAt })
})

/** وضعیت لحظه‌ای کلاس — polling عمومی (تایمر + حاضران) */
app.get('/api/classes/:id/state', (req, res) => {
  const c = db.prepare('SELECT id, status, started_at, ended_at FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  res.json({
    id: c.id, status: c.status, startedAt: c.started_at, endedAt: c.ended_at,
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
  const c = db.prepare('SELECT id, status FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).json({ error: 'کلاس پیدا نشد' })
  const hand = req.body?.hand ? 1 : 0
  db.prepare(`INSERT INTO attendance (class_id, user_id, hand, first_seen, last_seen) VALUES (?,?,?,?,?)
    ON CONFLICT(class_id, user_id) DO UPDATE SET last_seen=excluded.last_seen, hand=excluded.hand`)
    .run(c.id, req.user.id, hand, now(), now())
  res.json({ ok: true, participants: liveParticipants(c.id) })
})

const ONLINE_WINDOW = 25_000 // ۲۵ ثانیه — با heartbeat هر ۸ ثانیه
function liveParticipants(classId) {
  return db.prepare(`SELECT a.user_id AS id, u.name, u.role, u.color, a.hand, a.first_seen
    FROM attendance a JOIN users u ON u.id = a.user_id
    WHERE a.class_id = ? AND a.last_seen > ? ORDER BY a.first_seen`).all(classId, now() - ONLINE_WINDOW)
    .map((p) => ({ id: p.id, name: p.name, role: p.role, color: p.color, hand: !!p.hand, joinedAt: p.first_seen }))
}

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

/* ---------------- SSE: رویداد لحظه‌ای کلاس ---------------- */
const sseClients = new Map() // classId → Set(res)
function broadcast(classId, event) {
  const set = sseClients.get(classId)
  if (!set) return
  const payload = `data: ${JSON.stringify(event)}\n\n`
  for (const r of set) { try { r.write(payload) } catch { set.delete(r) } }
}

app.get('/api/classes/:id/events', (req, res) => {
  const c = db.prepare('SELECT id FROM classes WHERE id = ?').get(req.params.id)
  if (!c) return res.status(404).end()
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' })
  res.flushHeaders()
  res.write(`data: ${JSON.stringify({ type: 'hello', at: now() })}\n\n`)
  if (!sseClients.has(c.id)) sseClients.set(c.id, new Set())
  sseClients.get(c.id).add(res)
  const ping = setInterval(() => { try { res.write(`: ping\n\n`) } catch {} }, 20_000)
  req.on('close', () => { clearInterval(ping); sseClients.get(c.id)?.delete(res) })
})

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
