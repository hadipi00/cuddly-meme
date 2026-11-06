import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { Avatar } from '../../components/ui'
import { students as fallbackStudents, teachers as fallbackTeachers } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { req, getToken } from '../../services/http'
import { faNum, toman } from '../../utils/format'

const ROLE_BADGE = { student: ['دانش‌آموز', 'b-sky'], teacher: ['مدرس', 'b-violet'], admin: ['مدیر', 'b-red'] }

/** کاربران واقعی سیستم از بک‌اند — قبلاً این صفحه فقط ردیف‌های موک ثابت نشان می‌داد؛
    کاربرانی که واقعاً ثبت‌نام می‌کردند هیچ‌جا دیده نمی‌شدند */
function useRealUsers() {
 const [users, setUsers] = useState(null)
 const reload = () => req('/admin/users').then((r) => { if (r.users) setUsers(r.users) }).catch(() => {})
 useEffect(() => { reload() }, [])
 return [users, reload]
}

export default function AUsers({ kind }) {
 const { toast } = useApp()
 const [modal, setModal] = useState(null)
 const [all, reload] = useRealUsers()
 const [saving, setSaving] = useState(false)
 const list = all
  ? all.filter((u) => (kind === 'teacher' ? u.role === 'teacher' : u.role === 'student'))
  : (kind === 'teacher' ? fallbackTeachers.map((t) => ({ ...t, joined: t.joined })) : fallbackStudents)
 const offline = !all

 /** ارتقا/تنزل نقش واقعی کاربر — روی سرور ثبت می‌شود */
 const changeRole = async (u, role, msg) => {
  /* [فیکس F32] تغییر نقش (مثل تنزل مدرس) برگشت‌ناپذیر است — confirm اضافه شد */
  if (!window.confirm(`نقش «${u.name}» به ${role === 'teacher' ? 'مدرس' : 'دانش‌آموز'} تغییر کند؟ این عمل فوراً روی حساب واقعی او اعمال می‌شود.`)) return
  try {
   await req(`/admin/users/${u.id}/role`, { method: 'POST', body: { role } })
   toast(msg)
   reload()
  } catch (e) {
   if (!e.serverDown) toast(e.message || 'تغییر نقش ناموفق بود', 'error')
   else toast('سرور در دسترس نیست', 'error')
  }
 }

 /* [فیکس F40] ساخت/ویرایش واقعی اکانت — فقط مدیر. ثبت‌نام عمومی سایت همیشه
    دانش‌آموز می‌سازد؛ اکانت معلم فقط از همین فرم ساخته می‌شود (رمز موقت +
    اجبار تغییر در اولین ورود + شماره موبایل برای CRM) */
 const add = async (data) => {
  if (saving) return
  setSaving(true)
  try {
   if (modal === 'new') {
    await req('/admin/users', {
     method: 'POST',
     body: {
      role: kind === 'teacher' ? 'teacher' : 'student',
      name: data.name, title: data.role, phone: data.phone, email: data.email,
      username: data.username, password: data.pass,
     },
    })
    toast(`اکانت ساخته شد — نام‌کاربری: ${data.username || '—'} • رمز موقت است و در اولین ورود باید عوض شود`)
   } else {
    await req(`/admin/users/${modal.id}`, {
     method: 'PATCH',
     body: {
      name: data.name, title: data.role, email: data.email,
      phone: data.phone, username: data.username,
     },
    })
    toast('مشخصات کاربر ذخیره شد')
   }
   setModal(null)
   reload()
  } catch (e) {
   if (!e.serverDown) toast(e.message || 'عملیات ناموفق بود', 'error')
   else toast('سرور در دسترس نیست', 'error')
  }
  setSaving(false)
 }

 /** [فیکس F40] بازنشانی رمز واقعی — رمز موقت + اجبار تغییر در اولین ورود + ابطال سشن‌ها */
 const resetPw = async (u) => {
  const pw = window.prompt(`رمز موقت جدید برای «${u.name}» (حداقل ۸ کاراکتر):`)
  if (pw === null) return
  if (pw.trim().length < 8) { toast('رمز باید حداقل ۸ کاراکتر باشد', 'error'); return }
  try {
   const r = await req(`/admin/users/${u.id}/password`, { method: 'POST', body: { password: pw.trim() } })
   toast(r.note || 'رمز بازنشانی شد')
  } catch (e) {
   if (!e.serverDown) toast(e.message || 'بازنشانی رمز ناموفق بود', 'error')
   else toast('سرور در دسترس نیست', 'error')
  }
 }

 /* [CRM] خروجی CSV مشتریان — فایل UTF-8 با BOM برای اکسل؛ شماره موبایل ستون اصلی */
 const exportCrm = async (role) => {
  try {
   const res = await fetch('/api/admin/users.csv' + (role ? `?role=${role}` : ''), {
     headers: { Authorization: `Bearer ${getToken()}` },
   })
   if (!res.ok) throw new Error()
   const blob = await res.blob()
   const a = document.createElement('a')
   a.href = URL.createObjectURL(blob)
   a.download = `modaresyar-crm-${role || 'all'}.csv`
   a.click()
   URL.revokeObjectURL(a.href)
   toast('خروجی CRM دانلود شد — شماره موبایل‌ها برای پیام‌کوتاه آماده است')
  } catch { toast('خروجی CSV ناموفق بود — سرور در دسترس نیست', 'error') }
 }

 if (kind === 'teacher') {
 return (
 <div>
 <div className="between wrap mb24">
 <div>
 <h2 style={{ fontSize: 17 }}>مدیریت مدرسان</h2>
 <span className="muted small">{offline ? 'سرور در دسترس نیست — داده نمونه' : 'اکانت معلم فقط از همین‌جا ساخته می‌شود (ثبت‌نام عمومی فقط دانش‌آموز می‌سازد) — یا ارتقای دانش‌آموز از پنل دانشجوها'}</span>
 </div>
 <button className="btn btn-ghost" onClick={() => exportCrm('teacher')}><Icon name="download" size={16} /> خروجی CRM</button>
 <button className="btn btn-primary" onClick={() => setModal('new')}><Icon name="plus" size={16} /> ساخت اکانت مدرس</button>
 </div>

 <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 22 }}>
 <div className="card stat-card"><b className="sc-val">{faNum(list.length)}</b><span className="sc-label">مدرس سامانه</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(list.reduce((a, t) => a + (Number(t.teacherStudents) || 0), 0).toLocaleString('fa-IR'))}</b><span className="sc-label">مجموع دانشجوهای ثبت‌نام‌شده</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(list.reduce((a, t) => a + (Number(t.courses) || 0), 0))}</b><span className="sc-label">مجموع کلاس‌های فعال</span></div>
 </div>

 <div className="card pad">
 <DataTable
 columns={[
 { key: 'name', label: 'مدرس', render: (r) => (
 <div className="cell-user"><Avatar name={r.name} size={34} color="grad-0" /><div><span className="cell-strong">{r.name}</span><span className="muted small" style={{ display: 'block' }}>{r.title || 'مدرس'}</span></div></div>
 ) },
 { key: 'phone', label: 'موبایل', render: (r) => r.phone ? <span dir="ltr" className="cell-strong">{r.phone}</span> : <span className="muted">—</span> },
 { key: 'email', label: 'ایمیل', render: (r) => <span dir="ltr">{r.email || '—'}</span> },
 { key: 'joined', label: 'عضویت' },
 { key: 'teacherStudents', label: 'دانشجو', render: (r) => faNum(r.teacherStudents || 0) },
 { key: 'courses', label: 'کلاس‌ها', render: (r) => faNum(r.courses || 0) },
 { key: 'spent', label: 'مجموع خرید', render: (r) => toman(r.spent || 0) },
 ]}
 rows={list}
 searchKeys={['name', 'email', 'phone', 'username', 'title']}
 actions={(r) => (
 <>
 <button className="icon-btn" title="ویرایش مشخصات" onClick={() => setModal(r)}><Icon name="edit" /></button>
 <button className="icon-btn" title="تبدیل به دانش‌آموز" onClick={() => changeRole(r, 'student', `${r.name} به دانش‌آموز تغییر نقش یافت`)}><Icon name="user" /></button>
 <button className="icon-btn" title="بازنشانی رمز (رمز موقت)" onClick={() => resetPw(r)}><Icon name="refresh" /></button>
 </>
 )}
 />
 </div>

 <FormModal
 open={!!modal}
 title={modal === 'new' ? 'ساخت اکانت مدرس جدید' : `ویرایش ${modal?.name}`}
 onClose={() => setModal(null)}
 onSubmit={add}
 submitLabel={modal === 'new' ? 'ساخت اکانت' : 'ذخیره'}
 initial={modal && modal !== 'new' ? { name: modal.name, role: modal.title, phone: modal.phone || '', email: modal.email || '', username: modal.username || '' } : { commission: '۷۰' }}
 fields={modal && modal !== 'new' ? [
 { key: 'name', label: 'نام و نام خانوادگی', full: true },
 { key: 'role', label: 'عنوان تخصصی', full: true, placeholder: 'مثلاً مدرس هوش مصنوعی' },
 { key: 'username', label: 'نام کاربری', placeholder: 'a.rezaei' },
 { key: 'phone', label: 'شماره موبایل (CRM)', placeholder: '۰۹۱۲…' },
 { key: 'email', label: 'ایمیل', placeholder: 'teacher@example.com', required: false },
 ] : [
 { key: 'name', label: 'نام و نام خانوادگی', full: true, placeholder: 'مثلاً علی رضایی' },
 { key: 'role', label: 'عنوان تخصصی', full: true, placeholder: 'مثلاً مدرس هوش مصنوعی' },
 { key: 'phone', label: 'شماره موبایل (CRM)', placeholder: '۰۹۱۲…' },
 { key: 'email', label: 'ایمیل', placeholder: 'teacher@example.com', required: false },
 { key: 'username', label: 'نام کاربری', placeholder: 'a.rezaei' },
 { key: 'pass', label: 'رمز موقت (حداقل ۸ کاراکتر)', placeholder: '۸ کاراکتر یا بیشتر' },
 { key: 'commission', label: 'سهم مدرس از فروش (٪)', type: 'select', options: ['۶۰', '۶۵', '۷۰', '۷۵', '۸۰'] },
 { key: 'bio', label: 'بیوگرافی کوتاه', type: 'textarea', required: false },
 ]}
 />
 </div>
 )
 }

 // ---- دانشجوها ----
 return (
 <div>
 <div className="between wrap mb24">
 <div>
 <h2 style={{ fontSize: 17 }}>مدیریت دانشجوها</h2>
 <span className="muted small">{offline ? 'سرور در دسترس نیست — داده نمونه' : 'کاربران واقعی ثبت‌نام‌شده — می‌توانید نقششان را به مدرس ارتقا دهید'}</span>
 </div>
 <button className="btn btn-ghost" onClick={() => exportCrm('student')}><Icon name="download" size={16} /> خروجی CRM</button>
 <button className="btn btn-primary" onClick={() => setModal('new')}><Icon name="plus" size={16} /> افزودن دانشجو</button>
 </div>

 <div className="stat-cards" style={{ marginBottom: 22 }}>
 <div className="card stat-card"><b className="sc-val">{faNum(list.length)}</b><span className="sc-label">دانش‌آموز ثبت‌نام‌شده</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(list.reduce((a, s) => a + (Number(s.courses) || 0), 0))}</b><span className="sc-label">مجموع ثبت‌نام در کلاس‌ها</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(list.reduce((a, s) => a + (Number(s.orders) || 0), 0))}</b><span className="sc-label">مجموع سفارش‌ها</span></div>
 <div className="card stat-card"><b className="sc-val">{toman(list.reduce((a, s) => a + (Number(s.spent) || 0), 0))}</b><span className="sc-label">مجموع خرید پرداخت‌شده</span></div>
 </div>

 <div className="card pad">
 <DataTable
 columns={[
 { key: 'name', label: 'دانشجو', render: (r) => (
 <div className="cell-user"><Avatar name={r.name} size={34} color="grad-2" /><div><span className="cell-strong">{r.name}</span><span className="muted small" style={{ display: 'block' }} dir="ltr">{r.email}</span></div></div>
 ) },
 { key: 'phone', label: 'موبایل', render: (r) => r.phone ? <span dir="ltr" className="cell-strong">{r.phone}</span> : <span className="muted">—</span> },
 { key: 'joined', label: 'عضویت' },
 { key: 'courses', label: 'کلاس‌ها', render: (r) => faNum(r.courses || 0) },
 { key: 'orders', label: 'سفارش‌ها', render: (r) => faNum(r.orders || 0) },
 { key: 'spent', label: 'مجموع خرید', render: (r) => toman(r.spent || 0) },
 { key: 'role', label: 'نقش', render: (r) => {
 const [label, cls] = ROLE_BADGE[r.role] || ROLE_BADGE.student
 return <span className={`badge ${cls}`}>{label}</span>
 } },
 ]}
 rows={list}
 searchKeys={['name', 'email', 'phone', 'username']}
 actions={(r) => (
 <>
 <button className="icon-btn" title="ارتقا به مدرس" onClick={() => changeRole(r, 'teacher', `${r.name} مدرس شد — در «مدیریت مدرسان» می‌بینید`)}><Icon name="cap" /></button>
 <button className="icon-btn" title="ویرایش" onClick={() => setModal(r)}><Icon name="edit" /></button>
 </>
 )}
 />
 </div>

 <FormModal
 open={!!modal}
 title={modal === 'new' ? 'افزودن دانشجوی جدید' : `ویرایش ${modal?.name}`}
 onClose={() => setModal(null)}
 onSubmit={add}
 submitLabel={modal === 'new' ? 'ساخت اکانت' : 'ذخیره'}
 initial={modal && modal !== 'new' ? { name: modal.name, email: modal.email || '', phone: modal.phone || '', username: modal.username || '' } : {}}
 fields={modal && modal !== 'new' ? [
 { key: 'name', label: 'نام و نام خانوادگی', full: true },
 { key: 'username', label: 'نام کاربری', placeholder: 'sara_m' },
 { key: 'phone', label: 'شماره موبایل (CRM)', placeholder: '۰۹۱۲…' },
 { key: 'email', label: 'ایمیل', required: false },
 ] : [
 { key: 'name', label: 'نام و نام خانوادگی', full: true },
 { key: 'username', label: 'نام کاربری', placeholder: 'sara_m' },
 { key: 'phone', label: 'شماره موبایل (CRM)', placeholder: '۰۹۱۲…' },
 { key: 'email', label: 'ایمیل', required: false },
 { key: 'pass', label: 'رمز موقت (حداقل ۸ کاراکتر)', placeholder: '۸ کاراکتر یا بیشتر' },
 ]}
 />
 </div>
 )
}
