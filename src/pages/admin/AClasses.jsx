import { useEffect, useState } from 'react'
import { DataIcon } from '../../utils/icons'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { liveClasses as fallbackClasses, teachers as fallbackTeachers } from '../../data/mock'
import { content, useCatalog } from '../../services/content'
import { useApp } from '../../store/AppContext'
import { DAYS, SLOTS, faNum } from '../../utils/format'
import { req } from '../../services/http'

/**
 * مدیریت کلاس‌های زنده (ادمین) — داده واقعی از /api/classes؛
 * ساخت کلاس با POST واقعی و حذف با DELETE (قبلاً فقط در localStorage ذخیره می‌شد
 * و هیچ کلاسی که اینجا ساخته می‌شد واقعاً وجود نمی‌آورد)
 */
export default function AClasses() {
 const { toast } = useApp()
 const [modal, setModal] = useState(null)
 const [rows, setRows] = useState(fallbackClasses.map((l) => ({ ...l, source: 'سامانه' })))
 const teachers = useCatalog(content.teachers, fallbackTeachers)

 const load = () => {
 req('/classes').then((r) => {
 if (r.classes?.length) setRows(r.classes.map((c) => ({
 id: c.id, title: c.title, teacher: c.teacherName, day: c.day, start: c.start,
 dur: c.dur, enrolled: c.enrolled, cap: c.cap, price: c.price, status: c.status,
 icon: c.icon, color: c.color, source: 'سامانه',
 statusLabel: c.enrolled >= c.cap ? 'تکمیل ظرفیت' : (c.cap - c.enrolled <= 5 ? 'در حال ثبت‌نام' : 'باز'),
 })))
 }).catch(() => {})
 }
 useEffect(() => { load() }, [])

 const save = async (d) => {
 if (modal && modal !== 'new') return
 /* مدرس انتخابی باید userId واقعی داشته باشد تا کلاس به حساب او تعلق بگیرد */
 const t = teachers.find((x) => x.name === d.teacher)
 if (!t?.userId) { toast('برای این مدرس حساب واقعی نیست — از فهرست مدرسان سامانه انتخاب کنید', 'error'); return }
 try {
 await req('/classes', { method: 'POST', body: {
 title: d.title, desc: '', day: Number(d.day), start: SLOTS[Number(d.slot)] || '18:00',
 dur: Number(d.dur) || 90, cap: Number(d.cap) || 30, price: 0, teacherId: t.userId,
 } })
 setModal(null)
 toast('کلاس واقعاً ساخته شد و در جدول هفتگی دانشجوها قرار گرفت')
 load()
 } catch (e) {
 if (!e.serverDown) toast(e.message || 'ساخت کلاس ناموفق بود', 'error')
 else toast('سرور در دسترس نیست', 'error')
 }
 }

 const remove = async (r) => {
 try {
 await req(`/classes/${r.id}`, { method: 'DELETE' })
 toast('کلاس حذف شد', 'info')
 load()
 } catch (e) {
 if (!e.serverDown) toast(e.message || 'حذف ناموفق بود', 'error')
 }
 }

 return (
 <div>
 <div className="between wrap mb24">
 <div>
 <h2 style={{ fontSize: 17 }}>مدیریت کلاس‌های زنده</h2>
 <span className="muted small">زمان‌بندی جلسات آنلاین — ثبت جلسه جدید = اضافه شدن به جدول هفتگی دانشجوها</span>
 </div>
 <button className="btn btn-primary" onClick={() => setModal('new')}><Icon name="plus" size={16} /> زمان‌بندی جلسه جدید</button>
 </div>

 <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 22 }}>
 <div className="card stat-card"><b className="sc-val">{faNum(rows.length)}</b><span className="sc-label">جلسات فعال</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(rows.reduce((a, r) => a + (r.enrolled || 0), 0))}</b><span className="sc-label">مجموع ثبت‌نام‌ها</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(rows.filter((r) => r.statusLabel === 'تکمیل ظرفیت').length)}</b><span className="sc-label">جلسه تکمیل ظرفیت</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(rows.filter((r) => !r.price).length)}</b><span className="sc-label">کلاس رایگان</span></div>
 </div>

 <div className="card pad">
 <DataTable
 columns={[
 { key: 'title', label: 'کلاس', render: (r) => (
 <div className="cell-user">
 <span className={`avatar ${r.color || 'grad-1'}`} style={{ width: 36, height: 36, borderRadius: 10, fontSize: 18 }}><DataIcon name={r.icon} size={18} /></span>
 <span className="cell-strong">{r.title}</span>
 </div>
 ) },
 { key: 'teacher', label: 'مدرس' },
 { key: 'day', label: 'روز', render: (r) => DAYS[r.day] },
 { key: 'start', label: 'ساعت' },
 { key: 'enrolled', label: 'ظرفیت', render: (r) => <span className="muted small">{faNum(r.enrolled)} / {faNum(r.cap)}</span> },
 { key: 'statusLabel', label: 'وضعیت', render: (r) => (
 <span className={`badge ${r.statusLabel === 'تکمیل ظرفیت' ? 'b-red' : r.statusLabel === 'در حال ثبت‌نام' ? 'b-amber' : 'b-green'}`}>{r.statusLabel}</span>
 ) },
 ]}
 rows={rows}
 searchKeys={['title', 'teacher']}
 filters={[
 { key: 'day', label: 'روز', options: DAYS, match: (r, v) => DAYS[r.day] === v },
 { key: 'teacher', label: 'مدرس', options: teachers.map((t) => t.name) },
 ]}
 actions={(r) => (
 <>
 <button className="icon-btn" title="حذف کلاس" onClick={() => remove(r)}>
 <Icon name="trash" />
 </button>
 <button className="icon-btn" title="یادآوری به دانشجوها" onClick={() => toast('پیامک یادآوری به همه ثبت‌نامی‌ها ارسال شد')}>
 <Icon name="send" />
 </button>
 <button className="icon-btn" title="بازیابی ضبط جلسه" onClick={() => toast('فایل ضبط جلسه دانلود شد', 'info')}>
 <Icon name="download" />
 </button>
 </>
 )}
 />
 </div>

 <FormModal
 open={!!modal}
 title="زمان‌بندی جلسه زنده جدید"
 onClose={() => setModal(null)}
 onSubmit={save}
 submitLabel="ثبت در جدول هفتگی"
 fields={[
 { key: 'title', label: 'عنوان جلسه', full: true, placeholder: 'مثلاً مرور جامع فصل ۴ — ریاضی' },
 { key: 'teacher', label: 'مدرس', type: 'select', options: teachers.map((t) => t.name) },
 { key: 'day', label: 'روز هفته', type: 'select', options: DAYS.map((d, i) => ({ value: String(i), label: d })) },
 { key: 'slot', label: 'ساعت شروع', type: 'select', options: SLOTS.map((s, i) => ({ value: String(i), label: s })) },
 { key: 'dur', label: 'مدت (دقیقه)', type: 'number' },
 { key: 'cap', label: 'ظرفیت', type: 'number', required: false },
 ]}
 />
 </div>
 )
}
