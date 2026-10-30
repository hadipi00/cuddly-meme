import { useState } from 'react'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { submissions } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum, faDate } from '../../utils/format'

export default function TAssignments() {
 const { toast } = useApp()
 const [list, setList] = useState(submissions)
 const [gradeFor, setGradeFor] = useState(null)
 const [creating, setCreating] = useState(false)

 const saveGrade = (e) => {
 e.preventDefault()
 setList((l) => l.map((s) => (s.id === gradeFor.id ? { ...s, status: 'graded', grade: Number(e.target.grade.value) } : s)))
 setGradeFor(null)
 toast('نمره ثبت شد و برای دانشجو پیامک شد')
 }

 return (
 <div>
 <div className="between wrap mb24">
 <div>
 <h2 style={{ fontSize: 17 }}>تکالیف و تصحیح</h2>
 <span className="muted small">تعریف تمرین جدید و نمره‌دهی پاسخ‌های دانشجوها</span>
 </div>
 <button className="btn btn-primary" onClick={() => setCreating(true)}><Icon name="plus" size={16} /> تعریف تکلیف جدید</button>
 </div>

 <div className="stat-cards" style={{ gridTemplateColumns: 'repeat(3,1fr)', marginBottom: 22 }}>
 <div className="card stat-card"><b className="sc-val">{faNum(list.filter((s) => s.status === 'pending').length)}</b><span className="sc-label">در انتظار تصحیح</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(list.filter((s) => s.status === 'graded').length)}</b><span className="sc-label">تصحیح‌شده</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(18.1)}</b><span className="sc-label">میانگین نمرات</span></div>
 </div>

 <div className="card pad">
 <DataTable
 columns={[
 { key: 'student', label: 'دانشجو', render: (r) => <span className="cell-strong">{r.student}</span> },
 { key: 'assignment', label: 'تکلیف' },
 { key: 'date', label: 'تاریخ ارسال' },
 { key: 'file', label: 'فایل', render: (r) => <span className="muted small" dir="ltr">{r.file}</span> },
 { key: 'status', label: 'وضعیت', render: (r) => r.status === 'pending'
 ? <span className="badge b-amber">در انتظار تصحیح</span>
 : <span className="badge b-green">نمره: {faNum(r.grade)}</span> },
 ]}
 rows={list}
 searchKeys={['student', 'assignment']}
 filters={[{ key: 'status', label: 'وضعیت', options: ['در انتظار', 'نمره‌داده'], match: (r, v) => (r.status === 'pending' ? 'در انتظار' : 'نمره‌داده') === v }]}
 actions={(r) => (
 <>
 <button className="icon-btn" title="دانلود فایل" onClick={() => toast('فایل پاسخ دانلود شد')}><Icon name="download" /></button>
 {r.status === 'pending' && (
 <button className="icon-btn" title="نمره‌دهی" onClick={() => setGradeFor(r)}><Icon name="check" /></button>
 )}
 </>
 )}
 />
 </div>

 {gradeFor && (
 <div className="modal-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) setGradeFor(null) }}>
 <div className="modal">
 <div className="modal-head"><h3>نمره‌دهی — {gradeFor.student}</h3><button className="icon-btn" onClick={() => setGradeFor(null)}><Icon name="x" size={17} /></button></div>
 <form onSubmit={saveGrade}>
 <div className="field"><label>نمره از ۲۰</label><input className="input" name="grade" type="number" min="0" max="20" step="0.25" defaultValue={18} required /></div>
 <div className="field"><label>بازخورد برای دانشجو</label><textarea className="textarea" placeholder="نقاط قوت و موارد قابل بهبود…" /></div>
 <div className="modal-actions">
 <button className="btn btn-primary">ثبت نمره و بازخورد</button>
 <button type="button" className="btn btn-ghost" onClick={() => setGradeFor(null)}>انصراف</button>
 </div>
 </form>
 </div>
 </div>
 )}

 <FormModal
 open={creating} title="تعریف تکلیف جدید" onClose={() => setCreating(false)}
 onSubmit={(d) => { setCreating(false); toast(`تکلیف «${d.title}» برای دانشجوها ارسال شد`) }}
 fields={[
 { key: 'title', label: 'عنوان تکلیف', full: true },
 { key: 'course', label: 'دوره', type: 'select', options: ['ری‌اکت و Next.js', 'پایتون نوجوانان', 'ریاضی کنکور'] },
 { key: 'due', label: 'مهلت تحویل', type: 'date' },
 { key: 'desc', label: 'توضیحات', type: 'textarea', full: true, required: false },
 ]}
 />
 </div>
 )
}
