import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { useApp } from '../../store/AppContext'
import { faNum, faDate } from '../../utils/format'
import { req } from '../../services/http'

const resTag = (r) => r === 'correct'
  ? <span className="exm-rtag ok">درست</span>
  : r === 'wrong'
    ? <span className="exm-rtag no">غلط</span>
    : r === 'pending'
      ? <span className="exm-rtag pd">در انتظار تصحیح</span>
      : <span className="exm-rtag bl">نزده</span>
const typeLabel = { mcq: 'گزینه‌ای', multi: 'چندگزینه‌ای', tf: 'درست/نادرت', blank: 'جای خالی', short: 'کوتاه‌پاسخ', essay: 'تشریحی', match: 'وصل‌کردنی', order: 'مرتب‌کردنی', pdfmcq: 'تستی' }
const flagNote = {
  late: '⏱ پاسخ‌های شما بعد از پایان وقت ثبت شد (بر اساس آخرین ذخیره خودکار).',
  fast: '⚡ تکمیل آزمون خیلی سریع‌تر از حد معمول بود — در گزارش معلم ثبت شده است.',
  tab_limit: '🚨 خروج از تب بیشتر از حد مجاز بود — آزمون شما در انتظار بررسی معلم است.',
  auto: 'این آزمون توسط سامانه و به‌علت پایان وقت تحویل گرفته شد.',
  rejected: 'این آزمون توسط معلم رد شده است (تخلف امنیتی).',
  reviewed_ok: 'این آزمون توسط معلم بررسی و تأیید شد.',
}

