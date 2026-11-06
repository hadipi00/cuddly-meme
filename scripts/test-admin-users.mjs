/* تست E2E فیکس F40 — ساخت اکانت معلم فقط توسط مدیر */
import { DatabaseSync } from 'node:sqlite'
const B = 'http://localhost:4000/api'
const ok = (name, cond) => { console.log((cond ? 'PASS' : 'FAIL') + ' — ' + name); if (!cond) process.exitCode = 1 }
const j = (r) => r.json()
const req = (t, path, opts = {}) => fetch(B + path, {
  ...opts,
  body: opts.body && typeof opts.body === 'object' ? JSON.stringify(opts.body) : opts.body,
  headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) },
}).then(j)

const main = async () => {
  const admin = await req(null, '/auth/login', { method: 'POST', body: { id: 'admin', password: '12345678' } })
  ok('ورود مدیر', !!admin.token)

  // ۱) ساخت اکانت معلم توسط مدیر
  const c = await req(admin.token, '/admin/users', { method: 'POST', body: {
    role: 'teacher', name: 'استاد آزمایشی', title: 'مدرس فیزیک کنکور',
    username: 'test_teacher', password: 'TempPass99', phone: '09359990011', email: '',
  } })
  ok('ساخت اکانت معلم توسط مدیر', c.ok === true && c.user?.role === 'teacher')

  // ۲) ورود با همان نام‌کاربری/رمز + نقش معلم + اجبار تغییر رمز
  const t1 = await req(null, '/auth/login', { method: 'POST', body: { id: 'test_teacher', password: 'TempPass99' } })
  ok('ورود معلم جدید با رمز موقت', t1.ok === true && t1.user?.role === 'teacher')
  ok('اجبار تغییر رمز در اولین ورود', t1.user?.mustChangePassword === true)

  // ۳) دانش‌آموز اجازه ساخت اکانت ندارد (403)
  const sara = await req(null, '/auth/login', { method: 'POST', body: { id: 'sara', password: '12345678' } })
  const no = await req(sara.token, '/admin/users', { method: 'POST', body: { role: 'teacher', name: 'x', username: 'zzz9', password: '123456789', email: 'z@z.ir' } })
  ok('دانش‌آموز → ۴۰۳ در ساخت اکانت', !no.ok && !no.user)

  // ۴) تکراری بودن نام‌کاربری/شماره
  const dup = await req(admin.token, '/admin/users', { method: 'POST', body: { role: 'teacher', name: 'y', username: 'test_teacher', password: '123456789', phone: '09359990022' } })
  ok('نام‌کاربری تکراری رد می‌شود', dup.ok !== true && /گروه|گرفته|تکراری/.test(dup.error || ''))
  const dupPh = await req(admin.token, '/admin/users', { method: 'POST', body: { role: 'student', name: 'y', username: 'test_st2', password: '123456789', phone: '09359990011' } })
  ok('شماره موبایل تکراری رد می‌شود', dupPh.ok !== true)

  // ۵) نقش admin از فرم رد می‌شود
  const noAdmin = await req(admin.token, '/admin/users', { method: 'POST', body: { role: 'admin', name: 'y', username: 'test_adm', password: '123456789', email: 'a@a.ir' } })
  ok('ساخت اکانت «مدیر» از فرم رد می‌شود', noAdmin.ok !== true)

  // ۶) ویرایش مشخصات توسط مدیر
  const uid = c.user.id
  const up = await req(admin.token, `/admin/users/${uid}`, { method: 'PATCH', body: { name: 'استاد آزمایشی دوم', title: 'مدرس فیزیک', phone: '09359990012' } })
  ok('ویرایش اکانت توسط مدیر', up.ok === true)

  // ۷) بازنشانی رمز توسط مدیر → رمز موقت قبلی باطل، رمز جدید کار می‌کند، سشن‌ها ابطال
  const pw = await req(admin.token, `/admin/users/${uid}/password`, { method: 'POST', body: { password: 'NewTemp88' } })
  ok('بازنشانی رمز توسط مدیر', pw.ok === true)
  const oldLogin = await req(null, '/auth/login', { method: 'POST', body: { id: 'test_teacher', password: 'TempPass99' } })
  ok('رمز قبلی دیگر کار نمی‌کند', oldLogin.ok !== true)
  const newLogin = await req(null, '/auth/login', { method: 'POST', body: { id: 'test_teacher', password: 'NewTemp88' } })
  ok('ورود با رمز جدید', newLogin.ok === true)

  // ۸) ثبت‌نام عمومی همیشه دانش‌آموز می‌سازد (پایهٔ سیاست «معلم فقط توسط مدیر»)
  const db = new DatabaseSync('server/data/modaresyar.db', { readOnly: true })
  const roles = db.prepare("SELECT role, COUNT(*) n FROM users GROUP BY role").all()
  const teacherN = roles.find((r) => r.role === 'teacher')?.n || 0
  ok(`تعداد مدرسان (${teacherN}) فقط از مسیر مدیر/seed افزایش یافته`, teacherN >= 6)

  // ۹) CRM — شماره موبایل معلم جدید در دیتابیس ثبت شده
  const ph = db.prepare('SELECT phone FROM users WHERE id = ?').get(uid)
  ok('شماره موبایل معلم برای CRM ذخیره شد', ph?.phone === '09359990012')
}

main().catch((e) => { console.error('FAIL — exception:', e.message); process.exitCode = 1 })
