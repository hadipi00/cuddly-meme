import { Component } from 'react'
import { AlertTriangle, RotateCcw, Home, WifiOff } from 'lucide-react'

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
              <button className="btn btn-soft" onClick={() => this.setState({ error: null })}>
                تلاش مجدد همین بخش
              </button>
              <button className="btn btn-ghost" onClick={this.goHome}>
                <Home size={15} /> صفحه اصلی
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
