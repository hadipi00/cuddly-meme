import { useEffect, useState } from 'react'
import {
  PackagePlus, Truck, Printer, X, Plus, Minus, Eye, PackageCheck, AlertTriangle,
  ClipboardList, Boxes, TrendingUp, PackageSearch,
} from 'lucide-react'
import DataTable from '../../components/DataTable'
import { FormModal } from '../../components/Modal'
import { marketCats } from '../../data/mock'
import { useApp } from '../../store/AppContext'
import { faNum, toman } from '../../utils/format'
import { DataIcon } from '../../utils/icons'
import { Badge } from '../../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../../components/ui/dialog'
import { Button } from '../../components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../../components/ui/tabs'
import { req } from '../../services/http'

const SHIP_METHODS = ['پیش‌کرایه', 'پس‌کرایه', 'پیک فوری تهران']
const ORDER_STATUS = {
  pending: ['در انتظار پرداخت', 'b-amber'],
  processing: ['در حال پردازش', 'b-amber'],
  shipped: ['ارسال شده', 'b-sky'],
  delivered: ['تحویل شده', 'b-green'],
  canceled: ['لغو شده', 'b-red'],
}

export default function AMarket() {
  const { toast } = useApp()
  const [modal, setModal] = useState(null)
  const [list, setList] = useState([])
  const [detail, setDetail] = useState(null)
  const [orders, setOrders] = useState([])
  const [saving, setSaving] = useState(false)

  /* [فیکس F16-b] محصولات و سفارش‌های فروشگاه واقعی — قبلاً دادهٔ mock ثابت بود؛
     تغییر وضعیت سفارش/موجودی با هر رفرش پریده و خریدار واقعی هیچ‌وقت دیده نمی‌شد */
  const load = async () => {
    try {
      const p = await req('/admin/products')
      setList(p.products || [])
    } catch (e) { toast(e.message || 'دریافت محصولات ناموفق بود', 'error') }
    try {
      const o = await req('/admin/market-orders')
      setOrders((o.orders || []).map((r) => ({ ...r, ship: r.ship || SHIP_METHODS[0] })))
    } catch { /* سفارش خالی مجاز است */ }
  }
  useEffect(() => { load() }, [])

  const save = async (d) => {
    setSaving(true)
    try {
      if (modal === 'new') {
        const r = await req('/admin/products', {
          method: 'POST',
          body: { name: d.name, cat: d.cat, price: Number(d.price) || 0, stock: Number(d.stock) || 0, desc: d.desc || '' },
        })
        setList((l) => [r.product, ...l])
        toast('محصول جدید در دیتابیس ثبت شد')
      } else {
        const r = await req(`/admin/products/${modal.id}`, {
          method: 'PATCH',
          body: { name: d.name, cat: d.cat, price: Number(d.price) || 0, stock: Number(d.stock) || 0, desc: d.desc || '' },
        })
        setList((l) => l.map((p) => (p.id === modal.id ? r.product : p)))
        toast('محصول در دیتابیس به‌روزرسانی شد')
      }
      setModal(null)
    } catch (e) { toast(e.message || 'ذخیره ناموفق بود', 'error') }
    finally { setSaving(false) }
  }

  /* تغییر وضعیت/روش ارسال — واقعی روی orders (kind=market) */
  const patchOrder = async (o, patch) => {
    setOrders((os) => os.map((x) => (x.id === o.id ? { ...x, ...patch } : x)))
    try {
      await req(`/admin/market-orders/${encodeURIComponent(o.id)}`, { method: 'POST', body: patch })
      if (patch.status) toast(`سفارش ${o.id} → ${ORDER_STATUS[patch.status][0]}`, patch.status === 'canceled' ? 'info' : 'success')
      else if (patch.ship) toast(`روش ارسال سفارش ${o.id} → ${patch.ship}`)
    } catch (e) {
      toast(e.message || 'ثبت تغییر ناموفق بود', 'error')
      load() // برگشت به وضعیت واقعی سرور
    }
  }
  const setStatus = (o, status) => { if (status !== o.status) patchOrder(o, { status }) }
  const setShip = (o, ship) => { if (ship !== o.ship) patchOrder(o, { ship }) }

  /* موجودی واقعی — PATCH /admin/products/:id */
  const bumpStock = async (p, delta) => {
    const next = Math.max(0, p.stock + delta)
    setList((l) => l.map((x) => (x.id === p.id ? { ...x, stock: next } : x)))
    try { await req(`/admin/products/${encodeURIComponent(p.id)}`, { method: 'PATCH', body: { stock: next } }) }
    catch (e) { toast(e.message || 'ثبت موجودی ناموفق بود', 'error'); load() }
  }

  const removeProduct = async (p) => {
    if (!window.confirm(`محصول «${p.name}» حذف شود؟`)) return
    try {
      await req(`/admin/products/${encodeURIComponent(p.id)}`, { method: 'DELETE' })
      setList((l) => l.filter((x) => x.id !== p.id))
      toast('محصول از دیتابیس حذف شد', 'info')
    } catch (e) { toast(e.message || 'حذف ناموفق بود', 'error') }
  }

  const revenue = orders.filter((o) => o.status !== 'canceled').reduce((a, o) => a + (o.total || 0), 0)

  return (
    <div>
      <div className="between wrap mb16">
        <div>
          <h2 style={{ fontSize: 17 }}>مدیریت مدرس‌مارکت</h2>
          <span className="muted small">فروشگاه لوازم‌التحریر — محصولات، موجودی، سفارش‌ها و روش ارسال</span>
        </div>
      </div>

      <div className="stat-cards" style={{ marginBottom: 22 }}>
        <div className="card stat-card">
          <span className="sc-icon teal"><Boxes size={18} /></span>
          <b className="sc-val">{faNum(list.length)}</b><span className="sc-label">کالای فعال</span>
        </div>
        <div className="card stat-card">
          <span className="sc-icon amber"><AlertTriangle size={18} /></span>
          <b className="sc-val text-amber">{faNum(list.filter((p) => p.stock < 20).length)}</b><span className="sc-label">موجودی رو به اتمام</span>
        </div>
        <div className="card stat-card">
          <span className="sc-icon sky"><ClipboardList size={18} /></span>
          <b className="sc-val">{faNum(orders.filter((o) => o.status === 'processing').length)}</b><span className="sc-label">در انتظار ارسال</span>
        </div>
        <div className="card stat-card">
          <span className="sc-icon green"><TrendingUp size={18} /></span>
          <b className="sc-val">{toman(revenue)}</b><span className="sc-label">درآمد فروشگاه</span>
        </div>
      </div>

      <Tabs defaultValue="orders" dir="rtl">
        <TabsList>
          <TabsTrigger value="orders"><ClipboardList size={15} /> سفارش‌ها ({faNum(orders.length)})</TabsTrigger>
          <TabsTrigger value="products"><PackagePlus size={15} /> محصولات ({faNum(list.length)})</TabsTrigger>
        </TabsList>

        {/* ---------- سفارش‌ها ---------- */}
        <TabsContent value="orders">
          <div className="card pad">
            <DataTable
              columns={[
                { key: 'id', label: 'کد سفارش', render: (r) => <span className="cell-strong" dir="ltr" style={{ textAlign: 'right' }}>{r.id}</span> },
                { key: 'user', label: 'مشتری' },
                { key: 'items', label: 'اقلام', render: (r) => <span className="muted small">{r.items}</span> },
                { key: 'total', label: 'مبلغ', render: (r) => toman(r.total) },
                { key: 'ship', label: 'روش ارسال', render: (r) => (
                  <Select value={r.ship} onValueChange={(v) => setShip(r, v)}>
                    <SelectTrigger className="h-8 w-[130px] text-[12px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SHIP_METHODS.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) },
                { key: 'status', label: 'وضعیت', render: (r) => (
                  <Select value={r.status} onValueChange={(v) => setStatus(r, v)}>
                    <SelectTrigger className={`h-8 w-[120px] text-[12px] ${r.status === 'canceled' ? 'text-[var(--red)]' : r.status === 'delivered' ? 'text-[var(--green)]' : ''}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ORDER_STATUS).map(([k, [label]]) => <SelectItem key={k} value={k}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) },
              ]}
              rows={orders}
              searchKeys={['id', 'user', 'items']}
              filters={[{ key: 'status', label: 'وضعیت', options: Object.values(ORDER_STATUS).map((x) => x[0]), match: (r, v) => ORDER_STATUS[r.status][0] === v }]}
              actions={(r) => (
                <>
                  <button className="icon-btn" title="جزئیات سفارش" onClick={() => setDetail(r)}><Eye size={16} /></button>
                  <button className="icon-btn" title="چاپ فاکتور" onClick={() => toast('فاکتور چاپ شد (دمو)')}><Printer size={16} /></button>
                  {r.status !== 'canceled' && r.status !== 'delivered' && (
                    <button className="icon-btn" title="لغو سفارش" onClick={() => setStatus(r, 'canceled')}>
                      <X size={16} />
                    </button>
                  )}
                </>
              )}
            />
          </div>
        </TabsContent>

        {/* ---------- محصولات ---------- */}
        <TabsContent value="products">
          <div className="card pad">
            <DataTable
              columns={[
                { key: 'name', label: 'محصول', render: (r) => (
                  <div className="cell-user">
                    <span className={`avatar ${r.color}`} style={{ width: 36, height: 36, borderRadius: 10 }}>
                      <DataIcon name={r.icon} size={18} />
                    </span>
                    <div><span className="cell-strong">{r.name}</span><span className="muted small" style={{ display: 'block' }}>{r.cat}</span></div>
                  </div>
                ) },
                { key: 'price', label: 'قیمت', render: (r) => toman(r.price) },
                { key: 'sold', label: 'فروش', render: (r) => <span className="badge b-sky">{faNum(r.sold || 0)} عدد</span> },
                { key: 'stock', label: 'موجودی', render: (r) => (
                  <div className="row g8" style={{ justifyContent: 'flex-start' }}>
                    <div className="qty-stepper">
                      <button onClick={() => bumpStock(r, +1)} aria-label="افزودن موجودی"><Plus size={12} /></button>
                      <b>{faNum(r.stock)}</b>
                      <button onClick={() => bumpStock(r, -1)} aria-label="کاهش موجودی"><Minus size={12} /></button>
                    </div>
                    {r.stock === 0
                      ? <Badge variant="red">ناموجود</Badge>
                      : r.stock < 20 ? <Badge variant="amber">رو به اتمام</Badge> : <Badge variant="green">موجود</Badge>}
                  </div>
                ) },
              ]}
              rows={list}
              searchKeys={['name', 'cat']}
              filters={[{ key: 'cat', label: 'دسته', options: marketCats }]}
              onAdd={() => setModal('new')}
              addLabel="محصول جدید"
              actions={(r) => (
                <>
                  <button className="icon-btn" title="ویرایش" onClick={() => setModal(r)}><PackageSearch size={16} /></button>
                  <button className="icon-btn" title="+۵۰ موجودی" onClick={() => bumpStock(r, 50)}><Plus size={16} /></button>
                  <button className="icon-btn" title="حذف" onClick={() => removeProduct(r)}>
                    <X size={16} />
                  </button>
                </>
              )}
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* جزئیات سفارش */}
      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent>
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="row g8"><PackageCheck size={17} /> سفارش {detail.id}</DialogTitle>
                <DialogDescription>{detail.user} — {detail.date}</DialogDescription>
              </DialogHeader>
              <table className="dtable" style={{ minWidth: 'auto' }}>
                <tbody>
                  {[['اقلام', detail.items], ['مبلغ کل', toman(detail.total)],
                   ['روش ارسال', detail.ship], ['وضعیت', ORDER_STATUS[detail.status][0]],
                   ['آدرس مقصد', detail.addr]].map(([k, v]) => (
                    <tr key={k}><td className="muted" style={{ width: 110 }}>{k}</td><td className="cell-strong">{v}</td></tr>
                  ))}
                </tbody>
              </table>
              <div className="row g8">
                <Button
                  className="flex-1"
                  disabled={detail.status !== 'processing' && detail.status !== 'pending'}
                  onClick={() => { setStatus(detail, 'shipped'); setDetail(null) }}
                >
                  <Truck size={15} /> ثبت و ارسال سفارش
                </Button>
                <Button variant="secondary" onClick={() => setDetail(null)}>بستن</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <FormModal
        open={!!modal}
        title={modal === 'new' ? 'افزودن محصول جدید' : 'ویرایش محصول'}
        onClose={() => setModal(null)}
        onSubmit={save}
        submitLabel={saving ? 'در حال ذخیره…' : 'ذخیره'}
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
