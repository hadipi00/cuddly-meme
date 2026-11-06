import { useEffect, useState } from 'react'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { payments, coupons } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { req, authedFetch } from '../../services/http'
import { faNum, toman } from '../../utils/format'

const payBadge = { paid: ['موفق', 'b-green'], pending: ['در انتظار', 'b-amber'], refunded: ['برگشتی', 'b-red'] }
const c2cBadge = {
  review: ['در انتظار تأیید', 'b-amber'], pending: ['بدون رسید', 'b-gray'],
  paid: ['تأیید شده', 'b-green'], rejected: ['رد شده', 'b-red'],
  expired: ['منقضی', 'b-red'], failed: ['ناموفق', 'b-red'],
}

export default function AFinance() {
 const { toast } = useApp()
 const [tab, setTab] = useState('payments')
 const [modal, setModal] = useState(null)
 const [cList, setCList] = useState(coupons)
 const [saving, setSaving] = useState(false)
 const [c2c, setC2c] = useState(null)
 const [c2cBusy, setC2cBusy] = useState(false)
 const [c2cImg, setC2cImg] = useState(null) // { authority, url }

 /* صف رسیدهای کارت‌به‌کارت — واقعی از سرور */
 const loadC2c = () => {
  req('/pay/admin/c2c').then((r) => setC2c(Array.isArray(r.payments) ? r.payments : [])).catch(() => setC2c(null))
 }
 useEffect(() => { loadC2c() }, [])

 const c2cAct = async (authority, action) => {
  if (c2cBusy) return
  if (action === 'approve' && !window.confirm('رسید را تأیید می‌کنید؟ سفارش قطعی می‌شود و دسترسی‌ها فعال می‌شود.')) return
  if (action === 'reject' && !window.confirm('رسید رد شود؟ موجودی برمی‌گردد و سفارش حذف می‌شود.')) return
  setC2cBusy(true)
  try {
   await req(`/pay/admin/c2c/${encodeURIComponent(authority)}/${action}`, { method: 'POST', body: {} })
   toast(action === 'approve' ? 'پرداخت تأیید و سفارش فعال شد' : 'رسید رد شد و موجودی برگشت')
   loadC2c()
  } catch (e) { if (!e.serverDown) toast(e.message || 'عملیات ناموفق بود', 'error') }
  finally { setC2cBusy(false) }
 }

 /* نمایش تصویر رسید — img هدر Authorization نمی‌فرستد → blob با توکن */
 const showReceipt = async (authority) => {
  try {
   const r = await authedFetch(`/pay/admin/c2c/${encodeURIComponent(authority)}/receipt`)
   if (!r.ok) throw new Error('رسید در دسترس نیست')
   const blob = await r.blob()
   setC2cImg({ authority, url: URL.createObjectURL(blob) })
  } catch (e) { toast(e.message || 'نمایش رسید ناموفق بود', 'error') }
 }

 /* [فیکس F15] کوپن‌ها از سرور — قبلاً فقط mock محلی بود و کدِ ساخته‌شده هرگز
    در جدول coupons سرور ثبت نمی‌شد و در پرداخت «نامعتبر» می‌خورد */
 useEffect(() => {
  let alive = true
  req('/admin/coupons').then((r) => {
   if (alive && Array.isArray(r.coupons))
    setCList(r.coupons.map((c) => ({ ...c, id: c.code, type: c.kind === 'amount' ? 'مبلغی' : 'درصدی', value: c.kind === 'amount' ? faNum(c.value) : `${faNum(c.value)}٪`, cap: c.kind === 'amount' ? null : 100, expires: c.expires || '—' })))
  }).catch(() => { /* serverDown → mock */ })
  return () => { alive = false }
 }, [])

 const saveCoupon = async (d) => {
  if (saving) return
  setSaving(true)
  try {
   const kind = d.type === 'مبلغی' ? 'amount' : 'percent'
   const digits = String(d.value || '').replace(/[۰-۹]/g, (x) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(x)).replace(/[^0-9]/g, '')
   const value = Number(digits) || 0
   const r = await req('/admin/coupons', { method: 'POST', body: { code: d.code, kind, value, status: 'active', expires: d.expires || '' } })
   const c = r.coupon
   setCList((l) => [{ id: c.code, code: c.code, type: c.kind === 'amount' ? 'مبلغی' : 'درصدی', value: c.kind === 'amount' ? faNum(c.value) : `${faNum(c.value)}٪`, used: 0, cap: c.kind === 'amount' ? null : 100, expires: c.expires || '—', status: c.status }, ...l])
   setModal(null)
   toast('کد تخفیف ساخته و روی سرور ثبت شد')
  } catch (e) {
   if (!e.serverDown) toast(e.message || 'ساخت کد ناموفق بود', 'error')
  }
  setSaving(false)
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
 <button className={`tab ${tab === 'c2c' ? 'on' : ''}`} onClick={() => setTab('c2c')}>
  رسیدهای کارت‌به‌کارت {c2c ? `(${faNum(c2c.filter((p) => p.status === 'review').length)})` : ''}
 </button>
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
 <button className="icon-btn" title={r.status === 'active' ? 'غیرفعال‌سازی' : 'فعال‌سازی'} onClick={async () => {
  const next = r.status === 'active' ? 'inactive' : 'active'
  try {
   const digits = String(r.value || '').replace(/[۰-۹]/g, (x) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(x)).replace(/[^0-9]/g, '')
   await req('/admin/coupons', { method: 'POST', body: { code: r.code, kind: r.type === 'مبلغی' ? 'amount' : 'percent', value: Number(digits) || 0, status: next, expires: r.expires && r.expires !== '—' ? r.expires : '' } })
   setCList((l) => l.map((c) => (c.id === r.id ? { ...c, status: next } : c)))
   toast(next === 'active' ? 'کد فعال شد' : 'کد غیرفعال شد', 'info')
  } catch (e) { if (!e.serverDown) toast(e.message || 'تغییر وضعیت ناموفق بود', 'error') }
 }}><Icon name={r.status === 'active' ? 'x' : 'check'} /></button>
 <button className="icon-btn" title="کپی کد" onClick={() => { try { navigator.clipboard?.writeText(r.code); toast('کد کپی شد') } catch { toast('کد: ' + r.code, 'info') } }}><Icon name="file" /></button>
 <button className="icon-btn" title="حذف" onClick={async () => {
  try {
   await req(`/admin/coupons/${encodeURIComponent(r.code)}`, { method: 'DELETE' })
   setCList((l) => l.filter((c) => c.id !== r.id))
   toast('کد حذف شد', 'info')
  } catch (e) { if (!e.serverDown) toast(e.message || 'حذف ناموفق بود', 'error') }
 }}><Icon name="trash" /></button>
 </>
 )}
 />
 </div>
 )}

 {tab === 'c2c' && (
 <div className="card pad">
 <div className="between mb16 wrap">
  <h3 style={{ fontSize: 15 }}>رسیدهای کارت‌به‌کارت — تأیید/رد واریزهای دستی</h3>
  <button className="btn btn-ghost btn-sm" onClick={loadC2c}>بروزرسانی</button>
 </div>
 {!c2c ? (
  <p className="muted small">لیست از سرور دریافت نشد (فقط مدیر) — یا خطای اتصال.</p>
 ) : c2c.length === 0 ? (
  <p className="muted small">هنوز سفارش کارت‌به‌کارتی ثبت نشده است.</p>
 ) : (
 <div className="dtable-wrap">
 <table className="dtable">
 <thead><tr><th>کد سفارش</th><th>خریدار</th><th>اقلام</th><th>مبلغ</th><th>وضعیت</th><th>رسید</th><th>اقدام</th></tr></thead>
 <tbody>
 {c2c.map((p) => {
  const [label, cls] = c2cBadge[p.status] || c2cBadge.pending
  return (
  <tr key={p.authority}>
  <td className="cell-strong" dir="ltr" style={{ textAlign: 'right' }}>{p.code}</td>
  <td className="small">{p.userName}{p.userPhone && <div className="muted" dir="ltr">{p.userPhone}</div>}</td>
  <td className="muted small" style={{ maxWidth: 220 }}>{p.items}</td>
  <td className="cell-strong">{toman(p.amount)}</td>
  <td><span className={`badge ${cls}`}>{label}</span></td>
  <td>
   {p.hasReceipt
   ? <button className="btn btn-ghost btn-sm" onClick={() => showReceipt(p.authority)}>مشاهده</button>
   : <span className="muted small">—</span>}
  </td>
  <td>
   {(p.status === 'review' || p.status === 'pending') ? (
   <div className="row g8">
   <button className="btn btn-primary btn-sm" disabled={c2cBusy || !p.hasReceipt}
    title={p.hasReceipt ? '' : 'اول باید رسید آپلود شود'}
    onClick={() => c2cAct(p.authority, 'approve')}>تأیید</button>
   <button className="btn btn-ghost btn-sm" disabled={c2cBusy} onClick={() => c2cAct(p.authority, 'reject')}>رد</button>
   </div>
   ) : p.refId ? <span className="muted small" dir="ltr">{p.refId}</span> : <span className="muted small">—</span>}
  </td>
  </tr>
  )
 })}
 </tbody>
 </table>
 </div>
 )}
 {c2cImg && (
 <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 60, display: 'grid', placeItems: 'center', padding: 24 }} onClick={() => setC2cImg(null)}>
  <div className="card pad" style={{ maxWidth: 560, maxHeight: '86vh', overflow: 'auto' }} onClick={(e) => e.stopPropagation()}>
  <div className="between mb12">
  <b className="small">رسید سفارش <span dir="ltr">{c2cImg.authority.replace('C2C-', 'ORD-')}</span></b>
  <button className="btn btn-ghost btn-sm" onClick={() => setC2cImg(null)}>بستن</button>
  </div>
  <img src={c2cImg.url} alt="رسید کارت‌به‌کارت" style={{ maxWidth: '100%', borderRadius: 10 }} />
  </div>
 </div>
 )}
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
