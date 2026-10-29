import { useEffect, useRef } from 'react'
import Icon from './Icon'

export function Logo() {
  return (
    <svg viewBox="0 0 64 64" width="40" height="40" className="logo-mark" aria-hidden="true">
      <defs>
        <linearGradient id="lg1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#2dd4bf" /><stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="rgba(148,163,184,0.08)" stroke="rgba(148,163,184,0.2)" />
      <path d="M10 26 32 14l22 12-22 12z" fill="url(#lg1)" />
      <path d="M20 33v9c0 4 6 7 12 7s12-3 12-7v-9l-12 6z" fill="url(#lg1)" opacity=".8" />
      <circle cx="50" cy="18" r="3" fill="#fbbf24" />
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

/** نمایان‌سازی نرم هنگام اسکرول */
export function Reveal({ children, delay = 0, className = '', as: Tag = 'div', ...rest }) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.transitionDelay = `${delay}ms`
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { el.classList.add('is-in'); io.disconnect() } },
      { threshold: 0.12 }
    )
    io.observe(el)
    return () => io.disconnect()
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
