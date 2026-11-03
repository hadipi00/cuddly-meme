// =====================================================================
// هسته مشترک پرداخت — قیمت‌گذاری سبد، کد تخفیف، موجودی، کد سفارش
// ---------------------------------------------------------------------
// منطق قیمت‌گذاری قبلاً فقط داخل روت /api/checkout بود؛ با اضافه‌شدن
// درگاه واقعی زرین‌پال (server/pay.js) دو جریان باید دقیقاً یک منطق
// قیمت داشته باشند → استخراج به این ماژول تا هیچ‌وقت واگرا نشوند.
// اصل امنیتی: قیمت/تخفیف/موجودی فقط از DB خوانده می‌شود، هرگز از کلاینت.
// =====================================================================
import { db } from './db.js'

export const now = () => Date.now()

export const faNum = (n) => String(n).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
export const money = (n) => faNum(Number(n || 0).toLocaleString('en-US')) + ' تومان'

/* تاریخ شمسی امروز با ارقام ASCII و صفرپُر — «1405/08/12»
   (toLocaleDateString('fa-IR') ارقام فارسی برمی‌گرداند و مقایسه رشته‌ای
   با تاریخ‌های ASCII جدول همیشه «منقضی» می‌داد؛ صفرپُری هم برای مقایسه
   رشته‌ای درستِ «1405/8» vs «1405/10» لازم است) */
