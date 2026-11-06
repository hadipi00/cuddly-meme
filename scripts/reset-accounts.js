// بازنشانی رمز اکانت‌های دمو + پاک‌سازی وضعیت کلاس‌های گیرکرده بعد از تست‌های قبلی
// [درخواست کاربر] «رمز مدیر و مدرس رو بده» — رمزها باید مشخص و قابل ورود باشند
import { DatabaseSync } from 'node:sqlite'
import bcrypt from '../server/node_modules/bcryptjs/index.js'

const db = new DatabaseSync('server/data/modaresyar.db')
const hash = bcrypt.hashSync('12345678', 10)

// مدرس (رضا) و دانش‌آموز دمو (سارا) رمزشان در تست‌های قبلی عوض شده بود → بازگشت به رمز دمو
// پرچم اجبار تغییر رمز برای این دو برداشته می‌شود تا ورود تستی بی‌دردسر باشد
for (const id of ['u-reza', 'u-sara']) {
  db.prepare('UPDATE users SET password_hash = ?, must_change_pw = 0 WHERE id = ?').run(hash, id)
}
console.log('[reset] u-reza & u-sara → password 12345678 (must_change_pw cleared)')

// کلاس‌هایی که وسط تست live/ended مانده‌اند → به حالت «زمان‌بندی شده» تمیز برگردند
const r = db.prepare("UPDATE classes SET status='scheduled', started_at=NULL, ended_at=NULL WHERE status != 'scheduled'").run()
console.log(`[reset] ${r.changes} class(es) back to scheduled`)

// همهٔ سشن‌های قدیمی هم باطل شوند تا از صفر شروع شود
const s = db.prepare('UPDATE auth_sessions SET revoked = 1').run()
console.log(`[reset] ${s.changes} old session(s) revoked`)
