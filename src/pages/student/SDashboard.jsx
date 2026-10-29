import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { StatCard } from '../../components/PanelLayout'
import { Spark } from '../../components/Charts'
import { studyLogs, myCourses, courses, assignments } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum, faDate } from '../../utils/format'

export default function SDashboard() {
  const { user } = useApp()
  const totalMin = studyLogs.reduce((a, d) => a + d.minutes, 0)
  const today = assignments.filter((a) => a.status === 'todo').slice(0, 3)

  return (
    <div>
      <div className="card pad mb24" style={{ background: 'linear-gradient(135deg, rgba(45,212,191,0.12), rgba(167,139,250,0.12))' }}>
        <div className="between wrap">
          <div>
            <h2 style={{ fontSize: 20 }}>سلام {user?.name || 'سارا'} عزیز 👋</h2>
            <p className="muted small mt8">امروز ۲ کلاس زنده داری و ۲ تمرین سررسید نزدیک — انرژی‌ات رو حفظ کن!</p>
          </div>
          <Link to="/panel/student/schedule" className="btn btn-primary">جدول هفتگی من <Icon name="calendar" size={16} /></Link>
        </div>
      </div>

      <div className="stat-cards">
        <StatCard icon="book" color="teal" label="دوره‌های در حال یادگیری" value={faNum(myCourses.filter((c) => c.progress < 100).length)} trend={12} />
        <StatCard icon="calendar" color="violet" label="کلاس زنده این هفته" value={faNum(4)} trend={0} />
        <StatCard icon="clock" color="amber" label="مطالعه این ماه" value={`${faNum(Math.round(totalMin / 60))} ساعت`} trend={8}
          spark={<Spark points={studyLogs.map((d) => d.minutes)} color="#fbbf24" />} />
        <StatCard icon="check" color="green" label="میانگین نمره تمرین‌ها" value={`${faNum(19.2)}`} trend={3} />
      </div>

      <div className="chart-grid">
        {/* ادامه یادگیری */}
        <div className="card chart-card">
          <h3>ادامه یادگیری</h3>
          <div className="chart-sub">از همان جلسه قبلی ادامه بده</div>
          {myCourses.slice(0, 3).map((mc) => {
            const c = courses.find((x) => x.id === mc.courseId)
            return (
              <Link to={`/panel/student/player/${c.id}`} key={mc.courseId} className="row g12" style={{ padding: '12px 0', borderBottom: '1px solid var(--line2)' }}>
                <span className={`avatar ${c.color}`} style={{ width: 46, height: 46, borderRadius: 12, fontSize: 22 }}>{c.emoji}</span>
                <div style={{ flex: 1 }}>
                  <b className="small">{c.title}</b>
                  <div className="row g8 mt8">
                    <div className="progress" style={{ flex: 1 }}><i style={{ width: `${mc.progress}%` }} /></div>
                    <span className="muted small">{faNum(mc.progress)}٪</span>
                  </div>
                  <span className="muted small">آخرین درس: {mc.lastLesson} • {faDate(mc.lastSeen)}</span>
                </div>
                <button className="btn btn-soft btn-sm"><Icon name="play" size={14} /> ادامه</button>
              </Link>
            )
          })}
        </div>

        {/* کارهای نزدیک */}
        <div className="card chart-card">
          <h3>سررسیدهای نزدیک</h3>
          <div className="chart-sub">تمرین‌هایی که باید تحویل بدهی</div>
          <div className="feed">
            {today.map((a) => (
              <div className="feed-item" key={a.id}>
                <span className="fd-icon" style={{ background: 'rgba(251,113,133,0.12)', color: 'var(--red)' }}><Icon name="file" size={16} /></span>
                <div>
                  <p><b>{a.title}</b></p>
                  <span className="muted small">{a.course}</span>
                  <div className="fd-time">مهلت: {faDate(a.due)}</div>
                </div>
              </div>
            ))}
            <Link to="/panel/student/assignments" className="btn btn-ghost btn-sm mt16 btn-block">همه تمرین‌ها</Link>
          </div>
        </div>
      </div>

      <div className="grids g3">
        {[
          { icon: 'calendar', t: 'جدول هفتگی', d: 'کلاس‌های زنده و زمان‌بندی هفته', to: '/panel/student/schedule', color: 'teal' },
          { icon: 'activity', t: 'میانگین مطالعه', d: 'نمودار دقیق روند مطالعه ۳۰ روز', to: '/panel/student/study', color: 'amber' },
          { icon: 'award', t: 'گواهی‌نامه‌ها', d: 'مدارک پایان دوره با کد رهگیری', to: '/panel/student/certificates', color: 'violet' },
        ].map((x) => (
          <Link key={x.t} to={x.to}>
            <div className="card pad" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
              <span className={`sc-icon ${x.color}`} style={{ width: 44, height: 44, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={x.icon} size={20} />
              </span>
              <div><b className="small">{x.t}</b><p className="muted small">{x.d}</p></div>
              <Icon name="chevronLeft" size={18} style={{ marginInlineStart: 'auto', color: 'var(--faint)' }} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
