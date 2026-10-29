import { useState } from 'react'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { payments, coupons } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum, toman } from '../../utils/format'

const payBadge = { paid: ['موفق', 'b-green'], pending: ['در انتظار', 'b-amber'], refunded: ['برگشتی', 'b-red'] }

export default function AFinance() {
 const { toast } = useApp()
 const [tab, setTab] = useState('payments')
 const [modal, setModal] = useState(null)
 const [cList, setCList] = useState(coupons)

 const saveCoupon = (d) => {
 setCList((l) => [{ id: 'c' + Date.now(), type: d.type, value: d.value, used: 0, cap: Number(d.cap) || 100, expires: d.expires || '—', status: 'active', ...d, code: d.code.toUpperCase() }, ...l])
 setModal(null)
 toast('کد تخفیف ساخته شد ')
 }

 return (
 <div>
 <div className="between wrap mb16">
 <div>
 <h2 style={{ fontSize: 17 }}>مدیریت مالی</h2>
 <span className="muted small">تراکنش‌ها، کدهای تخفیف و تسویه حساب مدرسان</span>
 </div>
 </div>

 <div className="stat-cards" style={{ marginBottom: 22 }}>
 <div className="card stat-card"><b className="sc-val">{toman(184000000)}</b><span className="sc-label">درآمد امروز (دمو)</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(4821)}</b><span className="sc-label">تراکنش موفق این ماه</span></div>
 <div className="card stat-card"><b className="sc-val text-red">{toman(1980000)}</b><span className="sc-label">مبلغ برگشتی</span></div>
 <div className="card stat-card"><b className="sc-val">{faNum(1)}</b><span className="sc-label">در انتظار تأیید</span></div>
 </div>

 <div className="tabs">
 <button className={`tab ${tab === 'payments' ? 'on' : ''}`} onClick={() => setTab('payments')}> تراکنش‌ها</button>
 <button className={`tab ${tab === 'coupons' ? 'on' : ''}`} onClick={() => setTab('coupons')}> کدهای تخفیف ({faNum(cList.length)})</button>
 <button className={`tab ${tab === 'payouts' ? 'on' : ''}`} onClick={() => setTab('payouts')}> تسویه مدرسان</button>
 </div>

 {tab === 'payments' && (
 <div className="card pad">
 <DataTable
 columns={[
 { key: 'code', label: 'کد', render: (r) => <span className="cell-strong" dir="ltr" style={{ textAlign: 'right' }}>{r.code}</span> },
 { key: 'user', label: 'کاربر' },
 { key: 'type', label: 'نوع', render: (r) => <span className="badge b-gray">{r.type}</span> },
 { key: 'amount', label: 'مبلغ', render: (r) => toman(r.amount) },
 { key: 'method', label: 'روش پرداخت' },
 { key: 'date', label: 'تاریخ' },
 { key: 'status', label: 'وضعیت', render: (r) => {
 const [label, cls] = payBadge[r.status]
 return <span className={`badge ${cls}`}>{label}</span>
 } },
 ]}
 rows={payments}
 searchKeys={['code', 'user', 'method']}
 filters={[
 { key: 'status', label: 'وضعیت', options: Object.values(payBadge).map((x) => x[0]), match: (r, v) => payBadge[r.status][0] === v },
 { key: 'type', label: 'نوع', options: ['دوره', 'کلاس زنده', 'مدرس‌مارکت'] },
 ]}
 actions={(r) => (
 <>
 <button className="icon-btn" title="جزئیات" onClick={() => toast(`تراکنش ${r.code} — ${toman(r.amount)} از ${r.user}`, 'info')}><Icon name="eye" /></button>
 {r.status === 'paid' && (
 <button className="icon-btn" title="بازگشت وجه" onClick={() => toast(`وجه ${r.code} به ${r.user} برگشت داده شد`, 'info')}><Icon name="refresh" /></button>
 )}
 </>
 )}
 />
 </div>
 )}

 {tab === 'coupons' && (
 <div className="card pad">
 <DataTable
 columns={[
 { key: 'code', label: 'کد', render: (r) => <span className="cell-strong" dir="ltr" style={{ textAlign: 'right' }}>{r.code}</span> },
 { key: 'type', label: 'نوع', render: (r) => <span className="badge b-gray">{r.type}</span> },
 { key: 'value', label: 'مقدار' },
 { key: 'used', label: 'استفاده', render: (r) => <span className="muted small">{faNum(r.used)} / {faNum(r.cap)}</span> },
 { key: 'expires', label: 'انقضا' },
 { key: 'status', label: 'وضعیت', render: (r) => (
 r.status === 'active' ? <span className="status-dot green"><i />فعال</span>
 : r.status === 'expired' ? <span className="status-dot red"><i />منقضی</span>
 : <span className="status-dot gray"><i />غیرفعال</span>
 ) },
 ]}
 rows={cList}
 searchKeys={['code']}
 onAdd={() => setModal('new')}
 addLabel="کد تخفیف جدید"
 actions={(r) => (
 <>
 <button className="icon-btn" title={r.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'} onClick={() => {
 setCList((l) => l.map((c) => (c.id === r.id ? { ...c, status: c.status === 'active' ? 'inactive' : 'active' } : c)))
 toast(r.status === 'active' ? 'کد غیرفعال شد' : 'کد فعال شد', 'info')
 }}><Icon name={r.status === 'active' ? 'x' : 'check'} /></button>
 <button className="icon-btn" title="کپی لینک" onClick={() => toast('کد کپی شد')}><Icon name="file" /></button>
 <button className="icon-btn" title="حذف" onClick={() => { setCList((l) => l.filter((c) => c.id !== r.id)); toast('کد حذف شد', 'info') }}><Icon name="trash" /></button>
 </>
 )}
 />
 </div>
 )}

 {tab === 'payouts' && (
 <div className="card pad">
 <h3 className="mb16" style={{ fontSize: 15 }}>درخواست‌های تسویه مدرسان</h3>
 <div className="dtable-wrap">
 <table className="dtable">
 <thead><tr><th>مدرس</th><th>دوره</th><th>مبلغ (سهم مدرس)</th><th>وضعیت</th><th>اقدام</th></tr></thead>
 <tbody>
 {[
 ['رضا کریمی', 'آبان ۱۴۰۴', 66500000, 'pending'],
 ['حسین موسوی', 'آبان ۱۴۰۴', 43200000, 'pending'],
 ['مریم احمدی', 'مهر ۱۴۰۴', 38000000, 'paid'],
 ['علی نادری', 'مهر ۱۴۰۴', 29000000, 'paid'],
 ].map(([name, period, amount, st]) => (
 <tr key={name + period}>
 <td className="cell-strong">{name}</td>
 <td className="muted">{period}</td>
 <td>{toman(amount)}</td>
 <td>{st === 'pending' ? <span className="badge b-amber">در انتظار تأیید</span> : <span className="badge b-green">واریز شد</span>}</td>
 <td>
 {st === 'pending' ? (
 <button className="btn btn-primary btn-sm" onClick={() => toast(`تسویه ${name} تأیید شد و به حسابش واریز شد `)}>
 تأیید و واریز
 </button>
 ) : <span className="muted small">—</span>}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 <FormModal
 open={!!modal}
 title="ساخت کد تخفیف جدید"
 onClose={() => setModal(null)}
 onSubmit={saveCoupon}
 fields={[
 { key: 'code', label: 'کد (انگلیسی)', placeholder: 'مثلاً NOWRUZ40' },
 { key: 'type', label: 'نوع', type: 'select', options: ['درصدی', 'مبلغی'] },
 { key: 'value', label: 'مقدار (٪ یا تومان)' },
 { key: 'cap', label: 'سقف استفاده', type: 'number' },
 { key: 'expires', label: 'تاریخ انقضا', type: 'date', required: false },
 ]}
 />
 </div>
 )
}
