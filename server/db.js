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
  kind       TEXT NOT NULL DEFAULT 'class',   -- class | course | market | shipping
  item_id    TEXT NOT NULL,
  title      TEXT NOT NULL,
  amount     INTEGER NOT NULL DEFAULT 0,      -- تومان
  status     TEXT NOT NULL DEFAULT 'paid',    -- paid | pending | refunded
  gateway    TEXT NOT NULL DEFAULT 'test',    -- test | zarinpal
  created_at INTEGER NOT NULL,
  qty        INTEGER NOT NULL DEFAULT 1       -- تعداد هر قلم (برای برگشت موجودی در انصراف پرداخت)
);
CREATE INDEX IF NOT EXISTS idx_orders_code ON orders(code);
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
/* [فیکس B26-UI] پرچم «اجبار تغییر رمز اولین ورود» برای اکانت‌های دموی با رمز عمومی */
try { db.exec('ALTER TABLE users ADD COLUMN must_change_pw INTEGER NOT NULL DEFAULT 0') } catch { /* ستون هست */ }

/* ---------------- [مهاجرت CRM] ستون‌های تلفن و نام کاربری ----------------
 * شماره موبایل ستون فقرات CRM مشتریان + ورود با کد پیامکی است؛
 * username هم برای ورود سریع «نام کاربری + رمز» لازم است. */
try { db.exec('ALTER TABLE users ADD COLUMN phone TEXT') } catch { /* ستون هست */ }
try { db.exec('ALTER TABLE users ADD COLUMN username TEXT') } catch { /* ستون هست */ }

/* [مهاجرت CRM] ایمیل دیگر اجباری نیست — ثبت‌نام رسمی سایت فقط با شماره موبایل است.
 * SQLite اجازهٔ تغییر NOT NULL با ALTER ندارد → بازسازی یک‌بارهٔ جدول (فقط بار اول).
 * UNIQUE روی ستون NULL-پذیر چند ردیف NULL را می‌پذیرد (چند ثبت‌نامِ بدون ایمیل) */
try {
  const emailCol = db.prepare('PRAGMA table_info(users)').all().find((c) => c.name === 'email')
  if (emailCol && emailCol.notnull) {
    console.log('[db] rebuilding users table → email becomes optional…')
    db.exec('PRAGMA foreign_keys = OFF')
    db.exec('BEGIN')
    try {
      db.exec(`CREATE TABLE users_new (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  email         TEXT UNIQUE,
  phone         TEXT,
  username      TEXT,
  password_hash TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'student' CHECK (role IN ('student','teacher','admin')),
  color         TEXT DEFAULT 'grad-0',
  title         TEXT,
  created_at    INTEGER NOT NULL,
  must_change_pw INTEGER NOT NULL DEFAULT 0
)`)
      db.exec(`INSERT INTO users_new (id, name, email, phone, username, password_hash, role, color, title, created_at, must_change_pw)
               SELECT id, name, email, phone, username, password_hash, role, color, title, created_at, must_change_pw FROM users`)
      db.exec('DROP TABLE users')
      db.exec('ALTER TABLE users_new RENAME TO users')
      db.exec('COMMIT')
    } catch (e) {
      db.exec('ROLLBACK')
      throw e
    }
    db.exec('PRAGMA foreign_keys = ON')
    const broken = db.prepare('PRAGMA foreign_key_check').all()
    if (broken.length) throw new Error('foreign_key_check failed after users rebuild')
    console.log('[db] users table rebuilt — email is now optional')
  }
} catch (e) { console.error('[db] users rebuild failed:', e.message) }

/* یکتایی تلفن و نام کاربری — فقط برای ردیف‌های واقعاً مقداردار */
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL')
db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL')

/* ---------------- جدول کدهای یکبارمصرف پیامکی (OTP) ----------------
 * هش‌شده ذخیره می‌شود (نه متن خام) + سقف تلاش + انقضای ۲ دقیقه */
db.exec(`
CREATE TABLE IF NOT EXISTS otps (
  phone      TEXT NOT NULL,
  purpose    TEXT NOT NULL,             -- login | register | reset
  code_hash  TEXT NOT NULL,
  attempts   INTEGER NOT NULL DEFAULT 0,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (phone, purpose)
);
/* ---------------- سشن‌های ماندگار (Refresh Token) ----------------
 * توکنِ ۳۶۵روزه با هر تازه‌سازی می‌چرخد؛ فقط هشِ SHA-256 در DB ذخیره می‌شود.
 * revoked=1 یعنی چرخیده/باطل — استفادهٔ دوبارهٔ آن بیرون از مهلت تب‌ها = کشف سرقت */
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  family_id  TEXT NOT NULL,
  user_id    TEXT NOT NULL REFERENCES users(id),
  revoked    INTEGER NOT NULL DEFAULT 0,
  next_enc   TEXT,                      -- توکن بعدیِ رمزنگاری‌شده (مهلت هم‌زمانی تب‌ها)
  created_at INTEGER NOT NULL,
  last_used  INTEGER,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_family ON auth_sessions(family_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user   ON auth_sessions(user_id);
`)

