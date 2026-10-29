import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import Seo, { ORIGIN, crumbsJsonLd, storeJsonLd } from '../components/Seo'
import {
  Search, SlidersHorizontal, X, PackageCheck, Store, RotateCcw,
  ChevronRight, ChevronLeft, Minus, Plus, ShoppingCart,
  Truck, BadgeCheck, Undo2, CreditCard,
} from 'lucide-react'
import Icon from '../components/Icon'
import { Reveal, RatingStars } from '../components/ui'
import { ProductCard } from '../components/cards'
import { products, marketCats } from '../data/mock'
import { faNum, toman } from '../utils/format'
import { DataIcon } from '../utils/icons'
import { useApp } from '../store/AppContext'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog'

const SORTS = [
  { key: 'best', label: 'پرفروش‌ترین' },
  { key: 'new', label: 'جدیدترین' },
  { key: 'cheap', label: 'ارزان‌ترین' },
  { key: 'expensive', label: 'گران‌ترین' },
  { key: 'rating', label: 'محبوب‌ترین' },
  { key: 'off', label: 'بیشترین تخفیف' },
]

const MAX_PRICE = 1000000
const PER_PAGE = 8

export default function Market() {
  const navigate = useNavigate()
  const [filterOpen, setFilterOpen] = useState(false)

  /* ---------- فیلترها متصل به URL — هر دید فروشگاهی یک لینک اشتراکی دارد (سئو + UX) ---------- */
  const [params, setParams] = useSearchParams()
  const cat = params.get('cat') || 'همه'
  const q = params.get('q') || ''
  const sort = params.get('sort') || 'best'
  const maxPrice = Number(params.get('max') || MAX_PRICE)
  const inStockOnly = params.get('stock') === '1'
  const offOnly = params.get('off') === '1'
  const page = Math.max(1, Number(params.get('page') || 1))

  const patch = (obj, resetPage = true) => {
    const next = new URLSearchParams(params)
    Object.entries(obj).forEach(([k, v]) => {
      const def = k === 'cat' ? 'همه' : k === 'sort' ? 'best' : k === 'max' ? MAX_PRICE : k === 'page' ? 1 : ''
      const isDef = v === def || v === '' || v == null
      if (isDef) next.delete(k)
      else next.set(k, String(v))
    })
    setParams(next, { replace: false })
  }

  /* ---------- فیلتر و مرتب‌سازی ---------- */
  const list = useMemo(() => {
    let out = [...products]
    if (cat !== 'همه') out = out.filter((p) => p.cat === cat)
    if (q.trim()) out = out.filter((p) => p.name.includes(q.trim()))
    if (maxPrice < MAX_PRICE) out = out.filter((p) => p.price <= maxPrice)
    if (inStockOnly) out = out.filter((p) => p.stock > 0)
    if (offOnly) out = out.filter((p) => p.oldPrice)
    const sorters = {
      best: (a, b) => (b.sold || 0) - (a.sold || 0),
      new: (a, b) => b.id.localeCompare(a.id),
      cheap: (a, b) => a.price - b.price,
      expensive: (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating,
      off: (a, b) => (b.oldPrice ? 1 - b.price / b.oldPrice : 0) - (a.oldPrice ? 1 - a.price / a.oldPrice : 0),
    }
    return out.sort(sorters[sort] || sorters.best)
  }, [cat, q, sort, maxPrice, inStockOnly, offOnly])

  /* ---------- صفحه‌بندی فروشگاهی ---------- */
  const pages = Math.max(1, Math.ceil(list.length / PER_PAGE))
  const safePage = Math.min(page, pages)
  const pagedList = list.slice((safePage - 1) * PER_PAGE, safePage * PER_PAGE)
  const gridTop = useRef(null)
  useEffect(() => {
    gridTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [safePage])

  const activeCount =
    (cat !== 'همه' ? 1 : 0) + (maxPrice < MAX_PRICE ? 1 : 0) + (inStockOnly ? 1 : 0) + (offOnly ? 1 : 0)

  const resetAll = () => setParams(new URLSearchParams(), { replace: false })

  /* ---------- بلوک فیلترها (مشترک دسکتاپ و موبایل) ---------- */
  const FilterBlock = () => (
    <>
      <div className="mk-fgroup">
        <b className="mk-ftitle">دسته‌بندی</b>
        <div className="mk-flist">
          {['همه', ...marketCats].map((c) => (
            <label key={c} className={`mk-fcheck ${cat === c ? 'on' : ''}`}>
              <input type="radio" name="mkcat" checked={cat === c} onChange={() => patch({ cat: c })} />
              <span>{c}</span>
              <small>{c === 'همه' ? faNum(products.length) : faNum(products.filter((p) => p.cat === c).length)}</small>
            </label>
          ))}
        </div>
      </div>
      <div className="mk-fgroup">
        <b className="mk-ftitle">سقف قیمت</b>
        <input
          type="range" min={50000} max={MAX_PRICE} step={50000}
          value={maxPrice} onChange={(e) => patch({ max: Number(e.target.value) })}
          className="mk-range"
        />
        <div className="between small muted">
          <span>تا {maxPrice >= MAX_PRICE ? 'بدون محدودیت' : toman(maxPrice)}</span>
          <span>۵ هزار تومان</span>
        </div>
      </div>
      <div className="mk-fgroup">
        <b className="mk-ftitle">وضعیت کالا</b>
        <label className="mk-fswitch">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => patch({ stock: e.target.checked ? '1' : '' })} />
          <span className="mk-switch" /> فقط کالاهای موجود
        </label>
        <label className="mk-fswitch">
          <input type="checkbox" checked={offOnly} onChange={(e) => patch({ off: e.target.checked ? '1' : '' })} />
          <span className="mk-switch" /> فقط تخفیف‌دارها
        </label>
      </div>
      {activeCount > 0 && (
        <Button variant="outline" size="sm" className="w-full" onClick={resetAll}>
          <RotateCcw size={14} /> حذف {faNum(activeCount)} فیلتر فعال
        </Button>
      )}
    </>
  )

  /* ---------- چیپ‌های فیلتر فعال با دکمه حذف تکی ---------- */
  const activeChips = [
    cat !== 'همه' && { label: cat, clear: () => patch({ cat: 'همه' }) },
    q.trim() && { label: `«${q.trim()}»`, clear: () => patch({ q: '' }) },
    maxPrice < MAX_PRICE && { label: `تا ${toman(maxPrice)}`, clear: () => patch({ max: MAX_PRICE }) },
    inStockOnly && { label: 'فقط موجود', clear: () => patch({ stock: '' }) },
    offOnly && { label: 'فقط تخفیف‌دار', clear: () => patch({ off: '' }) },
  ].filter(Boolean)

  /* ---------- مشاهده سریع با انتخاب تعداد ---------- */
  const [quick, setQuick] = useState(null)
  const [quickQty, setQuickQty] = useState(1)
  const { addToCart, toast } = useApp()
  useEffect(() => { setQuickQty(1) }, [quick])

  const quickAdd = () => {
    if (!quick) return
    addToCart(
      { id: quick.id, name: quick.name, price: quick.price, icon: quick.icon, color: quick.color, kind: 'market', maxStock: quick.stock },
      quickQty
    )
    toast(`${faNum(quickQty)} عدد «${quick.name}» به سبد اضافه شد`)
    setQuick(null)
  }

  return (
    <>
      <Seo
        title="مدرس‌مارکت — فروشگاه لوازم‌التحریر"
        description="خرید آنلاین نوشت‌افزار، لوازم هنری، اداری و دانش‌آموزی با تخفیف واقعی؛ ارسال پیش‌کرایه، پس‌کرایه و پیک فوری تهران — مدرس‌مارکت."
        path="/market"
        keywords="خرید لوازم التحریر, فروشگاه نوشت افزار, لوازم هنری, لوازم اداری, مدرس مارکت, خرید آنلاین لوازم دانش‌آموزی"
        jsonLd={[
          storeJsonLd(),
          crumbsJsonLd([['صفحه نخست', '/'], ['مدرس‌مارکت', '/market']]),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            itemListElement: products.map((p, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              name: p.name,
              url: `${ORIGIN}/market/${p.id}`,
            })),
          },
        ]}
      />
      <section className="page-hero" style={{ paddingBottom: 20 }}>
        <div className="container">
          <div className="breadcrumb"><Link to="/">صفحه نخست</Link> <Icon name="chevronLeft" size={13} /> <span>مدرس‌مارکت</span></div>
          <h1>مدرس‌<span className="text-amber">مارکت</span></h1>
          <p className="muted">فروشگاه تخصصی لوازم‌التحریر و ابزار یادگیری — ارسال سریع به سراسر کشور، ضمانت اصالت کالا.</p>
        </div>
      </section>

      {/* نوار دسته‌بندی چسبان — در موبایل اسکرول افقی */}
      <div className="mk-catbar">
        <div className="container row g8 wrap mk-catscroll">
          {['همه', ...marketCats].map((c) => (
            <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => patch({ cat: c })}>
              {c === 'همه' ? <ShoppingCart size={14} /> : null}{c}
            </button>
          ))}
        </div>
      </div>

      <section className="section-sm container">
        {/* جستجو + مرتب‌سازی + فیلتر موبایل */}
        <div className="mk-toolbar">
          <div className="search-box">
            <Search size={17} className="opacity-60" />
            <input className="input" placeholder="جستجو در میان محصولات مدرس‌مارکت…" value={q} onChange={(e) => patch({ q: e.target.value })} />
            {q && <button className="mk-clear" onClick={() => patch({ q: '' })} aria-label="پاک کردن"><X size={14} /></button>}
          </div>
          <div className="mk-toolbar-ctrl">
            <Select value={sort} onValueChange={(v) => patch({ sort: v })}>
              <SelectTrigger className="mk-sortsel" aria-label="مرتب‌سازی"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" className="mk-openfilter" onClick={() => setFilterOpen(true)}>
              <SlidersHorizontal size={15} /> فیلترها
              {activeCount > 0 && <Badge variant="discount" className="px-1.5">{faNum(activeCount)}</Badge>}
            </Button>
          </div>
        </div>

        {/* چیپ‌های فیلتر فعال */}
        {activeChips.length > 0 && (
          <div className="mk-active row g8 wrap mb16">
            {activeChips.map((c) => (
              <button key={c.label} className="mk-activechip" onClick={c.clear} aria-label={`حذف فیلتر ${c.label}`}>
                {c.label} <X size={13} />
              </button>
            ))}
            <button className="mk-activechip all" onClick={resetAll}><RotateCcw size={12} /> حذف همه</button>
          </div>
        )}

        <div className="mk-layout" ref={gridTop}>
          {/* سایدبار فیلتر — دسکتاپ */}
          <aside className="mk-filters hidden lg:block">
            <div className="between mb16">
              <b className="row g8"><SlidersHorizontal size={16} /> فیلترها</b>
              {activeCount > 0 && <Badge variant="discount">{faNum(activeCount)}</Badge>}
            </div>
            <FilterBlock />
          </aside>

          {/* شبکه محصولات + صفحه‌بندی */}
          <div>
            <div className="between mb16">
              <span className="muted small">
                نمایش {faNum(pagedList.length)} از {faNum(list.length)} کالا
                {pages > 1 && <span className="mk-pageinfo"> — صفحه {faNum(safePage)} از {faNum(pages)}</span>}
              </span>
              {activeCount > 0 && (
                <button className="text-teal small mk-openfilter-inline" onClick={resetAll}>حذف فیلترها</button>
              )}
            </div>
            {list.length === 0 ? (
              <div className="empty card" style={{ padding: 60 }}>
                <Search size={44} />
                <p>کالایی با این مشخصات پیدا نشد — فیلترها را تغییر دهید.</p>
                <Button variant="soft" size="sm" onClick={resetAll}><RotateCcw size={14} /> حذف فیلترها</Button>
              </div>
            ) : (
              <>
                <div className="grids g3 mk-grid">
                  {pagedList.map((p, i) => <Reveal key={p.id} delay={(i % 4) * 50}><ProductCard product={p} onQuickView={(pr) => { setQuick(pr); setQuickQty(1) }} /></Reveal>)}
                </div>
                {pages > 1 && (
                  <nav className="mk-pag" aria-label="صفحه‌بندی محصولات">
                    <button className="mk-pagbtn" disabled={safePage === 1} onClick={() => patch({ page: safePage - 1 })} aria-label="صفحه قبل">
                      <ChevronRight size={16} />
                    </button>
                    {Array.from({ length: pages }, (_, i) => i + 1).map((n) => (
                      <button key={n} className={`mk-pagbtn ${n === safePage ? 'on' : ''}`} onClick={() => patch({ page: n })} aria-current={n === safePage ? 'page' : undefined}>
                        {faNum(n)}
                      </button>
                    ))}
                    <button className="mk-pagbtn" disabled={safePage === pages} onClick={() => patch({ page: safePage + 1 })} aria-label="صفحه بعد">
                      <ChevronLeft size={16} />
                    </button>
                  </nav>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* مزایا */}
      <section className="section-sm container">
        <div className="grids g4">
          {[
            { I: Truck, t: 'ارسال سریع', d: 'تهران ۲۴ ساعته، شهرستان ۲ تا ۴ روز کاری' },
            { I: BadgeCheck, t: 'ضمانت اصالت', d: 'تمام کالاها اورجینال و دارای گارانتی' },
            { I: Undo2, t: '۷ روز مهلت بازگشت', d: 'بدون قید و شرط، بدون سوال' },
            { I: CreditCard, t: 'پرداخت امن', d: 'درگاه‌های معتبر بانکی کشور' },
          ].map(({ I, t, d }) => (
            <div className="card pad" key={t} style={{ textAlign: 'center' }}>
              <span className="sc-icon amber" style={{ width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
                <I size={22} />
              </span>
              <b className="small">{t}</b>
              <p className="muted small">{d}</p>
            </div>
          ))}
        </div>
      </section>

      {/* دیالوگ فیلتر — موبایل */}
      <Dialog open={filterOpen} onOpenChange={setFilterOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="row g8"><SlidersHorizontal size={17} /> فیلتر محصولات</DialogTitle>
            <DialogDescription>نتایج را بر اساس دسته، قیمت و موجودی محدود کنید.</DialogDescription>
          </DialogHeader>
          <FilterBlock />
          <Button className="w-full" onClick={() => setFilterOpen(false)}>مشاهده {faNum(list.length)} نتیجه</Button>
        </DialogContent>
      </Dialog>

      {/* مشاهده سریع محصول — با انتخاب تعداد و افزودن مستقیم به سبد */}
      <Dialog open={!!quick} onOpenChange={(v) => !v && setQuick(null)}>
        <DialogContent>
          {quick && (
            <>
              <DialogHeader>
                <DialogTitle>{quick.name}</DialogTitle>
                <DialogDescription className="row g8 flex-wrap">
                  <Badge variant="gray">{quick.cat}</Badge>
                  <RatingStars value={quick.rating} showNum />
                </DialogDescription>
              </DialogHeader>
              <div className="row g16 items-start mk-quickrow">
                <div className={`p-thumb ${quick.color}`} style={{ width: 110, height: 110, borderRadius: 16, flexShrink: 0 }}>
                  <DataIcon name={quick.icon} size={48} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row g8 items-center flex-wrap">
                    {quick.oldPrice && <Badge variant="discount">٪{faNum(Math.round((1 - quick.price / quick.oldPrice) * 100))} تخفیف</Badge>}
                    <b style={{ fontSize: 17, color: 'var(--amber)' }}>{toman(quick.price)}</b>
                    {quick.oldPrice && <span className="old">{faNum(quick.oldPrice)}</span>}
                  </div>
                  <p className="muted small mt8" style={{ lineHeight: 2 }}>
                    موجودی: {faNum(quick.stock)} عدد — ارسال فوری تهران، پیش‌کرایه یا پس‌کرایه در مرحله پرداخت.
                  </p>
                  <div className="row g8 items-center mt12">
                    <span className="muted small">تعداد:</span>
                    <div className="qty-stepper">
                      <button onClick={() => setQuickQty((v) => Math.min(quick.stock || 99, v + 1))} disabled={quickQty >= (quick.stock || 99)} aria-label="افزایش"><Plus size={13} /></button>
                      <b>{faNum(quickQty)}</b>
                      <button onClick={() => setQuickQty((v) => Math.max(1, v - 1))} disabled={quickQty <= 1} aria-label="کاهش"><Minus size={13} /></button>
                    </div>
                    <b className="small" style={{ color: 'var(--amber)' }}>{toman(quick.price * quickQty)}</b>
                  </div>
                </div>
              </div>
              <div className="row g8 mk-quickact">
                <Button className="flex-1" disabled={quick.stock <= 0} onClick={quickAdd}>
                  <ShoppingCart size={16} /> افزودن به سبد
                </Button>
                <Button variant="secondary" onClick={() => { setQuick(null); navigate(`/market/${quick.id}`) }}>
                  <PackageCheck size={16} /> جزئیات
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
