import { useEffect } from 'react'

/* ============================================================
   Seo v2 — مدیریت کامل متاتگ‌ها و داده ساختاریافته هر صفحه
   ------------------------------------------------------------
   - title/description/keywords/canonical
   - OpenGraph کامل (+og:image 1200×630) و Twitter Card (large)
   - robots: صفحات خصوصی (پنل، پرداخت) با noindex از گوگل حذف می‌شوند
   - hreflang (fa-IR + x-default) برای سیگنال زبان
   - jsonLd: آبجکت یا آرایه‌ای از اسکیماها (Product/Course/Article/
     BreadcrumbList/Event…) برای ریچ‌ریزالت گوگل
   - کمکی‌های crumbsJsonLd و orgJsonLd برای ساخت اسکیمای استاندارد
   نکته: بعد از اتصال دامنه اصلی، فقط کافی است ORIGIN را عوض کنید.
   ============================================================ */

export const ORIGIN = 'https://modaresyar.ir'
export const SITE_NAME = 'مدرس‌یار'
export const DEFAULT_DESC =
  'خرید کلاس‌های آنلاین، دوره‌های ضبط‌شده و لوازم‌التحریر از مدرس‌مارکت — با مدرس‌یار یاد بگیر، پیشرفت کن.'
export const OG_IMAGE = '/og-cover.jpg'

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

function upsertLink(rel, href, extra) {
  if (!href) return
  let el = document.head.querySelector(`link[rel="${rel}"]${extra || ''}`)
  if (!el) {
    el = document.createElement('link')
    el.setAttribute('rel', rel)
    if (extra) el.setAttribute('data-s', extra.replace(/[\[\]='"\\]/g, ''))
    document.head.appendChild(el)
  }
  el.setAttribute('href', href)
}

/* بوردکرامب استاندارد — در صفحاتی که مسیر راهنما دارند */
export function crumbsJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name,
      item: ORIGIN + path,
    })),
  }
}

/* اسکیمای فروشگاه/سازمان — برای صفحات فروشگاهی مدرس‌مارکت */
export function storeJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'OnlineStore',
    name: 'مدرس‌مارکت',
    url: `${ORIGIN}/market`,
    parentOrganization: { '@id': `${ORIGIN}/#org` },
    areaServed: 'IR',
    currenciesAccepted: 'IRR',
    paymentAccepted: 'کارت بانکی، پیش‌کرایه، پس‌کرایه',
  }
}

export default function Seo({
  title,
  description = DEFAULT_DESC,
  path, // مسیر canonical؛ پیش‌فرض: مسیر فعلی مرورگر (بدون query)
  type = 'website',
  robots = 'index, follow, max-image-preview:large',
  image = OG_IMAGE, // مسیر نسبی یا URL کامل تصویر اشتراک‌گذاری
  imageAlt,
  publishedTime, // ISO — برای مقالات بلاگ
  keywords,
  jsonLd, // آبجکت، یا آرایه‌ای از آبجکت‌های schema.org
}) {
  const jsonLdKey = jsonLd ? JSON.stringify(jsonLd) : ''

  useEffect(() => {
    const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} | پلتفرم کلاس آنلاین و فروش دوره‌های آموزشی`
    const pathname = path || window.location.pathname
    const url = ORIGIN + pathname
    const img = image.startsWith('http') ? image : ORIGIN + image

    document.title = fullTitle
    upsertMeta('name', 'description', description)
    upsertMeta('name', 'robots', robots)
    if (keywords) upsertMeta('name', 'keywords', keywords)
    upsertMeta('property', 'og:title', fullTitle)
    upsertMeta('property', 'og:description', description)
    upsertMeta('property', 'og:type', type === 'article' ? 'article' : type)
    upsertMeta('property', 'og:url', url)
    upsertMeta('property', 'og:site_name', SITE_NAME)
    upsertMeta('property', 'og:locale', 'fa_IR')
    upsertMeta('property', 'og:image', img)
    upsertMeta('property', 'og:image:width', '1200')
    upsertMeta('property', 'og:image:height', '630')
    upsertMeta('property', 'og:image:alt', imageAlt || `${SITE_NAME} — ${title || 'صفحه نخست'}`)
    if (publishedTime) {
      upsertMeta('property', 'article:published_time', publishedTime)
      upsertMeta('property', 'article:author', SITE_NAME)
    }
    upsertMeta('name', 'twitter:card', 'summary_large_image')
    upsertMeta('name', 'twitter:title', fullTitle)
    upsertMeta('name', 'twitter:description', description)
    upsertMeta('name', 'twitter:image', img)
    upsertLink('canonical', url)
    // hreflang — سیگنال زبان فارسی برای گوگل
    upsertLink('alternate', url, '[hreflang="fa-IR"]')
    upsertLink('alternate', url, '[hreflang="x-default"]')

    // داده ساختار یافته صفحه — هر بار به‌روزرسانی کامل می‌شود
    document.querySelectorAll('script[data-page-jsonld]').forEach((n) => n.remove())
    const blocks = jsonLdKey
      ? (Array.isArray(jsonLd) ? jsonLd : [jsonLd])
      : []
    blocks.forEach((obj) => {
      const s = document.createElement('script')
      s.type = 'application/ld+json'
      s.setAttribute('data-page-jsonld', '1')
      s.textContent = JSON.stringify(obj)
      document.head.appendChild(s)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, path, type, robots, image, imageAlt, publishedTime, keywords, jsonLdKey])

  return null
}
