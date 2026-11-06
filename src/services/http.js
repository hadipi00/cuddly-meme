// =====================================================================
// کلاینت HTTP بک‌اند واقعی — توکن JWT + تشخیص قطع سرور (fallback به دمو)
// همه درخواست‌ها same-origin از مسیر /api (در dev پروکسی Vite → :4000)
// ---------------------------------------------------------------------
// معماری سشن ماندگار [مهاجرت CRM/B30]:
//   • توکن دسترسی کوتاه‌مدت (۳۰دقیقه) — «به ازای هر تب» ذخیره می‌شود
//     (sessionStorage) تا بتوان در یک مرورگر همزمان با دو حساب تست کرد؛
//     آخرین ورود در localStorage می‌ماند تا تب‌های جدید هم وارد شوند.
//   • توکن تازه‌سازی یک‌ساله در localStorage — سشن با هر 401 خودکار و
//     بی‌سروصدا تمدید می‌شود (چرخش سمت سرور)؛ یعنی تا وقتی مرورگر/دستگاه
//     عوض نشود کاربر هرگز از حساب خارج نمی‌شود.
//   • اگر چند درخواست همزمان 401 بگیرند فقط «یک» تازه‌سازی انجام می‌شود
//     (single-flight) و بعدش همه درخواست‌ها دوباره می‌روند.
// =====================================================================

const TOKEN_KEY = 'modaresyar:token'
const SESSION_KEY = 'modaresyar:token:tab'
const REFRESH_KEY = 'modaresyar:refresh'

export const getToken = () => {
  try { return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export const setToken = (t) => {
  try {
    if (t) {
      sessionStorage.setItem(SESSION_KEY, t)
      localStorage.setItem(TOKEN_KEY, t) // آخرین ورود → برای تب‌های جدید
    } else {
      sessionStorage.removeItem(SESSION_KEY)
      localStorage.removeItem(TOKEN_KEY)
    }
  } catch { /* ignore */ }
}

/* توکن تازه‌سازی — مشترک بین تب‌های یک مرورگر؛ سرور مهلت هم‌زمانی تب‌ها را پوشش می‌دهد */
export const getRefresh = () => {
  try { return localStorage.getItem(REFRESH_KEY) } catch { return null }
}
export const setRefresh = (t) => {
  try {
    if (t) localStorage.setItem(REFRESH_KEY, t)
    else localStorage.removeItem(REFRESH_KEY)
  } catch { /* ignore */ }
}

/** وضعیت دسترس‌پذیری سرور — بعد از اولین خطای شبکه false می‌شود */
let serverUp = null
export const isServerUp = () => serverUp
export const markServerUp = (v) => { serverUp = v }

/* ---------- تازه‌سازی بی‌سروصدا با single-flight ---------- */
let refreshFlight = null
/** [فیکس باگ «کلاس شروع نمیشود»] مرگ نشست باید «بلند» اعلام شود.
 *  قبلاً 401 نهایی فقط در همان کامپوننت catch می‌شد → پنل با user ماندگارِ
 *  localStorage «زامبی» می‌ماند، TLiveRoom به کلاس‌های دموی قلابی می‌افتید،
 *  POST /start با 401 شکست می‌خورد و دانش‌آموز برای همیشه روی «زمان‌بندی شده» می‌ماند.
 *  حالا هر 401ِ نهایی (بعد از تلاش تازه‌سازی) رخداد سراسری پخش می‌کند تا
 *  AppContext کاربر را پاک و به صفحه ورود برگرداند. */
export const SESSION_EXPIRED_EVENT = 'modaresyar:session-expired'
export const announceSessionExpired = () => {
  try { window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT)) } catch { /* noop */ }
}

