import { useEffect, useState } from 'react'
import { req } from './http'

/* =====================================================================
 * [فیکس F16-d] تنظیمات عمومی سایت از بک‌اند — Footer و Contact به‌جای
 * مقادیر ثابت باندل، نام/تلفن/ایمیل/آدرس/ساعات کاری ذخیره‌شده در پنل
 * ادمین را نشان می‌دهند (fallback: همان config استاتیک site).
 * یک fetch در عمر تب + کش ماژولی؛ خطا بی‌صدا → config استاتیک می‌ماند.
 * ===================================================================== */

let cached = null
let pending = null

export function fetchPublicSettings() {
 if (cached) return Promise.resolve(cached)
 if (pending) return pending
 pending = req('/settings/public')
 .then((r) => {
 cached = r || {}
 return cached
 })
 .catch(() => {
 cached = { site: {}, registrationOpen: true, maintenance: false }
 return cached
 })
 .finally(() => { pending = null })
 return pending
}

/** مقدار ترکیبی: تنظیم سرور اول، بعد مقدار استاتیک site */
export const pick = (srvVal, staticVal) => (srvVal && String(srvVal).trim() ? srvVal : staticVal)

/** هوک سبک: بعد از گرفتن تنظیمات یک بار re-render می‌کند */
export function useSiteSettings() {
 const [v, setV] = useState(cached)
 useEffect(() => {
 let alive = true
 fetchPublicSettings().then((r) => { if (alive) setV(r) })
 return () => { alive = false }
 }, [])
 return v || { site: {}, registrationOpen: true, maintenance: false }
}
