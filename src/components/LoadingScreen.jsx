import { Logo } from './ui'

/** صفحه بارگذاری سراسری — هنگام lazy loading صفحات نمایش داده می‌شود */
export function LoadingScreen({ label = 'در حال بارگذاری…' }) {
  return (
    <div className="loading-screen" role="status" aria-label={label}>
      <Logo />
      <div className="spinner" />
      <span className="muted small">{label}</span>
    </div>
  )
}
