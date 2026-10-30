/* ============================================================
   پیش‌بارگذاری صفحات (Route Prefetch) — رفع کندی ناوبری
   ------------------------------------------------------------
   مشکل: با code-splitting، هر ناوبری یک درخواست شبکه برای chunk
   صفحه جدید می‌خواهد → روی اینترنت ایران حس کندی ایجاد می‌کند.
   راه‌حل:
   ۱) روی hover/focus هر لینک داخلی، chunk مقصد پیش‌بارگذاری می‌شود
      (تا کاربر کلیک کند، صفحه از قبل آماده است)
   ۲) بعد از لود اولیه، در وقت بیکاری CPU مسیرهای پرتکرار
      پیش‌بارگذاری می‌شوند.
   نکته: این نقشه باید با مسیرهای App.jsx هماهنگ بماند.
   ============================================================ */

const EXACT_ROUTES = {
  '/': () => import('../pages/Home'),
  '/resume': () => import('../pages/Resume'),
  '/courses': () => import('../pages/Courses'),
  '/live': () => import('../pages/LiveClasses'),
  '/teachers': () => import('../pages/Teachers'),
  '/market': () => import('../pages/Market'),
  '/blog': () => import('../pages/Blog'),
  '/checkout': () => import('../pages/Checkout'),
  '/order-success': () => import('../pages/OrderSuccess'),
  '/contact': () => import('../pages/Contact'),
  '/auth': () => import('../pages/Auth'),
}

const PREFIX_ROUTES = {
  '/courses/': () => import('../pages/CourseDetail'),
  '/teachers/': () => import('../pages/TeacherProfile'),
  '/market/': () => import('../pages/ProductDetail'),
  '/blog/': () => import('../pages/BlogPost'),
}

const done = new Set()

/** chunk یک مسیر را یک‌بار (و فقط یک‌بار) پیش‌بارگذاری می‌کند */
export function prefetch(path) {
  if (!path || typeof path !== 'string' || !path.startsWith('/')) return
  const clean = path.split('?')[0].split('#')[0]
  const exact = EXACT_ROUTES[clean]
  if (exact && !done.has(clean)) {
    done.add(clean)
    exact().catch(() => done.delete(clean)) // در صورت شکست، تلاش دوباره مجاز است
    return
  }
  for (const key of Object.keys(PREFIX_ROUTES)) {
    if (clean.startsWith(key) && !done.has(clean)) {
      done.add(clean)
      PREFIX_ROUTES[key]().catch(() => done.delete(clean))
      return
    }
  }
}

/** شنونده‌های سراسری hover/focus + گرم‌کردن مسیرهای پرتکرار */
export function initPrefetch() {
  const onHover = (e) => {
    const a = e.target?.closest?.('a[href^="/"]')
    if (a) prefetch(a.getAttribute('href'))
  }
  document.addEventListener('pointerover', onHover, { capture: true, passive: true })
  document.addEventListener('focusin', onHover, { capture: true })

  const warm = () => ['/courses', '/market', '/teachers', '/live', '/blog'].forEach(prefetch)
  const t = setTimeout(() => {
    if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 4000 })
    else warm()
  }, 2500)

  return () => {
    document.removeEventListener('pointerover', onHover, { capture: true })
    document.removeEventListener('focusin', onHover, { capture: true })
    clearTimeout(t)
  }
}
