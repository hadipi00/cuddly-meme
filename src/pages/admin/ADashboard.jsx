import { Link } from 'react-router-dom'
import Icon from '../../components/Icon'
import { StatCard } from '../../components/PanelLayout'
import { LineChart, BarChart, Donut, Spark } from '../../components/Charts'
import { salesSeries, weekSales, catShare, payments } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum, toman } from '../../utils/format'

export default function ADashboard() {
 const { toast } = useApp()
 const totalSales = salesSeries.reduce((a, d) => a + d.value, 0)
 return (
 <div>
 <div className="stat-cards">
 <StatCard icon="wallet" color="teal" label="فروش امروز (میلیون)" value={faNum(26)} trend={14}
 spark={<Spark points={weekSales.map((d) => d.value)} color="#2dd4bf" />} />
 <StatCard icon="users" color="sky" label="دانشجوی فعال" value={`${faNum(12000)}+`} trend={7} />
 <StatCard icon="book" color="violet" label="فروش دوره این ماه" value={faNum(312)} trend={22} />
 <StatCard icon="box" color="amber" label="سفارش مدرس‌مارکت" value={faNum(148)} trend={9} />
 </div>

 <div className="chart-grid">
 <div className="card chart-card">
 <div className="between">
 <div>
 <h3>فروش ۱۲ ماه گذشته (میلیون تومان)</h3>
 <div className="chart-sub">مجموع سال: {faNum(totalSales)} میلیون تومان</div>
 </div>
 <button className="btn btn-ghost btn-sm" onClick={() => toast('فایل خروجی اکسل آماده شد (دمو)')}>
 <Icon name="download" size={14} /> خروجی
 </button>
 </div>
 <LineChart data={salesSeries} color="#2dd4bf" color2="#38bdf8" />
 </div>
 <div className="card chart-card">
 <h3>سهم دسته‌بندی‌ها</h3>
 <div className="chart-sub">از کل فروش دوره‌ها</div>
 <Donut data={catShare} />
 </div>
 </div>

 <div className="chart-grid" style={{ gridTemplateColumns: '1fr 1.7fr' }}>
 <div className="card chart-card">
 <h3>فروش هفته جاری</h3>
 <div className="chart-sub">تعداد سفارش در روز</div>
 <BarChart data={weekSales} color="#a78bfa" height={200} />
 </div>
 <div className="card chart-card">
 <div className="between mb16">
 <h3>آخرین تراکنش‌ها</h3>
 <Link to="/panel/admin/finance" className="btn btn-ghost btn-sm">همه تراکنش‌ها</Link>
 </div>
 <div className="dtable-wrap">
 <table className="dtable">
 <thead><tr><th>کد</th><th>کاربر</th><th>مبلغ</th><th>وضعیت</th></tr></thead>
 <tbody>
 {payments.slice(0, 5).map((p) => (
 <tr key={p.id}>
 <td className="cell-strong" dir="ltr" style={{ textAlign: 'right' }}>{p.code}</td>
 <td>{p.user}</td>
 <td>{toman(p.amount)}</td>
 <td>
 {p.status === 'paid' && <span className="badge b-green">موفق</span>}
 {p.status === 'pending' && <span className="badge b-amber">در انتظار</span>}
 {p.status === 'refunded' && <span className="badge b-red">برگشتی</span>}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 </div>

 <div className="card pad">
 <h3 className="mb16">اقدامات سریع مدیریتی</h3>
 <div className="grids g4">
 {[
 { to: '/panel/admin/teachers', icon: 'user', t: 'ساخت اکانت مدرس', d: 'ایجاد دسترسی برای مدرس جدید' },
 { to: '/panel/admin/courses', icon: 'book', t: 'افزودن دوره', d: 'ثبت دوره جدید در فروشگاه' },
 { to: '/panel/admin/classes', icon: 'calendar', t: 'زمان‌بندی کلاس', d: 'ثبت جلسه زنده در جدول هفتگی' },
 { to: '/panel/admin/finance', icon: 'tag', t: 'ساخت کد تخفیف', d: 'کمپین فروش جدید' },
 ].map((x) => (
 <Link key={x.t} to={x.to}>
 <div className="card pad" style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
 <span className="sc-icon teal" style={{ width: 40, height: 40, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
 <Icon name={x.icon} size={18} />
 </span>
 <div><b className="small">{x.t}</b><p className="muted small">{x.d}</p></div>
 </div>
 </Link>
 ))}
 </div>
 </div>
 </div>
 )
}
