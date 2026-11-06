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

 const add = (data) => {
  /* ساخت اکانت واقعی هنوز در این فاز نیست — در فازهای بعدی با /api/admin/users POST اضافه می‌شود */
  setModal(null)
  toast('ساخت اکانت واقعی به‌زودی از همین فرم فعال می‌شود — فعلاً ثبت‌نام کاربران از صفحه ثبت‌نام سایت انجام می‌شود', 'info')
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
 <span className="muted small">{offline ? 'سرور در دسترس نیست — داده نمونه' : 'اکانت‌های واقعی مدرسان سامانه — ارتقا دانش‌آموز به مدرس از پنل دانشجوها'}</span>
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
 <button className="icon-btn" title="تبدیل به دانش‌آموز" onClick={() => changeRole(r, 'student', `${r.name} به دانش‌آموز تغییر نقش یافت`)}><Icon name="user" /></button>
 <button className="icon-btn" title="بازنشانی رمز" onClick={() => toast(`بازنشانی رمز ${r.name} — قابلیت ایمیل به‌زودی`, 'info')}><Icon name="refresh" /></button>
 </>
 )}
 />
 </div>

 <FormModal
 open={!!modal}
 title={modal === 'new' ? 'ساخت اکانت مدرس جدید' : `ویرایش ${modal?.name}`}
 onClose={() => setModal(null)}
 onSubmit={add}
 submitLabel={modal === 'new' ? 'ساخت اکانت و ارسال مشخصات' : 'ذخیره'}
 initial={modal && modal !== 'new' ? { name: modal.name, role: modal.title, phone: '', email: modal.email, commission: '۷۰' } : { commission: '۷۰' }}
 fields={[
 { key: 'name', label: 'نام و نام خانوادگی', full: true, placeholder: 'مثلاً علی رضایی' },
 { key: 'role', label: 'عنوان تخصصی', full: true, placeholder: 'مثلاً مدرس هوش مصنوعی' },
 { key: 'phone', label: 'شماره موبایل', placeholder: '۰۹۱۲…' },
 { key: 'email', label: 'ایمیل', placeholder: 'teacher@example.com' },
 { key: 'username', label: 'نام کاربری', placeholder: 'a.rezaei' },
 { key: 'pass', label: 'رمز عبور اولیه', placeholder: 'حداقل ۸ کاراکتر' },
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
 initial={modal && modal !== 'new' ? { name: modal.name, email: modal.email } : {}}
 fields={[
 { key: 'name', label: 'نام و نام خانوادگی', full: true },
 { key: 'email', label: 'ایمیل' },
 { key: 'pass', label: 'رمز اولیه', required: false },
 ]}
 />
 </div>
 )
}
