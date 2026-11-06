// =====================================================================
// سشن‌های ماندگار مدرس‌یار — Refresh Token با چرخش و کشف سرقت
// ---------------------------------------------------------------------
// هدف محصول: «تا وقتی دستگاه/مرورگر کاربر عوض نشود، سشن هرگز نمی‌پرد»
// اما با ملاحظات امنیتی واقعی (نه یک توکن جاودان بی‌سروصدا):
//   • توکن تازه‌سازی ۳۶۵روزه — با هر تازه‌سازی می‌چرخد (توکن قبلی باطل می‌شود)
//   • فقط هشِ SHA-256 توکن در DB می‌نشیند؛ لو رفتن دیتابیس توکن کار می‌کند ندارد
//   • مهلت هم‌زمانی ۴۵ثانیه‌ای: تب‌های متعدد همان مرورگر که توکن مشترک
//     localStorage را دارند در لحظهٔ چرخش، توکنِ تازه را از طریق فیلد
//     next_enc (رمزنگاری‌شده AES-256-GCM) دریافت می‌کنند — بدون شکستن UX
//   • استفاده از توکنِ چرخیده بیرون از این مهلت = نشانهٔ سرقت → کل خانوادهٔ
//     سشن (همهٔ توکن‌های همان ورود) باطل می‌شود
//   • تغییر رمز / بازیابی رمز → ابطال همهٔ سشن‌های کاربر (خروج اجباری بقیهٔ دستگاه‌ها)
// =====================================================================
import crypto from 'node:crypto'
import { db, JWT_SECRET } from './db.js'

const now = () => Date.now()
const REFRESH_TTL = 365 * 86400_000 // یک سال — با هر استفاده تمدید می‌شود (اسلایدینگ واقعی)
/* [فیکس «همش میگه نشست منقضی شده»] مهلت قبلی ۴۵ثانیه بود؛ وقتی دو تب باز است
 * (مثلاً مدرس در یک تب و دانش‌آموز در تب دیگر برای تست)، مرورگر تایمر تب
 * پس‌زمینه را تا یک دقیقه عقب می‌اندازد و درخواستِ دیرهنگام با توکنِ چرخیده
 * بیرون از مهلت به «کشف سرقت» تعبیر و کل خانوادهٔ سشن باطل می‌شد → خروج اجباری
 * مکرر هر دو تب. حالا ۱۲۰ ثانیه — پوشش کامل throttle تب‌ها، همچنان کوتاه‌تر از
 * هر سناریوی سرقت واقعی که همان‌جا خانواده را می‌کشد */
const GRACE = 120_000               // مهلت هم‌زمانی تب‌ها برای توکنِ تازه‌چرخیده
const sha = (t) => crypto.createHash('sha256').update(String(t)).digest('hex')
const randToken = () => crypto.randomBytes(48).toString('base64url')

/* ---------- رمزنگاری توکن بعدی برای مهلت هم‌زمانی (AES-256-GCM) ---------- */
const encKey = crypto.createHash('sha256').update(JWT_SECRET + ':auth_sessions_v1').digest()
const enc = (plain) => {
  const iv = crypto.randomBytes(12)
  const c = crypto.createCipheriv('aes-256-gcm', encKey, iv)
  const out = Buffer.concat([c.update(String(plain), 'utf8'), c.final()])
  return iv.toString('base64') + '.' + c.getAuthTag().toString('base64') + '.' + out.toString('base64')
}
const dec = (blob) => {
  try {
    const [iv, tag, ct] = String(blob).split('.')
    const d = crypto.createDecipheriv('aes-256-gcm', encKey, Buffer.from(iv, 'base64'))
    d.setAuthTag(Buffer.from(tag, 'base64'))
    return Buffer.concat([d.update(Buffer.from(ct, 'base64')), d.final()]).toString('utf8')
  } catch { return null }
}

/** ساخت سشن تازه برای کاربر (خانوادهٔ جدید) — توکن خام فقط همین‌جا برمی‌گردد */
export function createSession(userId) {
  const token = randToken()
  db.prepare('INSERT INTO auth_sessions (token_hash, family_id, user_id, revoked, created_at, expires_at) VALUES (?,?,?,?,?,?)')
    .run(sha(token), crypto.randomUUID(), String(userId), 0, now(), now() + REFRESH_TTL)
  return token
}