/** کارنامه تحلیلی — نمره، رتبه، پاسخ‌ها، تحلیل موضوعی + ذخیره PDF */
export default function SExamResult() {
 const { eid } = useParams()
 const nav = useNavigate()
 const { toast } = useApp()
 const [data, setData] = useState(null)

 useEffect(() => {
   req(`/exams/${eid}/result`).then(setData).catch((e) => {
     if (e.in_progress) { nav(`/panel/student/exams/${eid}/take`, { replace: true }); return }
     toast(e.message || 'کارنامه پیدا نشد', 'error')
   })
 }, [eid])

 if (!data) return <div className="card pad muted">در حال بارگذاری کارنامه…</div>
 const { exam, attempt, items, class: cls, rank } = data
 const max = attempt.max_score || 0
 const score = attempt.score || 0
 const pct = max ? Math.round((score / max) * 100) : 0
 const usedMin = attempt.submitted_at ? Math.max(0, Math.round((attempt.submitted_at - attempt.started_at) / 60000)) : null
 const correctN = items.filter((i) => i.res === 'correct').length
 const wrongN = items.filter((i) => i.res === 'wrong').length
 const blankN = items.filter((i) => i.res === 'blank').length
 const pendingN = items.filter((i) => i.res === 'pending').length
 const flags = attempt.flags || []

 /* تحلیل موضوعی از روی آیتم‌ها */
 const topics = {}
 for (const it of items) {
   const t = it.topic || (exam.mode === 'pdf' ? 'برگه تستی' : 'سایر')
   topics[t] = topics[t] || { got: 0, total: 0 }
   topics[t].total += it.points
   topics[t].got += it.got || 0
 }

 if (attempt.status === 'invalid') {
   return (
    <div className="exm-report">
     <div style={{ textAlign: 'center', padding: '30px 10px' }}>
      <div style={{ fontSize: 44 }}>🚨</div>
      <h2>آزمون شما در انتظار بررسی معلم است</h2>
      <p className="muted" style={{ lineHeight: 2, marginTop: 10 }}>
       به‌علت تخلف‌های امنیتی ثبت‌شده (مثل خروج بیش از حد از تب)، این آزمون برای بررسی توسط معلم ارجاع شده است.
       بعد از بررسی معلم، نتیجه در همین صفحه نمایش داده می‌شود.
      </p>
      <Link to="/panel/student/exams" className="btn btn-ghost mt16">بازگشت به آزمون‌ها</Link>
     </div>
    </div>
   )
 }

 return (
  <div>
   <div className="exm-no-print row mb16" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
    <Link to="/panel/student/exams" className="icon-btn" aria-label="بازگشت"><Icon name="arrowLeft" size={17} /></Link>
    <div className="row" style={{ gap: 8 }}>
     {exam.answer_pdf && <a className="btn btn-soft btn-sm" href={exam.answer_pdf} target="_blank" rel="noreferrer"><Icon name="file" size={14} />پاسخنامه تحلیلی معلم</a>}
     <button className="btn btn-primary btn-sm" onClick={() => window.print()}><Icon name="printer" size={14} />ذخیره PDF</button>
    </div>
   </div>

   <div className="exm-report">
    <div className="exm-report-head">
     <div>
      <h2 style={{ marginBottom: 4 }}>کارنامه تحلیلی</h2>
      <b>{exam.title}</b>
      <p className="muted small" style={{ marginTop: 4 }}>مدرس: {exam.teacher_name} — آزمون: {faDate(attempt.started_at)}</p>
     </div>
     <div className="exm-score-tile big" style={{ minWidth: 170 }}>
      <div className="v">{faNum(score)}</div>
      <div className="l">از {faNum(max)} نمره ({faNum(pct)}٪)</div>
     </div>
    </div>

    {flags.map((f) => (
     <div key={f} className="exm-no-print" style={{ background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.4)', borderRadius: 12, padding: '10px 14px', marginBottom: 14, fontSize: 13 }}>
      {flagNote[f] || f}
     </div>
    ))}

    {/* خلاصه آماری */}
    <div className="exm-score-hero">
     <div className="exm-score-tile"><div className="v" style={{ color: '#34d399' }}>{faNum(correctN)}</div><div className="l">پاسخ درست</div></div>
     <div className="exm-score-tile"><div className="v" style={{ color: 'var(--red)' }}>{faNum(wrongN)}</div><div className="l">پاسخ غلط</div></div>
     <div className="exm-score-tile"><div className="v">{faNum(blankN)}</div><div className="l">نزده</div></div>
     {!!pendingN && <div className="exm-score-tile"><div className="v" style={{ color: '#fbbf24' }}>{faNum(pendingN)}</div><div className="l">در انتظار تصحیح</div></div>}
     {rank && <div className="exm-score-tile"><div className="v">رتبه {faNum(rank)}</div><div className="l">از {faNum(cls.count)} شرکت‌کننده</div></div>}
     {usedMin != null && <div className="exm-score-tile"><div className="v">{faNum(usedMin)}</div><div className="l">دقیقه زمان مصرفی</div></div>}
    </div>

    {/* مقایسه با کلاس */}
    {!!cls.count && (
     <div className="mb24">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
       <b className="small">جایگاه شما نسبت به کلاس</b>
       <span className="muted small">میانگین کلاس: {faNum(cls.avg)} {cls.highest != null ? `— بالاترین: ${faNum(cls.highest)}` : ''}</span>
      </div>
      <div className="exm-tbar">
       <span className="name">شما</span>
       <div className="bar"><i style={{ width: `${pct}%` }} /></div>
       <span className="pct">{faNum(pct)}٪</span>
      </div>
      <div className="exm-tbar" style={{ marginTop: 6 }}>
       <span className="name">میانگین کلاس</span>
       <div className="bar"><i style={{ width: `${max ? Math.round((cls.avg / max) * 100) : 0}%`, background: 'linear-gradient(90deg,#94a3b8,#64748b)' }} /></div>
       <span className="pct">{faNum(max ? Math.round((cls.avg / max) * 100) : 0)}٪</span>
      </div>
     </div>
    )}

    {/* جدول پاسخ‌ها */}
    <b className="small">تحلیل سوال‌به‌سوال</b>
    <div style={{ overflowX: 'auto', marginTop: 10, marginBottom: 24 }}>
     <table className="exm-rtable">
      <thead><tr>
       <th>#</th><th>پاسخ شما</th><th>پاسخ صحیح</th><th>نتیجه</th><th>نمره</th><th>توضیح مدرس</th>
      </tr></thead>
      <tbody>
       {items.map((it) => (
        <tr key={it.n}>
         <td><b>{faNum(it.n)}</b><div className="muted" style={{ fontSize: 10.5 }}>{typeLabel[it.type] || ''}{it.topic ? ` — ${it.topic}` : ''}</div></td>
         <td>{it.your || <span className="muted">بی‌پاسخ</span>}</td>
         <td style={{ color: '#34d399' }}>{it.correct || '—'}</td>
         <td>{resTag(it.res)}</td>
         <td>{faNum(it.got)} / {faNum(it.points)}</td>
         <td className="muted" style={{ fontSize: 12 }}>{it.expl || ''}</td>
        </tr>
       ))}
      </tbody>
     </table>
    </div>

    {/* تحلیل موضوعی */}
    {Object.keys(topics).length > 1 && (
     <>
      <b className="small">تحلیل موضوعی — نقاط قوت و ضعف شما</b>
      <div className="exm-tbars mt12 mb24">
       {Object.entries(topics).map(([name, t]) => {
        const rate = t.total ? Math.round((t.got / t.total) * 100) : 0
        return (
         <div key={name} className="exm-tbar">
          <span className="name">{name}</span>
          <div className="bar"><i style={{ width: `${rate}%`, background: rate < 40 ? 'linear-gradient(90deg,#fb7185,#f43f5e)' : rate < 70 ? 'linear-gradient(90deg,#fbbf24,#fb923c)' : 'linear-gradient(90deg,#2dd4bf,#38bdf8)' }} /></div>
          <span className="pct">{faNum(rate)}٪</span>
         </div>
        )
       })}
      </div>
     </>
    )}

    <p className="muted" style={{ fontSize: 11.5, textAlign: 'center' }}>
     این کارنامه توسط سامانه مدرس‌یار تولید شده است — با دکمه «ذخیره PDF» بالای صفحه قابل نگهداری است.
    </p>
   </div>
  </div>
 )
}
