// =====================================================================
// موتور آزمون‌ساز مدرس‌یار — کاملاً جدا از کلاس آنلاین
// ---------------------------------------------------------------------
// لایه‌های امنیتی (ضد تقلب):
//   ۱) پاسخ صحیح هرگز برای دانش‌آموز ارسال نمی‌شود — تصحیح فقط سمت سرور
//   ۲) زمان آزمون فقط با ساعت سرور کنترل می‌شود (تایمر کلاینت صرفاً نمایشی)
//   ۳) هر دانش‌آموز فقط یک تلاش — قید UNIQUE در دیتابیس + امکان ادامه از همان‌جا
//   ۴) ترتیب سوال‌ها و گزینه‌ها برای هر دانش‌آموز متفاوت است (map مخصوص هر تلاش)
//   ۵) لاگ امنیتی: خروج از تب، تلاش کپی، خروج از تمام‌صفحه، تکمیل غیرعادی سریع
//   ۶) سقف خروج از تب (اختیاری معلم) → آزمون برای بررسی امنیتی ارجاع می‌شود
//   ۷) ضد کپی متن/کلیک راست/میان‌برها در صفحه آزمون (کلاینت) + شمارش تلاش‌ها
//   ۸) نرخ محدود ذخیره خودکار (ضد اسپم) + اعتبارسنجی سخت‌گیرانه تک‌تک پاسخ‌ها
//   ۹) حالت PDF: برگه سوال تصویری است (انتخاب متن ندارد) و کلید فقط روی سرور می‌ماند
//  ۱۰) نرمال‌سازی ارقام فارسی/عربی در پاسخ‌های کوتاه و جای خالی
// =====================================================================
import express from 'express'
import jwt from 'jsonwebtoken'
import { mkdirSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db, JWT_SECRET } from './db.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const now = () => Date.now()
const J = (v) => JSON.stringify(v ?? null)
const P = (s, fb) => { try { const v = JSON.parse(s ?? ''); return v ?? fb } catch { return fb } }
const rid = () => 'ex-' + randomBytes(5).toString('hex')

/* ---------------- جداول ---------------- */
db.exec(`
CREATE TABLE IF NOT EXISTS exams (
  id              TEXT PRIMARY KEY,
  teacher_id      TEXT NOT NULL REFERENCES users(id),
  course_id       TEXT,
  title           TEXT NOT NULL,
  desc            TEXT DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','closed')),
  mode            TEXT NOT NULL DEFAULT 'builder' CHECK (mode IN ('builder','pdf')),
  duration_min    INTEGER NOT NULL DEFAULT 30,
  open_at         INTEGER,
  close_at        INTEGER,
  shuffle_q       INTEGER NOT NULL DEFAULT 0,
  shuffle_o       INTEGER NOT NULL DEFAULT 0,
  sec_copy_block  INTEGER NOT NULL DEFAULT 1,
  sec_tab_limit   INTEGER NOT NULL DEFAULT 0,
  sec_fullscreen  INTEGER NOT NULL DEFAULT 0,
  sec_fast_submit INTEGER NOT NULL DEFAULT 45,
  pdf_pages       TEXT DEFAULT '[]',
  pdf_total       REAL NOT NULL DEFAULT 20,
  q_count         INTEGER NOT NULL DEFAULT 0,
  answer_key      TEXT DEFAULT '{}',
  choices_per_q   INTEGER NOT NULL DEFAULT 4,
  answer_pdf      TEXT DEFAULT '',
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS exam_questions (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  ord     INTEGER NOT NULL,
  type    TEXT NOT NULL,
  body    TEXT DEFAULT '',
  image   TEXT DEFAULT '',
  opts    TEXT DEFAULT '[]',
  correct TEXT DEFAULT 'null',
  points  REAL NOT NULL DEFAULT 1,
  topic   TEXT DEFAULT '',
  expl    TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS exam_attempts (
  id           TEXT PRIMARY KEY,
  exam_id      TEXT NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL REFERENCES users(id),
  started_at   INTEGER NOT NULL,
  deadline_at  INTEGER NOT NULL,
  submitted_at INTEGER,
  status       TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress','submitted','graded','invalid')),
  score        REAL,
  max_score    REAL,
  answers      TEXT DEFAULT '{}',
  order_map    TEXT DEFAULT '{}',
  graded_pts   TEXT DEFAULT '{}',
  sec_log      TEXT DEFAULT '{}',
  flags        TEXT DEFAULT '[]',
  last_save    INTEGER DEFAULT 0,
  UNIQUE (exam_id, student_id)
);
CREATE INDEX IF NOT EXISTS idx_attempts_exam ON exam_attempts(exam_id);
`)

/* ---------------- فایل‌های آپلودی (برگه سوال PDF/تصویر + پاسخنامه تحلیلی) ---------------- */
const upDir = join(__dirname, 'uploads', 'exams')
mkdirSync(upDir, { recursive: true })

/* ---------------- هلپرهای مشترک ---------------- */
const authUser = (req) => {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return null
  try {
    const payload = jwt.verify(token, JWT_SECRET)
    return db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid) || null
  } catch { return null }
}

/** نرمال‌سازی متن برای مقایسه پاسخ کوتاه/جای خالی: ارقام فارسی→انگلیسی، حذف فاصله و نیم‌فاصله */
function normText(s) {
  return String(s ?? '')
    .replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
    .replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
    .replace(/[\u200c\u064b-\u0652]/g, '')
    .replace(/[يی]/g, 'ی').replace(/[كک]/g, 'ک')
    .replace(/\s+/g, '').toLowerCase()
}

/* تصادفی با seed — تا همان ترتیب برای همان تلاش قابل بازتولید باشد */
function seededShuffle(arr, seed) {
  const a = [...arr]
  let s = seed >>> 0
  const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1));[a[i], a[j]] = [a[j], a[i]] }
  return a
}