export function doRefresh() {
  if (refreshFlight) return refreshFlight
  refreshFlight = (async () => {
    try {
      const rt = getRefresh()
      if (!rt) return null
      const res = await fetch('/api/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      })
      if (!res.ok) {
        setRefresh(null) // سشن واقعاً تمام/ابطال شده — ورود مجدد لازم است
        setToken(null)
        announceSessionExpired() // [فیکس] به کل اپ اعلام کن: نشست مرده است
        return null
      }
      const d = await res.json().catch(() => null)
      if (d?.token) {
        setToken(d.token)
        if (d.refreshToken) setRefresh(d.refreshToken)
        return d
      }
      return null
    } catch { return null } /* قطع شبکه — تلاش مجدد بعدی */
  })()
  setTimeout(() => { refreshFlight = null }, 250)
  return refreshFlight
}

/* مسیرهایی که خودشان احراز هویت‌اند — برای آن‌ها تازه‌سازی/تلاش مجدد بی‌معناست */
const AUTH_PATHS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/otp', '/auth/logout']

/* [فیکس «همش میگه نشست منقضی شده»] پیام «نشست منقضی» فقط وقتی واقعی است که
 * درخواستِ شکست‌خورده اصلاً توکن داشته باشد؛ ۴۰۱ِ یک بازدیدکنندهٔ ناشناس
 * (مثلاً poll صفحهٔ عمومی) نشست مرده نیست و نباید کل اپ را به ورود بفرستد */
const isAuthPath = (path) => AUTH_PATHS.some((p) => path.startsWith(p))

/** fetch با پشتیبانی توکن — برای درخواست‌های باینری/استریم که از req() استفاده نمی‌کنند.
 *  [فیکس «ارسال با وقفه افتاده — برای همیشه»] آپلود تکه‌های رسانهٔ کلاس زنده قبلاً با
 *  fetch خام بود؛ وقتی توکن دسترسی ۳۰دقیقه‌ای وسط کلاس منقضی می‌شد، همهٔ تکه‌ها
 *  ۴۰۱ می‌خوردند، هیچ تازه‌سازی‌ای انجام نمی‌شد و صدا/تصویر مدرس برای همیشه
 *  قطع می‌ماند. حالا مثل req(): روی ۴۰۱ یک‌بار توکن تازه‌سازی بی‌صدا می‌شود و
 *  درخواست با توکن تازه تکرار می‌شود (single-flight مشترک با بقیهٔ اپ) */
export async function authedFetch(url, { headers = {}, ...opts } = {}) {
  const h = { ...headers }
  const t = getToken()
  if (t) h.Authorization = `Bearer ${t}`
  let res = await fetch(url, { ...opts, headers: h })
  if (res.status === 401 && getRefresh()) {
    const r = await doRefresh()
    if (r?.token) {
      h.Authorization = `Bearer ${r.token}`
      res = await fetch(url, { ...opts, headers: h })
    }
  }
  return res
}

/**
 * درخواست به API مدرس‌یار
 * @returns {Promise<Object>} پاسخ JSON سرور
 * @throws Error با پرچم serverDown=true اگر سرور در دسترس نباشد (→ حالت دمو)
 */
export async function req(path, { method = 'GET', body, timeout = 0, _retried = false } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  const ac = timeout > 0 ? new AbortController() : null
  const tid = ac ? setTimeout(() => ac.abort(), timeout) : null
  let res
  try {
    res = await fetch('/api' + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ac?.signal,
    })
  } catch (err) {
    if (tid) clearTimeout(tid)
    serverUp = false
    const e = new Error(err?.name === 'AbortError' ? 'TIMEOUT' : 'SERVER_DOWN')
    e.serverDown = err?.name !== 'AbortError'
    e.timeout = err?.name === 'AbortError'
    throw e
  }

  if (tid) clearTimeout(tid)
  serverUp = true
  let data = {}
  try { data = await res.json() } catch { /* پاسخ خالی */ }
  if (!res.ok) {
    // خطای گِیت‌وی/پروکسی = بک‌اند موقتاً در دسترس نیست (مثلاً وسط ری‌استارت pm2):
    // پراکسی 5xx بدون بدنه JSON برمی‌گرداند؛ خطای واقعی API همیشه پیام فارسی دارد.
    const gatewayDown = res.status >= 500 && (res.status !== 500 || !data?.error)
    if (gatewayDown) {
      serverUp = false
      const e = new Error('SERVER_DOWN')
      e.serverDown = true
      throw e
    }
    /* [سشن ماندگار] توکن دسترسی منقضی شده → بی‌سروصدا تازه‌سازی + تلاش مجدد (فقط یک‌بار) */
    if (res.status === 401 && !_retried && !isAuthPath(path) && getRefresh()) {
      const r = await doRefresh()
      if (r?.token) return req(path, { method, body, timeout, _retried: true })
    }
    /* [فیکس] 401 نهایی = نشست مرده — فقط اگر درخواست واقعاً توکن داشت.
       ۴۰۱ِ ناشناس (بدون هیچ نشستی) فقط یک «دسترسی مجاز نیست» است و نباید
       toast «نشست منقضی» بفرستد و توکن‌های احتمالاً معتبر تب‌های دیگر را پاک کند */
    if (res.status === 401 && !isAuthPath(path) && token) {
      announceSessionExpired()
    }
    const e = new Error(data?.error || `خطای سرور (${res.status})`)
    e.status = res.status
    /* [فیکس F10] پرچم‌های بدنهٔ خطا روی Error کپی می‌شوند — قبلاً دور ریخته می‌شدند و
        چک‌های `e.expired` / `e.in_progress` / `e.done` در جریان آزمون هرگز true نمی‌شدند:
        SExamResult برای همیشه «در حال بارگذاری» و autosave حلقهٔ بی‌پایان ۴۰۹ می‌زد */
    if (data && typeof data === 'object') Object.assign(e, data)
    throw e
  }
  return data
}
