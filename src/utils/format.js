export const faNum = (n) => {
 const num = Number(n)
 return isNaN(num) ? String(n ?? '') : num.toLocaleString('fa-IR')
}

export const toman = (n) => `${faNum(n)} تومان`

export const faDate = (iso) => {
 const d = new Date(iso)
 return isNaN(d.getTime())
 ? String(iso)
 : d.toLocaleDateString('fa-IR', { year: 'numeric', month: 'long', day: 'numeric' })
}

export const faDateShort = (iso) => {
 const d = new Date(iso)
 return isNaN(d.getTime())
 ? String(iso)
 : d.toLocaleDateString('fa-IR', { month: 'long', day: 'numeric' })
}

export const DAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']

export const SLOTS = ['۸:۰۰', '۱۰:۰۰', '۱۲:۰۰', '۱۴:۰۰', '۱۶:۰۰', '۱۸:۰۰', '۲۰:۰۰']

export const initials = (name = '') =>
 name
 .split(' ')
 .filter(Boolean)
 .slice(0, 2)
 .map((w) => w[0])
 .join('')

/** pick a deterministic gradient class index from any string/id */
export const gradOf = (seed) => {
 const n = String(seed).split('').reduce((a, c) => a + c.charCodeAt(0), 0)
 return `grad-${n % 6}`
}
