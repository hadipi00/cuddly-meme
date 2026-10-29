import { Link, useNavigate } from 'react-router-dom'
import Icon from './Icon'
import { RatingStars } from './ui'
import { useApp } from '../store/AppContext'
import { faNum, toman } from '../utils/format'

export function CourseCard({ course, myProgress }) {
  const { wishlist, toggleWish, addToCart, toast } = useApp()
  const nav = useNavigate()
  const wished = wishlist.some((w) => w.id === course.id)
  return (
    <div className="card course-card" onClick={() => nav(`/courses/${course.id}`)}>
      <div className={`c-thumb ${course.color}`}>
        <span className="c-emoji">{course.emoji}</span>
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
          <span><Icon name="user" size={14} /> {course.teacher}</span>
          <span><Icon name="clock" size={14} /> {faNum(course.hours)} ساعت</span>
          <span><Icon name="play" size={14} /> {faNum(course.lessonsCount)} درس</span>
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
            onClick={(e) => { e.stopPropagation(); toggleWish({ id: course.id, name: course.title, emoji: course.emoji, color: course.color, price: course.price, kind: 'course' }) }}
            aria-label="علاقه‌مندی"
          >
            <Icon name="heart" filled={wished} />
          </button>
          <button className="btn btn-soft btn-sm" onClick={(e) => {
            e.stopPropagation()
            addToCart({ id: course.id, name: course.title, price: course.price, emoji: course.emoji, color: course.color, kind: 'course' })
            toast('دوره به سبد خرید اضافه شد')
          }}>
            <Icon name="cart" size={15} /> افزودن
          </button>
        </div>
      </div>
    </div>
  )
}

export function ProductCard({ product }) {
  const { addToCart, toast } = useApp()
  const nav = useNavigate()
  return (
    <div className="card product-card" onClick={() => nav(`/market/${product.id}`)}>
      <div className={`p-thumb ${product.color}`}>
        <span className="p-emoji">{product.emoji}</span>
        {product.badge && <span className="badge b-amber p-badge">{product.badge}</span>}
      </div>
      <div className="p-body">
        <span className="c-cat">{product.cat}</span>
        <h3>{product.name}</h3>
        <div className="rating-line"><RatingStars value={product.rating} /></div>
        <span className={`p-stock ${product.stock < 20 ? 'text-red' : 'muted'}`}>
          {product.stock > 0 ? <>موجودی: {faNum(product.stock)} عدد</> : 'ناموجود'}
        </span>
        <div className="p-foot">
          <div className="price-box" style={{ fontSize: 14.5 }}>
            {product.oldPrice && <span className="old">{faNum(product.oldPrice)}</span>}
            {toman(product.price)}
          </div>
          <button className="btn btn-soft btn-sm" onClick={(e) => {
            e.stopPropagation()
            addToCart({ id: product.id, name: product.name, price: product.price, emoji: product.emoji, color: product.color, kind: 'market' })
            toast('به سبد خرید اضافه شد')
          }}>
            <Icon name="cart" size={15} />
          </button>
        </div>
      </div>
    </div>
  )
}
