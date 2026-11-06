// =====================================================================
// ایندکس متون سایت — استخراج همه‌ی متن‌های فارسی از سورس فرانت
// برای «جستجوی متن در همه صفحات» پنل مدیریت (ابزار ویرایش متون)
// متون استاتیک JSX + رشته‌های فارسی داخل کد را با نام صفحه‌شان برمی‌گرداند.
// =====================================================================
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src')

const FA = /[\u0600-\u06FF]/

/* برچسب فارسی صفحه‌ها بر اساس مسیر فایل */
const PAGE_LABELS = {
  'pages/Home.jsx': 'صفحه اصلی',
  'pages/LiveClasses.jsx': 'کلاس‌های زنده (عمومی)',
  'pages/Courses.jsx': 'دوره‌ها',
  'pages/CourseDetail.jsx': 'جزئیات دوره',
  'pages/Teachers.jsx': 'مدرسان',
  'pages/TeacherProfile.jsx': 'پروفایل مدرس',
  'pages/Market.jsx': 'مدرس‌مارکت',
  'pages/ProductDetail.jsx': 'جزئیات محصول',
  'pages/Blog.jsx': 'وبلاگ',
  'pages/BlogPost.jsx': 'مطلب وبلاگ',
  'pages/Checkout.jsx': 'تسویه حساب',
  'pages/OrderSuccess.jsx': 'سفارش موفق',
  'pages/Contact.jsx': 'تماس با ما',
  'pages/Auth.jsx': 'ورود / ثبت‌نام',
  'pages/Resume.jsx': 'رزومه‌ساز',
  'pages/NotFound.jsx': 'صفحه ۴۰۴',
  'components/Navbar.jsx': 'نوار بالای سایت',
  'components/Footer.jsx': 'فوتر سایت',
  'components/LiveRoom.jsx': 'اتاق کلاس زنده',
  'components/CartDrawer.jsx': 'سبد خرید',
  'components/PanelLayout.jsx': 'چیدمان پنل',
  'components/Modal.jsx': 'پنجره‌های مودال',
  'components/cards.jsx': 'کارت‌های عمومی',
  'components/DataTable.jsx': 'جدول داده',
  'store/AppContext.jsx': 'هسته برنامه (پیام‌ها)',
  'pages/student/StudentPanel.jsx': 'پنل دانش‌آموز — منو',
  'pages/teacher/TeacherPanel.jsx': 'پنل مدرس — منو',
  'pages/admin/AdminPanel.jsx': 'پنل مدیریت — منو',
  'data/mock.js': 'داده‌های نمونه',
  'config/site.js': 'تنظیمات سایت',
}
const labelFor = (rel) => {
  if (PAGE_LABELS[rel]) return PAGE_LABELS[rel]
  let m = rel.match(/^pages\/student\/S(.+?)\.jsx$/)
  if (m) return `پنل دانش‌آموز — ${m[1]}`
  m = rel.match(/^pages\/teacher\/T(.+?)\.jsx$/)
  if (m) return `پنل مدرس — ${m[1]}`
  m = rel.match(/^pages\/admin\/A(.+?)\.jsx$/)
  if (m) return `پنل مدیریت — ${m[1]}`
  m = rel.match(/^pages\/(.+?)\.jsx$/)
  if (m) return m[1]
  return rel.replace(/\.jsx$/, '')
}

const walk = (dir) => {
  const out = []
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    let isDir = false
    try { isDir = statSync(p).isDirectory() } catch { isDir = false }
    if (isDir) out.push(...walk(p))
    else if (/\.(jsx|js)$/.test(name)) out.push(p)
  }
  return out
}

/* استخراج متن‌های فارسی از یک فایل سورس */
function extractTexts(source) {
  const out = []
  // ۱) متن JSX بین تگ‌ها: >متن فارسی<
  const jsx = />([^<>{}]*[\u0600-\u06FF][^<>{}]*)</g
  let m
  while ((m = jsx.exec(source))) {
    const s = m[1].replace(/\s+/g, ' ').trim()
    if (s.length >= 3 && s.length <= 300) out.push(s)
  }
  // ۲) رشته‌های نقل‌قولی که فارسی هستند
  const q = /(['"`])((?:\\.|(?!\1)[^\\])*?)\1/g
  while ((m = q.exec(source))) {
    let s = m[2]
      .replace(/\\n/g, ' ').replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\`/g, '`')
      .replace(/\s+/g, ' ').trim()
    if (s.length >= 4 && s.length <= 300 && FA.test(s) && !/^(https?:|\/|#[0-9a-f])/i.test(s)) out.push(s)
  }
  return out
}

let cache = null // { items, builtAt, files }
export function buildIndex(force = false) {
  if (cache && !force) return cache
  const files = walk(SRC)
  const map = new Map() // text -> Set(relPath)
  for (const f of files) {
    const rel = f.slice(SRC.length + 1).replace(/\\/g, '/')
    let src = ''
    try { src = readFileSync(f, 'utf8') } catch { continue }
    for (const t of extractTexts(src)) {
      if (!map.has(t)) map.set(t, new Set())
      map.get(t).add(rel)
    }
  }
  const items = [...map.entries()]
    .map(([text, filesSet]) => {
      const files = [...filesSet]
      return { text, files, pages: [...new Set(files.map(labelFor))], n: files.length }
    })
    .sort((a, b) => a.text.localeCompare(b.text, 'fa'))
  cache = { items, builtAt: Date.now(), files: files.length }
  return cache
}

export function searchIndex(q) {
  const { items, builtAt, files } = buildIndex()
  const ql = q.trim().toLowerCase()
  if (ql.length < 2) return { results: [], total: items.length, builtAt, files }
  const results = []
  for (const it of items) {
    if (it.text.toLowerCase().includes(ql)) {
      results.push(it)
      if (results.length >= 80) break
    }
  }
  return { results, total: items.length, builtAt, files }
}
