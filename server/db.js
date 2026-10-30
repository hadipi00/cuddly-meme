// =====================================================================
// لایه دیتابیس — SQLite داخلی Node (بدون وابستگی خارجی)
// مسیر فایل: server/data/modaresyar.db  +  لاگ WAL
// Seed اولیه: کاربران دمو + کلاس‌های آنلاین + ثبت‌نام‌های نمونه
// =====================================================================
import { DatabaseSync } from 'node:sqlite'
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import bcrypt from 'bcryptjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dataDir = join(__dirname, 'data')
mkdirSync(dataDir, { recursive: true })

export const db = new DatabaseSync(join(dataDir, 'modaresyar.db'))
db.exec('PRAGMA journal_mode = WAL;')
db.exec('PRAGMA foreign_keys = ON;')

/* ---------------- اسکیمای دیتابیس ---------------- */
db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher','admin')),
  color         TEXT DEFAULT 'grad-0',
  title         TEXT,
  created_at    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS classes (
  id            TEXT PRIMARY KEY,
  title         TEXT NOT NULL,
  desc          TEXT DEFAULT '',
  icon          TEXT DEFAULT 'video',
  color         TEXT DEFAULT 'grad-0',
  teacher_id    TEXT NOT NULL REFERENCES users(id),
  day           INTEGER NOT NULL,          -- ۰=شنبه … ۶=جمعه
  start         TEXT NOT NULL,             -- «HH:MM»
  dur           INTEGER NOT NULL DEFAULT 90,
  cap           INTEGER NOT NULL DEFAULT 30,
  price         INTEGER NOT NULL DEFAULT 0,
  base_enrolled INTEGER NOT NULL DEFAULT 0, -- تعداد پایه برای نمایش (داده نمونه)
  room          TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled','live','ended')),
  started_at    INTEGER,
  ended_at      INTEGER,
  created_at    INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS enrollments (
  class_id   TEXT NOT NULL REFERENCES classes(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (class_id, user_id)
);
CREATE TABLE IF NOT EXISTS attendance (
  class_id   TEXT NOT NULL REFERENCES classes(id),
  user_id    TEXT NOT NULL REFERENCES users(id),
  hand       INTEGER NOT NULL DEFAULT 0,
  first_seen INTEGER NOT NULL,
  last_seen  INTEGER NOT NULL,
  PRIMARY KEY (class_id, user_id)
);
CREATE TABLE IF NOT EXISTS messages (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id   TEXT NOT NULL REFERENCES classes(id),
  user_id    TEXT NOT NULL,
  name       TEXT NOT NULL,
  role       TEXT NOT NULL,
  body       TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  code       TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id),
  kind       TEXT NOT NULL DEFAULT 'class',   -- class | course | product
  item_id    TEXT NOT NULL,
  title      TEXT NOT NULL,
  amount     INTEGER NOT NULL DEFAULT 0,      -- تومان
  status     TEXT NOT NULL DEFAULT 'paid',    -- paid | pending | refunded
  gateway    TEXT NOT NULL DEFAULT 'test',    -- test | zarinpal (مرحله بعد)
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS board_strokes (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id   TEXT NOT NULL REFERENCES classes(id),
  user_id    TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#0f172a',
  size       INTEGER NOT NULL DEFAULT 4,
  tool       TEXT NOT NULL DEFAULT 'pen',     -- pen | erase
  points     TEXT NOT NULL,                   -- JSON [[x,y],…] نرمال‌شده ۰..۱
  created_at INTEGER NOT NULL
);
/* جلسات برگزارشده — هر بار که مدرس کلاس را پایان دهد یک ردیف ثبت می‌شود */
CREATE TABLE IF NOT EXISTS class_sessions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id      TEXT NOT NULL REFERENCES classes(id),
  started_at    INTEGER NOT NULL,
  ended_at      INTEGER NOT NULL,
  dur           INTEGER NOT NULL DEFAULT 0,    -- ثانیه
  recording_url TEXT DEFAULT '',               -- لینک مستقیم ویدیوی ضبط‌شده (آپارات/دُرایو/…)
  created_at    INTEGER NOT NULL,
  UNIQUE (class_id, started_at)
);
/* فایل‌ها و جزوه‌های کلاس — لینک مستقیم فایل (attach به جلسه اختیاری است) */
CREATE TABLE IF NOT EXISTS class_materials (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  class_id   TEXT NOT NULL REFERENCES classes(id),
  session_id INTEGER,                           -- NULL = مالِ کل کلاس
  title      TEXT NOT NULL,
  url        TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_class ON messages(class_id, id);
CREATE INDEX IF NOT EXISTS idx_attendance_class ON attendance(class_id, last_seen);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id, id);
CREATE INDEX IF NOT EXISTS idx_sessions_class ON class_sessions(class_id, started_at);
CREATE INDEX IF NOT EXISTS idx_materials_class ON class_materials(class_id);
`)

/* مهاجرت‌های سبک — افزودن ستون اگر وجود ندارد */
try { db.exec('ALTER TABLE classes ADD COLUMN board_locked INTEGER NOT NULL DEFAULT 0') } catch { /* ستون هست */ }
try { db.exec('ALTER TABLE classes ADD COLUMN board_open INTEGER NOT NULL DEFAULT 0') } catch { /* ستون هست */ }
try { db.exec('ALTER TABLE classes ADD COLUMN board_bg TEXT DEFAULT \'\'') } catch { /* ستون هست */ }
try { db.exec('ALTER TABLE attendance ADD COLUMN can_speak INTEGER NOT NULL DEFAULT 0') } catch { /* ستون هست */ }

/* مهاجرت داده: جلسه‌های برگزارشده قدیمی (کلاس‌هایی که قبل از این قابلیت پایان یافتند) */
try {
  const ended = db.prepare("SELECT id, started_at, ended_at FROM classes WHERE status='ended' AND started_at IS NOT NULL AND ended_at IS NOT NULL").all()
  const ins = db.prepare('INSERT OR IGNORE INTO class_sessions (class_id, started_at, ended_at, dur, created_at) VALUES (?,?,?,?,?)')
  for (const c of ended) ins.run(c.id, c.started_at, c.ended_at, Math.max(1, Math.floor((c.ended_at - c.started_at) / 1000)), c.ended_at)
} catch { /* noop */ }

/* داده نمونه واقعی: یک جزوه برای کلاس کارگاه React تا بخش «فایل‌ها» از اول دیدنی باشد */
try {
  const hasMat = db.prepare('SELECT COUNT(*) AS n FROM class_materials').get().n
  const hasL2 = db.prepare("SELECT 1 AS x FROM classes WHERE id='l2'").get()
  if (!hasMat && hasL2) {
    db.prepare('INSERT INTO class_materials (class_id, session_id, title, url, created_at) VALUES (?,?,?,?,?)')
      .run('l2', null, 'مستند رسمی هوک‌های React (مرجع جلسه اول)', 'https://react.dev/reference/react/hooks', Date.now())
  }
} catch { /* noop */ }

/* ---------------- کلید امضای JWT (تولید یک‌بار و ذخیره) ---------------- */
const secretFile = join(dataDir, '.jwt-secret')
let JWT_SECRET
try {
  JWT_SECRET = readFileSync(secretFile, 'utf8').trim()
  if (!JWT_SECRET) throw new Error('empty')
} catch {
  JWT_SECRET = randomBytes(48).toString('hex')
  writeFileSync(secretFile, JWT_SECRET, { mode: 0o600 })
}
export { JWT_SECRET }

/* ---------------- داده‌های اولیه (فقط بار اول) ---------------- */
const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n
if (userCount === 0) {
  console.log('[db] seeding initial data…')
  const now = Date.now()
  const hash = bcrypt.hashSync('12345678', 8)
  const insUser = db.prepare(
    'INSERT INTO users (id, name, email, password_hash, role, color, title, created_at) VALUES (?,?,?,?,?,?,?,?)'
  )

  const users = [
    ['u-admin',  'مدیر سامانه',      'admin@demo.ir',  'admin',   'grad-5', 'مدیر پلتفرم مدرس‌یار'],
    ['u-sara',   'سارا محمدی',       'sara@demo.ir',   'student', 'grad-3', 'دانش‌آموز پایه دوازدهم'],
    ['u-amir',   'امیرحسین طباطبایی','amir@demo.ir',   'student', 'grad-1', 'دانش‌آموز دوره ری‌اکت'],
    ['u-yalda',  'یلدا قاسمی',       'yalda@demo.ir',  'student', 'grad-4', 'دانش‌آموز طراحی UI'],
    ['u-reza',   'رضا کریمی',        'reza@demo.ir',   'teacher', 'grad-0', 'مدرس برنامه‌نویسی و استاد ارشد آکادمی'],
    ['u-maryam', 'مریم احمدی',       'maryam@demo.ir', 'teacher', 'grad-4', 'مدرس طراحی و تجربه کاربری'],
    ['u-ali',    'علی نادری',        'ali@demo.ir',    'teacher', 'grad-2', 'مدرس زبان انگلیسی و آیلتس'],
    ['u-hossein','حسین موسوی',       'hossein@demo.ir','teacher', 'grad-3', 'مدرس ریاضیات و کنکور'],
    ['u-negar',  'نگار رستمی',       'negar@demo.ir',  'teacher', 'grad-1', 'مدرس بازاریابی دیجیتال'],
  ]
  for (const [id, name, email, role, color, title] of users) {
    insUser.run(id, name, email, hash, role, color, title, now)
  }

  // کلاس‌های آنلاین — دقیقاً همان ۱۰ کلاس دموی فرانت (l1..l10)
  const insClass = db.prepare(`INSERT INTO classes
    (id, title, desc, icon, color, teacher_id, day, start, dur, cap, price, base_enrolled, room, status, created_at)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'scheduled',?)`)

  const classes = [
    ['l1', 'ریاضی ۳ — مشتق و کاربردها', 'کلاس زنده حل تمرین با پرسش و پاسخ مستقیم.', 'sigma', 'grad-3', 'u-hossein', 0, '16:00', 90, 30, 350000, 24, 'room-math3'],
    ['l2', 'کارگاه React — هوک‌های پیشرفته', 'کارگاه عملی رایگان برای دانشجوهای دوره ری‌اکت.', 'atom', 'grad-0', 'u-reza', 0, '18:00', 120, 50, 0, 41, 'room-react'],
    ['l3', 'کلاب مکالمه انگلیسی — هفته‌ای دو جلسه', 'بحث آزاد با موضوعات هفتگی و تصحیح لحظه‌ای.', 'chat', 'grad-2', 'u-ali', 1, '17:00', 60, 20, 180000, 17, 'room-english'],
    ['l4', 'کریتیک پورتفولیو طراحی', 'بازخورد حرفه‌ای روی نمونه‌کارهای دانشجوها.', 'palette', 'grad-4', 'u-maryam', 2, '19:00', 90, 15, 250000, 15, 'room-critique'],
    ['l5', 'شیمی کنکور — آزمونک هفتگی', 'آزمون ۳۰ سواله + تحلیل کامل در کلاس.', 'flask', 'grad-5', 'u-hossein', 3, '10:00', 150, 100, 150000, 62, 'room-chem'],
    ['l6', 'استارتاپ اسکول — جلسه منتورینگ', 'نشست هفتگی رایگان بررسی ایده کسب‌وکار.', 'rocket', 'grad-1', 'u-negar', 4, '20:00', 90, 80, 0, 35, 'room-startup'],
    ['l7', 'ریاضی ۲ — حد و پیوستگی', 'کلاس زنده مباحث حد و پیوستگی.', 'sigma', 'grad-3', 'u-hossein', 5, '16:00', 90, 30, 350000, 19, 'room-math2'],
    ['l8', 'پایتون — حل تمرین پروژه‌ها', 'رفع اشکال پروژه‌های دانشجوها.', 'terminal', 'grad-0', 'u-reza', 2, '14:00', 60, 40, 0, 28, 'room-py'],
    ['l9', 'کارگاه Context و مدیریت State', 'مدیریت state در مقیاس بزرگ با Context و reducer.', 'atom', 'grad-0', 'u-reza', 3, '18:00', 90, 40, 0, 36, 'room-ctx'],
    ['l10', 'پرسش و پاسخ پروژه نهایی', 'جلسه رفع اشکال گروهی پروژه پایانی دوره ری‌اکت.', 'terminal', 'grad-0', 'u-reza', 5, '18:00', 90, 25, 0, 22, 'room-final'],
  ]
  for (const c of classes) insClass.run(...c, now)

  // سارا (اکانت دموی دانش‌آموز) در همه کلاس‌ها ثبت‌نام شده — مطابق برنامه هفتگی پنل
  const insEnroll = db.prepare('INSERT OR IGNORE INTO enrollments (class_id, user_id, created_at) VALUES (?,?,?)')
  for (const c of classes) insEnroll.run(c[0], 'u-sara', now)
  insEnroll.run('l2', 'u-amir', now)
  insEnroll.run('l8', 'u-amir', now)
  insEnroll.run('l4', 'u-yalda', now)

  // چند پیام خوشامد در کلاس کارگاه React
  const insMsg = db.prepare('INSERT INTO messages (class_id, user_id, name, role, body, created_at) VALUES (?,?,?,?,?,?)')
  insMsg.run('l2', 'u-reza', 'رضا کریمی', 'teacher', 'سلام به همه! خوش آمدید — سوال‌هایتان را همین‌جا بپرسید 👋', now - 3600_000)
  insMsg.run('l2', 'u-sara', 'سارا محمدی', 'student', 'سلام استاد، صدا واضحه 🙌', now - 3500_000)
  insMsg.run('l2', 'u-amir', 'امیرحسین طباطبایی', 'student', 'میشه اسلاید قبل رو دوباره نشون بدید؟', now - 3400_000)

  console.log('[db] seed done — 9 users, 10 classes')
}

/* ---------------- هلپرهای پرکاربرد ---------------- */
export const publicUser = (u) =>
  u ? { id: u.id, name: u.name, email: u.email, role: u.role, color: u.color, title: u.title } : null

export const classRow = (c) => ({
  id: c.id, title: c.title, desc: c.desc, icon: c.icon, color: c.color,
  teacherId: c.teacher_id, day: c.day, start: c.start, dur: c.dur,
  cap: c.cap, price: c.price, room: c.room,
  status: c.status, startedAt: c.started_at, endedAt: c.ended_at,
})
