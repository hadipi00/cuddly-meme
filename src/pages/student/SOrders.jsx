import Icon from '../../components/Icon'
import { myOrders, myCourses, courses } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum, toman } from '../../utils/format'

const statusMap = { paid: ['پرداخت شده', 'b-green'], pending: ['در انتظار پرداخت', 'b-amber'], shipped: ['ارسال شده', 'b-sky'], delivered: ['تحویل شده', 'b-green'], canceled: ['لغو شده', 'b-red'] }

export default function SOrders() {
  const { orders: ctxOrders } = useApp()
  const all = [...(ctxOrders || []), ...myOrders]
  return (
    <div>
      <div className="between wrap mb24">
        <div>
          <h2 style={{ fontSize: 17 }}>سفارش‌ها و پرداخت‌های من</h2>
          <span className="muted small">خرید دوره‌ها، کلاس‌های زنده و سفارش‌های مدرس‌مارکت</span>
        </div>
      </div>

      <div className="dtable-wrap mb24">
        <table className="dtable">
          <thead><tr><th>کد سفارش</th><th>اقلام</th><th>مبلغ</th><th>تاریخ</th><th>وضعیت</th><th>فاکتور</th></tr></thead>
          <tbody>
            {all.map((o) => {
              const [label, cls] = statusMap[o.status] || statusMap.paid
              return (
                <tr key={o.code}>
                  <td className="cell-strong" dir="ltr" style={{ textAlign: 'right' }}>{o.code}</td>
                  <td className="muted">{o.items}</td>
                  <td className="cell-strong">{toman(o.total)}</td>
                  <td className="muted">{o.date}</td>
                  <td><span className={`badge ${cls}`}>{label}</span></td>
                  <td><button className="icon-btn" style={{ width: 31, height: 31 }} title="دانلود فاکتور"><Icon name="download" size={15} /></button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="card pad">
        <h3 className="mb16">دوره‌های فعال من</h3>
        {myCourses.map((mc) => {
          const c = courses.find((x) => x.id === mc.courseId)
          return (
            <div className="between mb16" key={mc.courseId} style={{ borderBottom: '1px solid var(--line2)', paddingBottom: 12 }}>
              <span className="row g8 small"><b>{c.emoji} {c.title}</b><span className="muted">— {c.price ? toman(c.price) : 'رایگان'}</span></span>
              <span className="badge b-teal">دسترسی فعال</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
