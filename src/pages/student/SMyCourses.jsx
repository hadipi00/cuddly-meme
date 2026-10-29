import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { courses, myCourses } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum, faDate, toman } from '../../utils/format'

export default function SMyCourses() {
  const { lessonDone } = useApp()
  return (
    <div>
      <div className="between wrap mb24">
        <div>
          <h2 style={{ fontSize: 17 }}>دوره‌های من</h2>
          <span className="muted small">دسترسی مادام‌العمر به همه ویدیوها و منابع</span>
        </div>
      </div>

      <div className="grids g2">
        {myCourses.map((mc) => {
          const c = courses.find((x) => x.id === mc.courseId)
          const done = (lessonDone[String(c.id)] || []).length
          return (
            <div className="card pad" key={mc.courseId}>
              <div className="row g16" style={{ alignItems: 'flex-start' }}>
                <span className={`avatar ${c.color}`} style={{ width: 64, height: 64, borderRadius: 16, fontSize: 30 }}>{c.emoji}</span>
                <div style={{ flex: 1 }}>
                  <b style={{ fontSize: 15, lineHeight: 1.7 }}>{c.title}</b>
                  <div className="row g12 wrap mt8">
                    <span className="badge b-gray"><Icon name="user" size={12} /> {c.teacher}</span>
                    <span className="badge b-gray"><Icon name="play" size={12} /> {faNum(c.lessonsCount)} درس</span>
                    {mc.progress === 100 && <span className="badge b-green"><Icon name="check" size={12} /> تکمیل شده</span>}
                  </div>
                </div>
              </div>
              <div className="row g8 mt16">
                <div className="progress"><i style={{ width: `${mc.progress}%` }} /></div>
                <span className="muted small" style={{ minWidth: 44 }}>{faNum(mc.progress)}٪</span>
              </div>
              <div className="between mt16 wrap">
                <span className="muted small">
                  {done > 0 ? `${faNum(done)} درس تکمیل کرده‌اید • ` : ''}
                  آخرین حضور: {faDate(mc.lastSeen)}
                </span>
                <Link to={`/panel/student/player/${c.id}`} className="btn btn-primary btn-sm">
                  <Icon name="play" size={14} /> {mc.progress === 100 ? 'مرور دوره' : 'ادامه یادگیری'}
                </Link>
              </div>
            </div>
          )
        })}
      </div>

      <div className="card pad mt24">
        <div className="between wrap">
          <div>
            <b className="small">دوره جدید می‌خواهید؟</b>
            <p className="muted small">از فروشگاه دوره‌های مدرس‌یار انتخاب کنید</p>
          </div>
          <Link to="/courses" className="btn btn-ghost btn-sm">مشاهده فروشگاه دوره‌ها</Link>
        </div>
      </div>
    </div>
  )
}