/**
 * تازه‌سازی (چرخش) توکن — خروجی:
 *   { token }              → موفق؛ توکن خامِ تازه (در همان خانواده)
 *   { token, carried }     → توکنِ قبلاًچرخیده در مهلت هم‌زمانی تب‌ها (همان توکنِ تازهٔ فعلی)
 *   { familyRevoked: true } → استفادهٔ مشکوک مکرر؛ کل خانواده ابطال شد
 *   null                   → توکن نامعلوم/منقضی (ورود مجدد لازم است)
 */
export function rotateSession(rawToken) {
  const h = sha(rawToken)
  const row = db.prepare('SELECT * FROM auth_sessions WHERE token_hash = ?').get(h)
  if (!row) return null
  const t = now()

  if (row.expires_at < t) { // منقضی — عادی؛ فقط یک سال فعالیت نکرده
    db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').run(h)
    return null
  }

  if (row.revoked) {
    /* توکنِ چرخیده — دو حالت: */
    if (row.next_enc && row.last_used && t - row.last_used <= GRACE) {
      const carried = dec(row.next_enc)
      if (carried) return { token: carried, carried: true } // تب دومِ همان مرورگر
    }
    /* بیرون از مهلت = یا تب قدیمیِ فراموش‌شده یا دزدِ توکن → کشف و ابطال خانواده */
    db.prepare('UPDATE auth_sessions SET revoked = 1, next_enc = NULL WHERE family_id = ?').run(row.family_id)
    return { familyRevoked: true }
  }

  /* چرخش عادی: توکن فعلی باطل + توکن تازه در همان خانواده + نگهداریِ
     توکنِ بعدی به‌صورت رمزنگاری‌شده در ردیف قدیمی برای مهلت هم‌زمانی */
  const fresh = randToken()
  db.prepare('UPDATE auth_sessions SET revoked = 1, last_used = ?, next_enc = ? WHERE token_hash = ?')
    .run(t, enc(fresh), h)
  db.prepare('INSERT INTO auth_sessions (token_hash, family_id, user_id, revoked, created_at, expires_at) VALUES (?,?,?,?,?,?)')
    .run(sha(fresh), row.family_id, row.user_id, 0, t, t + REFRESH_TTL)
  return { token: fresh }
}

/** کاربرِ صاحب توکنِ فعال — برای مسیرهایی که فقط refresh دارند */
export function sessionUser(rawToken) {
  const row = db.prepare('SELECT * FROM auth_sessions WHERE token_hash = ?').get(sha(rawToken))
  if (!row || row.revoked || row.expires_at < now()) return null
  return db.prepare('SELECT * FROM users WHERE id = ?').get(row.user_id) || null
}

export const revokeFamily = (familyId) =>
  db.prepare('UPDATE auth_sessions SET revoked = 1, next_enc = NULL WHERE family_id = ?').run(String(familyId))

export const revokeByRawToken = (rawToken) => {
  const row = db.prepare('SELECT family_id FROM auth_sessions WHERE token_hash = ?').get(sha(rawToken))
  if (row) revokeFamily(row.family_id)
}

/** تغییر/بازیابی رمز → همهٔ سشن‌های کاربر در همهٔ دستگاه‌ها باطل می‌شوند */
export const revokeAllForUser = (userId) =>
  db.prepare('UPDATE auth_sessions SET revoked = 1, next_enc = NULL WHERE user_id = ?').run(String(userId))

/* پاکسازی دوره‌ای: سشن‌های منقضی یا چرخیدهٔ قدیمی (بیش از ۳۰ روز) حذف می‌شوند */
setInterval(() => {
  try {
    db.prepare('DELETE FROM auth_sessions WHERE expires_at < ? OR (revoked = 1 AND last_used < ?)')
      .run(now(), now() - 30 * 86400_000)
  } catch (e) { console.error('[sessions] cleanup failed:', e.message) }
}, 6 * 3600_000).unref()
