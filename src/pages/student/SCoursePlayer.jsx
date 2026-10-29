import { useMemo, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { courses, myCourses } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum } from '../../utils/format'

export default function SCoursePlayer() {
  const { courseId } = useParams()
  const { lessonDone, toggleLesson, addMinutes, toast } = useApp()
  const course = courses.find((c) => c.id === Number(courseId))
  const [playing, setPlaying] = useState(false)
  const [note, setNote] = useState('')
  const [curSec, setCurSec] = useState(0)

  // فهرست مسطح درس‌ها از سرفصل‌ها
  const flat = useMemo(() => {
    if (!course) return []
    return course.curriculum.flatMap((sec, si) =>
      sec.lessons.map((l, li) => ({ section: sec.title, si, li, title: l[0], dur: l[1] }))
    )
  }, [course])

  if (!course) return <div className="empty"><p>دوره یافت نشد.</p></div>
  const done = lessonDone[String(course.id)] || []
  const firstUndone = flat.findIndex((_, i) => !done.includes(i))
  const current = flat[curSec] || flat[0]
  const progress = Math.round((done.length / flat.length) * 100)

  const startPlay = () => {
    setPlaying(true)
    addMinutes(3)
  }

  return (
    <div>
      <div className="between wrap mb16">
        <div>
          <Link to="/panel/student/courses" className="muted small row g8" style={{ marginBottom: 6 }}>
            <Icon name="arrowLeft" size={15} /> بازگشت به دوره‌های من
          </Link>
          <h2 style={{ fontSize: 17 }}>{course.emoji} {course.title}</h2>
          <span className="muted small">مدرس: {course.teacher} • پیشرفت کل: {faNum(progress)}٪</span>
        </div>
        <span className="badge b-teal">{faNum(done.length)} / {faNum(flat.length)} درس</span>
      </div>

      <div className="player-grid">
        <div className="player-stage">
          <div className="player-screen">
            {playing ? (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 64, marginBottom: 10 }}>{course.emoji}</div>
                <b>در حال پخش: {current?.title}</b>
                <p className="muted small mt8">مدت: {current?.dur} — زمان این جلسه در آمار مطالعه شما ثبت شد</p>
              </div>
            ) : (
              <button className="play-btn" onClick={startPlay}><Icon name="play" filled /></button>
            )}
          </div>
          <div className="player-bar">
            <b className="small">{current?.title}</b>
            <div className="progress"><i style={{ width: playing ? '38%' : '0%' }} /></div>
            <span dir="ltr">{current?.dur}</span>
            <button className="icon-btn" onClick={() => { setCurSec((i) => Math.max(0, i - 1)) }}><Icon name="chevronRight" size={16} /></button>
            <button className="icon-btn" onClick={() => { setPlaying(true); addMinutes(3) }}><Icon name="play" size={16} /></button>
            <button className="icon-btn" onClick={() => setCurSec((i) => Math.min(flat.length - 1, i + 1))}><Icon name="chevronLeft" size={16} /></button>
          </div>

          {/* یادداشت‌برداری */}
          <div style={{ padding: '14px 18px', borderTop: '1px solid var(--line2)' }}>
            <div className="row g8">
              <input className="input" placeholder="یادداشت این لحظه از درس…" value={note} onChange={(e) => setNote(e.target.value)} />
              <button className="btn btn-soft btn-sm" onClick={() => { if (note.trim()) { toast('یادداشت ذخیره شد'); setNote('') } }}>
                <Icon name="file" size={15} /> ذخیره
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line2)' }}>
            <b className="small">سرفصل‌ها و درس‌ها</b>
            <div className="progress mt8"><i style={{ width: `${progress}%` }} /></div>
          </div>
          <div className="lesson-list">
            {flat.map((l, i) => (
              <div
                key={i}
                className={`lesson-item ${i === curSec ? 'on' : ''} ${done.includes(i) ? 'done' : ''}`}
                onClick={() => { setCurSec(i); setPlaying(false) }}
              >
                <span
                  className="lesson-check"
                  onClick={(e) => { e.stopPropagation(); toggleLesson(course.id, i) }}
                  title="تکمیل درس"
                >
                  <Icon name="check" />
                </span>
                <span style={{ flex: 1, lineHeight: 1.7 }}>
                  <span className="muted" style={{ fontSize: 10.5, display: 'block' }}>{l.section}</span>
                  {l.title}
                </span>
                <span className="l-dur" dir="ltr">{l.dur}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
