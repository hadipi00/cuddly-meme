import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useApp } from '../../store/AppContext'
import { faNum, faDate } from '../../utils/format'
import { req } from '../../services/http'

/** آزمون‌های من — قابل انجام / در حال انجام / کارنامه */
export default function SExams() {
 const { toast } = useApp()
 const nav = useNavigate()
 const [rows, setRows] = useState([])
 const [loaded, setLoaded] = useState(false)

 const load = () => {
   req('/exams/available').then((r) => { setRows(r.exams || []); setLoaded(true) }).catch((e) => { toast(e.serverDown ? 'سرور در دسترس نیست' : e.message, 'error'); setLoaded(true) })
 }
 useEffect(load, [])

 const windowState = (e) => {
   const t = Date.now()
   if (e.open_at && t < e.open_at) return 'later'
   if (e.close_at && t > e.close_at && !e.attempt) return 'over'
   return 'open'
 }

 return (
  <div>
   <div className="card pad mb24" style={{ background: 'linear-gradient(135deg, rgba(45,212,191,.1), rgba(56,189,248,.08))' }}>
    <div className="row g12" style={{ alignItems: 'flex-start' }}>
     <span className="sc-icon teal" style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon name="target" size={20} />
     </span>
     <div>
      <b>آزمون‌های من</b>
      <p className="muted small">آزمون‌های معلم‌های شما. موقع آزمون، همه سوال‌ها را اسکرول می‌کنید و با دکمه پایین صفحه به پاسخبرگ جداگانه می‌روید — دقیقاً مثل آزمون‌های آزمایشی.</p>
     </div>
    </div>
   </div>

   {!loaded && <div className="card pad muted">در حال بارگذاری…</div>}
   {loaded && !rows.length && (
    <div className="card pad" style={{ textAlign: 'center', padding: 48 }}>
     <Icon name="target" size={40} style={{ opacity: .3 }} />
     <h3 style={{ marginTop: 12 }}>فعلاً آزمونی ندارید</h3>
     <p className="muted small">وقتی معلم آزمونی منتشر کند، اینجا ظاهر می‌شود.</p>
    </div>
   )}

   <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: 16 }}>
    {rows.map((e) => {
     const w = windowState(e)
     const a = e.attempt
     return (
      <div className="card pad" key={e.id} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
       <div className="row" style={{ justifyContent: 'space-between' }}>
        <b style={{ fontSize: 15 }}>{e.title}</b>
        {a?.status === 'graded' && <span className="badge" style={{ background: 'rgba(52,211,153,.14)', color: '#34d399' }}>نمره شد</span>}
        {a?.status === 'submitted' && <span className="badge" style={{ background: 'rgba(251,191,36,.14)', color: '#fbbf24' }}>در انتظار تصحیح</span>}
        {a?.status === 'invalid' && <span className="badge" style={{ background: 'rgba(251,113,133,.14)', color: 'var(--red)' }}>بررسی امنیتی</span>}
        {a?.status === 'in_progress' && <span className="badge b-teal">در حال انجام</span>}
        {!a && w === 'later' && <span className="badge">باز نشده</span>}
        {!a && w === 'over' && <span className="badge" style={{ background: 'rgba(148,163,184,.14)', color: 'var(--muted)' }}>تمام شده</span>}
       </div>
       <p className="muted small">{e.desc || `${e.teacher_name}${e.course_title ? ' — ' + e.course_title : ''}`}</p>
       <div className="exm-chips">
        <span className="chip">{e.mode === 'pdf' ? 'برگه PDF + پاسخبرگ' : `${faNum(e.q_count)} سوال`}</span>
        <span className="chip">{faNum(e.duration_min)} دقیقه</span>
        {e.course_title && <span className="chip">{e.course_title}</span>}
        {e.open_at && w === 'later' && <span className="chip">از {faDate(e.open_at)}</span>}
       </div>
       {a?.status === 'graded' && (
        <div className="exm-score-tile" style={{ padding: 12 }}>
         <div className="v" style={{ fontSize: 22 }}>{faNum(a.score)} <span style={{ fontSize: 13, color: 'var(--muted)' }}>از {faNum(a.max_score)}</span></div>
        </div>
       )}
       <div className="row mt8">
        {(!a || a.status === 'in_progress') && w === 'open' && (
         <button className="btn btn-primary" onClick={() => nav(`/panel/student/exams/${e.id}/take`)}>
          <Icon name="play" size={15} />{a?.status === 'in_progress' ? 'ادامه آزمون' : 'شروع آزمون'}
         </button>
        )}
        {a && a.status !== 'in_progress' && (
         <button className="btn btn-soft" onClick={() => nav(`/panel/student/exams/${e.id}/result`)}>
          <Icon name="award" size={15} />کارنامه تحلیلی
         </button>
        )}
        {!a && w === 'over' && <span className="muted small">زمان آزمون به پایان رسیده بود.</span>}
        {!a && w === 'later' && <span className="muted small">باز شدن: {faDate(e.open_at)}</span>}
       </div>
      </div>
     )
    })}
   </div>
  </div>
 )
}
