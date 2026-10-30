import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import Icon from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { useApp } from '../../store/AppContext'
import { faNum } from '../../utils/format'
import { req } from '../../services/http'

const greek = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸']
const typeLabel = { mcq: 'گزینه‌ای', multi: 'چندگزینه‌ای', tf: 'درست/نادرت', blank: 'جای خالی', short: 'کوتاه‌پاسخ', essay: 'تشریحی', match: 'وصل‌کردنی', order: 'مرتب‌کردنی', pdfmcq: 'تستی' }
const fmtTime = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60
  return (h ? `${h}:` : '') + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0')
}
const isObjective = (t) => ['mcq', 'multi', 'tf', 'pdfmcq'].includes(t)

/** صفحه آزمون دانش‌آموز — اسکرول همه سوال‌ها + پاسخبرگ جدا با دکمه انیمیشنی + تایمر سرور + ضدتقلب */
export default function SExamTake() {
 const { eid } = useParams()
 const nav = useNavigate()
 const { toast } = useApp()
 const [attempt, setAttempt] = useState(null)
 const [questions, setQuestions] = useState([])
 const [answers, setAnswers] = useState({})
 const [flags, setFlags] = useState(() => new Set())
 const [view, setView] = useState('questions')
 const [remaining, setRemaining] = useState(0)
 const [sec, setSec] = useState({ tabs: 0, copy: 0, fs_exits: 0, newEvents: [] })
 const [warn, setWarn] = useState('')
 const [fsNeed, setFsNeed] = useState(false)
 const [confirmOpen, setConfirmOpen] = useState(false)
 const [submitting, setSubmitting] = useState(false)
 const offRef = useRef(0)          // اختلاف ساعت سرور و مرورگر
 const dirtyRef = useRef(false)
 const lastTabRef = useRef(0)
 const saveTimer = useRef(null)
 const ansRef = useRef({})
 const secRef = useRef(sec)
 const rootRef = useRef(null)

 useEffect(() => { secRef.current = sec }, [sec])
 useEffect(() => { ansRef.current = answers }, [answers])

 /* ---------- شروع / ادامه ---------- */
 useEffect(() => {
   req(`/exams/${eid}/start`, { method: 'POST' }).then((r) => {
     const a = r.attempt
     setAttempt(a)
     setQuestions(a.questions)
     setAnswers(a.answers || {})
     ansRef.current = a.answers || {}
     offRef.current = Date.now() - (a.server_now || Date.now())
     setRemaining(a.deadline_at - (a.server_now || Date.now()))
     if (a.exam.sec_fullscreen && !document.fullscreenElement) setFsNeed(true)
   }).catch((e) => {
     if (e.status === 409 || e.done) { toast(e.message || 'شما قبلاً در این آزمون شرکت کرده‌اید', 'info'); nav(`/panel/student/exams/${eid}/result`, { replace: true }) }
     else { toast(e.message || 'شروع آزمون ناموفق بود', 'error'); nav('/panel/student/exams', { replace: true }) }
   })
 }, [eid])

 /* ---------- تایمر ---------- */
 useEffect(() => {
   if (!attempt) return
   const iv = setInterval(() => {
     const rem = attempt.deadline_at - (Date.now() - offRef.current)
     setRemaining(rem)
     if (rem <= 0) { clearInterval(iv); doSubmit(true) }
   }, 1000)
   return () => clearInterval(iv)
 }, [attempt?.id])

 /* ---------- ذخیره خودکار ---------- */
 const save = async () => {
   if (!dirtyRef.current) return
   dirtyRef.current = false
   try {
     await req(`/exams/${eid}/save`, { method: 'POST', body: { a: ansRef.current, sec: { ...secRef.current, newEvents: secRef.current.newEvents.slice(-10) } } })
     setSec((s) => ({ ...s, newEvents: [] }))
   } catch (e) {
     if (e.status === 429) { dirtyRef.current = true; return }
     if (e.expired) return
     dirtyRef.current = true
   }
 }
 const markDirty = () => {
   dirtyRef.current = true
   clearTimeout(saveTimer.current)
   saveTimer.current = setTimeout(save, 900)
 }
 useEffect(() => {
   const iv = setInterval(save, 20000)
   return () => { clearInterval(iv); clearTimeout(saveTimer.current) }
 }, [])

 /* ---------- لایه‌های امنیتی ---------- */
 useEffect(() => {
   if (!attempt) return
   const pushWarn = (msg) => { setWarn(msg); setTimeout(() => setWarn(''), 3600) }
   const onVis = () => {
     if (document.hidden) {
       const t = Date.now()
       if (t - lastTabRef.current > 1500) {
         lastTabRef.current = t
         setSec((s) => ({ ...s, tabs: s.tabs + 1, newEvents: [...s.newEvents, { k: 'tab_out' }] }))
         pushWarn('⚠️ خروج از تب ثبت شد — این حرکت در گزارش امنیتی معلم می‌آید')
         markDirty()
       }
     }
   }
   const onCopy = (e) => {
     if (!attempt.exam.sec_copy_block) return
     e.preventDefault()
     setSec((s) => ({ ...s, copy: s.copy + 1, newEvents: [...s.newEvents, { k: 'copy' }] }))
     pushWarn('⚠️ کپی کردن در آزمون مجاز نیست و ثبت می‌شود')
     markDirty()
   }
   const onCtx = (e) => { if (attempt.exam.sec_copy_block) e.preventDefault() }
   const onKey = (e) => {
     if (!attempt.exam.sec_copy_block) return
     if ((e.ctrlKey || e.metaKey) && ['c', 'x', 'u', 'p', 's'].includes(e.key.toLowerCase())) {
       e.preventDefault()
       if (['c', 'x'].includes(e.key.toLowerCase())) onCopy(e)
     }
   }
   const onFs = () => {
     if (!attempt.exam.sec_fullscreen) return
     if (!document.fullscreenElement) {
       setSec((s) => ({ ...s, fs_exits: s.fs_exits + 1, newEvents: [...s.newEvents, { k: 'fs_exit' }] }))
       setFsNeed(true)
       markDirty()
     }
   }
   const onBeforeUnload = (e) => { if (remaining > 0) { e.preventDefault(); e.returnValue = '' } }
   document.addEventListener('visibilitychange', onVis)
   document.addEventListener('copy', onCopy)
   document.addEventListener('cut', onCopy)
   document.addEventListener('contextmenu', onCtx)
   document.addEventListener('keydown', onKey)
   document.addEventListener('fullscreenchange', onFs)
   window.addEventListener('beforeunload', onBeforeUnload)
   return () => {
     document.removeEventListener('visibilitychange', onVis)
     document.removeEventListener('copy', onCopy)
     document.removeEventListener('cut', onCopy)
     document.removeEventListener('contextmenu', onCtx)
     document.removeEventListener('keydown', onKey)
     document.removeEventListener('fullscreenchange', onFs)
     window.removeEventListener('beforeunload', onBeforeUnload)
   }
 }, [attempt?.id, remaining])

 const enterFs = async () => {
   try { await document.documentElement.requestFullscreen(); setFsNeed(false) } catch { setFsNeed(false) }
 }

 /* ---------- پاسخ‌دهی ---------- */
 const setAns = (qid, v) => {
   setAnswers((a) => { const n = { ...a, [qid]: v }; ansRef.current = n; return n })
   markDirty()
 }
 const clearAns = (qid) => setAnswers((a) => { const n = { ...a }; delete n[qid]; ansRef.current = n; return n })
 const toggleFlag = (qid) => setFlags((f) => { const n = new Set(f); n.has(qid) ? n.delete(qid) : n.add(qid); return n })
 const moveItem = (qid, arr, from, dir) => {
   const to = from + dir
   if (to < 0 || to >= arr.length) return
   const c = [...arr];[c[from], c[to]] = [c[to], c[from]]
   setAns(qid, c)
 }

 const answeredCount = useMemo(() =>
   questions.filter((q) => {
     const v = answers[q.qid]
     return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)
   }).length, [answers, questions])

 const isAnswered = (q) => {
   const v = answers[q.qid]
   return v !== undefined && v !== null && v !== '' && !(Array.isArray(v) && !v.length) && !(typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)
 }
 const sheetChoices = (q) => q.type === 'pdfmcq' ? (attempt.exam.choices_per_q || 4) : q.type === 'tf' ? 2 : (q.opts?.length || 4)

 /* ---------- ارسال ---------- */
 const doSubmit = async (auto = false) => {
   if (submitting) return
   setSubmitting(true)
   try {
     await save()
     await req(`/exams/${eid}/submit`, { method: 'POST', body: { a: ansRef.current, sec: { ...secRef.current, newEvents: secRef.current.newEvents.slice(-10) } } })
     toast(auto ? 'وقت تمام شد — پاسخ‌های شما خودکار ثبت شد' : 'آزمون شما ثبت شد 🎉', 'success')
     nav(`/panel/student/exams/${eid}/result`, { replace: true })
   } catch (e) {
     toast(e.message || 'ارسال ناموفق بود', 'error')
     setSubmitting(false)
     setConfirmOpen(false)
   }
 }

 if (!attempt) return <div className="card pad muted">در حال آماده‌سازی آزمون…</div>
 const exam = attempt.exam
 const warnLevel = remaining < 60000 ? 'danger' : remaining < 300000 ? 'warn' : ''
 const pdfMode = exam.mode === 'pdf'

 /* ---------- رندر یک سوال ---------- */
 const renderQ = (q, i) => (
  <div key={q.qid} id={`q-${q.qid}`} className={`exm-q ${flags.has(q.qid) ? '' : ''}`}>
   <button className={`exm-mini exm-flagbtn ${flags.has(q.qid) ? 'on' : ''}`} onClick={() => toggleFlag(q.qid)} title="علامت برای مرور بعدی">
    <Icon name="bookmark" size={15} />
   </button>
   <div className="exm-q-head">
    <span className="exm-qnum">{faNum(i + 1)}</span>
    <div style={{ flex: 1 }}>
     <div className="exm-q-title">{pdfMode ? `سوال ${faNum(i + 1)} — پاسخ را در پاسخبرگ علامت بزنید` : q.body}</div>
     {!pdfMode && q.image && <img className="qimg" src={q.image} alt="" />}
    </div>
   </div>

   {q.type === 'mcq' && (
    <div className="exm-opts">
     {q.opts.map((o, j) => (
      <button key={j} className={`exm-opt ${answers[q.qid] === j ? 'on' : ''}`} onClick={() => setAns(q.qid, j)}>
       <span className="bub">{greek[j]}</span><span style={{ flex: 1 }}>{o}</span>
      </button>
     ))}
    </div>
   )}
   {q.type === 'multi' && (
    <div className="exm-opts">
     {q.opts.map((o, j) => {
      const sel = Array.isArray(answers[q.qid]) && answers[q.qid].includes(j)
      return (
       <button key={j} className={`exm-opt ${sel ? 'on' : ''}`}
         onClick={() => setAns(q.qid, sel ? (answers[q.qid] || []).filter((c) => c !== j) : [...(answers[q.qid] || []), j])}>
        <span className="bub">{greek[j]}</span><span style={{ flex: 1 }}>{o}</span>
       </button>
      )
     })}
     <span className="muted" style={{ fontSize: 11.5 }}>چند گزینه می‌تواند درست باشد.</span>
    </div>
   )}
   {q.type === 'tf' && (
    <div className="exm-opts" style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
     {[['درست', 0], ['نادرت', 1]].map(([l, v]) => (
      <button key={v} className={`exm-opt ${answers[q.qid] === v ? 'on' : ''}`} style={{ width: 150, justifyContent: 'center' }} onClick={() => setAns(q.qid, v)}>
       <span className="bub">{v === 0 ? '✓' : '✗'}</span>{l}
      </button>
     ))}
    </div>
   )}
   {(q.type === 'blank' || q.type === 'short') && (
    <input className="input" style={{ maxWidth: 420 }} value={answers[q.qid] || ''} placeholder="پاسخ خود را بنویسید…"
      onChange={(e) => setAns(q.qid, e.target.value)} />
   )}
   {q.type === 'essay' && (
    <textarea className="textarea exm-textarea" value={answers[q.qid] || ''} placeholder="پاسخ تشریحی خود را اینجا بنویسید…"
      onChange={(e) => setAns(q.qid, e.target.value)} />
   )}
   {q.type === 'match' && (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
     {q.opts.left.map((l, li) => (
      <div key={li} style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '10px 12px' }}>
       <b className="small">{greek[li]}) {l}</b>
       <div className="row mt8" style={{ flexWrap: 'wrap', gap: 6 }}>
        {q.opts.right.map((r, ri) => (
         <button key={ri} className={`exm-chip ${answers[q.qid]?.[li] === ri ? 'on' : ''}`} onClick={() => setAns(q.qid, { ...(answers[q.qid] || {}), [li]: ri })}>
          {answers[q.qid]?.[li] === ri ? '✓ ' : ''}{r}
         </button>
        ))}
       </div>
      </div>
     ))}
    </div>
   )}
   {q.type === 'order' && (() => {
    const cur = Array.isArray(answers[q.qid]) && answers[q.qid].length === q.opts.length ? answers[q.qid] : q.opts.map((_, j) => j)
    return (
     <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {cur.map((d, pos) => (
       <div key={pos} className="row" style={{ border: '1px solid var(--line)', borderRadius: 12, padding: '9px 12px' }}>
        <span className="exm-qnum" style={{ width: 26, height: 26, fontSize: 12 }}>{faNum(pos + 1)}</span>
        <span className="small" style={{ flex: 1 }}>{q.opts[d]}</span>
        <button className="exm-mini" onClick={() => moveItem(q.qid, cur, pos, -1)}><Icon name="arrowUp" size={13} /></button>
        <button className="exm-mini" style={{ transform: 'rotate(180deg)' }} onClick={() => moveItem(q.qid, cur, pos, 1)}><Icon name="arrowUp" size={13} /></button>
       </div>
      ))}
     </div>
    )
   })()}
  </div>
 )

 return (
  <div ref={rootRef} onCopyCapture={() => {}}>
   {/* نوار بالا: تایمر و وضعیت */}
   <div className="exm-take-head">
    <b style={{ fontSize: 14.5 }}>{exam.title}</b>
    <span className={`exm-timer ${warnLevel}`}><Icon name="clock" size={16} />{fmtTime(remaining)}</span>
    <span className="exm-answered-pill">پاسخ داده: <b>{faNum(answeredCount)}</b> از {faNum(questions.length)}</span>
    {exam.sec_tab_limit > 0 && <span className="muted" style={{ fontSize: 11.5 }}>سقف خروج از تب: {faNum(sec.tabs)}/{faNum(exam.sec_tab_limit)}</span>}
   </div>

   {warn && <div className="exm-secwarn">{warn}</div>}

   {/* حالت تمام‌صفحه اجباری */}
   {fsNeed && (
    <div className="modal-overlay" style={{ zIndex: 90 }}>
     <div className="modal" style={{ textAlign: 'center' }}>
      <h3>حالت تمام‌صفحه آزمون</h3>
      <p className="muted small" style={{ lineHeight: 2 }}>برای امنیت آزمون، صفحه به حالت تمام‌صفحه می‌رود. خروج از تمام‌صفحه در گزارش امنیتی ثبت می‌شود.</p>
      <button className="btn btn-primary btn-block mt12" onClick={enterFs}><Icon name="monitor" size={16} />ورود به آزمون</button>
     </div>
    </div>
   )}

   {/* ===== نمای سوال‌ها (اسکرول پیوسته) ===== */}
   {view === 'questions' && (
    <div className="exm-questions exm-qs-anim" onCopyCapture={(e) => exam.sec_copy_block && e.preventDefault()}>
     {pdfMode && (
      <div className="exm-pdfview mb16">
       {(exam.pdf_pages || []).map((u, i) => <img key={u + i} src={u} alt={`صفحه ${i + 1}`} />)}
       {!(exam.pdf_pages || []).length && <p className="muted small" style={{ padding: 16 }}>برگه‌ای بارگذاری نشده — با معلم خود تماس بگیرید.</p>}
      </div>
     )}
     {!pdfMode && questions.map((q, i) => renderQ(q, i))}
    </div>
   )}

   {/* ===== نمای پاسخبرگ (جدا از سوالات) ===== */}
   {view === 'sheet' && (
    <div className="exm-sheet">
     <div className="exm-sheet-card">
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap' }}>
       <b>پاسخبرگ تستی</b>
       <span className="exm-answered-pill">پاسخ داده: <b>{faNum(answeredCount)}</b> از {faNum(questions.length)}</span>
      </div>
      <div className="exm-sheet-grid">
       {questions.map((q, i) => {
        const done = isAnswered(q)
        const nCh = sheetChoices(q)
        const val = answers[q.qid]
        return (
         <div key={q.qid} className={`exm-sheet-cell ${done ? 'done' : ''} ${flags.has(q.qid) ? 'flagged' : ''}`}>
          <div className="n" style={{ cursor: 'pointer' }} onClick={() => { setView('questions'); setTimeout(() => document.getElementById(`q-${q.qid}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120) }}>
           {faNum(i + 1)}{!isObjective(q.type) && !pdfMode ? ' ✎' : ''}
          </div>
          <div className="exm-bubbles">
           {Array.from({ length: nCh }, (_, c) => {
            const on = q.type === 'multi' ? (Array.isArray(val) && val.includes(c)) : val === c
            return <button key={c} className={`exm-bubble ${on ? 'on' : ''}`} onClick={() => {
              if (q.type === 'multi') setAns(q.qid, on ? (val || []).filter((x) => x !== c) : [...(val || []), c])
              else if (val === c && q.type !== 'pdfmcq') clearAns(q.qid)
              else setAns(q.qid, c)
            }}>{faNum(c + 1)}</button>
           })}
          </div>
         </div>
        )
       })}
      </div>
      <p className="muted" style={{ fontSize: 11.5, marginTop: 14 }}>
       ✎ = پاسخ این سوال در متن همان سوال نوشته می‌شود (تشریحی/جای خالی/وصل‌کردنی/مرتب‌کردنی) — روی شماره بزنید تا به سوال بپرید.
      </p>
     </div>
    </div>
   )}

   {/* ===== دکمه شناور جابه‌جایی انیمیشنی ===== */}
   <div className="exm-switchbar">
    <button className={`exm-switchbtn ${view === 'questions' ? 'on' : ''}`} onClick={() => setView('questions')}>
     <Icon name="file" size={15} />{pdfMode ? 'برگه سوالات' : 'سوالات'}
    </button>
    <button className={`exm-switchbtn ${view === 'sheet' ? 'on' : ''}`} onClick={() => setView('sheet')}>
     <Icon name="grid" size={15} />پاسخبرگ<span className="cnt">{faNum(answeredCount)}</span>
    </button>
    <button className="exm-switchbtn" style={{ color: 'var(--red)' }} onClick={() => setConfirmOpen(true)}>
     <Icon name="send" size={15} />تحویل
    </button>
   </div>

   {/* تایید تحویل */}
   {confirmOpen && (
    <Modal open title="تحویل آزمون" onClose={() => setConfirmOpen(false)}>
     <p style={{ lineHeight: 2.1 }}>
      {answeredCount === questions.length
       ? `به همه ${faNum(questions.length)} سوال پاسخ داده‌اید. آماده تحویل نهایی هستید؟`
       : `${faNum(questions.length - answeredCount)} سوال بی‌پاسخ مانده. مطمئنید که تحویل می‌دهید؟ بعد از تحویل امکان ویرایش نیست.`}
     </p>
     {remaining > 0 && <p className="muted small">زمان باقی‌مانده: {fmtTime(remaining)}</p>}
     <div className="modal-actions">
      <button className="btn btn-danger" onClick={() => doSubmit(false)} disabled={submitting}>{submitting ? 'در حال ارسال…' : 'بله، تحویل نهایی'}</button>
      <button className="btn btn-ghost" onClick={() => setConfirmOpen(false)}>ادامه پاسخ‌دهی</button>
     </div>
    </Modal>
   )}
  </div>
 )
}
