/* ============================================================
   post-build — کارهای بعد از بیلد Vite:
   ۱) ساخت dist/404.html  → fallback درست SPA روی هاست‌های استاتیک
      (GitHub Pages، هاست‌های اشتراکی cPanel و… — refresh روی مسیر
      تو در تو هم صفحه را درست باز می‌کند)
   ۲) تولید dist/sitemap.xml از دیتای واقعی mock (دوره‌ها، محصولات،
      اساتید، بلاگ) — بعد از اتصال بک‌اند، همین اسکریپت از API بخواند.
   اجرا: خودکار پس از `npm run build`
   ============================================================ */
import { copyFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')

// ---------- ۱) SPA fallback ----------
copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))

// ---------- ۲) Sitemap ----------
const ORIGIN = 'https://modaresyar.ir' // TODO: بعد از خرید دامنه اصلی، همین‌جا عوض شود

const { courses, products, teachers, blogPosts } = await import(
  resolve(root, 'src/data/mock.js')
)

const today = new Date().toISOString().slice(0, 10)
const urls = [
  { loc: '/', priority: '1.0', freq: 'daily' },
  { loc: '/courses', priority: '0.9', freq: 'daily' },
  { loc: '/market', priority: '0.9', freq: 'daily' },
  { loc: '/live', priority: '0.8', freq: 'weekly' },
  { loc: '/teachers', priority: '0.8', freq: 'weekly' },
  { loc: '/blog', priority: '0.7', freq: 'weekly' },
  { loc: '/resume', priority: '0.6', freq: 'monthly' },
  { loc: '/contact', priority: '0.5', freq: 'monthly' },
  { loc: '/auth', priority: '0.3', freq: 'monthly' },
  ...courses.map((c) => ({ loc: `/courses/${c.id}`, priority: '0.8', freq: 'weekly' })),
  ...teachers.map((t) => ({ loc: `/teachers/${t.id}`, priority: '0.6', freq: 'monthly' })),
  ...products.map((p) => ({ loc: `/market/${p.id}`, priority: '0.7', freq: 'weekly' })),
  ...(blogPosts || []).map((b) => ({ loc: `/blog/${b.id}`, priority: '0.6', freq: 'monthly' })),
]

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  urls
    .map(
      (u) =>
        `  <url>\n    <loc>${ORIGIN}${esc(u.loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join('\n') +
  `\n</urlset>\n`

writeFileSync(resolve(dist, 'sitemap.xml'), xml, 'utf8')

console.log(`post-build: 404.html + sitemap.xml (${urls.length} URL) ساخته شد`)
