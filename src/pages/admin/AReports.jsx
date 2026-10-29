import { useState } from 'react'
import { DataIcon } from '../../utils/icons'
import Icon from '../../components/Icon'
import { LineChart, BarChart, Donut } from '../../components/Charts'
import { salesSeries, weekSales, catShare, courses, teachers, products, studyLogs } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum } from '../../utils/format'

export default function AReports() {
 const { toast } = useApp()
 const [period, setPeriod] = useState('۱۲ ماه اخیر')

 const topCourses = [...courses].sort((a, b) => b.students - a.students).slice(0, 5)
 const topTeachers = [...teachers].sort((a, b) => b.students - a.students).slice(0, 5)
 const topProducts = [...products].sort((a, b) => b.rating - a.rating).slice(0, 5)
 const avgStudy = Math.round(studyLogs.reduce((a, d) => a + d.minutes, 0) / studyLogs.length)

 const exportBtn = (label) => (
 <button className="btn btn-ghost btn-sm" onClick={() => toast(`خروجی ${label} آماده شد (دمو)`)}>
 <Icon name="download" size={14} /> اکسل
 </button>
 )

 return (
 <div>
 <div className="between wrap mb24">
 <div>
 <h2 style={{ fontSize: 17 }}>گزارش‌های تحلیلی</h2>
 <span className="muted small">روند فروش، عملکرد مدرسان، تعامل دانشجوها و پرفروش‌ها</span>
 </div>
 <select className="select" style={{ width: 'auto' }} value={period} onChange={(e) => setPeriod(e.target.value)}>
 {['۳ ماه اخیر', '۶ ماه اخیر', '۱۲ ماه اخیر'].map((p) => <option key={p}>{p}</option>)}
 </select>
 </div>

 <div className="chart-grid">
 <div className="card chart-card">
 <div className="between">
 <div><h3>روند فروش دوره‌ها (میلیون)</h3><div className="chart-sub">{period}</div></div>
 {exportBtn('فروش')}
 </div>
 <LineChart data={salesSeries} color="#2dd4bf" color2="#38bdf8" />
 </div>
 <div className="card chart-card">
 <h3>سهم دسته‌بندی‌ها</h3>
 <div className="chart-sub">از کل فروش</div>
 <Donut data={catShare} />
 </div>
 </div>

 <div className="chart-grid">
 <div className="card chart-card">
 <h3>سفارش‌های هفته</h3>
 <div className="chart-sub">دوره + کلاس زنده + مدرس‌مارکت</div>
 <BarChart data={weekSales} color="#fbbf24" height={200} />
 </div>
 <div className="card chart-card">
 <h3>شاخص‌های کلیدی آموزش</h3>
 <div className="chart-sub">سلامت پلتفرم از نگاه داده</div>
 <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
 {[
 ['میانگین مطالعه روزانه دانشجوها', `${faNum(avgStudy)} دقیقه`, 68],
 ['نرخ تکمیل دوره‌ها', '۵۴٪', 54],
 ['رضایت از کلاس‌های زنده', '۹۸٪', 98],
 ['نرخ تمدید خرید', '۴۱٪', 41],
 ].map(([label, val, w]) => (
 <div key={label}>
 <div className="between small mb8"><b>{label}</b><span className="text-teal">{val}</span></div>
 <div className="progress"><i style={{ width: `${w}%` }} /></div>
 </div>
 ))}
 </div>
 </div>
 </div>

 <div className="grids g3">
 <div className="card pad">
 <div className="between mb16"><h3 style={{ fontSize: 14.5 }}> پرفروش‌ترین دوره‌ها</h3>{exportBtn('دوره‌ها')}</div>
 {topCourses.map((c, i) => (
 <div className="between mb16" key={c.id} style={{ borderBottom: '1px solid var(--line2)', paddingBottom: 10 }}>
 <span className="row g8 small"><b className="text-amber">{faNum(i + 1)}</b> <DataIcon name={c.icon} size={15} /> {c.title.slice(0, 26)}…</span>
 <span className="badge b-gray">{faNum(c.students.toLocaleString('fa-IR'))}</span>
 </div>
 ))}
 </div>
 <div className="card pad">
 <div className="between mb16"><h3 style={{ fontSize: 14.5 }}> برترین مدرسان</h3>{exportBtn('مدرسان')}</div>
 {topTeachers.map((t, i) => (
 <div className="between mb16" key={t.id} style={{ borderBottom: '1px solid var(--line2)', paddingBottom: 10 }}>
 <span className="row g8 small"><b className="text-amber">{faNum(i + 1)}</b> {t.name}</span>
 <span className="badge b-gray">{faNum(t.students.toLocaleString('fa-IR'))} دانشجو</span>
 </div>
 ))}
 </div>
 <div className="card pad">
 <div className="between mb16"><h3 style={{ fontSize: 14.5 }}> پرفروش‌های مدرس‌مارکت</h3>{exportBtn('محصولات')}</div>
 {topProducts.map((p, i) => (
 <div className="between mb16" key={p.id} style={{ borderBottom: '1px solid var(--line2)', paddingBottom: 10 }}>
 <span className="row g8 small"><b className="text-amber">{faNum(i + 1)}</b> <DataIcon name={p.icon} size={15} /> {p.name.slice(0, 24)}…</span>
 <span className="badge b-amber"><Icon name="star" size={11} filled /> {faNum(p.rating)}</span>
 </div>
 ))}
 </div>
 </div>
 </div>
 )
}
