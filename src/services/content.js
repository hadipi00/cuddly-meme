// =====================================================================
// لایه محتوای عمومی — کاتالوگ/مارکت/بلاگ/اساتید از بک‌اند واقعی
// ---------------------------------------------------------------------
// قبلاً صفحات عمومی مستقیم از src/data/mock.js می‌خواندند (ناقصی:
// محتوا به بک‌اند وصل نبود و قابل مدیریت نبود). حالا اول سرور، و در
// نبود سرور همان داده موک — تا سایت آفلاین هم بشکند.
// =====================================================================
import { useEffect, useState } from 'react'
import { req } from './http'
import * as M from '../data/mock'

/** GET با فال‌بک: پاسخ سرور (r[key]) و در خطا داده موک */
const fetchOr = (path, key, fallback) =>
 req(path).then((r) => (r?.[key] != null ? r[key] : fallback)).catch(() => fallback)

export const content = {
 courses: () => fetchOr('/courses', 'courses', M.courses),
 course: (id) => fetchOr(`/courses/${id}`, 'course', M.courses.find((c) => c.id === Number(id))),
 courseBundle: (id) =>
  req(`/courses/${id}`).catch(() => ({
   course: M.courses.find((c) => c.id === Number(id)),
   teacher: M.teachers.find((t) => t.id === M.courses.find((c) => c.id === Number(id))?.teacherId),
   reviews: [],
  })),
 products: () => fetchOr('/products', 'products', M.products),
 product: (id) => fetchOr(`/products/${id}`, 'product', M.products.find((p) => p.id === id)),
 productBundle: (id) =>
  req(`/products/${id}`).catch(() => ({
   product: M.products.find((p) => p.id === id),
   reviews: [],
  })),
 posts: () => fetchOr('/blog', 'posts', M.blogPosts),
 post: (id) => fetchOr(`/blog/${id}`, 'post', M.blogPosts.find((p) => p.id === id)),
 teachers: () => fetchOr('/teachers', 'teachers', M.teachers),
 teacher: (id) =>
  req(`/teachers/${id}`).catch(() => {
   const t = M.teachers.find((x) => x.id === id)
   return { teacher: t, courses: M.courses.filter((c) => c.teacherId === id), liveClasses: [], reviews: [] }
  }),
 testimonials: () => fetchOr('/testimonials', 'items', M.testimonials),
}

/**
 * هوک خواندن داده — ابتدا fallback رندر می‌شود (بدون فلش خالی)، سپس داده
 * سرور جایگزین می‌شود. if سرور قطع باشد همان موک می‌ماند (رفتار قبلی صفحات).
 */
export function useCatalog(fetcher, fallback, deps = []) {
 const [data, setData] = useState(fallback)
 useEffect(() => {
  let alive = true
  Promise.resolve(fetcher()).then((v) => { if (alive && v != null) setData(v) })
  return () => { alive = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
 }, deps)
 return data
}
