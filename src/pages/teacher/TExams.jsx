import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { useApp } from '../../store/AppContext'
import { faNum } from '../../utils/format'
import { req } from '../../services/http'

const statusBadge = {
  draft: <span className="badge" style={{ background: 'rgba(148,163,184,.14)', color: 'var(--muted)' }}>پیش‌نویس</span>,
  published: <span className="badge b-teal">منتشر شده</span>,
  closed: <span className="badge" style={{ background: 'rgba(251,113,133,.13)', color: 'var(--red)' }}>بسته شده</span>,
}

/** لیست آزمون‌های مدرس — ساخت/ویرایش/انتشار/حذف + ورود به تحلیل */
export default function TExams() {
 const { toast } = useApp()
 const nav = useNavigate()
 const [rows, setRows] = useState([])
 const [loaded, setLoaded] = useState(false)
 const [modal, setModal] = useState(null)
 const [form, setForm] = useState({ title: '', mode: 'builder', duration_min: 30 })

 const load = () => {
   req('/exams').then((r) => {
     setRows(r.exams || [])
     setLoaded(true)
   }).catch(() => setLoaded(true))
 }
 useEffect(load, [])

 const create = async () => {
   if (!form.title.trim()) return toast('عنوان آزمون را وارد کنید', 'error')
   try {
     const r = await req('/exams', { method: 'POST', body: form })
     toast('آزمون ساخته شد — حالا سوال‌ها را اضافه کنید')
     nav(`/panel/teacher/exams/${r.id}`)
   } catch (e) { toast(e.message || 'ساخت ناموفق بود', 'error') }
 }

 const publish = async (row) => {
   try {
     await req(`/exams/${row.id}/publish`, { method: 'POST' })
     toast(row.status === 'published' ? 'آزمون تازه‌سازی شد' : 'آزمون منتشر شد — دانش‌آموزها می‌بینند', 'success')
     load()
   } catch (e) { toast(e.message || 'انتشار ناموفق بود', 'error') }
 }

 const close = async (row) => {
   try { await req(`/exams/${row.id}/close`, { method: 'POST' }); toast('آزمون بسته شد', 'info'); load() }
   catch (e) { toast(e.message || 'خطا', 'error') }
 }

 const remove = async (row) => {
   if (!window.confirm(`آزمون «${row.title}» و همه پاسخ‌های آن کامل حذف شود؟`)) return
   try { await req(`/exams/${row.id}`, { method: 'DELETE' }); toast('حذف شد', 'info'); load() }
   catch (e) { toast(e.message || 'حذف ناموفق بود', 'error') }
 }

 return (
  <div>
   <div className="card pad mb24" style={{ background: 'linear-gradient(135deg, rgba(45,212,191,.1), rgba(56,189,248,.08))' }}>
    <div className="row g12" style={{ alignItems: 'flex-start' }}>
     <span className="sc-icon teal" style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name="check" size={20} />
     </span>
     <div style={{ flex: 1 }}>
      <b>آزمون‌ساز مدرس‌یار</b>
      <p className="muted small">
       آزمون بسازید؛ یا سوال‌ها را همین‌جا طراحی کنید یا برگه PDF/تصویر آپلود کنید و فقط کلید پاسخبرگ تستی را بزنید.
       تصحیح خودکار، کارنامه تحلیلی و گزارش ضدتقلب هم خودکار انجام می‌شود.
      </p>
     </div>
     <button className="btn btn-primary" onClick={() => setModal(true)}><Icon name="plus" size={16} />آزمون جدید</button>
    </div>
   </div>

   {!loaded && <div className="card pad muted">در حال بارگذاری…</div>}
   {loaded && !rows.length && (
    <div className="card pad" style={{ textAlign: 'center', padding: 48 }}>
     <Icon name="check" size={40} style={{ opacity: .3 }} />
     <h3 style={{ marginTop: 12 }}>هنوز آزمونی نساخته‌اید</h3>
     <p className="muted small">اولین آزمون خود را بسازید: تستی، تشریحی، جای خالی، وصل‌کردنی یا از روی برگه PDF.</p>
     <button className="btn btn-primary mt16" onClick={() => setModal(true)}><Icon name="plus" size={16} />ساخت اولین آزمون</button>
    </div>
   )}

   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 16 }}>
    {rows.map((e) => (
     <div className="card pad" key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
       <b style={{ fontSize: 15 }}>{e.title}</b>
       {statusBadge[e.status]}
      </div>
      <div className="exm-chips">
       <span className="chip">{e.mode === 'pdf' ? 'برگه PDF + پاسخبرگ' : 'طراحی در سایت'}</span>
       {e.course_title && <span className="chip">{e.course_title}</span>}
       <span className="chip">{faNum(e.q_count)} سوال</span>
       <span className="chip">{faNum(e.duration_min)} دقیقه</span>
      </div>
      <div className="row muted small" style={{ gap: 16 }}>
       <span>شرکت‌کننده: {faNum(e.stats?.participants || 0)}</span>
       {!!e.stats?.participants && <span>میانگین: {faNum(e.stats.avg)}</span>}
      </div>
      <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
       {e.status !== 'closed' && <button className="btn btn-primary btn-sm" onClick={() => nav(`/panel/teacher/exams/${e.id}`)}><Icon name="edit" size={14} />{e.q_count ? 'ویرایش' : 'افزودن سوال'}</button>}
       {!!e.stats?.participants && <button className="btn btn-soft btn-sm" onClick={() => nav(`/panel/teacher/exams/${e.id}/analysis`)}><Icon name="chart" size={14} />تحلیل و تصحیح</button>}
       {e.status === 'draft' && <button className="btn btn-sm" style={{ background: 'rgba(52,211,153,.14)', color: '#34d399' }} onClick={() => publish(e)}><Icon name="send" size={14} />انتشار</button>}
       {e.status === 'published' && <button className="btn btn-ghost btn-sm" onClick={() => close(e)}>بستن</button>}
       <button className="btn btn-danger btn-sm" onClick={() => remove(e)} style={{ marginRight: 'auto' }}><Icon name="trash" size={14} /></button>
      </div>
     </div>
    ))}
   </div>

   {modal && (
    <Modal open title="ساخت آزمون جدید" onClose={() => setModal(null)}>
     <form onSubmit={(ev) => { ev.preventDefault(); create() }}>
      <div className="field">
       <label>عنوان آزمون</label>
       <input className="input" value={form.title} onChange={(ev) => setForm({ ...form, title: ev.target.value })} placeholder="مثلاً: آزمونک فصل ۲ فیزیک" autoFocus />
      </div>
      <div className="field">
       <label>روش سوال‌دهی</label>
       <div className="exm-chips">
        <button type="button" className={`exm-chip ${form.mode === 'builder' ? 'on' : ''}`} onClick={() => setForm({ ...form, mode: 'builder' })}>✍️ طراحی سوال در سایت (۸ نوع سوال)</button>
        <button type="button" className={`exm-chip ${form.mode === 'pdf' ? 'on' : ''}`} onClick={() => setForm({ ...form, mode: 'pdf' })}>📄 آپلود PDF/تصویر + پاسخبرگ تستی</button>
       </div>
       <p className="muted small">
        {form.mode === 'pdf'
         ? 'برگه سوالات را PDF یا عکس آپلود می‌کنید و فقط کلید را مشخص می‌کنید: «سوال ۱ گزینه ۳ صحیح است». دانش‌آموز برگه را می‌بیند و در پاسخبرگ جداگانه علامت می‌زند.'
         : 'سوال‌ها را با انواع گزینه‌ای، درست/نادرت، جای خالی، تشریحی، وصل‌کردنی و مرتب‌کردنی داخل سایت می‌سازید.'}
       </p>
      </div>
      <div className="field-row">
       <div className="field">
        <label>مدت پاسخ‌گویی (دقیقه)</label>
        <input className="input" type="number" min="1" max="600" value={form.duration_min} onChange={(ev) => setForm({ ...form, duration_min: ev.target.value })} />
       </div>
      </div>
      <div className="modal-actions">
       <button type="submit" className="btn btn-primary">ساخت و ادامه</button>
       <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>انصراف</button>
      </div>
     </form>
    </Modal>
   )}
  </div>
 )
}