export const faToday = () => {
  try {
    const parts = new Intl.DateTimeFormat('en-US-u-ca-persian', { year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date())
    const g = (t) => parts.find((x) => x.type === t)?.value || ''
    return `${g('year')}/${g('month')}/${g('day')}`
  } catch { return '' }
}

/* روش‌های ارسال — منبع حقیقت سرور (قبلاً فقط در فرانت تعریف شده بود) */
export const SHIP_METHODS = {
  prepaid:  { label: 'پست پیش‌کرایه', cost: 49_000, freeOver: 1_000_000 },
  postpaid: { label: 'پس‌کرایه',      cost: 69_000, freeOver: null },
  express:  { label: 'پیک فوری تهران', cost: 89_000, freeOver: null },
}

/** اعتبارسنجی کد تخفیف سمت سرور → { discount, label } یا { error } */
export const evaluateCoupon = (code, subtotal) => {
  const c = db.prepare('SELECT * FROM coupons WHERE code = ?').get(String(code || '').trim().toUpperCase())
  if (!c) return { error: 'کد تخفیف نامعتبر است' }
  if (c.status !== 'active') return { error: 'این کد تخفیف فعال نیست' }
  if (c.expires && c.expires !== '—') {
    /* انقضای شمسی «1404/10/01» — مقایسه رشته‌ای تاریخ شمسی معتبر است (قالب یکسان) */
    if (c.expires < faToday()) return { error: 'این کد تخفیف منقضی شده است' }
  }
  const discount = c.kind === 'percent'
    ? Math.round((subtotal || 0) * Math.min(100, c.value) / 100)
    : Math.min(c.value, subtotal || 0)
  return {
    discount: Math.max(0, discount),
    label: c.kind === 'percent' ? `${faNum(c.value)}٪` : money(c.value),
  }
}

/**
 * قیمت‌گذاری کامل سبد از سمت سرور — تنها منبع حقیقت قیمت.
 * خروجی موفق: { lines (با final هر قلم), subtotal, marketSub, hasMarket,
 *              discount, ship, shipCost, total, meta, couponCode }
 * خروجی ناموفق: { error, status }
 */
export const priceCart = (user, body) => {
  const itemsIn = body?.items
  if (!Array.isArray(itemsIn) || itemsIn.length < 1 || itemsIn.length > 50)
    return { error: 'سبد خرید نامعتبر است', status: 400 }

  /* ۱) قیمت واقعی هر قلم از DB — قیمتِ ادعایی کلاینت هرگز ملاک نیست */
  const lines = []
  for (const it of itemsIn) {
    const qty = Math.min(20, Math.max(1, Math.round(Number(it?.qty) || 1)))
    const kind = it?.kind === 'course' ? 'course' : 'market'
    if (kind === 'course') {
      const c = db.prepare('SELECT id, title, price FROM courses WHERE id = ?').get(Number(it?.id) || 0)
      if (!c) return { error: 'یکی از دوره‌های سبد دیگر موجود نیست', status: 400 }
      lines.push({ kind: 'course', id: String(c.id), title: c.title, price: c.price, qty })
    } else {
      const p = db.prepare('SELECT id, name, price, stock FROM products WHERE id = ?').get(String(it?.id || ''))
      if (!p) return { error: 'یکی از محصولات سبد دیگر موجود نیست', status: 400 }
      if (p.stock < qty) return { error: `موجودی «${p.name}» کافی نیست (${faNum(p.stock)} عدد)`, status: 400 }
      lines.push({ kind: 'market', id: p.id, title: p.name, price: p.price, qty, stock: p.stock })
    }
  }

  const subtotal = lines.reduce((a, l) => a + l.price * l.qty, 0)
  const marketSub = lines.filter((l) => l.kind === 'market').reduce((a, l) => a + l.price * l.qty, 0)
  const hasMarket = marketSub > 0

  /* ۲) تخفیف از جدول coupons — نه از رشته‌های هاردکد فرانت */
  let discount = 0
  const couponCode = String(body?.coupon || '').trim()
  if (couponCode) {
    const r = evaluateCoupon(couponCode, subtotal)
    if (r.error) return { error: r.error, status: 400 }
    discount = r.discount
  }

  /* ۳) هزینه ارسال — فقط برای کالای فیزیکی، با سقف رایگان خود روش */
  const ship = SHIP_METHODS[String(body?.shipKey || 'prepaid')] || SHIP_METHODS.prepaid
  const shipCost = !hasMarket ? 0 : (ship.freeOver && marketSub >= ship.freeOver ? 0 : ship.cost)
  const total = Math.max(0, subtotal - discount) + shipCost

  /* ۴) اطلاعات تماس خریدار (برای ارسال/فاکتور/پیامک) — سقف‌دار و پاک‌شده */
  const contact = body?.contact || {}
  const meta = JSON.stringify({
    name: String(contact.name || user.name || '').trim().slice(0, 80),
    phone: String(contact.phone || '').trim().slice(0, 20),
    email: String(contact.email || '').trim().slice(0, 120),
    address: String(contact.address || '').trim().slice(0, 300),
  })

  /* ۵) کاهش سقف تخفیف به‌صورت متناسب روی هر قلم (مجموع دقیق حفظ می‌شود) */
  const factor = subtotal > 0 ? (subtotal - discount) / subtotal : 1
  let allocated = 0
  const finalLines = lines.map((l, i) => {
    if (i === lines.length - 1) {
      const lineFinal = Math.max(0, subtotal - discount) - allocated
      return { ...l, final: lineFinal }
    }
    const lineFinal = Math.round(l.price * l.qty * factor)
    allocated += lineFinal
    return { ...l, final: lineFinal }
  })

  return { lines: finalLines, subtotal, marketSub, hasMarket, discount, ship, shipCost, total, meta, couponCode }
}

/** رزرو موجودی کالای فیزیکی — قبل از ثبت سفارش؛ null یعنی موفق */
export const reserveStock = (lines) => {
  const updStock = db.prepare('UPDATE products SET stock = stock - ?, sold = sold + ? WHERE id = ? AND stock >= ?')
  for (const l of lines) {
    if (l.kind === 'market' && updStock.run(l.qty, l.qty, l.id, l.qty).changes === 0)
      return `موجودی «${l.title}» همین الان تمام شد — سبد را به‌روز کنید`
  }
  return null
}

/** برگرداندن موجودی رزروشده — در شکست/انصراف/انقضای پرداخت درگاه */
export const restoreStock = (lines) => {
  const upd = db.prepare('UPDATE products SET stock = stock + ?, sold = sold - ? WHERE id = ?')
  for (const l of lines) if (l.kind === 'market') upd.run(l.qty, l.qty, l.id)
}

/** کد سفارش یکتا (۶ رقم) — با چک برخورد در جدول */
export const uniqueOrderCode = () => {
  for (let tries = 0; tries < 10; tries++) {
    const candidate = 'ORD-' + Math.floor(100000 + Math.random() * 900000)
    if (!db.prepare('SELECT 1 AS x FROM orders WHERE code = ?').get(candidate)) return candidate
  }
  return null
}
