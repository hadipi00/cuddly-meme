import { useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { Modal } from '../../components/Modal'
import { useApp } from '../../store/AppContext'
import { faNum } from '../../utils/format'
import { req } from '../../services/http'

/* ---------- انواع سوال ---------- */
const TYPES = [
  { id: 'mcq', label: 'گزینه‌ای', icon: '۱' },
  { id: 'multi', label: 'چندگزینه‌ای', icon: '۲' },
  { id: 'tf', label: 'درست/نادرت', icon: '۳' },
  { id: 'blank', label: 'جای خالی', icon: '۴' },
  { id: 'short', label: 'کوتاه‌پاسخ', icon: '۵' },
  { id: 'essay', label: 'تشریحی', icon: '۶' },
  { id: 'match', label: 'وصل‌کردنی', icon: '۷' },
  { id: 'order', label: 'مرتب‌کردنی', icon: '۸' },
]
const typeLabel = (t) => TYPES.find((x) => x.id === t)?.label || t
const greek = ['۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹', '۱۰']

const newQuestion = (type) => {
  const base = { type, body: '', image: '', points: 1, topic: '', expl: '' }
  if (type === 'mcq') return { ...base, opts: ['', '', '', ''], correct: 0 }
  if (type === 'multi') return { ...base, opts: ['', '', '', ''], correct: [0] }
  if (type === 'tf') return { ...base, opts: ['درست', 'نادرت'], correct: 0 }
  if (type === 'blank' || type === 'short') return { ...base, correct: [''] }
  if (type === 'match') return { ...base, opts: { left: ['', ''], right: ['', ''] }, correct: { 0: 0, 1: 1 } }
  if (type === 'order') return { ...base, opts: ['', ''], correct: [0, 1] }
  return base
}

const tsToLocal = (ts) => {
  if (!ts) return ''
  const d = new Date(ts - new Date().getTimezoneOffset() * 60000 * (new Date(ts).getTimezoneOffset() > 0 ? 1 : -1))
  try { return new Date(ts).toLocaleString('sv-SE', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }).replace(' ', 'T') } catch { return '' }
}

/* پاک‌سازی سوال‌ها قبل از ارسال — مثل اعتبارسنجی سرور */
function serializeQuestions(list) {
  return list.map((q, i) => {
    const out = { type: q.type, body: q.body.trim(), image: q.image, points: Number(q.points) || 1, topic: q.topic, expl: q.expl, ord: i }
    if (q.type === 'mcq' || q.type === 'multi') {
      const idx = q.opts.map((o, j) => [j, String(o || '').trim()]).filter(([, o]) => o)
      out.opts = idx.map(([, o]) => o)
      const remap = new Map(idx.map(([j], n) => [j, n]))
      out.correct = q.type === 'mcq'
        ? (remap.has(Number(q.correct)) ? remap.get(Number(q.correct)) : null)
        : (Array.isArray(q.correct) ? q.correct.map((c) => remap.get(Number(c))).filter((c) => c !== undefined) : [])
    } else if (q.type === 'tf') out.correct = Number(q.correct) === 0 ? 0 : 1
    else if (q.type === 'blank' || q.type === 'short') out.correct = (q.correct || []).map((c) => String(c || '').trim()).filter(Boolean)
    else if (q.type === 'match') {
      const left = q.opts.left.map((s) => String(s || '').trim()).filter(Boolean)
      const right = q.opts.right.map((s) => String(s || '').trim()).filter(Boolean)
      out.opts = { left, right }
      out.correct = {}
      left.forEach((_, l) => { const r = Number(q.correct?.[l]); if (r >= 0 && r < right.length) out.correct[l] = r })
    } else if (q.type === 'order') {
      out.opts = q.opts.map((s) => String(s || '').trim()).filter(Boolean)
      out.correct = out.opts.map((_, j) => j)
    }
    return out
  })
}

const qValidate = (q, i) => {
  if (!q.body.trim() && !q.image) return `متن سوال ${faNum(i + 1)} خالی است`
  if (q.type === 'mcq' || q.type === 'multi') {
    const n = q.opts.filter((o) => String(o || '').trim()).length
    if (n < 2) return `سوال ${faNum(i + 1)}: حداقل ۲ گزینه لازم است`
    if (q.type === 'mcq' && q.correct == null) return `سوال ${faNum(i + 1)}: گزینه صحیح را علامت بزنید`
    if (q.type === 'multi' && (!Array.isArray(q.correct) || !q.correct.length)) return `سوال ${faNum(i + 1)}: حداقل یک گزینه صحیح لازم است`
  }
  if ((q.type === 'blank' || q.type === 'short') && !(q.correct || []).filter((c) => String(c).trim()).length)
    return `سوال ${faNum(i + 1)}: حداقل یک پاسخ قابل قبول بنویسید`
  if (q.type === 'match') {
    if (q.opts.left.filter((s) => s.trim()).length < 2 || q.opts.right.filter((s) => s.trim()).length < 2)
      return `سوال ${faNum(i + 1)}: دو ستون تطبیق را کامل کنید`
  }
  if (q.type === 'order' && q.opts.filter((s) => s.trim()).length < 2) return `سوال ${faNum(i + 1)}: حداقل ۲ مورد برای مرتب‌سازی`
  return null
}