/* ---------------- تنظیمات سیستم (پنل ادمین — F16) ----------------
   [فیکس F16-d] قبلاً «تنظیمات» پنل ادمین فقط toast جعلی می‌زد؛ حالا key/value
   واقعی در DB ذخیره می‌شود. منبع: env اول، تنظیم DB دوم (تنظیم DB برنده است
   تا بدون دیپلویِ دوباره از پنل قابل تغییر باشد) */
db.exec(`
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  updated_at INTEGER NOT NULL DEFAULT 0
);
`)
export const getSetting = (key, fallback = null) => {
  try {
    const r = db.prepare('SELECT value FROM settings WHERE key = ?').get(String(key))
    return r ? r.value : fallback
  } catch { return fallback }
}
export const setSetting = (key, value) => {
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
   .run(String(key), String(value ?? ''), Date.now())
}

/* مهاجرت یک‌باره: اکانت‌های دموی قدیمی (ایمیل @demo.ir) که هنوز رمز عمومی
   «12345678» دارند → پرچم اجبار تغییر رمز اولین ورود می‌گیرند.
   با نشان‌گذاری در جدول settings فقط یک بار در عمر DB اجرا می‌شود. */
try {
  if (!getSetting('migration_demo_pw_flag')) {
    const demo = db.prepare("SELECT id, password_hash FROM users WHERE email LIKE '%@demo.ir'").all()
    const upd = db.prepare('UPDATE users SET must_change_pw = 1 WHERE id = ?')
    let n = 0
    for (const u of demo) {
      if (bcrypt.compareSync('12345678', u.password_hash)) { upd.run(u.id); n++ }
    }
    setSetting('migration_demo_pw_flag', '1')
    if (n) console.log(`[db] ${n} demo account(s) flagged for first-login password change`)
  }
} catch { /* noop */ }

/* ---------------- [مهاجرت CRM] نام‌کاربری و تلفن برای اکانت‌های بدون آن ----------------
 * اکانت‌های قدیمی (مخصوصاً دمویی‌های @demo.ir) username و phone ندارند؛
 * از لوکال‌پارت ایمیل نام‌کاربری می‌سازیم و شماره دموی ثابت می‌دهیم تا
 * ورود با نام‌کاربری و ورود با کد پیامکی برای دمو هم تست‌پذیر باشد */
try {
  if (!getSetting('migration_identity_v1')) {
    const DEMO_PHONES = {
      'admin@demo.ir': '09120000001', 'sara@demo.ir': '09120000002', 'amir@demo.ir': '09120000003',
      'yalda@demo.ir': '09120000004', 'reza@demo.ir': '09120000005', 'maryam@demo.ir': '09120000006',
      'ali@demo.ir': '09120000007', 'hossein@demo.ir': '09120000008', 'negar@demo.ir': '09120000009',
    }
    const rows = db.prepare('SELECT id, email, username, phone FROM users').all()
    const usedU = new Set(rows.map((r) => r.username).filter(Boolean).map((x) => x.toLowerCase()))
    const upd = db.prepare('UPDATE users SET username = ?, phone = ? WHERE id = ?')
    let n = 0
    for (const r of rows) {
      let un = r.username ? r.username : null
      if (!un && r.email) {
        const base = r.email.split('@')[0].toLowerCase().replace(/[^a-z0-9_.]/g, '') || 'user'
        let cand = base
        let i = 1
        while (usedU.has(cand)) cand = base + (++i)
        un = cand
        usedU.add(un)
      }
      const ph = r.phone || DEMO_PHONES[r.email] || null
      if ((un && un !== r.username) || (ph && ph !== r.phone)) { upd.run(un, ph, r.id); n++ }
    }
    setSetting('migration_identity_v1', '1')
    if (n) console.log(`[db] ${n} user(s) got username/phone (migration_identity_v1)`)
  }
} catch (e) { console.error('[db] identity migration failed:', e.message) }

/* ویرایش متون سایت از پنل مدیریت — «متن اصلی → متن جایگزین» (خالی = حذف متن) */
db.exec(`
CREATE TABLE IF NOT EXISTS content_overrides (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  find_text    TEXT NOT NULL UNIQUE,
  replace_text TEXT NOT NULL DEFAULT '',
  created_at   INTEGER NOT NULL
);
`)

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

/* ---------------- داده‌های اولیه (فقط بار اول) ----------------
   [فیکس B26] با DISABLE_SEED=1 در env، داده‌های دمو (با رمز عمومی) ساخته نمی‌شوند —
   برای deploy واقعی؛ در حالت عادی دمو باقی می‌ماند */
