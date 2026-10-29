// =====================================================================
// کلاینت HTTP بک‌اند واقعی — توکن JWT + تشخیص قطع سرور (fallback به دمو)
// همه درخواست‌ها same-origin از مسیر /api (در dev پروکسی Vite → :4000)
// ---------------------------------------------------------------------
// توکن «به ازای هر تب» ذخیره می‌شود (sessionStorage) تا بتوان در یک مرورگر
// همزمان با دو حساب (مدرس در یک تب + دانش‌آموز در تب دیگر) تست کرد؛
// آخرین ورود در localStorage می‌ماند تا تب‌های جدید هم وارد شوند.
// =====================================================================

const TOKEN_KEY = 'modaresyar:token'
const SESSION_KEY = 'modaresyar:token:tab'

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

/** وضعیت دسترس‌پذیری سرور — بعد از اولین خطای شبکه false می‌شود */
let serverUp = null
export const isServerUp = () => serverUp
export const markServerUp = (v) => { serverUp = v }

/**
 * درخواست به API مدرس‌یار
 * @returns {Promise<Object>} پاسخ JSON سرور
 * @throws Error با پرچم serverDown=true اگر سرور در دسترس نباشد (→ حالت دمو)
 */
export async function req(path, { method = 'GET', body } = {}) {
  const headers = {}
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`

  let res
  try {
    res = await fetch('/api' + path, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    })
  } catch {
    serverUp = false
    const e = new Error('SERVER_DOWN')
    e.serverDown = true
    throw e
  }

  serverUp = true
  let data = {}
  try { data = await res.json() } catch { /* پاسخ خالی */ }
  if (!res.ok) {
    const e = new Error(data?.error || `خطای سرور (${res.status})`)
    e.status = res.status
    throw e
  }
  return data
}