/** آزمون‌ساز — طراحی سوال، حالت PDF با کلید پاسخبرگ، تنظیمات امنیتی، پیش‌نمایش */
export default function TExamBuilder() {
 const { eid } = useParams()
 const nav = useNavigate()
 const { toast } = useApp()
 const [exam, setExam] = useState(null)
 const [questions, setQuestions] = useState([])
 const [active, setActive] = useState(0)
 const [tab, setTab] = useState('questions')
 const [saveState, setSaveState] = useState('saved') // saved | dirty | saving
 const [preview, setPreview] = useState(false)
 const [importOpen, setImportOpen] = useState(false)
 const [myExams, setMyExams] = useState([])
 const [uploading, setUploading] = useState(false)
 const [classes, setClasses] = useState([])
 const [settings, setSettings] = useState({})
 const dirtyRef = useRef(false)
 const hydratedRef = useRef(false)
 const timerRef = useRef(null)
 const dragRef = useRef(null)
 const fileRef = useRef(null)

 /* ---------- بارگذاری ---------- */
 useEffect(() => {
   req(`/exams/${eid}`).then((r) => {
     const e = r.exam
     setExam(e)
     setSettings({
       title: e.title, desc: e.desc || '', course_id: e.course_id || '', duration_min: e.duration_min,
       open_at: tsToLocal(e.open_at), close_at: tsToLocal(e.close_at),
       shuffle_q: !!e.shuffle_q, shuffle_o: !!e.shuffle_o,
       sec_copy_block: !!e.sec_copy_block, sec_tab_limit: e.sec_tab_limit || 0,
       sec_fullscreen: !!e.sec_fullscreen, sec_fast_submit: e.sec_fast_submit || 45,
       answer_pdf: e.answer_pdf || '',
     })
     const mapped = e.mode === 'pdf' ? [] : e.questions.map((q) => ({
       type: q.type, body: q.body, image: q.image, opts: Array.isArray(q.opts) ? (q.opts.length ? q.opts : ['', '']) : (q.type === 'match' ? { left: q.opts?.left?.length ? [...q.opts.left, ''] : ['', ''], right: q.opts?.right?.length ? [...q.opts.right, ''] : ['', ''] } : []),
       correct: q.correct == null ? (q.type === 'mcq' ? 0 : q.type === 'multi' ? [0] : q.type === 'blank' || q.type === 'short' ? [''] : q.type === 'match' ? {} : null) : q.correct,
       points: q.points, topic: q.topic, expl: q.expl,
     }))
     /* سازنده همیشه با یک فرم آماده باز شود — بدون ذخیره خودکار چیز خالی */
     if (e.mode === 'builder' && !mapped.length) mapped.push(newQuestion('mcq'))
     setQuestions(mapped)
   }).catch((e) => toast(e.message || 'آزمون پیدا نشد', 'error'))
   req('/me/teaching').then((r) => setClasses(r.classes || [])).catch(() => {})
   req(`/exams/${eid}`).then((r) => setTab(r.exam.mode === 'pdf' ? 'pdf' : 'questions')).catch(() => {})
 }, [eid])

 /* ---------- ذخیره خودکار سوال‌ها ---------- */
 const saveQuestions = async () => {
   if (!exam || exam.mode !== 'builder') return
   setSaveState('saving')
   try {
     await req(`/exams/${eid}/questions`, { method: 'PUT', body: { questions: serializeQuestions(questions) } })
     dirtyRef.current = false
     setSaveState('saved')
   } catch (e) {
     setSaveState('dirty')
     toast(e.message || 'ذخیره سوال‌ها ناموفق بود', 'error')
   }
 }
 useEffect(() => {
   if (!exam || exam.mode !== 'builder') return
   /* اولین hydrate و آزمون کاملاً خالی → ذخیره نکن */
   if (!hydratedRef.current) { hydratedRef.current = true; return }
   if (!questions.some((q) => String(q.body || '').trim() || q.image)) return
   dirtyRef.current = true
   setSaveState('dirty')
   clearTimeout(timerRef.current)
   timerRef.current = setTimeout(saveQuestions, 1400)
   return () => clearTimeout(timerRef.current)
 }, [questions])

 /* ---------- ذخیره تنظیمات ---------- */
 const saveMeta = async (patch) => {
   const body = { ...patch }
   for (const k of ['open_at', 'close_at']) if (body[k] !== undefined) body[k] = body[k] ? new Date(body[k]).getTime() : null
   try { await req(`/exams/${eid}`, { method: 'PATCH', body }) } catch (e) { toast(e.message || 'ذخیره تنظیمات ناموفق بود', 'error') }
 }
 const setMeta = (patch) => {
   setSettings((s) => ({ ...s, ...patch }))
   saveMeta(patch)
 }

 /* ---------- عملیات سوال ---------- */
 const addQ = (type) => {
   setQuestions((qs) => [...qs, newQuestion(type)])
   setActive(questions.length)
   setTimeout(() => document.getElementById('exm-qform')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60)
 }
 const updQ = (i, patch) => setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)))
 const delQ = (i) => { setQuestions((qs) => qs.filter((_, j) => j !== i)); setActive(0) }
 const dupQ = (i) => setQuestions((qs) => { const c = [...qs]; c.splice(i + 1, 0, JSON.parse(JSON.stringify(qs[i]))); return c })
 const moveQ = (from, to) => setQuestions((qs) => {
   if (to < 0 || to >= qs.length) return qs
   const c = [...qs]; const [it] = c.splice(from, 1); c.splice(to, 0, it); return c
 })

 /* درگ‌واندراپ لیست */
 const onDrop = (to) => {
   const from = dragRef.current
   dragRef.current = null
   if (from == null || from === to) return
   moveQ(from, to)
 }

 /* ---------- درون‌ریزی از آزمون دیگر (بانک سوال) ---------- */
 const openImport = () => {
   req('/exams').then((r) => {
     setMyExams((r.exams || []).filter((e) => e.id !== eid && e.mode === 'builder'))
     setImportOpen(true)
   }).catch(() => toast('دریافت لیست آزمون‌ها ناموفق بود', 'error'))
 }
 const importFrom = async (id) => {
   try {
     const r = await req(`/exams/${id}`)
     const imported = (r.exam.questions || []).map((q) => ({
       type: q.type, body: q.body, image: q.image,
       opts: Array.isArray(q.opts) ? [...q.opts] : { left: [...q.opts.left], right: [...q.opts.right] },
       correct: q.correct == null ? null : (typeof q.correct === 'object' ? JSON.parse(JSON.stringify(q.correct)) : q.correct),
       points: q.points, topic: q.topic, expl: q.expl,
     }))
     setQuestions((qs) => [...qs, ...imported])
     setImportOpen(false)
     toast(`${faNum(imported.length)} سوال از «${r.exam.title}» اضافه شد`)
   } catch (e) { toast(e.message || 'درون‌ریزی ناموفق بود', 'error') }
 }

 /* ---------- حالت PDF: آپلود برگه ---------- */
 const onFile = async (file) => {
   if (!file) return
   setUploading(true)
   try {
     let pages = []
     if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
       const buf = await file.arrayBuffer()
       const pdfjs = await import('pdfjs-dist')
       const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
       pdfjs.GlobalWorkerOptions.workerSrc = worker.default
       const doc = await pdfjs.getDocument({ data: buf }).promise
       const n = Math.min(doc.numPages, 40)
       for (let i = 1; i <= n; i++) {
         const page = await doc.getPage(i)
         const vp = page.getViewport({ scale: 1.7 })
         const canvas = document.createElement('canvas')
         canvas.width = vp.width; canvas.height = vp.height
         await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
         pages.push(canvas.toDataURL('image/jpeg', 0.82))
       }
     } else {
       pages = [await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file) })]
     }
     const urls = []
     for (const data of pages) {
       const r = await req('/exams/upload', { method: 'POST', body: { name: 'page.jpg', data } })
       urls.push(r.url)
     }
     setExam((e) => ({ ...e, pdf_pages: [...(e.pdf_pages || []), ...urls] }))
     await saveMeta({ pdf_pages: [...(exam?.pdf_pages || []), ...urls] })
     toast(`${faNum(urls.length)} صفحه آپلود شد`)
   } catch (e) {
     toast(e.message || 'آپلود ناموفق بود', 'error')
   }
   setUploading(false)
 }
 const delPage = async (i) => {
   const next = (exam.pdf_pages || []).filter((_, j) => j !== i)
   setExam((e) => ({ ...e, pdf_pages: next }))
   await saveMeta({ pdf_pages: next })
 }

 /* کلید پاسخبرگ */
 const setKey = (n, c) => {
   const key = { ...(exam.answer_key || {}), [n]: c }
   setExam((e) => ({ ...e, answer_key: key }))
   saveMeta({ answer_key: key })
 }
 const quickKey = (text) => {
   /* ورود سریع: «1:3 2:1 3:4» یا «۱۲۳۴…» */
   const key = {}
   const t = text.replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)).trim()
   if (/^[\d:\s]+$/.test(t) && t.includes(':')) {
     for (const part of t.split(/\s+/)) { const [a, b] = part.split(':').map(Number); if (a >= 1 && b >= 1) key[a] = b - 1 }
   } else if (/^\d+$/.test(t)) {
     [...t].forEach((ch, i) => { const v = Number(ch) - 1; if (v >= 0 && v < 6) key[i + 1] = v })
   } else return toast('قالب نامفهوم است — مثال: 1:3 2:1 یا ۳۱۴۲', 'error')
   setExam((e) => ({ ...e, answer_key: key }))
   saveMeta({ answer_key: key })
   toast('کلید اعمال شد')
 }

 /* ---------- انتشار ---------- */
 const publish = async () => {
   if (exam.mode === 'builder') {
     for (let i = 0; i < questions.length; i++) {
       const err = qValidate(questions[i], i)
       if (err) { setTab('questions'); setActive(i); return toast(err, 'error') }
     }
     if (!questions.length) return toast('حداقل یک سوال لازم است', 'error')
     await saveQuestions()
   } else {
     if (!(exam.pdf_pages || []).length) { setTab('pdf'); return toast('برگه سوالات را آپلود کنید', 'error') }
     if (!exam.q_count) { setTab('pdf'); return toast('تعداد سوالات را مشخص کنید', 'error') }
     const key = exam.answer_key || {}
     if (Object.keys(key).length !== exam.q_count) { setTab('pdf'); return toast(`کلید پاسخبرگ کامل نیست (${faNum(Object.keys(key).length)} از ${faNum(exam.q_count)})`, 'error') }
     /* هر متادیتای PDF که هنوز ذخیره نشده، همین‌جا کامل ذخیره می‌شود */
     await saveMeta({ q_count: exam.q_count, choices_per_q: exam.choices_per_q || 4, pdf_total: exam.pdf_total || 20, answer_key: key, pdf_pages: exam.pdf_pages || [] })
   }
   try {
     await req(`/exams/${eid}/publish`, { method: 'POST' })
     toast('🎉 آزمون منتشر شد — دانش‌آموزهای کلاس آن را می‌بینند', 'success')
     nav('/panel/teacher/exams')
   } catch (e) { toast(e.message || 'انتشار ناموفق بود', 'error') }
 }

 if (!exam) return <div className="card pad muted">در حال بارگذاری…</div>
 const cur = questions[active]
 const keyCount = Object.keys(exam.answer_key || {}).length

 /* ---------- رندر ---------- */
 return (
  <div>
   <div className="card pad mb24" style={{ background: 'linear-gradient(135deg, rgba(45,212,191,.1), rgba(56,189,248,.08))' }}>
    <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
     <div>
      <div className="row g12">
       <Link to="/panel/teacher/exams" className="icon-btn" aria-label="بازگشت"><Icon name="arrowLeft" size={17} /></Link>
       <b style={{ fontSize: 16 }}>{exam.title}</b>
       <span className="badge b-teal">{exam.mode === 'pdf' ? 'برگه PDF + پاسخبرگ' : 'طراحی در سایت'}</span>
       {exam.status === 'published' && <span className="badge" style={{ background: 'rgba(52,211,153,.15)', color: '#34d399' }}>منتشر شده</span>}
      </div>
      <p className="muted small" style={{ marginTop: 6, paddingRight: 46 }}>
       {exam.mode === 'builder' ? 'سوال‌ها به‌صورت خودکار ذخیره می‌شوند.' : 'برگه سوالات را آپلود کنید و کلید پاسخبرگ را وارد کنید.'}
      </p>
     </div>
     <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      <button className="btn btn-ghost btn-sm" onClick={() => setPreview(true)}><Icon name="eye" size={14} />پیش‌نمایش دانش‌آموزی</button>
      {exam.status !== 'published' && <button className="btn btn-primary btn-sm" onClick={publish}><Icon name="send" size={14} />انتشار آزمون</button>}
     </div>
    </div>
   </div>

   <div className="tabs">
    {exam.mode === 'builder' && <button className={`tab ${tab === 'questions' ? 'on' : ''}`} onClick={() => setTab('questions')}>طراحی سوال‌ها ({faNum(questions.length)})</button>}
    {exam.mode === 'pdf' && <button className={`tab ${tab === 'pdf' ? 'on' : ''}`} onClick={() => setTab('pdf')}>برگه سوالات و کلید پاسخبرگ</button>}
    <button className={`tab ${tab === 'settings' ? 'on' : ''}`} onClick={() => setTab('settings')}>تنظیمات و امنیت</button>
   </div>

   {/* ============ حالت طراحی سوال ============ */}
   {exam.mode === 'builder' && tab === 'questions' && (
    <div className="exm-builder">
     {/* فرم ویرایش سوال فعال */}
     <div>
      <div className="card pad" id="exm-qform">
       <div className="exm-chips mb16">
        {TYPES.map((t) => (
         <button key={t.id} className={`exm-chip ${cur?.type === t.id ? 'on' : ''}`}
          onClick={() => { if (cur?.type !== t.id) updQ(active, newQuestion(t.id)) }}>
          {t.icon} {t.label}
         </button>
        ))}
       </div>
       {cur ? <QuestionForm q={cur} idx={active} upd={(p) => updQ(active, p)} /> : <p className="muted">سوالی نیست — از دکمه‌های بالا یک نوع سوال انتخاب کنید.</p>}
      </div>
      <div className="card pad mt16">
       <b className="small">لیست سوال‌ها — با کشیدن جابه‌جا کنید</b>
       <p className="muted small" style={{ marginBottom: 10 }}>ترتیب نمایش برای دانش‌آموز (اگر «ترتیب تصادفی» خاموش باشد).</p>
       {questions.map((q, i) => (
        <div key={i} className={`exm-qcard ${dragRef.current === i ? 'dragging' : ''}`} draggable
          onDragStart={() => { dragRef.current = i }} onDragOver={(e) => e.preventDefault()} onDrop={() => onDrop(i)}>
         <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
          <span className="exm-grip" title="بکشید">⠿</span>
          <span className="exm-qnum">{faNum(i + 1)}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
           <div className="row" style={{ gap: 8, marginBottom: 4 }}>
            <span className="chip" style={{ padding: '2px 9px', fontSize: 11 }}>{typeLabel(q.type)}</span>
            {q.topic && <span className="chip" style={{ padding: '2px 9px', fontSize: 11 }}>{q.topic}</span>}
            <span className="muted" style={{ fontSize: 11 }}>بارم {faNum(q.points)}</span>
           </div>
           <div className="exm-qbody">{q.body || <span className="muted">بدون متن…</span>}</div>
           {(q.type === 'mcq' || q.type === 'multi' || q.type === 'tf') && (
            <div className="exm-qopts">
             {q.opts.filter((o) => String(o).trim()).map((o, j) => {
              const isRight = q.type === 'multi' ? q.correct?.includes(j) : q.correct === j
              return <div key={j} className={`exm-qopt ${isRight ? 'right' : ''}`}><span className="dot" />{o}</div>
             })}
            </div>
           )}
           {(q.type === 'blank' || q.type === 'short') && <div className="exm-qopts">{(q.correct || []).filter((c) => c?.trim()).map((c, j) => <div key={j} className="exm-qopt right"><span className="dot" />{c}</div>)}</div>}
          </div>
          <div className="exm-qacts">
           <button className="exm-mini" onClick={() => moveQ(i, i - 1)} title="بالا"><Icon name="arrowUp" size={14} /></button>
           <button className="exm-mini" style={{ transform: 'rotate(180deg)' }} onClick={() => moveQ(i, i + 1)} title="پایین"><Icon name="arrowUp" size={14} /></button>
           <button className="exm-mini" onClick={() => dupQ(i)} title="کپی"><Icon name="file" size={13} /></button>
           <button className="exm-mini red" onClick={() => delQ(i)} title="حذف"><Icon name="trash" size={13} /></button>
           <button className="exm-mini" onClick={() => setActive(i)} title="ویرایش"><Icon name="edit" size={13} /></button>
          </div>
         </div>
        </div>
       ))}
       <div className="row mt12" style={{ flexWrap: 'wrap', gap: 8 }}>
        <button className="btn btn-soft btn-sm" onClick={() => addQ('mcq')}><Icon name="plus" size={14} />سوال جدید</button>
        <button className="btn btn-ghost btn-sm" onClick={openImport}><Icon name="download" size={14} />درون‌ریزی از آزمون دیگر</button>
        {saveState !== 'saved' && <span className="muted small" style={{ marginRight: 'auto' }}>{saveState === 'saving' ? 'در حال ذخیره…' : 'تغییرات ذخیره‌نشده…'}</span>}
        {saveState === 'saved' && <span className="muted small" style={{ marginRight: 'auto', color: '#34d399' }}>✓ ذخیره شد</span>}
       </div>
      </div>
     </div>

     {/* ستون راهنما */}
     <div>
      <div className="card pad">
       <b className="small">انواع سوال — راهنما</b>
       <ul className="muted small" style={{ lineHeight: 2.2, marginTop: 8, paddingRight: 18 }}>
        <li><b>گزینه‌ای:</b> یک پاسخ صحیح، تصحیح خودکار</li>
        <li><b>چندگزینه‌ای:</b> چند پاسخ صحیح، نمره جزئی</li>
        <li><b>درست/نادرت:</b> دوگزینه سریع</li>
        <li><b>جای خالی:</b> چند پاسخ قابل قبول (مثلاً «۲» و «دو»)</li>
        <li><b>کوتاه‌پاسخ:</b> مقایسه دقیق با نرمال‌سازی ارقام</li>
        <li><b>تشریحی:</b> در پنل شما دستی نمره می‌دهید</li>
        <li><b>وصل‌کردنی:</b> ستون راست به چپ</li>
        <li><b>مرتب‌کردنی:</b> ترتیب صحیح را با فلش‌ها بچینید</li>
       </ul>
      </div>
      <div className="card pad mt16" style={{ background: 'rgba(45,212,191,.06)' }}>
       <b className="small">🛡️ امنیت آزمون</b>
       <p className="muted small" style={{ marginTop: 8, lineHeight: 2 }}>
        پاسخ‌های صحیح هرگز به مرورگر دانش‌آموز نمی‌روند؛ تصحیح فقط روی سرور است، هر دانش‌آموز ترتیب متفاوتی می‌بیند و
        خروج از تب، تلاش کپی و تکمیل غیرعادی سریع در گزارش امنیتی ثبت می‌شود. تنظیم دقیق در تب «تنظیمات و امنیت».
       </p>
      </div>
     </div>
    </div>
   )}

   {/* ============ حالت PDF ============ */}
   {exam.mode === 'pdf' && tab === 'pdf' && (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 18, maxWidth: 980 }}>
     <div className="card pad">
      <b>۱) آپلود برگه سوالات (PDF یا تصویر)</b>
      <p className="muted small" style={{ marginTop: 6 }}>
       PDF چندصفحه‌ای آپلود کنید؛ خودکار به تصویر تبدیل می‌شود (متن قابل کپی نیست — یک لایه ضدتقلب).
      </p>
      <input ref={fileRef} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp" style={{ display: 'none' }}
        onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = '' }} />
      <button className="btn btn-soft mt12" onClick={() => fileRef.current?.click()} disabled={uploading}>
        <Icon name="upload" size={15} />{uploading ? 'در حال تبدیل و آپلود…' : 'انتخاب فایل PDF/تصویر'}
      </button>
      {!!(exam.pdf_pages || []).length && (
       <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12, marginTop: 16 }}>
        {exam.pdf_pages.map((u, i) => (
         <div key={u} style={{ position: 'relative', border: '1px solid var(--line)', borderRadius: 12, overflow: 'hidden' }}>
          <img src={u} alt={`صفحه ${i + 1}`} style={{ width: '100%', display: 'block' }} />
          <button className="exm-mini red" style={{ position: 'absolute', top: 6, left: 6 }} onClick={() => delPage(i)}><Icon name="trash" size={13} /></button>
          <span className="badge" style={{ position: 'absolute', bottom: 6, right: 6, background: 'rgba(0,0,0,.55)', color: '#fff' }}>صفحه {faNum(i + 1)}</span>
         </div>
        ))}
       </div>
      )}
     </div>

     <div className="card pad">
      <b>۲) مشخصات پاسخبرگ</b>
      <div className="field-row mt12" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
       <div className="field">
        <label>تعداد سوالات</label>
        <input className="input" type="number" min="1" max="400" value={exam.q_count || ''}
          onChange={(e) => setExam((x) => ({ ...x, q_count: Number(e.target.value) }))}
          onBlur={(e) => saveMeta({ q_count: Number(e.target.value) || 0 })} />
       </div>
       <div className="field">
        <label>تعداد گزینه هر سوال</label>
        <select className="select" value={exam.choices_per_q || 4} onChange={(e) => { setExam((x) => ({ ...x, choices_per_q: Number(e.target.value) })); saveMeta({ choices_per_q: Number(e.target.value) }) }}>
         {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{faNum(n)} گزینه</option>)}
        </select>
       </div>
       <div className="field">
        <label>بارم کل آزمون</label>
        <input className="input" type="number" min="1" value={exam.pdf_total || ''}
          onChange={(e) => setExam((x) => ({ ...x, pdf_total: Number(e.target.value) }))}
          onBlur={(e) => saveMeta({ pdf_total: Number(e.target.value) || 20 })} />
       </div>
      </div>
     </div>

     {!!exam.q_count && (
      <div className="card pad">
       <div className="row" style={{ justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <b>۳) کلید پاسخبرگ — گزینه صحیح هر سوال</b>
        <div className="row" style={{ gap: 8 }}>
         <input className="input" style={{ width: 210, padding: '8px 12px', fontSize: 13 }} placeholder="ورود سریع: 1:3 2:1 یا ۳۱۴۲"
           onKeyDown={(e) => { if (e.key === 'Enter') quickKey(e.target.value) }} />
         <span className="badge" style={{ background: keyCount === exam.q_count ? 'rgba(52,211,153,.14)' : 'rgba(251,191,36,.14)', color: keyCount === exam.q_count ? '#34d399' : '#fbbf24' }}>
          {keyCount === exam.q_count ? '✓ کلید کامل' : `${faNum(keyCount)} از ${faNum(exam.q_count)}`}
         </span>
        </div>
       </div>
       <p className="muted small" style={{ margin: '8px 0 14px' }}>مثال ورود سریع: «1:3 2:1 3:4» یعنی سوال ۱ گزینه ۳ … یا فقط «۳۱۴۲…» به ترتیب سوال‌ها.</p>
       <div className="exm-keygrid">
        {Array.from({ length: exam.q_count }, (_, i) => i + 1).map((n) => (
         <div key={n} className="exm-keycell">
          <span className="n">{faNum(n)}</span>
          <div className="exm-keybubbles">
           {Array.from({ length: exam.choices_per_q || 4 }, (_, c) => (
            <button key={c} className={`exm-keyb ${exam.answer_key?.[n] === c ? 'on' : ''}`} onClick={() => setKey(n, c)}>{faNum(c + 1)}</button>
           ))}
          </div>
         </div>
        ))}
       </div>
      </div>
     )}
    </div>
   )}

   {/* ============ تنظیمات و امنیت ============ */}
   {tab === 'settings' && (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, maxWidth: 1080 }}>
     <div className="card pad">
      <b>اطلاعات آزمون</b>
      <div className="field mt12"><label>عنوان</label>
       <input className="input" value={settings.title} onChange={(e) => setSettings((s) => ({ ...s, title: e.target.value }))}
         onBlur={() => { setExam((x) => ({ ...x, title: settings.title })); saveMeta({ title: settings.title }) }} /></div>
      <div className="field"><label>توضیح برای دانش‌آموز</label>
       <textarea className="textarea" style={{ minHeight: 70 }} value={settings.desc} onChange={(e) => setSettings((s) => ({ ...s, desc: e.target.value }))}
         onBlur={() => saveMeta({ desc: settings.desc })} /></div>
      <div className="field"><label>اتصال به کلاس (اختیاری — خالی = همه دانش‌آموزها)</label>
       <select className="select" value={settings.course_id || ''} onChange={(e) => { setSettings((s) => ({ ...s, course_id: e.target.value })); saveMeta({ course_id: e.target.value }) }}>
        <option value="">— بدون کلاس —</option>
        {classes.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
       </select></div>
      <div className="field-row">
       <div className="field"><label>مدت (دقیقه)</label>
        <input className="input" type="number" min="1" value={settings.duration_min} onChange={(e) => setSettings((s) => ({ ...s, duration_min: e.target.value }))}
          onBlur={() => saveMeta({ duration_min: Number(settings.duration_min) || 30 })} /></div>
      </div>
      <div className="field-row">
       <div className="field"><label>باز شدن از (اختیاری)</label>
        <input className="input" type="datetime-local" value={settings.open_at} onChange={(e) => setSettings((s) => ({ ...s, open_at: e.target.value }))}
          onBlur={() => saveMeta({ open_at: settings.open_at })} /></div>
       <div className="field"><label>بسته شدن در (اختیاری)</label>
        <input className="input" type="datetime-local" value={settings.close_at} onChange={(e) => setSettings((s) => ({ ...s, close_at: e.target.value }))}
          onBlur={() => saveMeta({ close_at: settings.close_at })} /></div>
      </div>
      <div className="field"><label>پاسخنامه تحلیلی (PDF) — بعد از آزمون به دانش‌آموز نمایش داده می‌شود</label>
       <div className="row" style={{ gap: 10 }}>
        <input type="file" accept=".pdf,.png,.jpg" style={{ display: 'none' }} id="anspdf"
          onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return
            const data = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f) })
            try { const r = await req('/exams/upload', { method: 'POST', body: { name: f.name, data } }); setSettings((s) => ({ ...s, answer_pdf: r.url })); saveMeta({ answer_pdf: r.url }); toast('پاسخنامه تحلیلی آپلود شد') } catch (err) { toast(err.message || 'آپلود ناموفق بود', 'error') }
          }} />
        <button className="btn btn-ghost btn-sm" onClick={() => document.getElementById('anspdf').click()}><Icon name="upload" size={14} />آپلود پاسخنامه</button>
        {settings.answer_pdf && <a className="btn btn-sm" style={{ background: 'rgba(52,211,153,.14)', color: '#34d399' }} href={settings.answer_pdf} target="_blank" rel="noreferrer">مشاهده فایل کنونی ✓</a>}
       </div></div>
     </div>

     <div className="card pad">
      <b>🛡️ تنظیمات امنیتی و ضدتقلب</b>
      <p className="muted small" style={{ margin: '6px 0 14px' }}>چند لایه هم‌زمان فعال می‌شود؛ هر مورد جداگانه قابل تنظیم است.</p>
      <ToggleRow label="ضد کپی (انتخاب متن، کلیک راست، Ctrl+C)" desc="در برگه سوال و حالت PDF همیشه فعال است" on={settings.sec_copy_block} onChange={(v) => setMeta({ sec_copy_block: v })} />
      <ToggleRow label="ترتیب تصادفی سوال‌ها" desc="هر دانش‌آموز ترتیب متفاوتی می‌بیند" on={settings.shuffle_q} onChange={(v) => setMeta({ shuffle_q: v })} />
      <ToggleRow label="ترتیب تصادفی گزینه‌ها" desc="جابه‌جایی گزینه‌ها برای هر تلاش" on={settings.shuffle_o} onChange={(v) => setMeta({ shuffle_o: v })} />
      <ToggleRow label="حالت تمام‌صفحه اجباری" desc="خروج از تمام‌صفحه ثبت و شمرده می‌شود" on={settings.sec_fullscreen} onChange={(v) => setMeta({ sec_fullscreen: v })} />
      <div className="field mt12"><label>سقف خروج از تب (۰ = بدون محدودیت)</label>
       <input className="input" type="number" min="0" max="99" value={settings.sec_tab_limit}
         onChange={(e) => setSettings((s) => ({ ...s, sec_tab_limit: e.target.value }))}
         onBlur={() => saveMeta({ sec_tab_limit: Number(settings.sec_tab_limit) || 0 })} />
       <span className="muted small">اگر دانش‌آموز بیش از این مقدار از تب خارج شود، آزمونش خودکار برای بررسی امنیتی شما ارجاع می‌شود.</span></div>
      <div className="field mt12"><label>آستانه تکمیل مشکوک‌ساز (ثانیه)</label>
       <input className="input" type="number" min="0" max="3600" value={settings.sec_fast_submit}
         onChange={(e) => setSettings((s) => ({ ...s, sec_fast_submit: e.target.value }))}
         onBlur={() => saveMeta({ sec_fast_submit: Number(settings.sec_fast_submit) })} />
       <span className="muted small">اگر آزمون سریع‌تر از این مدت تمام شود، در گزارش امنیتی پرچم «غیرعادی سریع» می‌خورد.</span></div>
     </div>
    </div>
   )}

   {/* پیش‌نمایش دانش‌آموزی */}
   {preview && (
    <Modal open wide title="پیش‌نمایش — دقیقاً از دید دانش‌آموز" onClose={() => setPreview(false)}>
     <p className="muted small" style={{ marginBottom: 14 }}>
      {exam.mode === 'pdf' ? 'در حالت PDF، دانش‌آموز برگه را می‌بیند و در پاسخبرگ جداگانه علامت می‌زند (در صفحه واقعی با دکمه انیمیشنی بین برگه و پاسخبرگ جابه‌جا می‌شود).' : 'دانش‌آموز همه سوال‌ها را اسکرول می‌کند و با دکمه انیمیشنی پایین صفحه به پاسخبرگ جداگانه می‌رود.'}
     </p>
     {exam.mode === 'builder' && questions.map((q, i) => (
      <div key={i} className="exm-preview-q">
       <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <span className="exm-qnum">{faNum(i + 1)}</span>
        <span className="chip" style={{ padding: '2px 9px', fontSize: 11 }}>{typeLabel(q.type)}</span>
        <span className="muted" style={{ fontSize: 11 }}>بارم {faNum(q.points)}</span>
       </div>
       <div className="exm-q-title">{q.body}</div>
       {(q.type === 'mcq' || q.type === 'multi' || q.type === 'tf') && (
        <div className="exm-opts mt12">{q.opts.filter((o) => String(o).trim()).map((o, j) => (
         <div key={j} className="exm-opt" style={{ cursor: 'default' }}><span className="bub">{greek[j]}</span>{o}</div>
        ))}</div>
       )}
       {q.type === 'essay' && <textarea className="textarea mt12" disabled placeholder="پاسخ تشریحی دانش‌آموز اینجا نوشته می‌شود" />}
       {(q.type === 'blank' || q.type === 'short') && <input className="input mt12" disabled placeholder="پاسخ کوتاه دانش‌آموز" />}
       {q.type === 'match' && <p className="muted small mt12">دانش‌آموز هر مورد ستون راست را به ستون چپ وصل می‌کند (دکمه‌های انتخابی).</p>}
       {q.type === 'order' && <p className="muted small mt12">دانش‌آموز موارد را با فلش‌ها به ترتیب صحیح می‌چیند.</p>}
      </div>
     ))}
     {exam.mode === 'pdf' && (
      <div>
       <div className="exm-pdfview mb16">{(exam.pdf_pages || [])[0] ? <img src={exam.pdf_pages[0]} alt="برگه" /> : <p className="muted small pad">برگه‌ای آپلود نشده</p>}</div>
       {!!exam.q_count && (
        <div className="exm-sheet-grid">
         {Array.from({ length: Math.min(exam.q_count, 12) }, (_, i) => (
          <div key={i} className="exm-sheet-cell"><div className="n">{faNum(i + 1)}</div>
           <div className="exm-bubbles">{Array.from({ length: exam.choices_per_q || 4 }, (_, c) => <button key={c} className="exm-bubble">{faNum(c + 1)}</button>)}</div>
          </div>
         ))}
        </div>
       )}
      </div>
     )}
    </Modal>
   )}

   {/* درون‌ریزی از آزمون دیگر */}
   {importOpen && (
    <Modal open title="درون‌ریزی سوال از آزمون دیگر (بانک سوال)" onClose={() => setImportOpen(false)}>
     {myExams.length === 0 && <p className="muted small">آزمون طراحی‌شده دیگری ندارید.</p>}
     {myExams.map((e) => (
      <div key={e.id} className="exm-bankitem row" onClick={() => importFrom(e.id)}>
       <Icon name="file" size={16} />
       <div style={{ flex: 1 }}><b className="small">{e.title}</b><div className="muted" style={{ fontSize: 11 }}>{faNum(e.q_count)} سوال</div></div>
       <Icon name="arrowLeft" size={15} />
      </div>
     ))}
    </Modal>
   )}
  </div>
 )
}