const SEED_DISABLED = process.env.DISABLE_SEED === '1'
/* [فیکس امنیتی S5] ایمنی production — با NODE_ENV=production داده‌های دمو
   (رمز عمومی «12345678» برای همهٔ نقش‌ها!) به‌طور پیش‌فرض ساخته نمی‌شوند؛
   اگر واقعاً خواستید در production دموی اولیه داشته باشید، ALLOW_SEED=1 بگذارید. */
const IS_PROD = process.env.NODE_ENV === 'production'
const SEED_ALLOWED_IN_PROD = process.env.ALLOW_SEED === '1'
const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n
if (userCount === 0 && (SEED_DISABLED || (IS_PROD && !SEED_ALLOWED_IN_PROD))) {
  console.log('[db] seeding skipped — production mode: no demo accounts (برای ساخت ادمین واقعی، ثبت‌نام اولین کاربر را از API بگیرید و نقش را مستقیم در DB ارتقا دهید، یا ALLOW_SEED=1 بگذارید)')
} else if (userCount === 0) {
  console.log('[db] seeding initial data…')
  const now = Date.now()
  const hash = bcrypt.hashSync('12345678', 8)
  /* [فیکس B26-UI] اکانت‌های دمو با رمز عمومی متولد می‌شوند → از همان اول
     پرچم اجبار تغییر رمز اولین ورود دارند (قبلاً رمز عمومی برای همیشه می‌ماند) */
  const insUser = db.prepare(
    'INSERT INTO users (id, name, email, phone, username, password_hash, role, color, title, created_at, must_change_pw) VALUES (?,?,?,?,?,?,?,?,?,?,1)'
  )

  const users = [
    ['u-admin',  'مدیر سامانه',      'admin@demo.ir',  'admin',   '09120000001', 'admin',   'grad-5', 'مدیر پلتفرم مدرس‌یار'],
    ['u-sara',   'سارا محمدی',       'sara@demo.ir',   'student', '09120000002', 'sara',    'grad-3', 'دانش‌آموز پایه دوازدهم'],
    ['u-amir',   'امیرحسین طباطبایی','amir@demo.ir',   'student', '09120000003', 'amir',    'grad-1', 'دانش‌آموز دوره ری‌اکت'],
    ['u-yalda',  'یلدا قاسمی',       'yalda@demo.ir',  'student', '09120000004', 'yalda',   'grad-4', 'دانش‌آموز طراحی UI'],
    ['u-reza',   'رضا کریمی',        'reza@demo.ir',   'teacher', '09120000005', 'reza',    'grad-0', 'مدرس برنامه‌نویسی و استاد ارشد آکادمی'],
    ['u-maryam', 'مریم احمدی',       'maryam@demo.ir', 'teacher', '09120000006', 'maryam',  'grad-4', 'مدرس طراحی و تجربه کاربری'],
    ['u-ali',    'علی نادری',        'ali@demo.ir',    'teacher', '09120000007', 'ali',     'grad-2', 'مدرس زبان انگلیسی و آیلتس'],
    ['u-hossein','حسین موسوی',       'hossein@demo.ir','teacher', '09120000008', 'hossein', 'grad-3', 'مدرس ریاضیات و کنکور'],
    ['u-negar',  'نگار رستمی',       'negar@demo.ir',  'teacher', '09120000009', 'negar',   'grad-1', 'مدرس بازاریابی دیجیتال'],
  ]
  for (const [id, name, email, role, phone, username, color, title] of users) {
    insUser.run(id, name, email, phone, username, hash, role, color, title, now)
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
/** برچسب فارسی نقش — در سمت کلاینت هم بعد از رفرش/تب جدید در دسترس باشد (فیکس «پنل undefined») */
const ROLE_LABELS = { student: 'دانش‌آموز', teacher: 'مدرس', admin: 'مدیر' }
export const publicUser = (u) =>
  u ? { id: u.id, name: u.name, email: u.email,
    /* [مهاجرت CRM] شماره موبایل و نام‌کاربری هم بخشی از پروفایل شدند */
    phone: u.phone || '', username: u.username || '',
    role: u.role, roleLabel: ROLE_LABELS[u.role] || u.title || '', color: u.color, title: u.title,
    /* [فیکس B26-UI] فرانت با این پرچم مودال اجباری تغییر رمز نشان می‌دهد */
    mustChangePassword: !!Number(u.must_change_pw) } : null

export const classRow = (c) => ({
  id: c.id, title: c.title, desc: c.desc, icon: c.icon, color: c.color,
  teacherId: c.teacher_id, day: c.day, start: c.start, dur: c.dur,
  cap: c.cap, price: c.price, room: c.room,
  status: c.status, startedAt: c.started_at, endedAt: c.ended_at,
})
