import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { StatCard } from '../../components/PanelLayout'
import { LineChart } from '../../components/Charts'
import { teacherEarnings, teacherClasses, teacherStudents } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { DAYS, faNum } from '../../utils/format'

export default function TDashboard() {
  const { user, customClasses } = useApp()
  const upcoming = [...teacherClasses, ...customClasses.map((c) => ({ ...c, students: 18 }))]
  return (
    <div>
      <div className="card pad mb24" style={{ background: 'linear-gradient(135deg, rgba(167,139,250,0.12), rgba(45,212,191,0.12))' }}>
        <div className="between wrap">
          <div>
            <h2 style={{ fontSize: 20 }}>سلام استاد {user?.name || 'کریمی'} 👨‍🏫</h2>
            <p className="muted small mt8">امروز یک کارگاه زنده دارید — ساعت ۱۸:۰۰ با ۴۱ دانشجو</p>
          </div>
          <Link to="/panel/teacher/live" className="btn btn-primary"><Icon name="video" size={17} /> شروع کلاس زنده</Link>
        </div>
      </div>

      <div className="stat-cards">
        <StatCard icon="users" color="teal" label="دانشجوی فعال" value={faNum(3260)} trend={11} />
        <StatCard icon="calendar" color="violet" label="کلاس پیش‌رو این هفته" value={faNum(upcoming.length)} />
        <StatCard icon="wallet" color="amber" label="درآمد آبان (میلیون)" value={faNum(95)} trend={16} />
        <StatCard icon="star" color="green" label="امتیاز رضایت" value="۴.۹" trend={2} />
      </div>

      <div className="chart-grid">
        <div className="card chart-card">
          <h3>روند درآمد ۹ ماه گذشته (میلیون تومان)</h3>
          <div className="chart-sub">درآمد دوره‌ها + کلاس‌های زنده</div>
          <LineChart data={teacherEarnings} color="#a78bfa" color2="#f472b6" unit="م" />
        </div>
        <div className="card chart-card">
          <h3>کلاس‌های پیش‌رو</h3>
          <div className="chart-sub">سریع‌ترین دسترسی به شروع کلاس</div>
          {upcoming.slice(0, 4).map((c) => (
            <div className="between mb16" key={c.id} style={{ borderBottom: '1px solid var(--line2)', paddingBottom: 12 }}>
              <div>
                <b className="small">{c.title}</b>
                <div className="muted small">{DAYS[c.day]} • {c.start} • {faNum(c.students)} دانشجو</div>
              </div>
              <Link to="/panel/teacher/live" className="btn btn-soft btn-sm"><Icon name="video" size={14} /> شروع</Link>
            </div>
          ))}
          <Link to="/panel/teacher/classes" className="btn btn-ghost btn-sm btn-block">مدیریت همه کلاس‌ها</Link>
        </div>
      </div>

      <div className="card chart-card">
        <h3 className="mb16">آخرین فعالیت دانشجوها</h3>
        <div className="feed">
          {teacherStudents.slice(0, 4).map((s) => (
            <div className="feed-item" key={s.id}>
              <span className="fd-icon" style={{ background: 'rgba(45,212,191,.12)', color: 'var(--teal)' }}><Icon name="user" size={15} /></span>
              <div>
                <p><b>{s.name}</b> دوره «{s.courses}» را ادامه داد — پیشرفت {s.progress.toLocaleString('fa-IR')}٪</p>
                <span className="fd-time">آخرین فعالیت: {s.lastSeen}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
