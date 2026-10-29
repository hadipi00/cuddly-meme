import Icon from '../../components/Icon'
import { StatCard } from '../../components/PanelLayout'
import { LineChart, BarChart, Donut, Spark } from '../../components/Charts'
import { studyLogs, studyByCourse } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { DAYS, faNum } from '../../utils/format'

export default function SStudy() {
  const { extraMinutes } = useApp()
  const logs = studyLogs.map((d, i) => (i === 29 ? { ...d, minutes: d.minutes + extraMinutes } : d))
  const totalMin = logs.reduce((a, d) => a + d.minutes, 0)
  const avg = Math.round(totalMin / logs.length)
  const week = DAYS.map((d, i) => ({
    label: d,
    value: logs.slice(i * 4, i * 4 + 4).reduce((a, x) => a + x.minutes, 0),
  }))
  const best = Math.max(...logs.map((d) => d.minutes))

  return (
    <div>
      <div className="between wrap mb24">
        <div>
          <h2 style={{ fontSize: 17 }}>میانگین مطالعه و پیشرفت من</h2>
          <span className="muted small">گزارش دقیق ۳۰ روز گذشته — زمان مطالعه دوره‌ها و کلاس‌ها به‌صورت خودکار ثبت می‌شود</span>
        </div>
      </div>

      <div className="stat-cards">
        <StatCard icon="clock" color="teal" label="میانگین مطالعه روزانه" value={`${faNum(avg)} دقیقه`} trend={9} />
        <StatCard icon="activity" color="amber" label="مجموع مطالعه این ماه" value={`${faNum(Math.floor(totalMin / 60))} ساعت`} trend={14}
          spark={<Spark points={logs.map((d) => d.minutes)} color="#fbbf24" />} />
        <StatCard icon="zap" color="violet" label="رکورد یک روز" value={`${faNum(best)} دقیقه`} trend={22} />
        <StatCard icon="target" color="green" label="روزهای فعال پیوسته" value={`${faNum(12)} روز`} trend={5} />
      </div>

      <div className="chart-card card mb22">
        <h3>روند مطالعه روزانه (دقیقه)</h3>
        <div className="chart-sub">۳۰ روز گذشته — هر جلسه پخش ویدیو و حضور در کلاس زنده لحظه‌ای ثبت می‌شود</div>
        <LineChart data={logs.map((d) => ({ label: faNum(d.day + 1), value: d.minutes }))} color="#fbbf24" color2="#fb923c" />
      </div>

      <div className="chart-grid">
        <div className="card chart-card">
          <h3>مطالعه هفته جاری</h3>
          <div className="chart-sub">مجموع دقیقه‌ها به تفکیک روز</div>
          <BarChart data={week} color="#38bdf8" />
        </div>
        <div className="card chart-card">
          <h3>توزیع زمان بین دوره‌ها</h3>
          <div className="chart-sub">کدام دوره بیشتر وقت شما را گرفته؟</div>
          <Donut data={studyByCourse} />
        </div>
      </div>

      <div className="card pad">
        <h3 className="mb16">تنظیم هدف مطالعه</h3>
        <div className="row g16 wrap">
          <div style={{ flex: 1, minWidth: 220 }}>
            <div className="between small mb8"><b>هدف هفتگی: ۱۰ ساعت</b><span className="muted">{faNum(Math.round(week.reduce((a, d) => a + d.value, 0) / 60))} ساعت محقق شده</span></div>
            <div className="progress violet"><i style={{ width: `${Math.min(100, Math.round((week.reduce((a, d) => a + d.value, 0) / 600) * 100))}%` }} /></div>
          </div>
          <span className="badge b-teal">🎯 این هفته ۲ روز دیگر تا هدف</span>
        </div>
      </div>
    </div>
  )
}
