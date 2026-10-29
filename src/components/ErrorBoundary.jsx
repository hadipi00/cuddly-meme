import { Component } from 'react'

/**
 * مرز خطا (Error Boundary) — اگر هر بخشی از برنامه خطای زمان‌اجرایی بدهد،
 * به‌جای صفحه سفید، این پیام دوستانه نمایش داده می‌شود.
 */
export default class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div className="card pad" style={{ maxWidth: 560, textAlign: 'center' }}>
            <div style={{ fontSize: 46, marginBottom: 10 }}>⚠️</div>
            <h2 style={{ marginBottom: 10 }}>مشکلی پیش آمد!</h2>
            <p className="muted" style={{ marginBottom: 24, lineHeight: 2 }}>
              یک خطای غیرمنتظره در برنامه رخ داد. نگران نباشید، اطلاعات شما (سبد خرید و حساب)
              ذخیره مانده است. می‌توانید صفحه را دوباره بارگذاری کنید.
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={() => window.location.reload()}>
                بارگذاری مجدد صفحه
              </button>
              <button className="btn btn-soft" onClick={() => this.setState({ error: null })}>
                تلاش مجدد
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
