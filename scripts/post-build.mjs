/* ============================================================
   post-build — کارهای بعد از بیلد Vite:
   ۱) ساخت dist/404.html  → fallback درست SPA روی هاست‌های استاتیک
   ۲) تولید dist/sitemap.xml از دیتای واقعی mock
   ۳) «پری‌رندر متادیتا» برای هر مسیر: فایل HTML اختصاصی با title/
      description/OG/JSON-LD صحیح + محتوای متنی قابل خزش (noscript+بخش آشکار)
      → خزنده‌های بدون JS هم هر صفحه را با متادیتای دقیق ایندکس می‌کنند؛
        کاربرانی که JS دارند همان SPA را می‌بینند.
   اجرا: خودکار پس از `npm run build`
   ============================================================ */
import { copyFileSync, writeFileSync, mkdirSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dist = resolve(root, 'dist')

// ---------- ۱) SPA fallback ----------
copyFileSync(resolve(dist, 'index.html'), resolve(dist, '404.html'))

// ---------- ۲ و ۳) داده‌ها ----------
const ORIGIN = 'https://modaresyar.ir'

const { courses, products, teachers, blogPosts, liveClasses } = await import(
  resolve(root, 'src/data/mock.js')
)

const today = new Date().toISOString().slice(0, 10)

/* ---------- متادیتای مسیرهای ایستا ---------- */
const STATIC_ROUTES = [
  { loc: '/', priority: '1.0', freq: 'daily',
    title: 'مدرس‌یار | پلتفرم کلاس آنلاین و فروش دوره‌های آموزشی',
    desc: 'مدرس‌یار — پلتفرم جامع آموزش آنلاین؛ خرید کلاس‌های آنلاین زنده، دوره‌های ضبط‌شده برنامه‌نویسی، طراحی، زبان و کنکور، رزومه‌ساز حرفه‌ای و فروشگاه لوازم‌التحریر مدرس‌مارکت.' },
  { loc: '/courses', priority: '0.9', freq: 'daily',
    title: 'دوره‌های ضبط‌شده آموزشی | مدرس‌یار',
    desc: 'خرید دوره‌های ضبط‌شده برنامه‌نویسی، طراحی UI/UX، زبان انگلیسی و آیلتس، کنکور و کسب‌وکار با دسترسی مادام‌العمر، گواهی‌نامه معتبر و پشتیبانی مدرس.' },
  { loc: '/live', priority: '0.8', freq: 'weekly',
    title: 'کلاس‌های آنلاین زنده | مدرس‌یار',
    desc: 'رزرو کلاس‌های آنلاین زنده با اساتید برتر — کلاس‌های تعاملی با دوربین، چت و اشتراک صفحه؛ ضبط جلسات، تکلیف هفتگی و گواهی‌نامه حضور.' },
  { loc: '/teachers', priority: '0.8', freq: 'weekly',
    title: 'اساتید آکادمی مدرس‌یار | مدرس‌یار',
    desc: 'آشنایی با اساتید مدرس‌یار؛ مدرسین برنامه‌نویسی، طراحی، زبان، کنکور و بازاریابی با سال‌ها تجربه تدریس و هزاران دانشجوی موفق.' },
  { loc: '/market', priority: '0.9', freq: 'daily',
    title: 'مدرس‌مارکت — فروشگاه لوازم‌التحریر | مدرس‌یار',
    desc: 'خرید آنلاین نوشت‌افزار، لوازم هنری، اداری و دانش‌آموزی با تخفیف واقعی؛ ارسال پیش‌کرایه، پس‌کرایه و پیک فوری تهران — ضمانت اصالت کالا.' },
  { loc: '/blog', priority: '0.7', freq: 'weekly',
    title: 'بلاگ آموزشی مدرس‌یار | مدرس‌یار',
    desc: 'مقالات تخصصی روش مطالعه، برنامه‌نویسی، طراحی، آیلتس و آموزش آنلاین — تجربه‌های واقعی اساتید و دانشجویان مدرس‌یار.' },
  { loc: '/resume', priority: '0.6', freq: 'monthly',
    title: 'درباره مدرس‌یار و رزومه‌ساز | مدرس‌یار',
    desc: 'داستان آکادمی مدرس‌یار، آمار و افتخارات و رزومه‌ساز حرفه‌ای برای ساخت رزومه آنلاین دانشجویان.' },
  { loc: '/contact', priority: '0.5', freq: 'monthly',
    title: 'تماس با ما | مدرس‌یار',
    desc: 'راه‌های ارتباط با پشتیبانی مدرس‌یار؛ تلفن، ایمیل، آدرس و فرم تماس مستقیم — پاسخگویی شنبه تا پنجشنبه.' },
]

/* ---------- مسیرهای داینامیک ---------- */
const DYN_ROUTES = [
  ...courses.map((c) => ({
    loc: `/courses/${c.id}`, priority: '0.8', freq: 'weekly',
    title: `${c.title} | مدرس‌یار`,
    desc: `${c.title} — مدرس: ${c.teacher}؛ ${faToText(c.hours)} ساعت آموزش، ${faToText(c.lessonsCount)} درس، دسترسی مادام‌العمر و گواهی‌نامه معتبر. ${stripHtml(c.desc)}`,
  })),
  ...products.map((p) => ({
    loc: `/market/${p.id}`, priority: '0.7', freq: 'weekly',
    title: `خرید ${p.name} | مدرس‌مارکت`,
    desc: `خرید ${p.name} از مدرس‌مارکت با ضمانت اصالت و ۷ روز بازگشت — ${p.cat}، ارسال فوری تهران و ارسال به سراسر کشور.`,
  })),
  ...teachers.map((t) => ({
    loc: `/teachers/${t.id}`, priority: '0.6', freq: 'monthly',
    title: `${t.name} — ${t.role} | مدرس‌یار`,
    desc: stripHtml(t.bio),
  })),
  ...(blogPosts || []).map((b) => ({
    loc: `/blog/${b.id}`, priority: '0.6', freq: 'monthly',
    title: `${b.title} | بلاگ مدرس‌یار`,
    desc: stripHtml(b.excerpt),
  })),
  ...liveClasses.map((l) => ({
    loc: `/live`, priority: '0.4', freq: 'weekly', skip: true, // کلاس‌ها همه در /live ایندکس می‌شوند
  })),
].filter((r) => !r.skip)

/* ارقام فارسی → متن (برای desc متا — خزنده‌ها ارقام فارسی را هم می‌خوانند اما انگلیسی استانداردتر است) */
function faToText(n) { return String(n) }
function stripHtml(s) { return String(s || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() }

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/* ---------- ۲) Sitemap ---------- */
const allUrls = [...STATIC_ROUTES, ...DYN_ROUTES]
const xml =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  allUrls
    .map(
      (u) =>
        `  <url>\n    <loc>${ORIGIN}${esc(u.loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${u.freq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
    )
    .join('\n') +
  `\n</urlset>\n`
writeFileSync(resolve(dist, 'sitemap.xml'), xml, 'utf8')

/* ---------- ۳) HTML اختصاصی هر مسیر ---------- */
/* مسیر «/» همان index.html اصلی SPA است — نباید بازنویسی شود */
const indexHtml = (() => {
  try { return readFileSync(resolve(dist, 'index.html'), 'utf8') } catch { return '' }
})()

const BASE_CRUMB = { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'صفحه نخست', item: `${ORIGIN}/` }] }

let made = 0
for (const r of [...STATIC_ROUTES, ...DYN_ROUTES]) {
  if (r.loc === '/') continue // ریشه همان index.html اصلی SPA است
  const url = ORIGIN + r.loc
  const dir = resolve(dist, '.' + r.loc.split('/').slice(0, -1).join('/'))
  mkdirSync(dir, { recursive: true })
  const fileName = r.loc === '/' ? 'index.html' : `${r.loc.split('/').pop()}.html`
  const breadcrumb = r.loc !== '/'
    ? { ...BASE_CRUMB, itemListElement: [...BASE_CRUMB.itemListElement, { '@type': 'ListItem', position: 2, name: titleOf(r), item: url }] }
    : BASE_CRUMB

  const html = `<!doctype html>
<html lang="fa" dir="rtl" data-theme="dark">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover"/>
<title>${esc(r.title)}</title>
<meta name="description" content="${esc(r.desc)}"/>
<meta name="robots" content="index, follow, max-image-preview:large"/>
<link rel="canonical" href="${url}"/>
<link rel="alternate" hreflang="fa-IR" href="${url}"/>
<link rel="alternate" hreflang="x-default" href="${url}"/>
<meta property="og:type" content="website"/>
<meta property="og:site_name" content="مدرس‌یار"/>
<meta property="og:locale" content="fa_IR"/>
<meta property="og:title" content="${esc(r.title)}"/>
<meta property="og:description" content="${esc(r.desc)}"/>
<meta property="og:url" content="${url}"/>
<meta property="og:image" content="${ORIGIN}/og-cover.jpg"/>
<meta property="og:image:width" content="1200"/>
<meta property="og:image:height" content="630"/>
<meta name="twitter:card" content="summary_large_image"/>
<meta name="twitter:title" content="${esc(r.title)}"/>
<meta name="twitter:description" content="${esc(r.desc)}"/>
<link rel="icon" type="image/svg+xml" href="/favicon.svg"/>
<script type="application/ld+json">${JSON.stringify(breadcrumb)}</script>
<!-- ریدایرکت فوری به SPA — کاربران همان اپ را می‌بینند؛ خزنده‌ها متادیتای بالا را ایندکس می‌کنند -->
<meta http-equiv="refresh" content="0;url=${url}"/>
</head>
<body>
<h1 style="font-family:Tahoma,sans-serif;font-size:16px">${esc(r.title)}</h1>
<p style="font-family:Tahoma,sans-serif;font-size:13px">${esc(r.desc)}</p>
<noscript><p style="font-family:Tahoma,sans-serif">برای تجربه کامل مدرس‌یار جاوااسکریپت را فعال کنید.</p></noscript>
</body>
</html>
`
  writeFileSync(resolve(dir, fileName), html, 'utf8')
  made++
}

function titleOf(r) {
  const t = r.title || ''
  return t.split('|')[0].trim()
}

console.log(`post-build: 404.html + sitemap.xml (${allUrls.length} URL) + ${made} صفحه متادیتای استاتیک ساخته شد`)
