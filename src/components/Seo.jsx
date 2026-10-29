import { useEffect } from 'react'

/* ============================================================
   Seo — مدیریت متاتگ‌ها و داده ساختاریافته هر صفحه (بدون وابستگی)
   ------------------------------------------------------------
   - title/description/canonical/OpenGraph/Twitter هر صفحه
   - robots: صفحات خصوصی (پنل، پرداخت) با noindex از گوگل حذف می‌شوند
   - jsonLd: اسکیمای Course/Product/FAQ… برای ریچ‌ریزالت گوگل
   نکته: بعد از اتصال دامنه اصلی، فقط کافی است ORIGIN را عوض کنید.
   ============================================================ */

export const ORIGIN = 'https://modaresyar.ir'
export const SITE_NAME = 'مدرس‌یار'
export const DEFAULT_DESC =
  'خرید کلاس‌های آنلاین، دوره‌های ضبط‌شده و لوازم‌التحریر از مدرس‌مارکت — با مدرس‌یار یاد بگیر، پیشرفت کن.'

function upsertMeta(attr, key, content) {
  if (!content) return
  let el = document.head.querySelector(`meta[${attr}="${key}"]`)
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(attr, key)
    document.head.appendChild(el)
  }
  el.setAttribute('content', content)
}

function upsertLink(rel, href) {
  if (!href) return
  let el = document.head.querySelector(`link[rel="${rel}"]`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

export default function Seo({
  title,
  description = DEFAULT_DESC,
  path, // مسیر canonical؛ پیش‌فرض: مسیر فعلی مرورگر
  type = 'website',
  robots = 'index, follow, max-image-preview:large',
  jsonLd, // آبجکت یا آرایه‌ای از آبجکت‌های schema.org
}) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : ''

  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | پلتفرم کلاس آنلاین و فروش دوره‌های آموزشی`
    const url = ORIGIN + (path || window.location.pathname)

    document.title = fullTitle
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', robots)
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:type', type)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:locale', 'fa_IR')
    upsertMeta('name', 'twitter:card', 'summary')
    upsertMeta('name', 'twitter:title', fullTitle)
    upsertMeta('name', 'twitter:description', description)
    upsertLink('canonical', url)

    // داده ساختاریافته صفحه — هر بار به‌روزرسانی کامل می‌شود
    document.getElementById('my-page-jsonld')?.remove()
    if (jsonLdKey) {
      const s = document.createElement('script')
      s.id = 'my-page-jsonld'
      s.type = 'application/ld+json'
      s.textContent = jsonLdKey
      document.head.appendChild(s)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, type, robots, jsonLdKey])

  return null
}
