import { useState } from 'react'
import Icon from '../../components/Icon'
import { assignments } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum, faDate } from '../../utils/format'

const quiz = {
  q: 'خروجی کد زیر در جاوااسکریپت چیست؟\nconsole.log(typeof null)',
  options: ['"null"', '"object"', '"undefined"', 'خطا می‌دهد'],
  correct: 1,
}

export default function SAssignments() {
  const { toast } = useApp()
  const [picked, setPicked] = useState(null)
  const [checked, setChecked] = useState(false)
  const [uploadFor, setUploadFor] = useState(null)

  return (
    <div>
      <div className="between wrap mb24">
        <div>
          <h2 style={{ fontSize: 17 }}>تمرین و آزمون‌ها</h2>
          <span className="muted small">تکالیف دوره‌ها، آزمون‌های کوییز و وضعیت تصحیح</span>
        </div>
        <span className="badge b-amber">{faNum(assignments.filter((a) => a.status === 'todo').length)} تمرین باز</span>
      </div>

      <div className="grids g2" style={{ marginBottom: 24 }}>
        {assignments.map((a) => (
          <div className="card pad" key={a.id}>
            <div className="between mb8">
              <span className="badge b-gray">{a.course}</span>
              {a.status === 'todo' && <span className="badge b-amber">در انتظار انجام</span>}
              {a.status === 'submitted' && <span className="badge b-sky">تحویل شده</span>}
              {a.status === 'graded' && <span className="badge b-green">نمره: {faNum(a.grade)}</span>}
            </div>
            <b style={{ fontSize: 14.5 }}>{a.title}</b>
            <div className="between mt16 wrap">
              <span className="muted small"><Icon name="calendar" size={13} /> مهلت: {faDate(a.due)}</span>
              {a.status === 'todo' ? (
                <button className="btn btn-primary btn-sm" onClick={() => setUploadFor(a.id)}>
                  <Icon name="upload" size={14} /> ارسال پاسخ
                </button>
              ) : a.status === 'submitted' ? (
                <button className="btn btn-ghost btn-sm" onClick={() => toast('پاسخ شما در صف تصحیح است', 'info')}><Icon name="eye" size={14} /> مشاهده</button>
              ) : (
                <button className="btn btn-ghost btn-sm" onClick={() => toast('جزوه تصحیح‌شده دانلود شد')}><Icon name="download" size={14} /> دانلود تصحیح</button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* آزمون کوییز */}
      <div className="card pad">
        <div className="between mb16">
          <h3 style={{ fontSize: 15 }}>🎯 آزمون کوییز سریع — جاوااسکریپت</h3>
          <span className="muted small">۱ سوال از ۱۰ • فرصت: بی‌نهایت</span>
        </div>
        <p className="mb16" style={{ whiteSpace: 'pre-line', fontFamily: 'monospace', background: 'rgba(7,13,24,.6)', padding: '12px 16px', borderRadius: 10, fontSize: 13.5 }}>{quiz.q}</p>
        {quiz.options.map((o, i) => (
          <div
            key={o} className={`quiz-option ${picked === i ? 'on' : ''} ${checked && i === quiz.correct ? 'on' : ''}`}
            onClick={() => !checked && setPicked(i)}
            style={checked && i === quiz.correct ? { borderColor: 'rgba(52,211,153,.5)', background: 'rgba(52,211,153,.08)' } : null}
          >
            <span className="opt-key">{['الف', 'ب', 'ج', 'د'][i]}</span> {o}
            {checked && i === quiz.correct && <Icon name="check" size={17} className="text-green" style={{ marginInlineStart: 'auto' }} />}
          </div>
        ))}
        <div className="row g12 mt16">
          <button className="btn btn-primary" disabled={picked == null || checked} onClick={() => {
            setChecked(true)
            if (picked === quiz.correct) toast('آفرین! پاسخ صحیح بود 🎉')
            else toast('پاسخ درست «object» بود — typeof null در JS باگ تاریخی است!', 'info')
          }}>ثبت پاسخ</button>
          {checked && <button className="btn btn-ghost" onClick={() => { setPicked(null); setChecked(false) }}>سوال بعدی</button>}
          {checked && <span className="badge b-green mt8"><Icon name="check" size={13} /> نمره این سوال ثبت شد</span>}
        </div>
      </div>

      {/* مودال ارسال تمرین */}
      {uploadFor && (
        <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setUploadFor(null) }}>
          <div className="modal">
            <div className="modal-head">
              <h3>ارسال پاسخ تمرین</h3>
              <button className="icon-btn" onClick={() => setUploadFor(null)}><Icon name="x" size={17} /></button>
            </div>
            <div className="demo-note mb16"><Icon name="sparkles" /> در نسخه دمو فایل واقعی آپلود نمی‌شود.</div>
            <div className="field">
              <label>فایل پاسخ (ZIP / PDF / کد)</label>
              <div className="map-placeholder" style={{ height: 130 }}>
                <Icon name="upload" size={30} />
                <span>فایل را اینجا رها کنید یا کلیک کنید</span>
              </div>
            </div>
            <div className="field"><label>توضیح (اختیاری)</label><textarea className="textarea" placeholder="نکاتی که مدرس باید بداند…" /></div>
            <div className="modal-actions">
              <button className="btn btn-primary" onClick={() => { setUploadFor(null); toast('پاسخ تمرین ارسال شد — نتیجه تصحیح اطلاع داده می‌شود') }}>ارسال برای تصحیح</button>
              <button className="btn btn-ghost" onClick={() => setUploadFor(null)}>انصراف</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