export function registerExamRoutes(app) {
  /* فایل‌های آزمون — نام تصادفی، فقط‌خواندنی */
  app.use('/api/exams-files', express.static(upDir, { maxAge: '1d', index: false }))

  const requireTeacher = (req, res, next) => {
    const u = authUser(req)
    if (!u) return res.status(401).json({ error: 'ابتدا وارد حساب شوید' })
    if (!['teacher', 'admin'].includes(u.role)) return res.status(403).json({ error: 'این بخش فقط برای مدرس است' })
    req.user = u
    next()
  }
  const requireStudent = (req, res, next) => {
    const u = authUser(req)
    if (!u) return res.status(401).json({ error: 'ابتدا وارد حساب شوید' })
    if (u.role !== 'student') return res.status(403).json({ error: 'این بخش فقط برای دانش‌آموز است' })
    req.user = u
    next()
  }
  const examOwner = (req, res) => {
    const e = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id)
    if (!e) { res.status(404).json({ error: 'آزمون پیدا نشد' }); return null }
    if (e.teacher_id !== req.user.id && req.user.role !== 'admin') { res.status(403).json({ error: 'این آزمون متعلق به شما نیست' }); return null }
    return e
  }
  const questionsOf = (examId) =>
    db.prepare('SELECT * FROM exam_questions WHERE exam_id = ? ORDER BY ord, id').all(examId)
      .map((q) => ({ ...q, opts: P(q.opts, []), correct: P(q.correct, null) }))
  const statsOf = (examId) => {
    const r = db.prepare(`SELECT COUNT(*) n, AVG(score) a, MAX(score) mx, MIN(score) mn
      FROM exam_attempts WHERE exam_id = ? AND status IN ('submitted','graded')`).get(examId)
    return { participants: r.n || 0, avg: Math.round((r.a || 0) * 100) / 100, max: r.mx ?? null, min: r.mn ?? null }
  }

  /* ================= آپلود فایل (برگه PDF/تصویر + پاسخنامه) ================= */
  app.post('/api/exams/upload', requireTeacher, (req, res) => {
    const { name = 'file', data = '' } = req.body || {}
    const m = String(data).match(/^data:([\w/.+-]+);base64,(.+)$/)
    if (!m) return res.status(400).json({ error: 'فایل معتبر نیست' })
    if (m[2].length > 14 * 1024 * 1024) return res.status(400).json({ error: 'حجم فایل باید کمتر از ۱۰ مگابایت باشد' })
    const ext = (String(name).split('.').pop() || '').toLowerCase()
    let real = ''
    if (ext === 'pdf' || m[1] === 'application/pdf') real = '.pdf'
    else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) real = '.' + (ext === 'jpeg' ? 'jpg' : ext)
    else if (m[1] === 'image/png') real = '.png'
    else if (m[1] === 'image/jpeg') real = '.jpg'
    else if (m[1] === 'image/webp') real = '.webp'
    if (!real) return res.status(400).json({ error: 'فقط PDF یا تصویر (PNG/JPG/WebP) مجاز است' })
    const fname = 'EX' + randomBytes(9).toString('hex') + real
    try { writeFileSync(join(upDir, fname), Buffer.from(m[2], 'base64')) }
    catch { return res.status(500).json({ error: 'ذخیره فایل ناموفق بود' }) }
    res.json({ url: '/api/exams-files/' + fname, bytes: Math.round(m[2].length * 0.75) })
  })

  /* ================= مدیریت آزمون (مدرس) ================= */
  app.get('/api/exams', requireTeacher, (req, res) => {
    const sql = req.user.role === 'admin'
      ? 'SELECT e.*, t.name AS teacher_name FROM exams e LEFT JOIN users t ON t.id = e.teacher_id ORDER BY e.updated_at DESC'
      : 'SELECT e.*, t.name AS teacher_name FROM exams e LEFT JOIN users t ON t.id = e.teacher_id WHERE e.teacher_id = ? ORDER BY e.updated_at DESC'
    const rows = (req.user.role === 'admin' ? db.prepare(sql).all() : db.prepare(sql).all(req.user.id))
    const cls = db.prepare('SELECT id, title FROM classes').all()
    const cName = Object.fromEntries(cls.map((c) => [c.id, c.title]))
    res.json({
      exams: rows.map((e) => ({
        id: e.id, title: e.title, desc: e.desc, status: e.status, mode: e.mode,
        duration_min: e.duration_min, open_at: e.open_at, close_at: e.close_at,
        course_id: e.course_id, course_title: cName[e.course_id] || '',
        teacher_name: e.teacher_name, q_count: e.mode === 'pdf' ? e.q_count : db.prepare('SELECT COUNT(*) n FROM exam_questions WHERE exam_id = ?').get(e.id).n,
        stats: statsOf(e.id), updated_at: e.updated_at,
      })),
    })
  })

  app.post('/api/exams', requireTeacher, (req, res) => {
    const { title, mode = 'builder' } = req.body || {}
    if (!String(title || '').trim()) return res.status(400).json({ error: 'عنوان آزمون الزامی است' })
    if (!['builder', 'pdf'].includes(mode)) return res.status(400).json({ error: 'حالت آزمون نامعتبر است' })
    const id = rid()
    db.prepare(`INSERT INTO exams (id, teacher_id, title, desc, status, mode, duration_min, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, req.user.id, String(title).trim().slice(0, 150), String(req.body?.desc || '').slice(0, 2000),
        'draft', mode, Math.max(1, Math.min(600, Number(req.body?.duration_min) || 30)), now(), now())
    res.json({ id })
  })

  /* نکته ترتیب: available باید قبل از /exams/:id ثبت شود وگرنه قاپیده می‌شود */
  app.get('/api/exams/available', requireStudent, (req, res) => {
    const rows = db.prepare(`SELECT e.*, t.name AS teacher_name, c.title AS course_title FROM exams e
      LEFT JOIN users t ON t.id = e.teacher_id LEFT JOIN classes c ON c.id = e.course_id
      WHERE e.status = 'published' ORDER BY COALESCE(e.open_at, e.created_at) DESC`).all()
    const mine = db.prepare('SELECT * FROM exam_attempts WHERE student_id = ?').all(req.user.id)
    const byExam = Object.fromEntries(mine.map((a) => [a.exam_id, a]))
    const out = []
    for (const e of rows) {
      if (e.course_id && !isEnrolled(e.course_id, req.user.id)) continue
      const a = byExam[e.id]
      out.push({
        id: e.id, title: e.title, desc: e.desc, mode: e.mode, teacher_name: e.teacher_name,
        course_title: e.course_title, duration_min: e.duration_min, open_at: e.open_at, close_at: e.close_at,
        q_count: e.mode === 'pdf' ? e.q_count : db.prepare('SELECT COUNT(*) n FROM exam_questions WHERE exam_id = ?').get(e.id).n,
        status: e.status,
        attempt: a ? { id: a.id, status: a.status, score: a.score, max_score: a.max_score, deadline_at: a.deadline_at, started_at: a.started_at, flags: P(a.flags, []) } : null,
      })
    }
    res.json({ exams: out })
  })

  /* نمای کامل برای سازنده (شامل کلیدها — فقط مالک) */
  app.get('/api/exams/:id', requireTeacher, (req, res) => {
    const e = examOwner(req, res)
    if (!e) return
    res.json({
      exam: {
        ...e,
        pdf_pages: P(e.pdf_pages, []),
        answer_key: P(e.answer_key, {}),
        questions: questionsOf(e.id),
        stats: statsOf(e.id),
        teacher_name: db.prepare('SELECT name FROM users WHERE id = ?').get(e.teacher_id)?.name || '',
      },
    })
  })

  app.patch('/api/exams/:id', requireTeacher, (req, res) => {
    const e = examOwner(req, res)
    if (!e) return
    const b = req.body || {}
    const set = {}, vals = []
    const put = (k, v) => { set[k] = v; vals.push(v) }
    if (b.title !== undefined) { if (!String(b.title).trim()) return res.status(400).json({ error: 'عنوان خالی است' }); put('title', String(b.title).trim().slice(0, 150)) }
    if (b.desc !== undefined) put('desc', String(b.desc || '').slice(0, 2000))
    if (b.course_id !== undefined) put('course_id', b.course_id || null)
    if (b.duration_min !== undefined) put('duration_min', Math.max(1, Math.min(600, Number(b.duration_min) || 30)))
    if (b.open_at !== undefined) put('open_at', b.open_at ? Number(b.open_at) : null)
    if (b.close_at !== undefined) put('close_at', b.close_at ? Number(b.close_at) : null)
    for (const k of ['shuffle_q', 'shuffle_o', 'sec_copy_block', 'sec_tab_limit', 'sec_fullscreen'])
      if (b[k] !== undefined) put(k, b[k] ? 1 : 0)
    if (b.sec_fast_submit !== undefined) put('sec_fast_submit', Math.max(0, Math.min(3600, Number(b.sec_fast_submit) || 0)))
    if (b.mode !== undefined && e.status === 'draft') put('mode', b.mode === 'pdf' ? 'pdf' : 'builder')
    if (b.pdf_pages !== undefined) put('pdf_pages', J((Array.isArray(b.pdf_pages) ? b.pdf_pages : []).slice(0, 40)))
    if (b.q_count !== undefined) put('q_count', Math.max(0, Math.min(400, Number(b.q_count) || 0)))
    if (b.choices_per_q !== undefined) put('choices_per_q', Math.max(2, Math.min(6, Number(b.choices_per_q) || 4)))
    if (b.pdf_total !== undefined) put('pdf_total', Math.max(1, Number(b.pdf_total) || 20))
    if (b.answer_key !== undefined) {
      const key = {}
      for (const [k, v] of Object.entries(b.answer_key || {})) {
        const n = parseInt(k, 10); const c = Number(v)
        if (Number.isInteger(n) && n >= 1 && n <= 400 && Number.isInteger(c) && c >= 0) key[n] = c
      }
      put('answer_key', J(key))
    }
    if (b.answer_pdf !== undefined) put('answer_pdf', String(b.answer_pdf || '').slice(0, 400))
    if (!Object.keys(set).length) return res.json({ ok: true })
    db.prepare(`UPDATE exams SET ${Object.keys(set).map((k) => k + ' = ?').join(', ')}, updated_at = ? WHERE id = ?`)
      .run(...vals, now(), e.id)
    res.json({ ok: true })
  })

  /* ذخیره دسته‌ای سوال‌ها از سازنده — جایگزینی کامل (تراکنش‌وار) */
  app.put('/api/exams/:id/questions', requireTeacher, (req, res) => {
    const e = examOwner(req, res)
    if (!e) return
    if (e.mode !== 'builder') return res.status(400).json({ error: 'این آزمون در حالت فایل است' })
    const list = Array.isArray(req.body?.questions) ? req.body.questions : []
    if (list.length > 300) return res.status(400).json({ error: 'حداکثر ۳۰۰ سوال' })
    const clean = []
    for (let i = 0; i < list.length; i++) {
      const q = list[i] || {}
      const type = String(q.type || 'mcq')
      if (!['mcq', 'multi', 'tf', 'blank', 'short', 'essay', 'match', 'order'].includes(type))
        return res.status(400).json({ error: `نوع سوال شماره ${i + 1} نامعتبر است` })
      const body = String(q.body || '').slice(0, 4000)
      const image = String(q.image || '').slice(0, 400)
      if (!body.trim() && !image.trim()) return res.status(400).json({ error: `متن سوال ${i + 1} خالی است` })
      let opts = [], correct = null
      if (type === 'mcq' || type === 'multi') {
        opts = (Array.isArray(q.opts) ? q.opts : []).map((o) => String(o ?? '').slice(0, 500))
        const idx = opts.map((o, j) => [j, o]).filter(([, o]) => o.trim())
        if (idx.length < 2) return res.status(400).json({ error: `سوال ${i + 1}: حداقل ۲ گزینه لازم است` })
        opts = idx.map(([, o]) => o)
        const remap = new Map(idx.map(([j], n) => [j, n]))
        if (type === 'mcq') {
          const c = Number(q.correct)
          if (!remap.has(c)) return res.status(400).json({ error: `سوال ${i + 1}: گزینه صحیح مشخص نشده` })
          correct = remap.get(c)
        } else {
          correct = [...(Array.isArray(q.correct) ? q.correct : [])].filter((c) => remap.has(Number(c))).map((c) => remap.get(Number(c)))
          if (!correct.length) return res.status(400).json({ error: `سوال ${i + 1}: حداقل یک گزینه صحیح لازم است` })
        }
      } else if (type === 'tf') {
        opts = ['درست', 'نادرت']
        correct = Number(q.correct) === 0 ? 0 : 1
      } else if (type === 'blank' || type === 'short') {
        correct = (Array.isArray(q.correct) ? q.correct : []).map((c) => String(c ?? '').slice(0, 300)).filter((c) => c.trim()).slice(0, 12)
        if (!correct.length) return res.status(400).json({ error: `سوال ${i + 1}: حداقل یک پاسخ قابل قبول لازم است` })
      } else if (type === 'match') {
        const left = (Array.isArray(q.opts?.left) ? q.opts.left : []).map((s) => String(s ?? '').slice(0, 300)).filter((s) => s.trim()).slice(0, 10)
        const right = (Array.isArray(q.opts?.right) ? q.opts.right : []).map((s) => String(s ?? '').slice(0, 300)).filter((s) => s.trim()).slice(0, 10)
        if (left.length < 2 || right.length < 2) return res.status(400).json({ error: `سوال ${i + 1}: هر دو ستون تطبیق حداقل ۲ مورد لازم دارد` })
        const raw = q.correct && typeof q.correct === 'object' ? q.correct : {}
        const map = {}
        for (let l = 0; l < left.length; l++) {
          const r = Number(raw[l])
          if (!Number.isInteger(r) || r < 0 || r >= right.length) return res.status(400).json({ error: `سوال ${i + 1}: اتصال همه موارد ستون راست مشخص نشده` })
          map[l] = r
        }
        opts = { left, right }; correct = map
      } else if (type === 'order') {
        opts = (Array.isArray(q.opts) ? q.opts : []).map((s) => String(s ?? '').slice(0, 300)).filter((s) => s.trim()).slice(0, 10)
        if (opts.length < 2) return res.status(400).json({ error: `سوال ${i + 1}: مرتب‌سازی حداقل ۲ مورد لازم دارد` })
        correct = (Array.isArray(q.correct) ? q.correct : []).map(Number)
        const isPerm = correct.length === opts.length && new Set(correct).size === opts.length && correct.every((c) => c >= 0 && c < opts.length)
        if (!isPerm) return res.status(400).json({ error: `سوال ${i + 1}: ترتیب صحیح کامل مشخص نشده` })
      } else if (type === 'essay') {
        correct = null
      }
      clean.push({
        ord: i, type, body, image, opts: J(opts), correct: J(correct),
        points: Math.max(0.25, Math.min(100, Number(q.points) || 1)),
        topic: String(q.topic || '').slice(0, 100), expl: String(q.expl || '').slice(0, 2000),
      })
    }
    const tx = db.prepare('BEGIN')
    tx.run()
    try {
      db.prepare('DELETE FROM exam_questions WHERE exam_id = ?').run(e.id)
      const ins = db.prepare(`INSERT INTO exam_questions (exam_id, ord, type, body, image, opts, correct, points, topic, expl)
        VALUES (?,?,?,?,?,?,?,?,?,?)`)
      for (const q of clean) ins.run(e.id, q.ord, q.type, q.body, q.image, q.opts, q.correct, q.points, q.topic, q.expl)
      db.prepare('UPDATE exams SET updated_at = ? WHERE id = ?').run(now(), e.id)
      db.prepare('COMMIT').run()
    } catch (err) {
      db.prepare('ROLLBACK').run()
      return res.status(500).json({ error: 'ذخیره سوال‌ها ناموفق بود' })
    }
    res.json({ ok: true, count: clean.length })
  })

  /* انتشار با اعتبارسنجی کامل */
  app.post('/api/exams/:id/publish', requireTeacher, (req, res) => {
    const e = examOwner(req, res)
    if (!e) return
    if (e.mode === 'builder') {
      const qs = questionsOf(e.id)
      if (!qs.length) return res.status(400).json({ error: 'هنوز سوالی ندارد' })
      for (let i = 0; i < qs.length; i++) {
        const q = qs[i]
        if (!String(q.body).trim() && !String(q.image || '').trim()) return res.status(400).json({ error: `سوال ${i + 1} خالی است` })
        if ((q.type === 'mcq' || q.type === 'multi') && (q.opts.length < 2 || q.correct == null || (Array.isArray(q.correct) && !q.correct.length)))
          return res.status(400).json({ error: `سوال ${i + 1} کامل نیست` })
      }
    } else {
      const pages = P(e.pdf_pages, [])
      if (!pages.length) return res.status(400).json({ error: 'برگه سوال (PDF/تصویر) آپلود نشده' })
      if (e.q_count < 1) return res.status(400).json({ error: 'تعداد سوالات مشخص نشده' })
      const key = P(e.answer_key, {})
      if (Object.keys(key).length !== e.q_count)
        return res.status(400).json({ error: `کلید پاسخبرگ کامل نیست — ${Object.keys(key).length} از ${e.q_count} سوال` })
    }
    db.prepare("UPDATE exams SET status = 'published', updated_at = ? WHERE id = ?").run(now(), e.id)
    res.json({ ok: true })
  })

  app.post('/api/exams/:id/close', requireTeacher, (req, res) => {
    const e = examOwner(req, res)
    if (!e) return
    db.prepare("UPDATE exams SET status = 'closed', updated_at = ? WHERE id = ?").run(now(), e.id)
    res.json({ ok: true })
  })

  app.delete('/api/exams/:id', requireTeacher, (req, res) => {
    const e = examOwner(req, res)
    if (!e) return
    db.prepare('DELETE FROM exams WHERE id = ?').run(e.id)
    res.json({ ok: true })
  })

  /* ================= تصحیح و تحلیل (مدرس) ================= */
  app.get('/api/exams/:id/attempts', requireTeacher, (req, res) => {
    const e = examOwner(req, res)
    if (!e) return
    const rows = db.prepare(`
      SELECT a.*, u.name AS student_name FROM exam_attempts a
      LEFT JOIN users u ON u.id = a.student_id
      WHERE a.exam_id = ? ORDER BY a.submitted_at IS NULL, a.submitted_at DESC, a.started_at DESC`).all(e.id)
    res.json({
      attempts: rows.map((a) => ({
        id: a.id, student_id: a.student_id, student_name: a.student_name,
        started_at: a.started_at, deadline_at: a.deadline_at, submitted_at: a.submitted_at,
        status: a.status, score: a.score, max_score: a.max_score,
        flags: P(a.flags, []), sec_log: P(a.sec_log, {}),
        graded_pts: P(a.graded_pts, {}),
        need_essay: e.mode === 'builder' && questionsOf(e.id).some((q) => q.type === 'essay' && P(a.graded_pts, {})[q.id] === undefined && P(a.answers, {})[q.id] !== undefined),
      })),
      stats: statsOf(e.id),
    })
  })

  /* پاسخ‌های یک دانش‌آموز برای تصحیح دستی تشریحی */
  app.get('/api/exams/:id/attempts/:aid', requireTeacher, (req, res) => {
    const e = examOwner(req, res)
    if (!e) return
    const a = db.prepare('SELECT * FROM exam_attempts WHERE id = ? AND exam_id = ?').get(req.params.aid, e.id)
    if (!a) return res.status(404).json({ error: 'تلاش پیدا نشد' })
    const answers = P(a.answers, {})
    const graded = P(a.graded_pts, {})
    const qs = questionsOf(e.id).map((q) => ({
      id: q.id, ord: q.ord, type: q.type, body: q.body, image: q.image, opts: q.opts,
      points: q.points, topic: q.topic,
      correct: q.type === 'essay' ? null : q.correct,
      student: answers[q.id] ?? null,
      graded: graded[q.id],
    }))
    res.json({ attempt: { ...a, answers: undefined, student_name: db.prepare('SELECT name FROM users WHERE id = ?').get(a.student_id)?.name }, questions: qs })
  })

  app.post('/api/exams/:id/attempts/:aid/grade', requireTeacher, (req, res) => {
    const e = examOwner(req, res)
    if (!e) return
    const a = db.prepare('SELECT * FROM exam_attempts WHERE id = ? AND exam_id = ?').get(req.params.aid, e.id)
    if (!a) return res.status(404).json({ error: 'تلاش پیدا نشد' })
    if (a.status === 'in_progress') return res.status(400).json({ error: 'آزمون هنوز تمام نشده' })
    const pts = {}
    const incoming = req.body?.pts || {}
    for (const [k, v] of Object.entries(incoming)) {
      const n = Number(v)
      if (Number.isFinite(n) && n >= 0) pts[parseInt(k, 10)] = n
    }
    const graded = { ...P(a.graded_pts, {}), ...pts }
    const { score, max } = gradeAttempt(e, questionsOf(e.id), P(a.answers, {}), graded)
    const allEssaysGraded = questionsOf(e.id).filter((q) => q.type === 'essay' && P(a.answers, {})[q.id] !== undefined)
      .every((q) => graded[q.id] !== undefined)
    const status = a.status === 'invalid' ? 'invalid' : (allEssaysGraded ? 'graded' : 'submitted')
    db.prepare('UPDATE exam_attempts SET graded_pts = ?, score = ?, max_score = ?, status = ?, submitted_at = COALESCE(submitted_at, ?) WHERE id = ?')
      .run(J(graded), Math.round(score * 100) / 100, max, status, now(), a.id)
    res.json({ ok: true, score: Math.round(score * 100) / 100, max, status })
  })

  /* بررسی امنیتی: تأیید یا رد آزمون مشکوک */
  app.post('/api/exams/:id/attempts/:aid/review', requireTeacher, (req, res) => {
    const e = examOwner(req, res)
    if (!e) return
    const a = db.prepare('SELECT * FROM exam_attempts WHERE id = ? AND exam_id = ?').get(req.params.aid, e.id)
    if (!a) return res.status(404).json({ error: 'تلاش پیدا نشد' })
    const verdict = req.body?.verdict === 'valid' ? 'valid' : 'invalid'
    if (verdict === 'valid') {
      const graded = P(a.graded_pts, {})
      const { score, max } = gradeAttempt(e, questionsOf(e.id), P(a.answers, {}), graded)
      db.prepare("UPDATE exam_attempts SET status = 'graded', flags = ? WHERE id = ?")
        .run(J([...P(a.flags, []).filter((f) => f !== 'tab_limit'), 'reviewed_ok']), a.id)
      db.prepare('UPDATE exam_attempts SET score = ?, max_score = ? WHERE id = ?').run(Math.round(score * 100) / 100, max, a.id)
    } else {
      db.prepare("UPDATE exam_attempts SET status = 'invalid', score = 0, flags = ? WHERE id = ?")
        .run(J([...P(a.flags, []), 'rejected']), a.id)
    }
    res.json({ ok: true })
  })

  /* بازکردن تلاش (اجازه آزمون مجدد) */
  app.delete('/api/exams/:id/attempts/:studentId', requireTeacher, (req, res) => {
    const e = examOwner(req, res)
    if (!e) return
    db.prepare('DELETE FROM exam_attempts WHERE exam_id = ? AND student_id = ?').run(e.id, req.params.studentId)
    res.json({ ok: true })
  })

  /* تحلیل کامل آزمون */
  app.get('/api/exams/:id/analytics', requireTeacher, (req, res) => {
    const e = examOwner(req, res)
    if (!e) return
    const qs = e.mode === 'pdf'
      ? Array.from({ length: e.q_count }, (_, i) => ({ id: 'q' + (i + 1), ord: i, type: 'pdfmcq', topic: '', points: e.pdf_total / Math.max(1, e.q_count), n: i + 1 }))
      : questionsOf(e.id).map((q, i) => ({ ...q, n: i + 1 }))
    const attempts = db.prepare(`SELECT a.*, u.name AS student_name FROM exam_attempts a
      LEFT JOIN users u ON u.id = a.student_id WHERE a.exam_id = ? AND a.status IN ('submitted','graded','invalid')`).all(e.id)
    const perQ = qs.map((q) => {
      let correct = 0, wrong = 0, blank = 0
      for (const a of attempts) {
        const ans = P(a.answers, {})[q.id]
        if (ans === undefined || ans === null || ans === '') blank++
        else if (isCorrect(e, q, ans)) correct++
        else wrong++
      }
      return { n: q.n, qid: q.id, topic: q.topic, points: q.points, correct, wrong, blank, rate: attempts.length ? Math.round((correct / attempts.length) * 100) : 0 }
    })
    const scores = attempts.filter((a) => a.status !== 'invalid').map((a) => a.score || 0)
    const avg = scores.length ? scores.reduce((s, v) => s + v, 0) / scores.length : 0
    const topics = {}
    for (const pq of perQ) {
      const t = pq.topic || 'سایر'
      topics[t] = topics[t] || { total: 0, got: 0 }
      topics[t].total += attempts.length ? pq.correct + pq.wrong + pq.blank : 0
      topics[t].got += pq.correct
    }
    res.json({
      stats: { participants: attempts.length, avg: Math.round(avg * 100) / 100, max_score: e.mode === 'pdf' ? e.pdf_total : qs.reduce((s, q) => s + q.points, 0),
        highest: scores.length ? Math.max(...scores) : null, lowest: scores.length ? Math.min(...scores) : null,
        avg_percent: scores.length && statsOf(e.id) ? Math.round((avg / Math.max(0.01, e.mode === 'pdf' ? e.pdf_total : qs.reduce((s, q) => s + q.points, 0))) * 100) : 0 },
      per_question: perQ,
      topics: Object.entries(topics).map(([name, v]) => ({ name, rate: v.total ? Math.round((v.got / v.total) * 100) : 0 })),
      hardest: [...perQ].filter((q) => q.correct + q.wrong > 0).sort((a, b) => a.rate - b.rate)[0] || null,
      attempts: attempts.map((a) => ({
        id: a.id, name: a.student_name, score: a.score, status: a.status,
        duration_min: Math.round(((a.submitted_at || a.deadline_at) - a.started_at) / 60000),
        tabs: P(a.sec_log, {}).tabs || 0, flags: P(a.flags, []),
      })),
    })
  })

  /* ================= آزمون‌های در دسترس دانش‌آموز ================= */

  /* ================= شروع/ادامه آزمون (دانش‌آموز) ================= */
  app.post('/api/exams/:id/start', requireStudent, (req, res) => {
    const e = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id)
    if (!e || e.status !== 'published') return res.status(404).json({ error: 'آزمون فعال نیست' })
    if (!isEnrolled(e.course_id, req.user.id)) return res.status(403).json({ error: 'شما در این کلاس ثبت‌نام ندارید' })
    const t = now()
    if (e.open_at && t < e.open_at) return res.status(403).json({ error: 'آزمون هنوز باز نشده است' })
    if (e.close_at && t > e.close_at) return res.status(403).json({ error: 'زمان آزمون به پایان رسیده است' })

    let a = db.prepare('SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?').get(e.id, req.user.id)
    const qs = questionsOf(e.id)
    if (!a) {
      const deadline = Math.min(t + e.duration_min * 60000, e.close_at || Infinity)
      /* ترتیب اختصاصی این تلاش — متفاوت برای هر دانش‌آموز */
      const seed = randomBytes(4).readUInt32BE(0)
      let qids = qs.map((q) => q.id)
      const optsMap = {}
      if (e.shuffle_q) qids = seededShuffle(qids, seed)
      for (const q of qs) {
        if (e.shuffle_o && (q.type === 'mcq' || q.type === 'multi' || q.type === 'tf')) optsMap[q.id] = seededShuffle(q.opts.map((_, i) => i), seed + q.id)
        else if (e.shuffle_o && q.type === 'match') optsMap[q.id] = seededShuffle(q.opts.right.map((_, i) => i), seed + q.id)
        else if (e.shuffle_o && q.type === 'order') optsMap[q.id] = seededShuffle(q.opts.map((_, i) => i), seed + q.id)
      }
      const aid = 'at-' + randomBytes(6).toString('hex')
      db.prepare(`INSERT INTO exam_attempts (id, exam_id, student_id, started_at, deadline_at, answers, order_map)
        VALUES (?,?,?,?,?,?,?)`)
        .run(aid, e.id, req.user.id, t, deadline === Infinity ? t + e.duration_min * 60000 : deadline, J({}), J({ qids, opts: optsMap }))
      a = db.prepare('SELECT * FROM exam_attempts WHERE id = ?').get(aid)
    } else if (a.status !== 'in_progress') {
      return res.status(409).json({ error: 'شما قبلاً در این آزمون شرکت کرده‌اید', done: true })
    } else if (e.close_at && t > e.close_at + 30000) {
      autoSubmit(e, a, 'پایان بازه آزمون')
      return res.status(409).json({ error: 'زمان آزمون تمام شده و پاسخ‌های شما ثبت شد', done: true })
    }

    const om = P(a.order_map, { qids: [], opts: {} })
    const byId = Object.fromEntries(qs.map((q) => [q.id, q]))
    /* حالت PDF: سوال‌های مجازی بدون متن — فقط پاسخبرگ */
    const questions = e.mode === 'pdf'
      ? Array.from({ length: e.q_count }, (_, i) => ({ qid: 'q' + (i + 1), n: i + 1, type: 'pdfmcq', choices: e.choices_per_q }))
      : om.qids.filter((qid) => byId[qid]).map((qid, i) => {
          const q = byId[qid]
          const perm = om.opts?.[qid]
          let opts = q.opts
          if (Array.isArray(opts) && perm) opts = perm.map((oi) => q.opts[oi])
          else if (q.type === 'match' && perm) opts = { left: q.opts.left, right: perm.map((oi) => q.opts.right[oi]) }
          return { qid: q.id, n: i + 1, type: q.type, body: q.body, image: q.image, opts, points: q.points }
        })
    res.json({
      attempt: {
        id: a.id, started_at: a.started_at, deadline_at: a.deadline_at, server_now: t,
        answers: P(a.answers, {}), sec: P(a.sec_log, {}),
        exam: {
          id: e.id, title: e.title, desc: e.desc, mode: e.mode, duration_min: e.duration_min,
          pdf_pages: e.mode === 'pdf' ? P(e.pdf_pages, []) : [],
          choices_per_q: e.choices_per_q,
          sec_copy_block: !!e.sec_copy_block, sec_tab_limit: e.sec_tab_limit, sec_fullscreen: !!e.sec_fullscreen,
          teacher_name: db.prepare('SELECT name FROM users WHERE id = ?').get(e.teacher_id)?.name || '',
        },
        questions,
      },
    })
  })

  /* ذخیره خودکار پاسخ‌ها — نرخ محدود، اعتبارسنجی سخت‌گیرانه */
  app.post('/api/exams/:id/save', requireStudent, (req, res) => {
    const e = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id)
    if (!e) return res.status(404).json({ error: 'آزمون پیدا نشد' })
    const a = db.prepare('SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?').get(e.id, req.user.id)
    if (!a || a.status !== 'in_progress') return res.status(409).json({ error: 'تلاش فعالی وجود ندارد' })
    if (now() > a.deadline_at + 60000) return res.status(409).json({ error: 'زمان تمام شده — ارسال کنید', expired: true })
    if (now() - (a.last_save || 0) < 1200) return res.status(429).json({ error: 'کمی صبر کنید', slow: true })

    const incoming = req.body?.a && typeof req.body.a === 'object' ? req.body.a : {}
    const qs = questionsOf(e.id)
    const valid = e.mode === 'pdf'
      ? validPdfAnswers(e, incoming)
      : validBuilderAnswers(qs, incoming, P(a.order_map, { opts: {} }).opts || {})
    const prev = P(a.answers, {})
    const merged = { ...prev, ...valid }
    /* پاک‌سازی پاسخ‌های حذف‌شده (null صریح) */
    for (const [k, v] of Object.entries(incoming)) if (v === null || v === '') delete merged[k]

    /* لاگ امنیتی — گزارش کلاینت + مهر زمانی سرور */
    const secIn = req.body?.sec && typeof req.body.sec === 'object' ? req.body.sec : {}
    const sec = P(a.sec_log, {})
    sec.tabs = Math.max(0, Math.min(999, Number(secIn.tabs ?? sec.tabs ?? 0)))
    sec.copy = Math.max(0, Math.min(999, Number(secIn.copy ?? sec.copy ?? 0)))
    sec.fs_exits = Math.max(0, Math.min(999, Number(secIn.fs_exits ?? sec.fs_exits ?? 0)))
    const events = (sec.events || []).concat((Array.isArray(secIn.newEvents) ? secIn.newEvents : []).slice(0, 10).map((ev) => ({ t: now(), k: String(ev?.k || 'ev').slice(0, 12) })))
    sec.events = events.slice(-120)

    db.prepare('UPDATE exam_attempts SET answers = ?, sec_log = ?, last_save = ? WHERE id = ?')
      .run(J(merged), J(sec), now(), a.id)
    res.json({ ok: true, saved: Object.keys(merged).length })
  })

  /* ارسال نهایی — تصحیح کامل سمت سرور */
  app.post('/api/exams/:id/submit', requireStudent, (req, res) => {
    const e = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id)
    if (!e) return res.status(404).json({ error: 'آزمون پیدا نشد' })
    const a = db.prepare('SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?').get(e.id, req.user.id)
    if (!a) return res.status(404).json({ error: 'تلاشی وجود ندارد' })
    if (a.status !== 'in_progress') return res.json({ ok: true, already: true, score: a.score, max_score: a.max_score })

    const t = now()
    const late = t > a.deadline_at + 30000
    /* اگر خیلی دیر رسیده، همان آخرین ذخیره سرور ملاک است (ضد تقلب زمانی) */
    const incoming = !late && req.body?.a && typeof req.body.a === 'object' ? req.body.a : {}
    const qs = questionsOf(e.id)
    const valid = e.mode === 'pdf'
      ? validPdfAnswers(e, incoming)
      : validBuilderAnswers(qs, incoming, P(a.order_map, { opts: {} }).opts || {})
    const prev = P(a.answers, {})
    const merged = { ...prev, ...valid }
    for (const [k, v] of Object.entries(incoming)) if (v === null || v === '') delete merged[k]

    const secIn = req.body?.sec || {}
    const sec = P(a.sec_log, {})
    sec.tabs = Math.max(0, Math.min(999, Number(secIn.tabs ?? sec.tabs ?? 0)))
    sec.copy = Math.max(0, Math.min(999, Number(secIn.copy ?? sec.copy ?? 0)))
    sec.fs_exits = Math.max(0, Math.min(999, Number(secIn.fs_exits ?? sec.fs_exits ?? 0)))

    const graded = P(a.graded_pts, {})
    const { score, max } = gradeAttempt(e, qs, merged, graded)
    const hasEssayPending = e.mode === 'builder' && qs.some((q) => q.type === 'essay' && merged[q.id] !== undefined && graded[q.id] === undefined)

    const flags = []
    const usedMin = (t - a.started_at) / 60000
    if (late) flags.push('late')
    if (e.sec_fast_submit > 0 && usedMin < e.sec_fast_submit / 60 && Object.keys(merged).length > 0) flags.push('fast')
    if (sec.copy > 10) flags.push('copy_tries')
    let status = hasEssayPending ? 'submitted' : 'graded'
    if (e.sec_tab_limit > 0 && (sec.tabs || 0) > e.sec_tab_limit) { status = 'invalid'; flags.push('tab_limit') }

    db.prepare(`UPDATE exam_attempts SET answers = ?, sec_log = ?, score = ?, max_score = ?, submitted_at = ?, status = ?, flags = ? WHERE id = ?`)
      .run(J(merged), J(sec), Math.round(score * 100) / 100, max, t, status, J(flags), a.id)
    res.json({ ok: true, status, score: Math.round(score * 100) / 100, max, flags })
  })

  /* ================= کارنامه دانش‌آموز ================= */
  app.get('/api/exams/:id/result', requireStudent, (req, res) => {
    const e = db.prepare('SELECT * FROM exams WHERE id = ?').get(req.params.id)
    if (!e) return res.status(404).json({ error: 'آزمون پیدا نشد' })
    const a = db.prepare('SELECT * FROM exam_attempts WHERE exam_id = ? AND student_id = ?').get(e.id, req.user.id)
    if (!a) return res.status(404).json({ error: 'در این آزمون شرکت نکرده‌اید' })
    if (a.status === 'in_progress') return res.status(409).json({ error: 'آزمون هنوز ارسال نشده', in_progress: true })

    const showAnswers = a.status === 'graded' || a.status === 'submitted'
    const qs = questionsOf(e.id)
    const answers = P(a.answers, {})
    const graded = P(a.graded_pts, {})
    const om = P(a.order_map, { qids: [], opts: {} })
    const list = e.mode === 'pdf'
      ? Array.from({ length: e.q_count }, (_, i) => ({ id: 'q' + (i + 1), n: i + 1, type: 'pdfmcq', topic: '', points: e.pdf_total / Math.max(1, e.q_count) }))
      : qs.map((q, i) => ({ ...q, n: i + 1 }))
    const items = list.map((q) => buildReportItem(e, q, answers, graded, om, showAnswers))

    const scores = db.prepare(`SELECT score FROM exam_attempts WHERE exam_id = ? AND status IN ('submitted','graded')`).all(e.id).map((r) => r.score || 0)
    const better = scores.filter((s) => s > (a.score || 0)).length
    res.json({
      exam: { id: e.id, title: e.title, mode: e.mode, teacher_name: db.prepare('SELECT name FROM users WHERE id = ?').get(e.teacher_id)?.name || '', answer_pdf: e.answer_pdf || '' },
      attempt: { status: a.status, score: a.score, max_score: a.max_score, started_at: a.started_at, submitted_at: a.submitted_at, deadline_at: a.deadline_at, flags: P(a.flags, []) },
      items,
      class: { count: scores.length, avg: scores.length ? Math.round((scores.reduce((s, v) => s + v, 0) / scores.length) * 100) / 100 : 0, highest: scores.length ? Math.max(...scores) : null },
      rank: scores.length ? better + 1 : null,
    })
  })

  /* ===================================================================== */

  function isEnrolled(courseId, uid) {
    if (!courseId) return true
    return !!db.prepare('SELECT 1 AS x FROM enrollments WHERE class_id = ? AND user_id = ?').get(courseId, uid)
  }

  /* اعتبارسنجی پاسخ‌ها در حالت سازنده — فقط شکل‌های مجاز، با تبدیل نمای نمایشی به اصلی */
  function validBuilderAnswers(qs, incoming, optsMap) {
    const out = {}
    for (const q of qs) {
      if (!(q.id in incoming)) continue
      const perm = optsMap?.[q.id]
      const toCanon = (i) => (Array.isArray(perm) && perm[Number(i)] !== undefined ? perm[Number(i)] : Number(i))
      const v = incoming[q.id]
      try {
        if (q.type === 'mcq' || q.type === 'tf') {
          if (Number.isInteger(Number(v)) && Number(v) >= 0 && Number(v) < Math.max(2, q.opts.length)) out[q.id] = toCanon(v)
        } else if (q.type === 'multi') {
          if (Array.isArray(v)) {
            const arr = [...new Set(v.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < Math.max(2, q.opts.length)))].map(toCanon)
            if (arr.length) out[q.id] = arr
          }
        } else if (q.type === 'blank' || q.type === 'short' || q.type === 'essay') {
          const s = String(v ?? '').slice(0, 2000)
          if (s.trim()) out[q.id] = s
        } else if (q.type === 'match') {
          if (v && typeof v === 'object' && !Array.isArray(v)) {
            const m = {}
            for (let l = 0; l < q.opts.left.length; l++) {
              const r = Number(v[l])
              if (Number.isInteger(r) && r >= 0 && r < (perm ? perm.length : q.opts.right.length)) m[l] = Array.isArray(perm) ? perm[r] : r
            }
            if (Object.keys(m).length) out[q.id] = m
          }
        } else if (q.type === 'order') {
          if (Array.isArray(v)) {
            const arr = v.map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < q.opts.length)
            if (arr.length === new Set(arr).size && arr.length === q.opts.length) out[q.id] = arr.map(toCanon)
          }
        }
      } catch { /* پاسخ نامعتبر نادیده گرفته می‌شود */ }
    }
    return out
  }

  function validPdfAnswers(e, incoming) {
    const out = {}
    const key = P(e.answer_key, {})
    for (let n = 1; n <= e.q_count; n++) {
      if (!(('q' + n) in incoming) && !(n in incoming)) continue
      const v = Number(incoming['q' + n] ?? incoming[n])
      if (Number.isInteger(v) && v >= 0 && v < e.choices_per_q) out['q' + n] = v
    }
    return out
  }

  const isCorrect = (e, q, ans) => {
    if (e.mode === 'pdf') return ans === P(e.answer_key, {})[q.n ?? parseInt(String(q.id).slice(1), 10)]
    switch (q.type) {
      case 'mcq': case 'tf': return ans === q.correct
      case 'multi': return Array.isArray(ans) && Array.isArray(q.correct) && ans.length === q.correct.length && ans.every((c) => q.correct.includes(c))
      case 'blank': case 'short': return Array.isArray(q.correct) && q.correct.some((c) => normText(c) === normText(ans))
      case 'match': return typeof ans === 'object' && q.correct && Object.keys(q.correct).length > 0 &&
        Object.entries(q.correct).every(([l, r]) => Number(ans[l]) === Number(r))
      case 'order': return Array.isArray(ans) && Array.isArray(q.correct) && ans.length === q.correct.length && ans.every((v, i) => Number(v) === Number(q.correct[i]))
      default: return false
    }
  }

  /* تصحیح کامل یک تلاش */
  function gradeAttempt(e, qs, answers, graded) {
    if (e.mode === 'pdf') {
      const max = e.pdf_total
      const perQ = max / Math.max(1, e.q_count)
      let s = 0
      for (let n = 1; n <= e.q_count; n++) {
        const a = answers['q' + n]
        if (a !== undefined && a !== null && a !== '' && Number(a) === Number(P(e.answer_key, {})[n])) s += perQ
      }
      return { score: s, max }
    }
    let score = 0, max = 0
    for (const q of qs) {
      max += q.points
      const ans = answers[q.id]
      if (ans === undefined || ans === null || ans === '') continue
      if (q.type === 'essay') { if (graded[q.id] !== undefined) score += Math.min(q.points, Number(graded[q.id]) || 0); continue }
      if (isCorrect(e, q, ans)) { score += q.points; continue }
      if (q.type === 'multi' && Array.isArray(ans)) {
        const c = Array.isArray(q.correct) ? q.correct : []
        const hits = ans.filter((x) => c.includes(x)).length
        const miss = ans.filter((x) => !c.includes(x)).length
        score += q.points * Math.max(0, (hits - miss) / Math.max(1, c.length))
      } else if (q.type === 'match' && ans && typeof ans === 'object') {
        const total = Object.keys(q.correct || {}).length || 1
        const okN = Object.entries(q.correct || {}).filter(([l, r]) => Number(ans[l]) === Number(r)).length
        score += q.points * (okN / total)
      } else if (q.type === 'order' && Array.isArray(ans)) {
        const total = q.correct?.length || 1
        const okN = ans.filter((v, i) => Number(v) === Number(q.correct?.[i])).length
        score += q.points * (okN / total)
      }
    }
    return { score: Math.max(0, score), max }
  }

  /* تبدیل پاسخ دانش‌آموز از نمای نمایشی به متن اصلی برای کارنامه */
  function buildReportItem(e, q, answers, graded, om, showAnswers) {
    if (e.mode === 'pdf') {
      const n = q.n
      const your = answers['q' + n]
      const key = P(e.answer_key, {})[n]
      const perQ = e.pdf_total / Math.max(1, e.q_count)
      const res = your === undefined || your === null || your === '' ? 'blank' : (Number(your) === Number(key) ? 'correct' : 'wrong')
      return { n, type: 'pdfmcq', topic: '', points: perQ, got: res === 'correct' ? perQ : 0, res,
        your: your === undefined ? null : 'گزینه ' + ['۱', '۲', '۳', '۴', '۵', '۶'][your],
        correct: showAnswers && key !== undefined ? 'گزینه ' + ['۱', '۲', '۳', '۴', '۵', '۶'][key] : null, expl: '' }
    }
    const perm = om?.opts?.[q.id]
    const fromCanon = (i) => (Array.isArray(perm) && perm.indexOf(Number(i)) >= 0 ? perm.indexOf(Number(i)) : Number(i))
    const your = answers[q.id]
    let yourTxt = null, corrTxt = null, got = 0
    const greek = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '۱۰']
    if (your !== undefined && your !== null && your !== '') {
      if (q.type === 'mcq' || q.type === 'tf') yourTxt = greek[fromCanon(your)] + ') ' + q.opts[fromCanon(your)]
      else if (q.type === 'multi') yourTxt = your.map((c) => greek[fromCanon(c)] + ') ' + q.opts[fromCanon(c)]).join(' ، ')
      else if (q.type === 'blank' || q.type === 'short' || q.type === 'essay') yourTxt = String(your)
      else if (q.type === 'match') yourTxt = Object.entries(your).map(([l, r]) => q.opts.left[l] + ' ← ' + q.opts.right[fromCanon(r)]).join(' | ')
      else if (q.type === 'order') yourTxt = your.map((c) => q.opts[fromCanon(c)]).join(' → ')
    }
    let res = your === undefined || your === null || your === '' ? 'blank' : 'wrong'
    if (q.type === 'essay') {
      got = graded[q.id] !== undefined ? Math.min(q.points, Number(graded[q.id]) || 0) : 0
      res = your === undefined || your === null || your === '' ? 'blank' : (graded[q.id] !== undefined ? 'correct' : 'pending')
    } else if (res !== 'blank' && isCorrect(e, q, your)) { res = 'correct'; got = q.points }
    else if (q.type === 'multi' && Array.isArray(your) && Array.isArray(q.correct)) {
      const c = q.correct, hits = your.filter((x) => c.includes(x)).length, miss = your.filter((x) => !c.includes(x)).length
      got = q.points * Math.max(0, (hits - miss) / Math.max(1, c.length))
    } else if (q.type === 'match' && your && typeof your === 'object') {
      const total = Object.keys(q.correct || {}).length || 1
      got = q.points * (Object.entries(q.correct || {}).filter(([l, r]) => Number(your[l]) === Number(r)).length / total)
    } else if (q.type === 'order' && Array.isArray(your)) {
      const total = q.correct?.length || 1
      got = q.points * (your.filter((v, i) => Number(v) === Number(q.correct?.[i])).length / total)
    }
    if (showAnswers) {
      if (q.type === 'mcq' || q.type === 'tf') corrTxt = greek[q.correct] + ') ' + q.opts[q.correct]
      else if (q.type === 'multi') corrTxt = q.correct.map((c) => greek[c] + ') ' + q.opts[c]).join(' ، ')
      else if (q.type === 'blank' || q.type === 'short') corrTxt = (q.correct || []).join(' / ')
      else if (q.type === 'match') corrTxt = Object.entries(q.correct).map(([l, r]) => q.opts.left[l] + ' ← ' + q.opts.right[r]).join(' | ')
      else if (q.type === 'order') corrTxt = q.correct.map((c) => q.opts[c]).join(' → ')
      else if (q.type === 'essay') corrTxt = 'نمره‌گذاری توسط مدرس'
    }
    return { n: q.n, qid: q.id, type: q.type, topic: q.topic || '', points: q.points, got: Math.round(got * 100) / 100, res, your: yourTxt, correct: corrTxt, expl: showAnswers ? (q.expl || '') : '' }
  }

  /* ارسال اجباری توسط سرور (پایان زمان) */
  function autoSubmit(e, a, reason) {
    if (a.status !== 'in_progress') return
    const { score, max } = gradeAttempt(e, questionsOf(e.id), P(a.answers, {}), P(a.graded_pts, {}))
    const hasEssay = e.mode === 'builder' && questionsOf(e.id).some((q) => q.type === 'essay' && P(a.answers, {})[q.id] !== undefined && P(a.graded_pts, {})[q.id] === undefined)
    db.prepare('UPDATE exam_attempts SET status = ?, score = ?, max_score = ?, submitted_at = ?, flags = ? WHERE id = ?')
      .run(hasEssay ? 'submitted' : 'graded', Math.round(score * 100) / 100, max, now(), J(['auto', reason.slice(0, 40)]), a.id)
  }
}
