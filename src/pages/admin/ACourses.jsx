import { useEffect, useState } from 'react'
import { DataIcon } from '../../utils/icons'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { useApp } from '../../store/AppContext'
import { faNum, toman } from '../../utils/format'
import { req } from '../../services/http'

/* [فیکس F16-a] CRUD واقعی دوره‌ها — قبلاً فقط state محلی روی دادهٔ mock بود:
   «ذخیره» با هر رفرش پریده، حذف واقعی نبود و «لغو انتشار» فقط toast جعلی می‌زد.
   حالا همه عملیات به /api/admin/courses می‌رود + وضعیت انتشار واقعی (published|draft)
   + مدیریت سرفصل‌ها (هر خط = یک درس) + لیست اساتید واقعی از teacher_profiles. */

const FALLBACK_CATS = ['برنامه‌نویسی', 'طراحی', 'زبان', 'کنکور', 'مهارت', 'دانشگاه']

export default function ACourses() {
 const { toast } = useApp()
 const [tab, setTab] = useState('courses')
 const [modal, setModal] = useState(null)
 const [list, setList] = useState([])
 const [teachers, setTeachers] = useState([])
 const [loaded, setLoaded] = useState(false)
 const [saving, setSaving] = useState(false)

 const load = async () => {
 try {
 const r = await req('/admin/courses')
 setList(r.courses || [])
 } catch (e) { toast(e.message || 'دریافت دوره‌ها ناموفق بود', 'error') }
 finally { setLoaded(true) }
 }

 useEffect(() => { load() }, [])
 useEffect(() => {
 req('/teachers').then((r) => setTeachers(r.teachers || [])).catch(() => {})
 }, [])

 const cats = [...new Set([...list.map((c) => c.cat).filter(Boolean), ...FALLBACK_CATS])]
 const totalStudents = list.reduce((a, c) => a + (c.students || 0), 0)

 /** ذخیرهٔ فرم (ایجاد/ویرایش) — سرفصل‌ها از textarea خط‌به‌خط پارس می‌شوند */
 const save = async (data) => {
 setSaving(true)
 try {
 const curriculum = String(data.curriculum || '').split('\n').map((s) => s.trim()).filter(Boolean)
 const body = {
 title: data.title, cat: data.cat, teacher: data.teacher, level: data.level,
 price: Number(data.price) || 0, hours: Number(data.hours) || 0,
 lessonsCount: Number(data.lessonsCount) || 0, desc: data.desc || '',
 curriculum,
 }
 if (modal === 'new') {
 /* کاور از استخر عکس‌های موجود — قبلاً id=Date.now() باعث آدرس عکس ناموجود
 (۴۰۴ در کارت و JSON-LD سئو) می‌شد */
 body.icon = 'book'; body.color = 'grad-0'
 const cover = '/images/courses/c' + ((list.length % 10) + 1) + '.jpg'
 const r = await req('/admin/courses', { method: 'POST', body: { ...body, cover, status: 'published' } })
 setList((l) => [r.course, ...l])
 toast('دوره جدید در دیتابیس ثبت و منتشر شد')
 } else {
 const r = await req(`/admin/courses/${modal.id}`, { method: 'PATCH', body })
 setList((l) => l.map((c) => (c.id === modal.id ? r.course : c)))
 toast('دوره در دیتابیس به‌روزرسانی شد')
 }
 setModal(null)
 } catch (e) { toast(e.message || 'ذخیره ناموفق بود', 'error') }
 finally { setSaving(false) }
 }

 /** لغو انتشار / انتشار — تغییر وضعیت واقعی: draft از سایت عمومی حذف می‌شود */
 const togglePublish = async (r0) => {
 const next = r0.status === 'published' ? 'draft' : 'published'
 try {
 const r = await req(`/admin/courses/${r0.id}`, { method: 'PATCH', body: { status: next } })
 setList((l) => l.map((c) => (c.id === r0.id ? r.course : c)))
 toast(next === 'published' ? `«${r0.title.slice(0, 24)}…» منتشر شد` : `انتشار «${r0.title.slice(0, 24)}…» لغو شد — از سایت عمومی حذف شد`, 'info')
 } catch (e) { toast(e.message || 'تغییر وضعیت ناموفق بود', 'error') }
 }

 const remove = async (r0) => {
 if (!window.confirm(`دوره «${r0.title}» و همه نظراتش برای همیشه حذف شود؟`)) return
 try {
 await req(`/admin/courses/${r0.id}`, { method: 'DELETE' })
 setList((l) => l.filter((c) => c.id !== r0.id))
 toast('دوره از دیتابیس حذف شد', 'info')
 } catch (e) { toast(e.message || 'حذف ناموفق بود', 'error') }
 }

 return (
 <div>
 <div className="between wrap mb16">
 <div>
 <h2 style={{ fontSize: 17 }}>مدیریت دوره‌ها</h2>
 <span className="muted small">ثبت، ویرایش، انتشار و حذف دوره‌های ضبط‌شده — متصل به دیتابیس</span>
 </div>
 </div>

 <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 22 }}>
 <div className="card stat-card"><b className="sc-val">{faNum(list.length)}</b><span className="sc-label">دوره ثبت‌شده</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(list.filter((c) => c.status === 'published').length)}</b><span className="sc-label">منتشر شده</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(list.filter((c) => c.status === 'draft').length)}</b><span className="sc-label">پیش‌نویس</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(totalStudents.toLocaleString?.('fa-IR') || totalStudents)}</b><span className="sc-label">کل ثبت‌نام‌ها</span></div>
 </div>

 <div className="tabs">
 <button className={`tab ${tab === 'courses' ? 'on' : ''}`} onClick={() => setTab('courses')}> دوره‌ها ({faNum(list.length)})</button>
 <button className={`tab ${tab === 'cats' ? 'on' : ''}`} onClick={() => setTab('cats')}> دسته‌بندی‌ها ({faNum(cats.length)})</button>
 </div>

 {tab === 'courses' ? (
 <div className="card pad">
 <DataTable
 columns={[
 { key: 'title', label: 'دوره', render: (r) => (
 <div className="cell-user">
 <span className={`avatar ${r.color}`} style={{ width: 36, height: 36, borderRadius: 10, fontSize: 18 }}><DataIcon name={r.icon} size={18} /></span>
 <div><span className="cell-strong">{r.title.slice(0, 42)}{r.title.length > 42 ? '…' : ''}</span><span className="muted small" style={{ display: 'block' }}>{r.teacher}</span></div>
 </div>
 ) },
 { key: 'cat', label: 'دسته', render: (r) => <span className="badge b-gray">{r.cat || '—'}</span> },
 { key: 'price', label: 'قیمت', render: (r) => r.price ? toman(r.price) : <span className="badge b-green">رایگان</span> },
 { key: 'students', label: 'دانشجو', render: (r) => faNum(r.students?.toLocaleString?.('fa-IR') || r.students) },
 { key: 'rating', label: 'امتیاز', render: (r) => <span className="badge b-amber"><Icon name="star" size={12} filled /> {faNum(r.rating)}</span> },
 { key: 'status', label: 'وضعیت', render: (r) => r.status === 'published'
 ? <span className="status-dot green"><i />منتشر شده</span>
 : <span className="status-dot amber"><i />پیش‌نویس</span> },
 ]}
 rows={list}
 searchKeys={['title', 'teacher', 'cat']}
 filters={[{ key: 'cat', label: 'دسته', options: cats }]}
 onAdd={() => setModal('new')}
 addLabel="دوره جدید"
 emptyText={loaded ? 'هنوز دوره‌ای ساخته نشده — اولین دوره را ثبت کنید' : 'در حال بارگذاری…'}
 actions={(r) => (
 <>
 <button className="icon-btn" title="ویرایش" onClick={() => setModal(r)}><Icon name="edit" /></button>
 <button className="icon-btn" title="مدیریت سرفصل‌ها" onClick={() => setModal({ ...r, _curriculum: true })}><Icon name="list" /></button>
 <button className="icon-btn" title={r.status === 'published' ? 'لغو انتشار' : 'انتشار'} onClick={() => togglePublish(r)}><Icon name="eye" /></button>
 <button className="icon-btn" title="حذف" onClick={() => remove(r)}><Icon name="trash" /></button>
 </>
 )}
 />
 </div>
 ) : (
 <div className="card pad">
 <h3 className="mb16" style={{ fontSize: 15 }}>دسته‌بندی‌های دوره‌ها</h3>
 <p className="muted small mb16">دسته‌بندی هر دوره از فرم ویرایش تغییر می‌کند؛ این لیست کلید فیلتر جدول است.</p>
 <div className="row wrap g8 mb24">
 {cats.map((c) => (
 <span className="chip on" key={c}>
 {c} <span className="muted small">({faNum(list.filter((x) => x.cat === c).length)})</span>
 </span>
 ))}
 </div>
 </div>
 )}

 <FormModal
 open={!!modal}
 title={modal === 'new' ? 'ثبت دوره جدید' : 'ویرایش دوره'}
 onClose={() => setModal(null)}
 onSubmit={save}
 submitLabel={saving ? 'در حال ذخیره…' : 'ذخیره'}
 initial={modal && modal !== 'new' ? {
 title: modal.title, cat: modal.cat, teacher: modal.teacher, price: String(modal.price),
 hours: String(modal.hours), lessonsCount: String(modal.lessonsCount), level: modal.level,
 desc: modal.desc || '', curriculum: (modal.curriculum || []).join('\n'),
 } : {}}
 fields={[
 { key: 'title', label: 'عنوان دوره', full: true },
 { key: 'cat', label: 'دسته‌بندی', type: 'select', options: cats },
 { key: 'teacher', label: 'مدرس', type: 'select', options: teachers.map((t) => t.name).length ? teachers.map((t) => t.name) : ['رضا کریمی', 'مریم احمدی', 'علی نادری', 'حسین موسوی', 'نگار رستمی'] },
 { key: 'level', label: 'سطح', type: 'select', options: ['مقدماتی', 'متوسط', 'پیشرفته', 'مقدماتی تا پیشرفته', 'کنکور'] },
 { key: 'price', label: 'قیمت (تومان)', type: 'number' },
 { key: 'hours', label: 'ساعت آموزش', type: 'number' },
 { key: 'lessonsCount', label: 'تعداد درس', type: 'number' },
 { key: 'desc', label: 'توضیحات', type: 'textarea', full: true, required: false },
 { key: 'curriculum', label: 'سرفصل‌ها — هر خط یک درس', type: 'textarea', full: true, required: false },
 ]}
 />
 </div>
 )
}
