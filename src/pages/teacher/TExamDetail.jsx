import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { useApp } from '../../store/AppContext'
import { faNum } from '../../utils/format'
import { req } from '../../services/http'

const flagLabel = {
  late: 'ارسال دیرهنگام', fast: 'غیرعادی سریع', tab_limit: 'خروج زیاد از تب',
  copy_tries: 'تلاش زیاد برای کپی', auto: 'ارسال خودکار (پایان وقت)', rejected: 'رد شده توسط مدرس', reviewed_ok: 'تأیید شده',
}
const statusChip = (s) => s === 'graded'
  ? <span className="badge" style={{ background: 'rgba(52,211,153,.14)', color: '#34d399' }}>نهایی شد</span>
  : s === 'submitted'
    ? <span className="badge" style={{ background: 'rgba(251,191,36,.14)', color: '#fbbf24' }}>در انتظار تصحیح</span>
    : s === 'invalid'
      ? <span className="badge" style={{ background: 'rgba(251,113,133,.14)', color: 'var(--red)' }}>بررسی امنیتی</span>
      : <span className="badge">در حال آزمون</span>

/** تحلیل قوی آزمون: آمار، سختی سوال‌ها، موضوع‌ها + تصحیح تشریحی + گزارش امنیتی */
export default function TExamDetail() {
 const { eid } = useParams()
 const { toast } = useApp()
 const [exam, setExam] = useState(null)
 const [ana, setAna] = useState(null)
 const [attempts, setAttempts] = useState([])
 const [grading, setGrading] = useState(null) // {aid, questions, pts, student}
 const [secView, setSecView] = useState(null) // attempt با لاگ امنیتی

 const load = () => {
   req(`/exams/${eid}`).then((r) => setExam(r.exam)).catch(() => {})
   req(`/exams/${eid}/analytics`).then(setAna).catch(() => {})
   req(`/exams/${eid}/attempts`).then((r) => setAttempts(r.attempts || [])).catch(() => {})
 }
 useEffect(load, [eid])

 const openGrading = async (a) => {
   try {
     const r = await req(`/exams/${eid}/attempts/${a.id}`)
     setGrading({ aid: a.id, name: a.student_name || r.attempt?.student_name, questions: r.questions, pts: { ...r.attempt?.graded_pts } })
   } catch (e) { toast(e.message || 'خطا', 'error') }
 }
 const saveGrading = async () => {
   try {
     await req(`/exams/${eid}/attempts/${grading.aid}/grade`, { method: 'POST', body: { pts: grading.pts } })
     toast('نمره‌گذاری ثبت شد', 'success')
     setGrading(null)
     load()
   } catch (e) { toast(e.message || 'ثبت ناموفق بود', 'error') }
 }
 const review = async (a, verdict) => {
   try {
     await req(`/exams/${eid}/attempts/${a.id}/review`, { method: 'POST', body: { verdict } })
     toast(verdict === 'valid' ? 'آزمون تأیید شد' : 'آزمون رد شد — نمره صفر ثبت گردید', 'info')
     load()
   } catch (e) { toast(e.message || 'خطا', 'error') }
 }
 const reset = async (a) => {
   if (!window.confirm(`تلاش «${a.student_name}» پاک شود تا دوباره آزمون بدهد؟`)) return
   try { await req(`/exams/${eid}/attempts/${a.student_id}`, { method: 'DELETE' }); toast('تلاش بازشد — دانش‌آموز می‌تواند دوباره شرکت کند', 'info'); load() }
   catch (e) { toast(e.message || 'خطا', 'error') }
 }

 if (!exam || !ana) return <div className="card pad muted">در حال بارگذاری…</div>
 const s = ana.stats

 return (
  <div>
   <div className="card pad mb24">
    <div className="row g12">
     <Link to="/panel/teacher/exams" className="icon-btn" aria-label="بازگشت"><Icon name="arrowLeft" size={17} /></Link>
     <div style={{ flex: 1 }}>
      <b style={{ fontSize: 16 }}>تحلیل آزمون — {exam.title}</b>
      <p className="muted small" style={{ marginTop: 4 }}>{faNum(s.participants)} شرکت‌کننده{exam.answer_pdf ? ' • پاسخنامه تحلیلی آپلود شده ✓' : ''}</p>
     </div>
    </div>
   </div>

   {/* کارت‌های آمار */}
   <div className="exm-score-hero mb24">
    <div className="exm-score-tile big"><div className="v">{faNum(s.participants)}</div><div className="l">شرکت‌کننده</div></div>
    <div className="exm-score-tile"><div className="v">{faNum(s.avg)}</div><div className="l">میانگین از {faNum(Math.round(s.max_score || 0))}</div></div>
    <div className="exm-score-tile"><div className="v" style={{ color: '#34d399' }}>{s.highest != null ? faNum(s.highest) : '—'}</div><div className="l">بالاترین نمره</div></div>
    <div className="exm-score-tile"><div className="v" style={{ color: 'var(--red)' }}>{s.lowest != null ? faNum(s.lowest) : '—'}</div><div className="l">پایین‌ترین نمره</div></div>
    <div className="exm-score-tile"><div className="v">{faNum(s.avg_percent || 0)}٪</div><div className="l">میانگین درصدی</div></div>
   </div>

   {/* تحلیل سوال‌ها */}
   {!!ana.per_question?.length && (
    <div className="card pad mb24">
     <div className="row" style={{ justifyContent: 'space-between' }}>
      <b>سختی هر سوال — درصد پاسخ صحیح</b>
      {ana.hardest && <span className="badge" style={{ background: 'rgba(251,113,133,.13)', color: 'var(--red)' }}>سخت‌ترین: سوال {faNum(ana.hardest.n)} ({faNum(ana.hardest.rate)}٪)</span>}
     </div>
     <div className="exm-tbars mt16">
      {ana.per_question.map((q) => (
       <div key={q.qid} className="exm-tbar">
        <span className="name">سوال {faNum(q.n)}{q.topic ? ` — ${q.topic}` : ''}</span>
        <div className="bar"><i style={{ width: `${q.rate}%` }} /></div>
        <span className="pct">{faNum(q.rate)}٪</span>
        <span className="muted" style={{ fontSize: 11, minWidth: 110 }}>✓{faNum(q.correct)} ✗{faNum(q.wrong)} —{faNum(q.blank)}</span>
       </div>
      ))}
     </div>
    </div>
   )}

   {/* تحلیل موضوعی */}
   {!!ana.topics?.length && (
    <div className="card pad mb24">
     <b>تحلیل موضوعی — کدام مبحث را باید دوباره کار کنید؟</b>
     <div className="exm-tbars mt16">
      {ana.topics.map((t) => (
       <div key={t.name} className="exm-tbar">
        <span className="name">{t.name}</span>
        <div className="bar"><i style={{ width: `${t.rate}%`, background: t.rate < 40 ? 'linear-gradient(90deg,#fb7185,#f43f5e)' : t.rate < 70 ? 'linear-gradient(90deg,#fbbf24,#fb923c)' : 'linear-gradient(90deg,#2dd4bf,#38bdf8)' }} /></div>
        <span className="pct">{faNum(t.rate)}٪</span>
       </div>
      ))}
     </div>
    </div>
   )}

   {/* لیست تلاش‌ها */}
   <div className="card pad">
    <b>پاسخ‌برگ‌های دریافتی و گزارش امنیتی</b>
    {!attempts.length && <p className="muted small mt12">هنوز کسی در آزمون شرکت نکرده است.</p>}
    {!!attempts.length && (
     <div style={{ overflowX: 'auto', marginTop: 12 }}>
      <table className="exm-rtable">
       <thead><tr>
        <th>دانش‌آموز</th><th>نمره</th><th>مدت</th><th>وضعیت</th><th>خروج از تب</th><th>پرچم‌های امنیتی</th><th>اقدام</th>
       </tr></thead>
       <tbody>
        {attempts.map((a) => (
         <tr key={a.id}>
          <td><b>{a.student_name}</b></td>
          <td>{a.score != null ? `${faNum(a.score)} از ${faNum(a.max_score)}` : '—'}</td>
          <td>{a.submitted_at ? `${faNum(Math.max(0, Math.round((a.submitted_at - a.started_at) / 60000)))} دقیقه` : '—'}</td>
          <td>{statusChip(a.status)}</td>
          <td>{faNum(a.sec_log?.tabs || 0)}</td>
          <td>{(a.flags || []).length ? (a.flags || []).map((f) => <span key={f} className="exm-rtag no" style={{ marginInlineEnd: 4 }}>{flagLabel[f] || f}</span>) : <span style={{ color: '#34d399' }}>سالم ✓</span>}</td>
          <td>
           <div className="row" style={{ gap: 6 }}>
            {(a.status === 'submitted' || (a.flags || []).length > 0) && <button className="btn btn-soft btn-sm" onClick={() => openGrading(a)}>تصحیح</button>}
            {a.status === 'invalid' && <>
             <button className="btn btn-sm" style={{ background: 'rgba(52,211,153,.14)', color: '#34d399' }} onClick={() => review(a, 'valid')}>تأیید</button>
             <button className="btn btn-danger btn-sm" onClick={() => review(a, 'invalid')}>رد</button>
            </>}
            <button className="btn btn-ghost btn-sm" onClick={() => setSecView(a)}><Icon name="shield" size={13} />گزارش</button>
            <button className="btn btn-ghost btn-sm" onClick={() => reset(a)} title="بازکردن تلاش"><Icon name="refresh" size={13} /></button>
           </div>
          </td>
         </tr>
        ))}
       </tbody>
      </table>
     </div>
    )}
   </div>

   {/* مودال تصحیح */}
   {grading && (
    <Modal open wide title={`تصحیح — ${grading.name}`} onClose={() => setGrading(null)}>
     <div style={{ maxHeight: '62vh', overflowY: 'auto', paddingLeft: 4 }}>
      {grading.questions.map((q, i) => (
       <div key={q.id} className="exm-preview-q">
        <div className="row" style={{ gap: 8, marginBottom: 8 }}>
         <span className="exm-qnum">{faNum(i + 1)}</span>
         <span className="chip" style={{ padding: '2px 9px', fontSize: 11 }}>{q.topic || q.type}</span>
         <span className="muted" style={{ fontSize: 11 }}>بارم {faNum(q.points)}</span>
        </div>
        <div className="exm-q-title">{q.body}</div>
        {q.type === 'essay' ? (
         <>
          <div style={{ background: 'rgba(148,163,184,.07)', borderRadius: 12, padding: 12, margin: '10px 0', lineHeight: 2, whiteSpace: 'pre-wrap' }}>
           {q.student || <span className="muted">پاسخ نداده</span>}
          </div>
          <div className="row" style={{ gap: 10 }}>
           <label className="muted small">نمره این تشریحی:</label>
           <input className="input" type="number" step="0.25" min="0" max={q.points} style={{ width: 100 }}
             value={grading.pts[q.id] ?? ''} onChange={(e) => setGrading((g) => ({ ...g, pts: { ...g.pts, [q.id]: e.target.value } }))} />
           <span className="muted small">از {faNum(q.points)}</span>
          </div>
         </>
        ) : (
         <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
          <span className="muted small">پاسخ دانش‌آموز:</span>
          <b className="small">{q.student == null || q.student === '' ? '—' : typeof q.student === 'object' ? JSON.stringify(q.student) : String(q.student)}</b>
          <span className="muted small">| پاسخ صحیح:</span>
          <b className="small" style={{ color: '#34d399' }}>{q.correct == null ? '—' : typeof q.correct === 'object' ? JSON.stringify(q.correct) : String(q.correct)}</b>
          {grading.pts[q.id] !== undefined && <span className="exm-rtag ok">نمره دستی: {faNum(grading.pts[q.id])}</span>}
         </div>
        )}
       </div>
      ))}
     </div>
     <div className="modal-actions">
      <button className="btn btn-primary" onClick={saveGrading}>ثبت نمره‌ها</button>
      <button className="btn btn-ghost" onClick={() => setGrading(null)}>بستن</button>
     </div>
    </Modal>
   )}

   {/* مودال گزارش امنیتی */}
   {secView && (
    <Modal open title={`گزارش امنیتی — ${secView.student_name}`} onClose={() => setSecView(null)}>
     <div className="exm-score-hero" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
      <div className="exm-score-tile"><div className="v">{faNum(secView.sec_log?.tabs || 0)}</div><div className="l">خروج از تب</div></div>
      <div className="exm-score-tile"><div className="v">{faNum(secView.sec_log?.copy || 0)}</div><div className="l">تلاش کپی</div></div>
      <div className="exm-score-tile"><div className="v">{faNum(secView.sec_log?.fs_exits || 0)}</div><div className="l">خروج از تمام‌صفحه</div></div>
     </div>
     <b className="small">رویدادها (به‌ترتیب زمانی)</b>
     <div style={{ maxHeight: 240, overflowY: 'auto', marginTop: 8 }}>
      {(secView.sec_log?.events || []).length === 0 && <p className="muted small">هیچ رویداد مشکوکی ثبت نشده — آزمون کاملاً سالم بوده است.</p>}
      {(secView.sec_log?.events || []).slice().reverse().map((ev, i) => (
       <div key={i} className="row" style={{ justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid var(--line)', fontSize: 12.5 }}>
        <span>{ev.k === 'tab_out' ? 'خروج از تب' : ev.k === 'copy' ? 'تلاش برای کپی' : ev.k === 'fs_exit' ? 'خروج از تمام‌صفحه' : ev.k}</span>
        <span className="muted" style={{ fontSize: 11 }}>{new Date(ev.t).toLocaleTimeString('fa-IR')}</span>
       </div>
      ))}
     </div>
    </Modal>
   )}
  </div>
 )
}
