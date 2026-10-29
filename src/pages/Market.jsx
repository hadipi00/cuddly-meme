import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Seo, { ORIGIN } from '../components/Seo'
import {
  Search, SlidersHorizontal, X, PackageCheck, Percent, Store, RotateCcw,
  Truck, BadgeCheck, Undo2, CreditCard, ShoppingBag,
} from 'lucide-react'
import Icon from '../components/Icon'
import { Reveal, RatingStars } from '../components/ui'
import { ProductCard } from '../components/cards'
import { products, marketCats } from '../data/mock'
import { faNum, toman } from '../utils/format'
import { DataIcon } from '../utils/icons'
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

export default function Market() {
  const navigate = useNavigate()
  const [cat, setCat] = useState('همه')
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('best')
  const [maxPrice, setMaxPrice] = useState(MAX_PRICE)
  const [inStockOnly, setInStockOnly] = useState(false)
  const [offOnly, setOffOnly] = useState(false)
  const [quick, setQuick] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)

  const applyFilters = (list) => {
    if (cat !== 'همه') list = list.filter((p) => p.cat === cat)
    if (q.trim()) list = list.filter((p) => p.name.includes(q.trim()))
    if (maxPrice < MAX_PRICE) list = list.filter((p) => p.price <= maxPrice)
    if (inStockOnly) list = list.filter((p) => p.stock > 0)
    if (offOnly) list = list.filter((p) => p.oldPrice)
    return list
  }

  const list = useMemo(() => {
    let out = applyFilters([...products])
    const sorters = {
      best: (a, b) => (b.sold || 0) - (a.sold || 0),
      new: (a, b) => b.id.localeCompare(a.id),
      cheap: (a, b) => a.price - b.price,
      expensive: (a, b) => b.price - a.price,
      rating: (a, b) => b.rating - a.rating,
      off: (a, b) => (b.oldPrice ? 1 - b.price / b.oldPrice : 0) - (a.oldPrice ? 1 - a.price / a.oldPrice : 0),
    }
    return out.sort(sorters[sort])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cat, q, sort, maxPrice, inStockOnly, offOnly])

  const activeCount = (cat !== 'همه' ? 1 : 0) + (maxPrice < MAX_PRICE ? 1 : 0) + (inStockOnly ? 1 : 0) + (offOnly ? 1 : 0)

  const resetAll = () => {
    setCat('همه'); setQ(''); setMaxPrice(MAX_PRICE); setInStockOnly(false); setOffOnly(false)
  }

  /* ---------- بلوک فیلترها (مشترک بین دسکتاپ و موبایل) ---------- */
  const FilterBlock = () => (
    <>
      <div className="mk-fgroup">
        <b className="mk-ftitle">دسته‌بندی</b>
        <div className="mk-flist">
          {['همه', ...marketCats].map((c) => (
            <label key={c} className={`mk-fcheck ${cat === c ? 'on' : ''}`}>
              <input type="radio" name="mkcat" checked={cat === c} onChange={() => setCat(c)} />
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
          value={maxPrice} onChange={(e) => setMaxPrice(Number(e.target.value))}
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
          <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
          <span className="mk-switch" /> فقط کالاهای موجود
        </label>
        <label className="mk-fswitch">
          <input type="checkbox" checked={offOnly} onChange={(e) => setOffOnly(e.target.checked)} />
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

  return (
    <>
      <Seo
        title="مدرس‌مارکت — فروشگاه لوازم‌التحریر"
        description="خرید آنلاین نوشت‌افزار، لوازم هنری، اداری و دانش‌آموزی با تخفیف واقعی؛ ارسال پیش‌کرایه، پس‌کرایه و پیک فوری تهران — مدرس‌مارکت."
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          itemListElement: products.map((p, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: p.name,
            url: `${ORIGIN}/market/${p.id}`,
          })),
        }}
      />
      <section className="page-hero" style={{ paddingBottom: 20 }}>
        <div className="container">
          <div className="breadcrumb"><Link to="/">صفحه نخست</Link> <Icon name="chevronLeft" size={13} /> <span>مدرس‌مارکت</span></div>
          <h1>مدرس‌<span className="text-amber">مارکت</span></h1>
          <p className="muted">فروشگاه تخصصی لوازم‌التحریر و ابزار یادگیری — ارسال سریع به سراسر کشور، ضمانت اصالت کالا.</p>
        </div>
      </section>

      {/* نوار دسته‌بندی چسبان */}
      <div className="mk-catbar">
        <div className="container row g8 wrap">
          {['همه', ...marketCats].map((c) => (
            <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
              {c === 'همه' ? <ShoppingBag size={14} /> : null}{c}
            </button>
          ))}
        </div>
      </div>

      <section className="section-sm container">
        {/* جستجو + مرتب‌سازی + فیلتر موبایل */}
        <div className="mk-toolbar">
          <div className="search-box">
            <Search size={17} className="opacity-60" />
            <input className="input" placeholder="جستجو در میان محصولات مدرس‌مارکت…" value={q} onChange={(e) => setQ(e.target.value)} />
            {q && <button className="mk-clear" onClick={() => setQ('')} aria-label="پاک کردن"><X size={14} /></button>}
          </div>
          <div className="row g8">
            <Select value={sort} onValueChange={setSort}>
              <SelectTrigger className="w-[170px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {SORTS.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" className="lg:hidden" onClick={() => setFilterOpen(true)}>
              <SlidersHorizontal size={15} /> فیلترها
              {activeCount > 0 && <Badge variant="discount" className="px-1.5">{faNum(activeCount)}</Badge>}
            </Button>
          </div>
        </div>

        <div className="mk-layout">
          {/* سایدبار فیلتر — دسکتاپ */}
          <aside className="mk-filters hidden lg:block">
            <div className="between mb16">
              <b className="row g8"><SlidersHorizontal size={16} /> فیلترها</b>
              {activeCount > 0 && <Badge variant="discount">{faNum(activeCount)}</Badge>}
            </div>
            <FilterBlock />
          </aside>

          {/* شبکه محصولات */}
          <div>
            <div className="between mb16">
              <span className="muted small">{faNum(list.length)} کالا</span>
              {activeCount > 0 && (
                <button className="text-teal small lg:hidden" onClick={resetAll}>حذف فیلترها</button>
              )}
            </div>
            {list.length === 0 ? (
              <div className="empty card" style={{ padding: 60 }}>
                <Search size={44} />
                <p>کالایی با این مشخصات پیدا نشد — فیلترها را تغییر دهید.</p>
                <Button variant="soft" size="sm" onClick={resetAll}><RotateCcw size={14} /> حذف فیلترها</Button>
              </div>
            ) : (
              <div className="grids g3 mk-grid">
                {list.map((p, i) => <Reveal key={p.id} delay={(i % 3) * 50}><ProductCard product={p} onQuickView={setQuick} /></Reveal>)}
              </div>
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

      {/* مشاهده سریع محصول */}
      <Dialog open={!!quick} onOpenChange={(v) => !v && setQuick(null)}>
        <DialogContent>
          {quick && (
            <>
              <DialogHeader>
                <DialogTitle>{quick.name}</DialogTitle>
                <DialogDescription className="row g8">
                  <Badge variant="gray">{quick.cat}</Badge>
                  <RatingStars value={quick.rating} showNum />
                </DialogDescription>
              </DialogHeader>
              <div className="row g16 items-start">
                <div className={`p-thumb ${quick.color}`} style={{ width: 110, height: 110, borderRadius: 16, flexShrink: 0 }}>
                  <DataIcon name={quick.icon} size={48} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="row g8 items-center">
                    {quick.oldPrice && <Badge variant="discount">٪{faNum(Math.round((1 - quick.price / quick.oldPrice) * 100))} تخفیف</Badge>}
                    <b style={{ fontSize: 17, color: 'var(--amber)' }}>{toman(quick.price)}</b>
                    {quick.oldPrice && <span className="old">{faNum(quick.oldPrice)}</span>}
                  </div>
                  <p className="muted small mt8" style={{ lineHeight: 2 }}>
                    موجودی: {faNum(quick.stock)} عدد — ارسال فوری تهران، پیش‌کرایه یا پس‌کرایه در مرحله پرداخت.
                  </p>
                </div>
              </div>
              <div className="row g8">
                <Button
                  className="flex-1"
                  onClick={() => {
                    setQuick(null)
                    navigate(`/market/${quick.id}`)
                  }}
                >
                  <PackageCheck size={16} /> مشاهده و خرید
                </Button>
                <Button variant="secondary" onClick={() => setQuick(null)}><X size={15} /> بستن</Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
