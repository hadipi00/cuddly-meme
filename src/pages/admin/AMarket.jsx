import { useState } from 'react'
import Icon from '../../components/Icon'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { products, marketCats, marketOrders } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum, toman } from '../../utils/format'

const orderBadge = { processing: ['در حال پردازش', 'b-amber'], shipped: ['ارسال شده', 'b-sky'], delivered: ['تحویل شده', 'b-green'], canceled: ['لغو شده', 'b-red'] }

export default function AMarket() {
  const { toast } = useApp()
  const [tab, setTab] = useState('products')
  const [modal, setModal] = useState(null)
  const [list, setList] = useState(products)
  const [orders, setOrders] = useState(marketOrders)

  const save = (d) => {
    if (modal === 'new') {
      setList((l) => [{ id: 'm' + Date.now(), rating: 5, stock: Number(d.stock) || 10, emoji: '🆕', color: 'grad-0', ...d }, ...l])
      toast('محصول جدید به مدرس‌مارکت اضافه شد ✅')
    } else {
      setList((l) => l.map((p) => (p.id === modal.id ? { ...p, ...d } : p)))
      toast('محصول به‌روزرسانی شد')
    }
    setModal(null)
  }

  const advance = (o) => {
    const flow = { processing: 'shipped', shipped: 'delivered' }
    const next = flow[o.status]
    if (!next) return
    setOrders((os) => os.map((x) => (x.id === o.id ? { ...x, status: next } : x)))
    toast(`سفارش ${o.id} → ${orderBadge[next][0]}`)
  }

  return (
    <div>
      <div className="between wrap mb16">
        <div>
          <h2 style={{ fontSize: 17 }}>مدیریت مدرس‌مارکت</h2>
          <span className="muted small">فروشگاه لوازم‌التحریر — محصولات، موجودی و سفارش‌ها</span>
        </div>
      </div>

      <div className="stat-cards" style={{ marginBottom: 22 }}>
        <div className="card stat-card"><b className="sc-val">{faNum(list.length)}</b><span className="sc-label">محصول فعال</span></div>
        <div className="card stat-card"><b className="sc-val text-amber">{faNum(list.filter((p) => p.stock < 20).length)}</b><span className="sc-label">موجودی رو به اتمام ⚠️</span></div>
        <div className="card stat-card"><b className="sc-val">{faNum(orders.length)}</b><span className="sc-label">سفارش اخیر</span></div>
        <div className="card stat-card"><b className="sc-val">{toman(orders.filter((o) => o.status !== 'canceled').reduce((a, o) => a + o.total, 0))}</b><span className="sc-label">درآمد فروشگاه</span></div>
      </div>

      <div className="tabs">
        <button className={`tab ${tab === 'products' ? 'on' : ''}`} onClick={() => setTab('products')}>📦 محصولات ({faNum(list.length)})</button>
        <button className={`tab ${tab === 'orders' ? 'on' : ''}`} onClick={() => setTab('orders')}>🚚 سفارش‌ها ({faNum(orders.length)})</button>
      </div>

      {tab === 'products' ? (
        <div className="card pad">
          <DataTable
            columns={[
              { key: 'name', label: 'محصول', render: (r) => (
                <div className="cell-user">
                  <span className={`avatar ${r.color}`} style={{ width: 36, height: 36, borderRadius: 10, fontSize: 18 }}>{r.emoji}</span>
                  <div><span className="cell-strong">{r.name}</span><span className="muted small" style={{ display: 'block' }}>{r.cat}</span></div>
                </div>
              ) },
              { key: 'price', label: 'قیمت', render: (r) => toman(r.price) },
              { key: 'rating', label: 'امتیاز', render: (r) => <span className="badge b-amber"><Icon name="star" size={12} filled /> {faNum(r.rating)}</span> },
              { key: 'stock', label: 'موجودی', render: (r) => (
                r.stock < 20
                  ? <span className="badge b-red">{faNum(r.stock)} عدد — رو به اتمام</span>
                  : <span className="badge b-green">{faNum(r.stock)} عدد</span>
              ) },
            ]}
            rows={list}
            searchKeys={['name', 'cat']}
            filters={[{ key: 'cat', label: 'دسته', options: marketCats }]}
            onAdd={() => setModal('new')}
            addLabel="محصول جدید"
            actions={(r) => (
              <>
                <button className="icon-btn" title="ویرایش" onClick={() => setModal(r)}><Icon name="edit" /></button>
                <button className="icon-btn" title="افزودن موجودی" onClick={() => { setList((l) => l.map((p) => (p.id === r.id ? { ...p, stock: p.stock + 50 } : p))); toast('۵۰ عدد به موجودی اضافه شد') }}><Icon name="plus" /></button>
                <button className="icon-btn" title="حذف" onClick={() => { setList((l) => l.filter((p) => p.id !== r.id)); toast('محصول حذف شد', 'info') }}><Icon name="trash" /></button>
              </>
            )}
          />
        </div>
      ) : (
        <div className="card pad">
          <DataTable
            columns={[
              { key: 'id', label: 'کد سفارش', render: (r) => <span className="cell-strong" dir="ltr" style={{ textAlign: 'right' }}>{r.id}</span> },
              { key: 'user', label: 'مشتری' },
              { key: 'items', label: 'اقلام', render: (r) => <span className="muted small">{r.items}</span> },
              { key: 'total', label: 'مبلغ', render: (r) => toman(r.total) },
              { key: 'date', label: 'تاریخ' },
              { key: 'addr', label: 'مقصد', render: (r) => <span className="muted small">{r.addr}</span> },
              { key: 'status', label: 'وضعیت', render: (r) => {
                const [label, cls] = orderBadge[r.status]
                return <span className={`badge ${cls}`}>{label}</span>
              } },
            ]}
            rows={orders}
            searchKeys={['id', 'user', 'items']}
            filters={[{ key: 'status', label: 'وضعیت', options: Object.values(orderBadge).map((x) => x[0]), match: (r, v) => orderBadge[r.status][0] === v }]}
            actions={(r) => (
              <>
                {(r.status === 'processing' || r.status === 'shipped') && (
                  <button className="icon-btn" title={r.status === 'processing' ? 'ارسال شد' : 'تحویل شد'} onClick={() => advance(r)}>
                    <Icon name="truck" />
                  </button>
                )}
                <button className="icon-btn" title="چاپ فاکتور" onClick={() => toast('فاکتور چاپ شد (دمو)')}><Icon name="printer" /></button>
                {r.status !== 'canceled' && r.status !== 'delivered' && (
                  <button className="icon-btn" title="لغو سفارش" onClick={() => { setOrders((os) => os.map((x) => (x.id === r.id ? { ...x, status: 'canceled' } : x))); toast('سفارش لغو شد', 'info') }}>
                    <Icon name="x" />
                  </button>
                )}
              </>
            )}
          />
        </div>
      )}

      <FormModal
        open={!!modal}
        title={modal === 'new' ? 'افزودن محصول جدید' : 'ویرایش محصول'}
        onClose={() => setModal(null)}
        onSubmit={save}
        initial={modal && modal !== 'new' ? { name: modal.name, cat: modal.cat, price: String(modal.price), stock: String(modal.stock) } : {}}
        fields={[
          { key: 'name', label: 'نام محصول', full: true },
          { key: 'cat', label: 'دسته', type: 'select', options: marketCats },
          { key: 'price', label: 'قیمت (تومان)', type: 'number' },
          { key: 'stock', label: 'موجودی', type: 'number' },
          { key: 'desc', label: 'توضیحات', type: 'textarea', required: false },
        ]}
      />
    </div>
  )
}