/* ---------- اجزای کوچک ---------- */
function ToggleRow({ label, desc, on, onChange }) {
 return (
  <div className="toggle-row">
   <div style={{ flex: 1 }}>
    <b className="small">{label}</b>
    {desc && <p className="muted" style={{ fontSize: 11.5, margin: '2px 0 0' }}>{desc}</p>}
   </div>
   <label className="switch">
    <input type="checkbox" checked={!!on} onChange={(e) => onChange(e.target.checked)} /><i />
   </label>
  </div>
 )
}

function QuestionForm({ q, idx, upd }) {
 const setOpt = (j, v) => { const opts = [...q.opts]; opts[j] = v; upd({ opts }) }
 const addOpt = () => upd({ opts: [...q.opts, ''] })
 const fileToData = (f) => new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.readAsDataURL(f) })
 const uploadQimg = async (f) => {
   if (!f) return
   const data = await fileToData(f)
   try { const r = await req('/exams/upload', { method: 'POST', body: { name: f.name, data } }); upd({ image: r.url }) } catch { /* ignore */ }
 }
 return (
  <div>
   <div className="field">
    <label>متن سوال {faNum(idx + 1)} — برای جای خالی از سه‌نقطه یا ___ استفاده کنید</label>
    <textarea className="textarea" style={{ minHeight: 76 }} value={q.body} onChange={(e) => upd({ body: e.target.value })} />
   </div>
   <div className="row" style={{ gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
    <label className="btn btn-ghost btn-sm" style={{ cursor: 'pointer' }}>
     <Icon name="upload" size={13} />{q.image ? 'تصویر آپلود شد ✓' : 'تصویر سوال (اختیاری)'}
     <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => uploadQimg(e.target.files?.[0])} />
    </label>
    {q.image && <button className="exm-mini red" onClick={() => upd({ image: '' })}><Icon name="trash" size={12} /></button>}
    <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 130 }}><label>بارم</label>
     <input className="input" type="number" step="0.25" min="0.25" value={q.points} onChange={(e) => upd({ points: e.target.value })} /></div>
    <div className="field" style={{ marginBottom: 0, flex: 1, minWidth: 130 }}><label>موضوع (برای تحلیل)</label>
     <input className="input" value={q.topic} onChange={(e) => upd({ topic: e.target.value })} placeholder="مثلاً: مشتق" /></div>
   </div>
   {q.image && <img src={q.image} alt="" style={{ maxWidth: '100%', maxHeight: 180, borderRadius: 12, marginBottom: 14 }} />}

   {(q.type === 'mcq' || q.type === 'multi') && (
    <div>
     <label className="muted small">{q.type === 'mcq' ? 'گزینه صحیح را با دکمه سبز علامت بزنید' : 'همه گزینه‌های صحیح را علامت بزنید (نمره جزئی دارد)'}</label>
     <div className="mt8">
      {q.opts.map((o, j) => (
       <div key={j} className="exm-optrow">
        <button type="button" className={`exm-markbtn ${q.type === 'multi' ? (q.correct || []).includes(j) ? 'on' : '' : q.correct === j ? 'on' : ''}`}
          onClick={() => upd(q.type === 'mcq' ? { correct: j } : { correct: (q.correct || []).includes(j) ? q.correct.filter((c) => c !== j) : [...(q.correct || []), j] })}
          title="گزینه صحیح">✓</button>
        <input className="input" value={o} onChange={(e) => setOpt(j, e.target.value)} placeholder={`گزینه ${greek[j]}`} />
        {q.opts.length > 2 && <button className="exm-mini red" onClick={() => upd({ opts: q.opts.filter((_, x) => x !== j), correct: q.type === 'mcq' ? (q.correct > j ? q.correct - 1 : q.correct === j ? 0 : q.correct) : (q.correct || []).filter((c) => c !== j).map((c) => (c > j ? c - 1 : c)) })}><Icon name="trash" size={12} /></button>}
       </div>
      ))}
      {q.opts.length < 6 && <button type="button" className="exm-addopt" onClick={addOpt}>+ افزودن گزینه</button>}
     </div>
    </div>
   )}

   {q.type === 'tf' && (
    <div className="row" style={{ gap: 10 }}>
     <button type="button" className={`exm-chip ${q.correct === 0 ? 'on' : ''}`} onClick={() => upd({ correct: 0 })}>✓ درست</button>
     <button type="button" className={`exm-chip ${q.correct === 1 ? 'on' : ''}`} onClick={() => upd({ correct: 1 })}>✗ نادرت</button>
    </div>
   )}

   {(q.type === 'blank' || q.type === 'short') && (
    <div>
     <label className="muted small">پاسخ‌های قابل قبول (با نرمال‌سازی ارقام فارسی/عربی مقایسه می‌شود)</label>
     <div className="mt8">
      {(q.correct || []).map((c, j) => (
       <div key={j} className="exm-optrow">
        <button type="button" className="exm-markbtn on">✓</button>
        <input className="input" value={c} onChange={(e) => { const arr = [...q.correct]; arr[j] = e.target.value; upd({ correct: arr }) }} placeholder={`پاسخ ${greek[j]}`} />
        {(q.correct || []).length > 1 && <button className="exm-mini red" onClick={() => upd({ correct: q.correct.filter((_, x) => x !== j) })}><Icon name="trash" size={12} /></button>}
       </div>
      ))}
      <button type="button" className="exm-addopt" onClick={() => upd({ correct: [...q.correct, ''] })}>+ پاسخ قابل قبول دیگر</button>
     </div>
    </div>
   )}

   {q.type === 'match' && (
    <div>
     <div className="field-row">
      <div>
       <label className="muted small">ستون راست (موارد)</label>
       {q.opts.left.map((o, j) => (
        <div key={j} className="exm-optrow"><input className="input" value={o} onChange={(e) => { const l = [...q.opts.left]; l[j] = e.target.value; upd({ opts: { ...q.opts, left: l } }) }} placeholder={`مورد ${greek[j]}`} /></div>
       ))}
       <button type="button" className="exm-addopt" onClick={() => upd({ opts: { ...q.opts, left: [...q.opts.left, ''] } })}>+ مورد</button>
      </div>
      <div>
       <label className="muted small">ستون چپ (اتصال‌ها)</label>
       {q.opts.right.map((o, j) => (
        <div key={j} className="exm-optrow"><input className="input" value={o} onChange={(e) => { const r = [...q.opts.right]; r[j] = e.target.value; upd({ opts: { ...q.opts, right: r } }) }} placeholder={`اتصال ${greek[j]}`} /></div>
       ))}
       <button type="button" className="exm-addopt" onClick={() => upd({ opts: { ...q.opts, right: [...q.opts.right, ''] } })}>+ اتصال</button>
      </div>
     </div>
     <label className="muted small">هر موردِ ستون راست به کدام اتصال وصل می‌شود؟</label>
     {q.opts.left.map((_, l) => (
      <div key={l} className="exm-optrow">
       <span className="muted small" style={{ minWidth: 70 }}>مورد {greek[l]}</span>
       <select className="select" value={q.correct?.[l] ?? 0} onChange={(e) => upd({ correct: { ...q.correct, [l]: Number(e.target.value) } })}>
        {q.opts.right.map((r, j) => <option key={j} value={j}>{r.trim() || `اتصال ${greek[j]}`}</option>)}
       </select>
      </div>
     ))}
    </div>
   )}

   {q.type === 'order' && (
    <div>
     <label className="muted small">موارد را به ترتیب صحیح بچینید (فلش‌های بالا/پایین) — دانش‌آموز این ترتیب را از حالت به‌هم‌ریخته باید بسازد</label>
     <div className="mt8">
      {q.opts.map((o, j) => (
       <div key={j} className="exm-optrow">
        <span className="exm-qnum" style={{ width: 26, height: 26, fontSize: 12 }}>{faNum(j + 1)}</span>
        <input className="input" value={o} onChange={(e) => { const arr = [...q.opts]; arr[j] = e.target.value; upd({ opts: arr }) }} placeholder={`مورد ${greek[j + 1]}`} />
        <button className="exm-mini" onClick={() => { if (j === 0) return; const a = [...q.opts];[a[j], a[j - 1]] = [a[j - 1], a[j]]; upd({ opts: a }) }}><Icon name="arrowUp" size={13} /></button>
        <button className="exm-mini" style={{ transform: 'rotate(180deg)' }} onClick={() => { if (j === q.opts.length - 1) return; const a = [...q.opts];[a[j], a[j + 1]] = [a[j + 1], a[j]]; upd({ opts: a }) }}><Icon name="arrowUp" size={13} /></button>
       </div>
      ))}
      {q.opts.length < 8 && <button type="button" className="exm-addopt" onClick={() => upd({ opts: [...q.opts, ''] })}>+ مورد</button>}
     </div>
    </div>
   )}

   {q.type === 'essay' && <p className="muted small">پاسخ تشریحی بعد از آزمون در بخش «تحلیل و تصحیح» به شما نشان داده می‌شود تا نمره بدهید.</p>}

   <div className="field mt16"><label>توضیح پاسخ (اختیاری — در کارنامه دانش‌آموز نمایش داده می‌شود)</label>
    <textarea className="textarea" style={{ minHeight: 60 }} value={q.expl} onChange={(e) => upd({ expl: e.target.value })} /></div>
  </div>
 )
}
