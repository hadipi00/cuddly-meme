import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { RatingStars } from '../../components/ui'
import { tickets as fallbackTickets, reviews as fallbackReviews } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { req } from '../../services/http'
import { faNum } from '../../utils/format'

export default function ASupport() {
 const { toast } = useApp()
 const [tab, setTab] = useState('tickets')
 const [list, setList] = useState(fallbackTickets)
 const [revList, setRevList] = useState(fallbackReviews)
 const [contactList, setContactList] = useState([])
 const [detail, setDetail] = useState(null)
 const [replyText, setReplyText] = useState('')
 const [sending, setSending] = useState(false)

 /* داده واقعی از بک‌اند — قبلاً تیکت/نظر فقط موک ثابت بود و هیچ تیکتی
    که کاربر واقعی ثبت می‌کرد اینجا دیده نمی‌شد */
 useEffect(() => {
  let alive = true
  req('/admin/tickets').then((r) => { if (alive && Array.isArray(r.tickets)) setList(r.tickets) }).catch(() => {})
  req('/admin/reviews').then((r) => { if (alive && r.reviews) setRevList(r.reviews) }).catch(() => {})
  req('/contact').then((r) => { if (alive && r.messages) setContactList(r.messages) }).catch(() => {})
  return () => { alive = false }
 }, [])

 /** بستن/پاسخ تیکت — روی سرور ثبت می‌شود (قبلاً فقط state محلی بود)
  *  [فیکس F14] متن پاسخ هم ارسال و ذخیره می‌شود — قبلاً input نه value داشت
  *  نه name/ref و متن هرگز خوانده نمی‌شد؛ دانشجو هرگز پاسخ را نمی‌دید */
 const setTicketStatus = async (t, status, reply = '') => {
  /* [فیکس F32] rollback optimistic — قبلاً شکست سرور state را ناسازگار می‌گذاشت */
  const prev = list
  setList((l) => l.map((x) => (x.id === t.id ? { ...x, status, reply: reply || x.reply } : x)))
  try { await req(`/admin/tickets/${t.id}`, { method: 'POST', body: { status, reply } }) }
  catch (e) {
   setList(prev)
   if (!e.serverDown) toast(e.message || 'ثبت وضعیت ناموفق بود', 'error')
   else toast('سرور در دسترس نیست — وضعیت تغییر نکرد', 'error')
  }
 }

 const close = (t) => { setTicketStatus(t, 'closed'); setDetail(null); toast('تیکت بسته شد') }

 /** ارسال پاسخ ادمین — متن input خوانده و با تغییر status به سرور می‌رود */
 const sendReply = async () => {
  const text = replyText.trim()
  if (!text) { toast('متن پاسخ را بنویسید', 'error'); return }
  if (sending) return
  setSending(true)
  try {
   await req(`/admin/tickets/${detail.id}`, { method: 'POST', body: { status: 'answered', reply: text } })
   setList((l) => l.map((x) => (x.id === detail.id ? { ...x, status: 'answered', reply: text } : x)))
   toast('پاسخ ارسال شد')
   setDetail(null)
   setReplyText('')
  } catch (e) {
   if (!e.serverDown) toast(e.message || 'ارسال پاسخ ناموفق بود', 'error')
  }
  setSending(false)
 }

 /** تأیید/رد نظر — روی سرور؛ نظر تأییدشده فوراً در سایت عمومی ظاهر می‌شود */
 const moderate = async (r, status) => {
  const prev = revList
  if (status === 'approved') setRevList((l) => l.map((x) => (x.id === r.id ? { ...x, status } : x)))
  else setRevList((l) => l.filter((x) => x.id !== r.id))
  try {
   await req(`/admin/reviews/${r.id}`, { method: 'POST', body: { status } })
   toast(status === 'approved' ? 'نظر تأیید و منتشر شد' : 'نظر رد شد', status === 'approved' ? 'success' : 'info')
  } catch (e) {
   setRevList(prev)
   if (!e.serverDown) toast(e.message || 'ثبت وضعیت ناموفق بود', 'error')
  }
 }

 return (
 <div>
 <div className="between wrap mb16">
 <div>
 <h2 style={{ fontSize: 17 }}>پشتیبانی و نظرات</h2>
 <span className="muted small">مدیریت تیکت‌های کاربران و تأیید/رد نظرات دوره‌ها</span>
 </div>
 </div>

 <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 22 }}>
 <div className="card stat-card"><b className="sc-val text-amber">{faNum(list.filter((t) => t.status === 'open').length)}</b><span className="sc-label">تیکت باز</span></div>
 <div className="card stat-card"><b className="sc-val">۴ ساعت</b><span className="sc-label">میانگین زمان پاسخ</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(list.filter((t) => t.priority === 'بالا').length)}</b><span className="sc-label">اولویت بالا </span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(revList.filter((r) => r.status === 'pending').length)}</b><span className="sc-label">نظر در انتظار تأیید</span></div>
 </div>

 <div className="tabs">
 <button className={`tab ${tab === 'tickets' ? 'on' : ''}`} onClick={() => setTab('tickets')}> تیکت‌ها ({faNum(list.filter((t) => t.status === 'open').length)} باز)</button>
 <button className={`tab ${tab === 'reviews' ? 'on' : ''}`} onClick={() => setTab('reviews')}> نظرات ({faNum(revList.filter((r) => r.status === 'pending').length)} در انتظار)</button>
 <button className={`tab ${tab === 'contact' ? 'on' : ''}`} onClick={() => setTab('contact')}> پیام‌های تماس ({faNum(contactList.length)})</button>
 </div>

 {tab === 'contact' ? (
 <div className="grids g2">
 {!contactList.length && (
 <div className="card pad" style={{ gridColumn: '1/-1' }}><p className="muted small" style={{ textAlign: 'center', padding: 16 }}>هنوز پیامی از فرم تماس ثبت نشده است.</p></div>
 )}
 {contactList.map((m) => (
 <div className="card pad" key={m.id}>
 <div className="between mb8">
 <b className="small">{m.name}</b>
 <span className="muted small" dir="ltr">{m.email}</span>
 </div>
 {m.subject && <span className="badge b-sky mb8">{m.subject}</span>}
 <p className="muted small" style={{ lineHeight: 2 }}>{m.body}</p>
 <div className="mt8"><span className="muted small">{new Date(m.createdAt).toLocaleDateString('fa-IR')}</span></div>
 </div>
 ))}
 </div>
 ) : tab === 'tickets' ? (
 <div className="card pad">
 <DataTable
 columns={[
 { key: 'id', label: 'کد', render: (r) => <span className="cell-strong" dir="ltr" style={{ textAlign: 'right' }}>{r.id}</span> },
 { key: 'subject', label: 'موضوع' },
 { key: 'user', label: 'کاربر' },
 { key: 'priority', label: 'اولویت', render: (r) => (
 <span className={`badge ${r.priority === 'بالا' ? 'b-red' : r.priority === 'متوسط' ? 'b-amber' : 'b-gray'}`}>{r.priority}</span>
 ) },
 { key: 'date', label: 'تاریخ' },
 { key: 'status', label: 'وضعیت', render: (r) => (
 r.status === 'open' ? <span className="badge b-amber">باز</span>
 : r.status === 'answered' ? <span className="badge b-sky">پاسخ داده شد</span>
 : <span className="badge b-gray">بسته</span>
 ) },
 ]}
 rows={list}
 searchKeys={['id', 'subject', 'user']}
 filters={[
 { key: 'status', label: 'وضعیت', options: ['باز', 'پاسخ داده شد', 'بسته'], match: (r, v) => (r.status === 'open' ? 'باز' : r.status === 'answered' ? 'پاسخ داده شد' : 'بسته') === v },
 { key: 'priority', label: 'اولویت', options: ['بالا', 'متوسط', 'کم'] },
 ]}
 actions={(r) => (
 <>
 <button className="icon-btn" title="مشاهده و پاسخ" onClick={() => setDetail(r)}><Icon name="chat" /></button>
 {r.status !== 'closed' && <button className="icon-btn" title="بستن" onClick={() => close(r)}><Icon name="check" /></button>}
 </>
 )}
 />
 </div>
 ) : tab === 'reviews' ? (
 <div className="grids g2">
 {revList.map((r) => (
 <div className="card pad" key={r.id}>
 <div className="between mb8">
 <div className="row g8"><b className="small">{r.user}</b><span className="muted small">درباره «{r.targetTitle || r.target || '—'}»</span></div>
 <RatingStars value={r.rating} />
 </div>
 <p className="muted small" style={{ lineHeight: 2 }}>«{r.text}»</p>
 <div className="between mt16">
 <span className="muted small">{r.date}</span>
 {r.status === 'pending' ? (
 <div className="row g8">
 <button className="btn btn-primary btn-sm" onClick={() => moderate(r, 'approved')}>
 <Icon name="check" size={14} /> تأیید
 </button>
 <button className="btn btn-danger btn-sm" onClick={() => moderate(r, 'rejected')}>
 <Icon name="x" size={14} /> رد
 </button>
 </div>
 ) : (
 <span className={`badge ${r.status === 'approved' ? 'b-green' : 'b-gray'}`}>{r.status === 'approved' ? 'منتشر شده' : 'رد شده'}</span>
 )}
 </div>
 </div>
 ))}
 </div>
 ) : null}

 <Modal open={!!detail} title={`تیکت ${detail?.id} — ${detail?.subject || ''}`} onClose={() => setDetail(null)} wide>
 {detail && (
 <>
 <div className="between mb16 wrap">
 <span className="row g8"><Icon name="user" size={15} /><b className="small">{detail.user}</b></span>
 <span className={`badge ${detail.priority === 'بالا' ? 'b-red' : 'b-amber'}`}>اولویت {detail.priority}</span>
 </div>
 <div className="card pad mb16" style={{ background: 'rgba(7,13,24,.5)' }}>
 <p className="muted small" style={{ lineHeight: 2 }}>{detail.msg}</p>
 </div>
 {/* [فیکس F14] تاریخچه از دادهٔ واقعی — پاسخ هاردکد «دیشب» حذف شد */}
 {detail.reply ? (
 <div className="feed mb16">
 <div className="feed-item">
 <span className="fd-icon" style={{ background: 'rgba(56,189,248,.12)', color: 'var(--sky)' }}><Icon name="shield" size={15} /></span>
 <div><p><b>پشتیبانی:</b> {detail.reply}</p><span className="fd-time">{detail.repliedAt ? new Date(detail.repliedAt).toLocaleDateString('fa-IR') : ''}</span></div>
 </div>
 </div>
 ) : null}
 <div className="row g8">
 <input className="input" placeholder="پاسخ شما…" value={replyText} onChange={(e) => setReplyText(e.target.value)}
   onKeyDown={(e) => { if (e.key === 'Enter' && !e.nativeEvent.isComposing) sendReply() }} disabled={sending} />
 <button className="btn btn-primary btn-sm" onClick={sendReply} disabled={sending || !replyText.trim()}>
 <Icon name="send" size={15} /> {sending ? 'در حال ارسال…' : 'ارسال'}
 </button>
 </div>
 </>
 )}
 </Modal>
 </div>
 )
}
