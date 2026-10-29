import { useState } from 'react'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { Modal } from '../../components/Modal'
import { RatingStars } from '../../components/ui'
import { tickets, reviews } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum } from '../../utils/format'

export default function ASupport() {
  const { toast } = useApp()
  const [tab, setTab] = useState('tickets')
  const [list, setList] = useState(tickets)
  const [revList, setRevList] = useState(reviews)
  const [detail, setDetail] = useState(null)

  const close = (t) => { setList((l) => l.map((x) => (x.id === t.id ? { ...x, status: 'closed' } : x))); setDetail(null); toast('تیکت بسته شد') }

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
        <div className="card stat-card"><b className="sc-val">{faNum(list.filter((t) => t.priority === 'بالا').length)}</b><span className="sc-label">اولویت بالا 🔴</span></div>
        <div className="card stat-card"><b className="sc-val">{faNum(revList.filter((r) => r.status === 'pending').length)}</b><span className="sc-label">نظر در انتظار تأیید</span></div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'tickets' ? 'on' : ''}`} onClick={() => setTab('tickets')}>🎫 تیکت‌ها ({faNum(list.filter((t) => t.status === 'open').length)} باز)</button>
        <button className={`tab ${tab === 'reviews' ? 'on' : ''}`} onClick={() => setTab('reviews')}>⭐ نظرات ({faNum(revList.filter((r) => r.status === 'pending').length)} در انتظار)</button>
      </div>

      {tab === 'tickets' ? (
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
      ) : (
        <div className="grids g2">
          {revList.map((r) => (
            <div className="card pad" key={r.id}>
              <div className="between mb8">
                <div className="row g8"><b className="small">{r.user}</b><span className="muted small">درباره «{r.target}»</span></div>
                <RatingStars value={r.rating} />
              </div>
              <p className="muted small" style={{ lineHeight: 2 }}>«{r.text}»</p>
              <div className="between mt16">
                <span className="muted small">{r.date}</span>
                {r.status === 'pending' ? (
                  <div className="row g8">
                    <button className="btn btn-primary btn-sm" onClick={() => { setRevList((l) => l.map((x) => (x.id === r.id ? { ...x, status: 'approved' } : x))); toast('نظر تأیید و منتشر شد') }}>
                      <Icon name="check" size={14} /> تأیید
                    </button>
                    <button className="btn btn-danger btn-sm" onClick={() => { setRevList((l) => l.filter((x) => x.id !== r.id)); toast('نظر رد شد', 'info') }}>
                      <Icon name="x" size={14} /> رد
                    </button>
                  </div>
                ) : (
                  <span className="badge b-green">منتشر شده</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

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
            <div className="feed mb16">
              <div className="feed-item">
                <span className="fd-icon" style={{ background: 'rgba(56,189,248,.12)', color: 'var(--sky)' }}><Icon name="shield" size={15} /></span>
                <div><p><b>پشتیبانی:</b> سلام وقت بخیر 🌹 مشکل به تیم فنی ارجاع شد.</p><span className="fd-time">دیشب</span></div>
              </div>
            </div>
            <div className="row g8">
              <input className="input" placeholder="پاسخ شما…" />
              <button className="btn btn-primary btn-sm" onClick={() => { setList((l) => l.map((x) => (x.id === detail.id ? { ...x, status: 'answered' } : x))); setDetail(null); toast('پاسخ ارسال شد') }}>
                <Icon name="send" size={15} /> ارسال
              </button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
