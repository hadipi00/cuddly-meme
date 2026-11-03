import { Component, useEffect, useRef } from 'react'
import { AlertTriangle, RotateCcw, Home, WifiOff } from 'lucide-react'
import { useLocation } from 'react-router-dom'

/**
 * مرز خطا (Error Boundary) — اگر هر بخشی از برنامه خطای زمان‌اجرایی بدهد،
 * به‌جای صفحه سفید، این پیام دوستانه نمایش داده می‌شود.
 *
 * تشخیص خاص: خطاهای بارگذاری chunk (قطعی اینترنت / کش قدیمی بعد از آپدیت)
 * با پیام متفاوت نمایش داده می‌شوند تا کاربر بداند مشکل «اتصال» است نه سایت.
 */
const isChunkError = (e) => {
  const m = `${e?.message || ''} ${e?.stack || ''}`
  return /dynamically imported module|loading chunk|chunkloaderror|failed to fetch|networkerror|load failed/i.test(m)
}

export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  /* [فیکس F27] crash لاگ می‌شود — قبلاً خطاهای production کاملاً بی‌ردپا بودند */
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error?.stack || error, '\ncomponentStack:', info?.componentStack || '')
    try {
      const body = JSON.stringify({ message: String(error?.message || error), stack: String(error?.stack || '').slice(0, 4000), path: window.location.pathname, at: Date.now() })
      navigator.sendBeacon?.('/api/client-errors', new Blob([body], { type: 'application/json' }))
        || fetch('/api/client-errors', { method: 'POST', body, keepalive: true, headers: { 'Content-Type': 'application/json' } }).catch(() => {})
    } catch { /* noop */ }
  }

  goHome = () => {
    this.setState({ error: null })
    window.location.href = '/'
  }

  render() {
    if (this.state.error) {
      const chunk = isChunkError(this.state.error)
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card pad" style={{ maxWidth: 560, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              {chunk ? <WifiOff size={44} color="#fb7185" /> : <AlertTriangle size={44} color="#fbbf24" />}
            </div>
            <h2 style={{ marginBottom: 10 }}>{chunk ? 'این بخش بارگذاری نشد' : 'مشکلی پیش آمد!'}</h2>
            <p className="muted" style={{ marginBottom: 24, lineHeight: 2 }}>
              {chunk
                ? 'به‌احتمال زیاد اتصال اینترنت لحظه‌ای قطع بوده یا نسخه‌ی سایت به‌تازگی به‌روزرسانی شده است. یک‌بار صفحه را دوباره بارگذاری کنید؛'
                : 'یک خطای غیرمنتظره در برنامه رخ داد.'}{' '}
              نگران نباشید، اطلاعات شما (سبد خرید و حساب) ذخیره مانده است.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                <RotateCcw size={15} /> بارگذاری مجدد صفحه
              </button>
              {/* [فیکس F27] ریست خودکار خطا با ناوبری — قبلاً back مرورگر هم بهبود نمی‌داد
                  چون router داخل subtree رندرنشده بود */}
              <ErrorReset onReset={() => this.setState({ error: null })} />
              <button className="btn btn-ghost" onClick={this.goHome}>
                <Home size={15} /> صفحه اصلی
              </button>
            </div>
            {/* در توسعه پیام خطا نمایش داده می‌شود تا ریشه باگ پیدا شود؛ در بیلد production مخفی است */}
            {import.meta.env.DEV && (
              <pre dir="ltr" style={{ marginTop: 18, maxHeight: 140, overflow: 'auto', textAlign: 'left', fontSize: 11, opacity: .7, whiteSpace: 'pre-wrap' }}>
                {String(this.state.error?.stack || this.state.error?.message || this.state.error)}
              </pre>
            )}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

/* [فیکس F27] ریست خطا با تغییر مسیر — کلید «تلاش مجدد» همان درخت crasher را دوباره
   رندر می‌کرد؛ حالا با تغییر pathname خطا پاک می‌شود تا back/forward هم بهبود بدهد */
function ErrorReset({ onReset }) {
  const { pathname } = useLocation()
  const prev = useRef(pathname)
  useEffect(() => {
    if (prev.current !== pathname) {
      prev.current = pathname
      onReset()
    }
  }, [pathname, onReset])
  return <button className="btn btn-soft" onClick={onReset}>تلاش مجدد همین بخش</button>
}
