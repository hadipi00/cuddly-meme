import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { studentTickets as fallbackTickets } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { req } from '../../services/http'
import { faNum, faDate } from '../../utils/format'

const badge = { open: ['باز', 'b-amber'], answered: ['پاسخ داده شد', 'b-sky'], closed: ['بسته', 'b-gray'] }

export default function STickets() {
 const { toast, user } = useApp()
 const [list, setList] = useState(fallbackTickets)
 const [open, setOpen] = useState(false)
 const [sending, setSending] = useState(false)
 const [detail, setDetail] = useState(null)

 /* تیکت‌های واقعی کاربر از سرور — قبلاً submitTicket فقط یک id تصادفی
    برمی‌گرداند و هیچ تیکتی در هیچ‌جا ذخیره نمی‌شد (ناقصی) */
 useEffect(() => {
  if (!user) return
  let alive = true
  req('/me/tickets').then((r) => {
   if (alive && Array.isArray(r.tickets)) setList(r.tickets) // [فیکس F21] لیست خالی سرور هم واقعی است
  }).catch(() => {})
  return () => { alive = false }
 }, [user?.id])

 const submit = async (e) => {
 e.preventDefault()
 if (sending) return
 const fd = new FormData(e.target)
 const payload = {
  subject: String(fd.get('subject') || ''),
  body: String(fd.get('body') || ''),
  priority: String(fd.get('priority') || 'متوسط'),
  /* [فیکس F34] بخشِ انتخابی در payload رفت — قبلاً سلکت name نداشت و سرور هم ذخیره نمی‌کرد */
  category: String(fd.get('category') || 'سایر'),
 }
 if (payload.body.trim().length < 10) { toast('توضیحات حداقل ۱۰ حرف باشد', 'error'); return }
 setSending(true)
 try {
  const res = await req('/tickets', { method: 'POST', body: payload })
  if (res.ticket) setList((l) => [res.ticket, ...l])
  setOpen(false)
  toast(`تیکت ${res.ticket?.id} ثبت شد — کارشناسان ما پاسخ می‌دهند`)
 } catch (err) {
  if (!err.serverDown) toast(err.message || 'ثبت تیکت ناموفق بود', 'error')
  else toast('سرور در دسترس نیست — بعداً تلاش کنید', 'error')
 }
 setSending(false)
 }

 return (
 <div>
 <div className="between wrap mb24">
 <div>
 <h2 style={{ fontSize: 17 }}>پشتیبانی و تیکت</h2>
 <span className="muted small">سوالات فنی، مالی و آموزشی — میانگین پاسخ‌گویی: ۴ ساعت</span>
 </div>
 <button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> تیکت جدید</button>
 </div>

 <div className="grids g2">
 {list.map((t) => {
 const [label, cls] = badge[t.status]
 return (
 <div className="card pad" key={t.id}>
 <div className="between mb8">
 <span className="badge b-gray" dir="ltr">{t.id}</span>
 <span className={`badge ${cls}`}>{label}</span>
 </div>
 <b style={{ fontSize: 14.5 }}>{t.subject}</b>
 <div className="between mt16">
 <span className="muted small">{faDate(t.date)} • {faNum(t.replies)} پاسخ</span>
 <button className="btn btn-ghost btn-sm" onClick={() => setDetail(t)}>مشاهده گفتگو</button>
 </div>
 </div>
 )
 })}
 </div>

 <Modal open={open} title="ثبت تیکت جدید" onClose={() => setOpen(false)}>
 <form onSubmit={submit}>
 <div className="field"><label>موضوع</label><input className="input" name="subject" required placeholder="خلاصه مشکل یا سوال" /></div>
 <div className="field-row">
 <div className="field"><label>بخش</label>
 <select className="select" name="category" defaultValue="فنی — پخش دوره">{['فنی — پخش دوره', 'مالی — پرداخت', 'کلاس زنده', 'مدرس‌مارکت', 'سایر'].map((s) => <option key={s}>{s}</option>)}</select>
 </div>
 <div className="field"><label>اولویت</label>
 <select className="select" name="priority">{['کم', 'متوسط', 'بالا'].map((s) => <option key={s}>{s}</option>)}</select>
 </div>
 </div>
 <div className="field"><label>توضیحات کامل</label><textarea className="textarea" name="body" required placeholder="شرح کامل مشکل…" /></div>
 <div className="modal-actions">
 <button className="btn btn-primary" disabled={sending}>{sending ? 'در حال ارسال…' : 'ارسال تیکت'}</button>
 <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>انصراف</button>
 </div>
 </form>
 </Modal>

 <Modal open={!!detail} title={`گفتگو ${detail?.id || ''}`} onClose={() => setDetail(null)}>
 {detail && (
 <>
 <div className="feed mb16">
 <div className="feed-item">
 <span className="fd-icon" style={{ background: 'rgba(45,212,191,.12)', color: 'var(--teal)' }}><Icon name="user" size={15} /></span>
 <div><p><b>شما:</b> {detail.subject}{detail.category && detail.category !== 'سایر' ? ` — بخش: ${detail.category}` : ''}</p><span className="fd-time">{faDate(detail.date)}</span></div>
 </div>
 {/* [فیکس F14] پاسخ واقعی ادمین از سرور — قبلاً برای همهٔ تیکت‌ها یک پاسخ جعلی هاردکد نشان داده می‌شد */}
 {detail.reply ? (
 <div className="feed-item">
 <span className="fd-icon" style={{ background: 'rgba(56,189,248,.12)', color: 'var(--sky)' }}><Icon name="shield" size={15} /></span>
 <div><p><b>پشتیبانی مدرس‌یار:</b> {detail.reply}</p><span className="fd-time">{detail.repliedAt ? new Date(detail.repliedAt).toLocaleDateString('fa-IR') : ''}</span></div>
 </div>
 ) : (
 <div className="feed-item">
 <span className="fd-icon" style={{ background: 'rgba(148,163,184,.12)', color: 'var(--muted)' }}><Icon name="clock" size={15} /></span>
 <div><p className="muted">هنوز پاسخی ثبت نشده — پشتیبانی حداکثر تا ۲۴ ساعت پاسخ می‌دهد.</p></div>
 </div>
 )}
 </div>
 </>
 )}
 </Modal>
 </div>
 )
}
