import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { teacherClasses } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { DAYS, SLOTS, faNum } from '../../utils/format'
import { req } from '../../services/http'

const SLOT_HOURS = [8, 10, 12, 14, 16, 18, 20] // معادل SLOTS (فارسی)

/**
 * مدیریت کلاس‌های پیش‌رو مدرس — نسخه بک‌اند واقعی:
 * ساخت/ویرایش/حذف کلاس روی دیتابیس سرور — بلافاصله در «کلاس زنده — برگزاری» و
 * صفحه عمومی کلاس‌ها دیده می‌شود. در قطعی سرور، همان لیست نمونه نمایش داده می‌شود.
 */
export default function TClasses() {
 const { toast } = useApp()
 const nav = useNavigate()
 const [modal, setModal] = useState(null) // 'new' | row
 const [rows, setRows] = useState(() => teacherClasses.map((c) => ({ ...c, source: 'سامانه' })))
 const [serverOn, setServerOn] = useState(false)

 const load = () => {
 req('/me/teaching').then((r) => {
 if (!r.classes) return
 setServerOn(true)
 setRows(r.classes.map((c) => ({
 id: c.id, liveId: c.id, title: c.title, day: c.day, start: c.start,
 dur: c.dur, students: c.enrolled, room: c.room, source: 'روی سرور (واقعی)',
 })))
 }).catch(() => setServerOn(false))
 }
 useEffect(load, [])

 const save = async (data) => {
 const start = `${SLOT_HOURS[Number(data.slot)] || 16}:00`
 const payload = {
 title: data.title, day: Number(data.day), start,
 dur: Number(data.dur) || 60, cap: Number(data.cap) || 30, desc: '',
 }
 try {
 if (modal === 'new') {
 await req('/classes', { method: 'POST', body: payload })
 toast('کلاس جدید روی سرور ثبت شد — از «کلاس زنده — برگزاری» قابل شروع است ')
 } else {
 await req(`/classes/${modal.id}`, { method: 'PATCH', body: payload })
 toast('کلاس روی سرور به‌روزرسانی شد')
 }
 setModal(null)
 load()
 } catch (e) {
 if (e.serverDown) {
 toast('سرور در دسترس نیست — در حالت دمو ذخیره نمی‌شود', 'error')
 } else {
 toast(e.message || 'ذخیره ناموفق بود', 'error')
 }
 }
 }

 const remove = async (row) => {
 try {
 await req(`/classes/${row.id}`, { method: 'DELETE' })
 toast('کلاس از سرور حذف شد', 'info')
 load()
 } catch (e) {
 toast(e.serverDown ? 'سرور در دسترس نیست' : (e.message || 'حذف ناموفق بود'), 'error')
 }
 }

 return (
 <div>
 <div className="card pad mb24" style={{ background: 'linear-gradient(135deg, rgba(45,212,191,0.1), rgba(56,189,248,0.1))' }}>
 <div className="row g12" style={{ alignItems: 'flex-start' }}>
 <span className="sc-icon teal" style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
 <Icon name="calendar" size={20} />
 </span>
 <div>
 <b>مدیریت کلاس‌های پیش‌رو {serverOn ? '— ذخیره واقعی روی سرور' : ''}</b>
 <p className="muted small">
 هر کلاسی که اینجا تعریف کنید روی سرور ذخیره می‌شود، در «کلاس زنده — برگزاری» قابل شروع است
 و لینک ورود دانشجوها به همان کلاس فعال خواهد بود.
 </p>
 </div>
 </div>
 </div>

 <div className="card pad">
 <DataTable
 columns={[
 { key: 'title', label: 'عنوان کلاس', render: (r) => <span className="cell-strong">{r.title}</span> },
 { key: 'day', label: 'روز هفته', render: (r) => DAYS[r.day] },
 { key: 'start', label: 'ساعت شروع' },
 { key: 'dur', label: 'مدت (دقیقه)', render: (r) => faNum(r.dur) },
 { key: 'students', label: 'ثبت‌نام', render: (r) => faNum(r.students ?? 0) },
 { key: 'source', label: 'منبع', render: (r) => <span className={`badge ${r.source === 'سامانه' ? 'b-gray' : 'b-teal'}`}>{r.source}</span> },
 ]}
 rows={rows}
 searchKeys={['title']}
 filters={[{ key: 'day', label: 'روز', options: DAYS, match: (r, v) => DAYS[r.day] === v }]}
 onAdd={() => setModal('new')}
 addLabel="کلاس جدید"
 actions={(row) => (
 <>
 <button className="icon-btn" title="مدیریت کلاس — ضبط‌ها و فایل‌ها" onClick={() => nav(`/panel/teacher/classes/${row.id}`)}><Icon name="settings" /></button>
 <button className="icon-btn" title="ویرایش" onClick={() => setModal(row)}><Icon name="edit" /></button>
 <button className="icon-btn" title="حذف" onClick={() => remove(row)}><Icon name="trash" /></button>
 <button className="icon-btn" title="شروع کلاس زنده" onClick={() => nav('/panel/teacher/live')}><Icon name="video" /></button>
 </>
 )}
 />
 </div>

 <FormModal
 open={!!modal}
 title={modal === 'new' ? 'تعریف کلاس پیش‌رو جدید' : 'ویرایش کلاس'}
 onClose={() => setModal(null)}
 onSubmit={save}
 initial={modal && modal !== 'new' ? { title: modal.title, day: String(modal.day), slot: String(Math.max(0, SLOT_HOURS.indexOf(parseInt(modal.start)))), dur: modal.dur } : {}}
 submitLabel={modal === 'new' ? 'ثبت کلاس روی سرور' : 'ذخیره تغییرات'}
 fields={[
 { key: 'title', label: 'عنوان کلاس', full: true, placeholder: 'مثلاً کارگاه React — هوک‌های پیشرفته' },
 { key: 'day', label: 'روز هفته', type: 'select', options: DAYS.map((d, i) => ({ value: String(i), label: d })) },
 { key: 'slot', label: 'ساعت شروع', type: 'select', options: SLOTS.map((s, i) => ({ value: String(i), label: s })) },
 { key: 'dur', label: 'مدت (دقیقه)', type: 'number' },
 { key: 'cap', label: 'ظرفیت', type: 'number', required: false },
 ]}
 />
 </div>
 )
}
