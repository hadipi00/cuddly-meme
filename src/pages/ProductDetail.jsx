import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import Seo, { ORIGIN } from '../components/Seo'
import {
  Truck, BadgeCheck, Undo2, ShoppingCart, Star, Store, MapPin,
  PackageCheck, Boxes, Minus, Plus, ShieldCheck,
} from 'lucide-react'
import Icon from '../components/Icon'
import SmartImg from '../components/SmartImg'
import { Reveal, RatingStars } from '../components/ui'
import { ProductCard } from '../components/cards'
import { products, reviews } from '../data/mock'
import { useApp } from '../store/AppContext'
import { faNum, toman } from '../utils/format'
import { DataIcon } from '../utils/icons'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

/* تنوع رنگ گالری — هر محصول ۴ «تصویر» وکتوری با گرادیان‌های متفاوت */
const GRADS = ['grad-0', 'grad-1', 'grad-2', 'grad-3', 'grad-4', 'grad-5']

export default function ProductDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const { addToCart, toast, pushViewed } = useApp()
  const product = products.find((p) => p.id === id)
  const [qty, setQty] = useState(1)
  const [shot, setShot] = useState(0)

  // ثبت بازدید برای ریل «بازدیدهای اخیر» در مدرس‌مارکت
  useEffect(() => {
    if (product) pushViewed({ id: product.id, name: product.name })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id])
  if (!product) {
    return (
      <div className="container section">
        <div className="empty card" style={{ padding: 60 }}>
          <PackageCheck size={44} />
          <p>محصول یافت نشد.</p>
          <Button variant="soft" size="sm" onClick={() => nav('/market')}><Store size={14} /> بازگشت به مدرس‌مارکت</Button>
        </div>
      </div>
    )
  }

  const off = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0
  const related = products.filter((p) => p.id !== product.id && p.cat === product.cat).slice(0, 4)
  const gallery = [...new Set([product.color, ...GRADS])].slice(0, 4)
  const thumbs = [product.icon, 'sparkles', 'layers', 'backpack']
  const prodReviews = reviews.slice(0, 3)
  const specs = product.specs?.length ? product.specs : [
    ['دسته‌بندی', product.cat],
    ['گارانتی', '۷ روز ضمانت بازگشت'],
  ]

  const add = () => {
    addToCart(
      { id: product.id, name: product.name, price: product.price, icon: product.icon, color: product.color, kind: 'market', maxStock: product.stock },
      qty
    )
    toast(`${faNum(qty)} عدد به سبد خرید اضافه شد`)
  }

  return (
    <>
      <Seo
        title={product.name}
        description={`خرید ${product.name} از مدرس‌مارکت — ${product.cat} با ارسال پیش‌کرایه، پس‌کرایه و پیک فوری تهران.`}
        path={`/market/${product.id}`}
        type="product"
        keywords={`خرید ${product.name}, ${product.cat}, مدرس مارکت, قیمت ${product.name}`}
        image={`${ORIGIN}/images/products/${product.id}.jpg`}
        jsonLd={[
          {
            '@context': 'https://schema.org',
            '@type': 'Product',
            name: product.name,
            description: `خرید ${product.name} از مدرس‌مارکت مدرس‌یار — ضمانت اصالت و ۷ روز بازگشت`,
            category: product.cat,
            sku: product.id.toUpperCase(),
            image: [`${ORIGIN}/images/products/${product.id}.jpg`],
            brand: { '@type': 'Brand', name: 'مدرس‌یار' },
            aggregateRating: product.rating
              ? {
                  '@type': 'AggregateRating',
                  ratingValue: product.rating,
                  ratingCount: product.sold || 10,
                  bestRating: 5,
                  worstRating: 1,
                }
              : undefined,
            offers: {
              '@type': 'Offer',
              price: product.price * 10,
              priceCurrency: 'IRR',
              availability:
                product.stock > 0
                  ? 'https://schema.org/InStock'
                  : 'https://schema.org/OutOfStock',
              itemCondition: 'https://schema.org/NewCondition',
              url: `${ORIGIN}/market/${product.id}`,
              seller: { '@type': 'Organization', name: 'مدرس‌یار' },
              shippingDetails: {
                '@type': 'OfferShippingDetails',
                shippingRate: { '@type': 'MonetaryAmount', value: 0, currency: 'IRR' },
                shippingDestination: { '@type': 'DefinedRegion', addressCountry: 'IR' },
              },
            },
          },
          {
            '@context': 'https://schema.org',
            '@type': 'BreadcrumbList',
            itemListElement: [
              { '@type': 'ListItem', position: 1, name: 'صفحه نخست', item: `${ORIGIN}/` },
              { '@type': 'ListItem', position: 2, name: 'مدرس‌مارکت', item: `${ORIGIN}/market` },
              { '@type': 'ListItem', position: 3, name: product.name, item: `${ORIGIN}/market/${product.id}` },
            ],
          },
        ]}
      />
      <section className="page-hero" style={{ paddingBottom: 20 }}>
        <div className="container">
          <div className="breadcrumb">
            <Link to="/">صفحه نخست</Link> <Icon name="chevronLeft" size={13} />
            <Link to="/market">مدرس‌مارکت</Link> <Icon name="chevronLeft" size={13} /> <span>{product.name}</span>
          </div>
        </div>
      </section>

      <section className="container section-sm" style={{ paddingTop: 0 }}>
        <div className="mk-detail">
          {/* ستون راست — گالری */}
          <div className="mk-gallery">
            <Reveal className={`card mk-shot ${gallery[shot]}`} style={{ height: 360, borderRadius: 22 }}>
              {/* نمای اول = عکس واقعی محصول؛ نمای‌های بعدی واریانت گرافیکی */}
              {shot === 0 ? (
                <SmartImg
                  src={`/images/products/${product.id}.jpg`}
                  alt={`${product.name} — ${product.cat} | خرید از مدرس‌مارکت`}
                  width={512}
                  height={360}
                  loading="eager"
                  className="mk-shot-img"
                  fallback={<DataIcon name={product.icon} size={116} />}
                />
              ) : (
                <DataIcon name={thumbs[shot] === product.icon ? product.icon : thumbs[shot]} size={116} />
              )}
              {off > 0 && <span className="badge discount mk-shot-off">٪{faNum(off)} تخفیف</span>}
            </Reveal>
            <div className="row g8 mt8" style={{ justifyContent: 'center' }}>
              {gallery.map((g, i) => (
                <button
                  key={g}
                  className={`mk-thumb ${g} ${shot === i ? 'on' : ''}`}
                  onClick={() => setShot(i)}
                  aria-label={`تصویر ${faNum(i + 1)}`}
                >
                  <DataIcon name={thumbs[i] || product.icon} size={26} />
                </button>
              ))}
            </div>
          </div>

          {/* ستون میانی — مشخصات */}
          <div className="mk-maininfo" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div className="row g8 mb8 flex-wrap">
                <Badge variant="gray">{product.cat}</Badge>
                {off > 0 && <Badge variant="discount">٪{faNum(off)} تخفیف ویژه</Badge>}
                <Badge variant="green"><BadgeCheck size={13} /> اورجینال</Badge>
              </div>
              <h1 style={{ fontSize: 'clamp(18px, 2.2vw, 24px)', lineHeight: 1.7 }}>{product.name}</h1>
              <div className="row g12 mt8 flex-wrap">
                <span className="row g8 small"><RatingStars value={product.rating} showNum /></span>
                <span className="muted small">|</span>
                <span className="muted small">{faNum(product.sold || 0)} فروش موفق</span>
                <span className="muted small">|</span>
                <span className="muted small">کد کالا: <b dir="ltr">{product.id.toUpperCase()}</b></span>
              </div>
            </div>

            <div className="card pad">
              <h3 className="row g8 mb16" style={{ fontSize: 15 }}><Boxes size={17} /> مشخصات کلیدی</h3>
              <table className="dtable" style={{ minWidth: 'auto' }}>
                <tbody>
                  {specs.map(([k, v]) => (
                    <tr key={k}><td className="muted" style={{ width: 140 }}>{k}</td><td className="cell-strong">{v}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Tabs defaultValue="desc">
              <TabsList dir="rtl">
                <TabsTrigger value="desc">معرفی</TabsTrigger>
                <TabsTrigger value="ship">ارسال و گارانتی</TabsTrigger>
                <TabsTrigger value="reviews">نظرات ({faNum(prodReviews.length)})</TabsTrigger>
              </TabsList>
              <TabsContent value="desc">
                <p className="muted" style={{ lineHeight: 2.2 }}>
                  {product.name} یکی از پرفروش‌ترین اقلام دسته «{product.cat}» در مدرس‌مارکت است.
                  این کالا با ضمانت اصالت و سلامت فیزیکی ارسال می‌شود و در صورت رضایت نداشتن، تا ۷ روز
                  فرصت بازگشت بدون قید و شرط دارید. تمام سفارش‌های تهران ظرف ۲۴ ساعت و شهرستان‌ها
                  ظرف ۲ تا ۴ روز کاری تحویل داده می‌شوند؛ با انتخاب ارسال پیش‌کرایه، هزینه پست همراه
                  سفارش و با پس‌کرایه هنگام دریافت کالا پرداخت می‌شود.
                </p>
              </TabsContent>
              <TabsContent value="ship">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { I: Truck, t: 'ارسال فوری تهران', d: 'سفارش‌های ثبت‌شده تا ساعت ۱۴، همان روز با پیک ارسال می‌شود.' },
                    { I: PackageCheck, t: 'پیش‌کرایه یا پس‌کرایه', d: 'هزینه ارسال را همراه سفارش بپردازید یا هنگام دریافت، انتخاب با شماست.' },
                    { I: Undo2, t: '۷ روز ضمانت بازگشت', d: 'بدون قید و شرط و بدون سوال — اعتبار از لحظه تحویل کالا.' },
                    { I: ShieldCheck, t: 'ضمانت اصالت', d: 'کالای اورجینال با فاکتور رسمی مدرس‌یار.' },
                  ].map(({ I, t, d }) => (
                    <div className="row g12 items-start" key={t}>
                      <span className="sc-icon amber" style={{ width: 38, height: 38, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <I size={18} />
                      </span>
                      <div><b className="small">{t}</b><p className="muted small">{d}</p></div>
                    </div>
                  ))}
                </div>
              </TabsContent>
              <TabsContent value="reviews">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {prodReviews.map((r) => (
                    <div className="card pad" key={r.id} style={{ padding: 14 }}>
                      <div className="row g8 between">
                        <b className="small">{r.user}</b>
                        <span className="row g4 small text-amber"><Star size={13} filled /> {faNum(r.rating)}</span>
                      </div>
                      <p className="muted small mt8" style={{ lineHeight: 2 }}>{r.text}</p>
                    </div>
                  ))}
                  <p className="muted small" style={{ textAlign: 'center' }}>نظر خود را بعد از خرید ثبت کنید.</p>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* ستون چپ — کارت خرید چسبان */}
          <aside className="mk-buycol">
            <div className="card buy-card mk-sticky">
              <div className="row g8 items-center mb8">
                <Store size={16} className="text-teal" />
                <b className="small">فروشنده: مدرس‌یار (رسمی)</b>
              </div>
              <div className="row g8 items-center small muted mb16">
                <MapPin size={14} /> ارسال از تهران — انبار مرکزی
              </div>

              <div className="row g8 items-center">
                {off > 0 && <Badge variant="discount">٪{faNum(off)}</Badge>}
                {product.oldPrice && <span className="old" style={{ fontSize: 13 }}>{faNum(product.oldPrice)}</span>}
              </div>
              <div className="price-big mt8" style={{ color: 'var(--amber)' }}>
                {product.stock > 0 ? toman(product.price) : 'ناموجود'}
              </div>
              {off > 0 && (
                <p className="muted small mt4">
                  سود شما از این خرید: <b className="text-green">{toman(product.oldPrice - product.price)}</b>
                </p>
              )}

              <div className="row g8 mt16 flex-wrap">
                <span className="muted small">تعداد:</span>
                <div className="row" style={{ border: '1px solid var(--line)', borderRadius: 9, overflow: 'hidden' }}>
                  <button className="icon-btn" style={{ border: 'none' }} onClick={() => setQty(Math.max(1, qty - 1))} aria-label="کاهش"><Minus size={14} /></button>
                  <b style={{ minWidth: 36, textAlign: 'center' }}>{faNum(qty)}</b>
                  <button className="icon-btn" style={{ border: 'none' }} onClick={() => setQty(Math.min(product.stock || 1, qty + 1))} aria-label="افزایش"><Plus size={14} /></button>
                </div>
              </div>
              {product.stock < 20 && product.stock > 0 && (
                <p className="small text-red mt8">تنها {faNum(product.stock)} عدد در انبار باقی مانده!</p>
              )}

              <Button className="w-full mt16" size="lg" disabled={product.stock <= 0} onClick={add}>
                <ShoppingCart size={18} /> افزودن به سبد خرید
              </Button>

              <div className="buy-feats">
                <span><Truck size={15} /> ارسال رایگان بالای ۱ میلیون تومان (پیش‌کرایه)</span>
                <span><Undo2 size={15} /> ۷ روز ضمانت بازگشت کالا</span>
                <span><BadgeCheck size={15} /> ضمانت اصالت و سلامت فیزیکی</span>
              </div>
            </div>
          </aside>
        </div>
      </section>

      {related.length > 0 && (
        <section className="section-sm container">
          <h3 className="mb24">کالاهای مشابه</h3>
          <div className="grids g4">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
        </section>
      )}
    </>
  )
}
