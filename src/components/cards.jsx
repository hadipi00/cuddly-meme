import { Link, useNavigate } from 'react-router-dom'
import { ShoppingCart, Heart, Star, Clock, PlayCircle, User } from 'lucide-react'
import Icon from './Icon'
import SmartImg from './SmartImg'
import { RatingStars } from './ui'
import { useApp } from '../store/AppContext'
import { faNum, toman } from '../utils/format'
import { DataIcon } from '../utils/icons'

/* ---------- کارت دوره (ثبت‌شده) ---------- */
export function CourseCard({ course, myProgress }) {
  const { wishlist, toggleWish, addToCart, toast } = useApp()
  const nav = useNavigate()
  const wished = wishlist.some((w) => w.id === course.id)
  return (
    <div className="card course-card" onClick={() => nav(`/courses/${course.id}`)}>
      <div className={`c-thumb ${course.color}`}>
        {/* عکس واقعی دوره با alt کامل — سئوی تصویر گوگل؛ در صورت خطا گرادیان + آیکون */}
        <SmartImg
          src={`/images/courses/c${course.id}.jpg`}
          alt={`کاور دوره ${course.title} — ${course.cat}`}
          width={672}
          height={330}
          fallback={<DataIcon name={course.icon} size={54} />}
        />
        {course.badge && <span className="badge b-amber c-badge">{course.badge}</span>}
        <span className="badge b-gray c-level">{course.level}</span>
        <span className="badge b-gray c-type"><Icon name="video" size={12} /> ضبط‌شده</span>
      </div>
      <div className="c-body">
        <span className="c-cat">{course.cat}</span>
        <h3>{course.title}</h3>
        <div className="rating-line">
          <RatingStars value={course.rating} />
          <span>({faNum(course.students.toLocaleString('fa-IR'))} دانشجو)</span>
        </div>
        <div className="c-meta">
          <span><User size={14} /> {course.teacher}</span>
          <span><Clock size={14} /> {faNum(course.hours)} ساعت</span>
          <span><PlayCircle size={14} /> {faNum(course.lessonsCount)} درس</span>
        </div>
        {myProgress != null && (
          <div className="skill-row">
            <div className="between small"><b>پیشرفت شما</b><span>{faNum(myProgress)}٪</span></div>
            <div className="progress"><i style={{ width: `${myProgress}%` }} /></div>
          </div>
        )}
        <div className="c-foot">
          <div className="price-box">
            {course.price === 0 ? <span className="free">رایگان</span> : (
              <>{toman(course.price)}{course.oldPrice && <span className="old">{faNum(course.oldPrice)}</span>}</>
            )}
          </div>
          <button
            className={`wish-btn ${wished ? 'on' : ''}`}
            onClick={(e) => { e.stopPropagation(); toggleWish({ id: course.id, name: course.title, icon: course.icon, color: course.color, price: course.price, kind: 'course' }) }}
            aria-label="علاقه‌مندی"
          >
            <Icon name="heart" filled={wished} />
          </button>
          <button className="btn btn-soft btn-sm" onClick={(e) => {
            e.stopPropagation()
            addToCart({ id: course.id, name: course.title, price: course.price, icon: course.icon, color: course.color, kind: 'course' })
            toast('دوره به سبد خرید اضافه شد')
          }}>
            <ShoppingCart size={15} /> افزودن
          </button>
        </div>
      </div>
    </div>
  )
}

/* ---------- کارت محصول مدرس‌مارکت — سبک فروشگاهی مدرن ---------- */
export function ProductCard({ product, onQuickView }) {
  const { addToCart, toast } = useApp()
  const nav = useNavigate()
  const off = product.oldPrice ? Math.round((1 - product.price / product.oldPrice) * 100) : 0
  const out = product.stock <= 0
  const low = !out && product.stock < 20

  const add = (e) => {
    e.stopPropagation()
    if (out) { toast('این محصول فعلاً ناموجود است', 'error'); return }
    addToCart(
      { id: product.id, name: product.name, price: product.price, icon: product.icon, color: product.color, kind: 'market', maxStock: product.stock },
      1
    )
    toast('به سبد خرید اضافه شد')
  }

  return (
    <div className="card product-card mk-card" onClick={() => nav(`/market/${product.id}`)}>
      <div className={`p-thumb ${product.color}`}>
        {/* عکس واقعی محصول با alt — سئوی تصویر گوگل شاپینگ */}
        <SmartImg
          src={`/images/products/${product.id}.jpg`}
          alt={`${product.name} — ${product.cat} | مدرس‌مارکت`}
          width={512}
          height={300}
          fallback={<DataIcon name={product.icon} size={52} />}
        />
        {off > 0 && <span className="badge discount p-off">٪{faNum(off)}</span>}
        {!off && product.badge && <span className="badge b-amber p-badge">{product.badge}</span>}
        <button
          className="mk-quick"
          onClick={(e) => { e.stopPropagation(); onQuickView?.(product) }}
          aria-label="مشاهده سریع"
          title="مشاهده سریع"
        >
          <Icon name="search" size={15} />
        </button>
      </div>
      <div className="p-body">
        <span className="c-cat">{product.cat}</span>
        <h3>{product.name}</h3>
        <div className="rating-line">
          <RatingStars value={product.rating} />
          <span className="muted small">({faNum(product.sold || 0)} فروش)</span>
        </div>
        {low
          ? <span className="p-stock text-red">تنها {faNum(product.stock)} عدد در انبار</span>
          : out
            ? <span className="p-stock text-red">ناموجود</span>
            : <span className="p-stock muted">موجود در انبار مدرس‌یار</span>}
        <div className="p-foot">
          <div className="price-box" style={{ fontSize: 14.5 }}>
            {product.oldPrice && <span className="old">{faNum(product.oldPrice)}</span>}
            {out ? <span className="muted">ناموجود</span> : toman(product.price)}
          </div>
          <button
            className={`mk-add ${out ? 'disabled' : ''}`}
            onClick={add}
            disabled={out}
            aria-label="افزودن به سبد"
            title={out ? 'ناموجود' : 'افزودن به سبد خرید'}
          >
            <ShoppingCart size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
