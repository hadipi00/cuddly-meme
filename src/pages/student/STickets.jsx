import { useState } from 'react'
import Icon from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { studentTickets } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { api } from '../../services/api'
import { faNum, faDate } from '../../utils/format'

const badge = { open: ['باز', 'b-amber'], answered: ['پاسخ داده شد', 'b-sky'], closed: ['بسته', 'b-gray'] }

export default function STickets() {
  const { toast } = useApp()
  const [list, setList] = useState(studentTickets)
  const [open, setOpen] = useState(false)
  const [sending, setSending] = useState(false)
  const [detail, setDetail] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setSending(true)
    const res = await api.submitTicket({ subject: e.target.subject.value })
    setSending(false)
    setList([{ id: res.id, subject: e.target.subject.value, date: '1404/09/13', status: 'open', replies: 0 }, ...list])
    setOpen(false)
    toast(`تیکت ${res.id} ثبت شد — کارشناسان ما پاسخ می‌دهند`)
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
              <select className="select">{['فنی — پخش دوره', 'مالی — پرداخت', 'کلاس زنده', 'مدرس‌مارکت', 'سایر'].map((s) => <option key={s}>{s}</option>)}</select>
            </div>
            <div className="field"><label>اولویت</label>
              <select className="select">{['کم', 'متوسط', 'بالا'].map((s) => <option key={s}>{s}</option>)}</select>
            </div>
          </div>
          <div className="field"><label>توضیحات کامل</label><textarea className="textarea" required placeholder="شرح کامل مشکل…" /></div>
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
                <div><p><b>شما:</b> {detail.subject} — لطفاً راهنمایی کنید.</p><span className="fd-time">{faDate(detail.date)}</span></div>
              </div>
              <div className="feed-item">
                <span className="fd-icon" style={{ background: 'rgba(56,189,248,.12)', color: 'var(--sky)' }}><Icon name="shield" size={15} /></span>
                <div><p><b>پشتیبانی مدرس‌یار:</b> سلام، وقت بخیر 🌹 درخواست شما بررسی شد و در حال پیگیری است. حداکثر تا ۲۴ ساعت آینده نتیجه اعلام می‌شود.</p><span className="fd-time">۲ ساعت پیش</span></div>
              </div>
            </div>
            <div className="row g8">
              <input className="input" placeholder="پاسخ جدید…" />
              <button className="btn btn-primary btn-sm" onClick={() => toast('پاسخ شما ارسال شد')}><Icon name="send" size={15} /></button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
