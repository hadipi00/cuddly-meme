import { useEffect, useId, useRef } from 'react'
import Icon from './Icon'

/* لوگوی مدرن مدرس‌یار — سکویرکل گرادیانی + کلاه فارغ‌التحصیلی + شرابه
 * گرادیان با useId یکتا می‌شود تا چند نمونه روی یک صفحه تداخل ID نداشته باشند */
export function Logo({ size = 40 }) {
  const id = useId().replace(/:/g, '')
  const g = `mg-${id}`
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className="logo-mark" aria-hidden="true">
      <defs>
        <linearGradient id={g} x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2dd4bf" />
          <stop offset=".55" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="18" fill={`url(#${g})`} />
      <path d="M32 15.5 L53.5 25 L32 34.5 L10.5 25 Z" fill="#ffffff" />
      <path d="M21.5 30.8 v7.4 c0 3.4 4.7 6.2 10.5 6.2 s10.5-2.8 10.5-6.2 v-7.4 l-10.5 4.7 Z" fill="#ffffff" opacity=".93" />
      <circle cx="32" cy="24.6" r="1.9" fill="#38bdf8" />
      <path d="M51 26.6 v7.4" stroke="#ffffff" strokeWidth="2.6" strokeLinecap="round" />
      <circle cx="51" cy="37.6" r="2.9" fill="#ffd54d" />
      <path d="M13.5 45.5 l4.6 0 M15.8 43.2 l0 4.6" stroke="#ffffff" strokeWidth="2.2" strokeLinecap="round" opacity=".95" />
    </svg>
  )
}

export function Brand({ small }) {
 return (
 <div className="brand">
 <Logo />
 <div>
 مدرس‌یار
 {!small && <small>MODARESYAR</small>}
 </div>
 </div>
 )
}

export function RatingStars({ value = 5, showNum = false }) {
 return (
 <span className="stars" title={`${value} از ۵`}>
 {[1, 2, 3, 4, 5].map((i) => (
 <Icon key={i} name="star" size={14} filled={i <= Math.round(value)} className={i > Math.round(value) ? 'off' : ''} />
 ))}
 {showNum && <span className="rating-line">{value.toLocaleString('fa-IR')}</span>}
 </span>
 )
}

/** نمایان‌سازی نرم — نسخه ضدخطا
 *  تضمین می‌کند محتوا هرگز نامرئی نماند:
 *  ۱) عنصر داخل دید اولیه → فوراً نمایش
 *  ۲) IntersectionObserver برای انیمیشن هنگام اسکرول
 *  ۳) اگر کاربر با اسکرول سریع/درگ اسکرول‌بار از روی عنصر رد شود
 *     (IO دیگر fire نمی‌شود) → تشخیص «بالای viewport» و نمایش
 *  ۴) تایمر اطمینان: حداکثر ~۱ ثانیه بعد، هر عنصری نمایش داده می‌شود
 *  ۵) با prefers-reduced-motion انیمیشن کلاً غیرفعال می‌شود (CSS) */
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div', ...rest }) {
 const ref = useRef(null)
 useEffect(() => {
 const el = ref.current
 if (!el) return
 const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
 if (reduce || !('IntersectionObserver' in window)) {
 el.classList.add('is-in')
 return
 }
 el.style.transitionDelay = `${delay}ms`
 let done = false
 const show = () => {
 if (done) return
 done = true
 el.classList.add('is-in')
 io.disconnect()
 clearTimeout(safety)
 }
 const io = new IntersectionObserver(
 (entries) => {
 for (const e of entries) {
 /* isIntersecting = در دید است؛ boundingRect.top < 0 = کاربر از روی آن رد شده */
 if (e.isIntersecting || e.boundingClientRect.top < 0) show()
 }
 },
 { threshold: 0.08 }
 )
 io.observe(el)
 /* تور ایمن نهایی — هیچ محتوایی بیش از ~۱ ثانیه پنهان نمی‌ماند */
 const safety = setTimeout(show, 1000 + delay)
 return () => { io.disconnect(); clearTimeout(safety) }
 }, [delay])
 return (
 <Tag ref={ref} className={`reveal ${className}`} {...rest}>
 {children}
 </Tag>
 )
}

export function EmptyState({ icon = 'search', text = 'موردی یافت نشد.' }) {
 return (
 <div className="empty">
 <Icon name={icon} />
 <p>{text}</p>
 </div>
 )
}

export function Avatar({ name = '', color = 'grad-0', size = 40 }) {
 const ini = name.split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('')
 return (
 <span className={`avatar ${color}`} style={{ width: size, height: size, fontSize: size * 0.34 }}>
 {ini}
 </span>
 )
}
