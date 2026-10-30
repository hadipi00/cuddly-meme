// =====================================================================
// لایه «جایگزینی متون سایت» — ویرایش متون از پنل مدیریت بدون تغییر کد
// ---------------------------------------------------------------------
// • لیست جایگزینی‌ها (متن اصلی → متن جدید) از سرور لود می‌شود
// • روی همه‌ی نودهای متنی صفحه اعمال می‌شود (TreeWalker)
// • با MutationObserver هر متن جدیدی که ری‌اکت رندر کند هم فوراً جایگزین می‌شود
// • بخش‌هایی که data-tx-skip دارند (مثل خود ابزار ویرایش) دست‌نخورده می‌مانند
// • جایگزینی خالی = حذف متن از نمایش
// =====================================================================
import { req, isServerUp } from './http'

let overrides = [] // [{find, replace}] — مرتب بر اساس طول (بلندتر اول)
let processed = new WeakSet()

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'CODE', 'PRE'])

function shouldSkip(el) {
  if (!el) return true
  if (el.closest && el.closest('[data-tx-skip]')) return true
  if (SKIP_TAGS.has(el.tagName)) return true
  return false
}

function applyToTextNode(node) {
  if (processed.has(node)) return
  processed.add(node)
  if (!overrides.length) return
  const v = node.nodeValue
  if (!v || !v.trim()) return
  let out = v
  let hit = false
  for (const o of overrides) {
    if (o.find && out.includes(o.find)) {
      out = out.split(o.find).join(o.replace)
      hit = true
    }
  }
  if (hit) node.nodeValue = out
}

function applyTree(root) {
  if (!root || !overrides.length) return
  if (root.nodeType === Node.TEXT_NODE) {
    if (!shouldSkip(root.parentElement)) applyToTextNode(root)
    return
  }
  if (root.nodeType !== Node.ELEMENT_NODE) return
  if (shouldSkip(root)) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (!n.nodeValue || !n.nodeValue.trim()) return NodeFilter.FILTER_REJECT
      if (shouldSkip(n.parentElement)) return NodeFilter.FILTER_REJECT
      return NodeFilter.FILTER_ACCEPT
    },
  })
  let cur
  while ((cur = walker.nextNode())) applyToTextNode(cur)
}

function fixTitle() {
  if (!overrides.length) return
  let t = document.title
  for (const o of overrides) if (o.find && t.includes(o.find)) t = t.split(o.find).join(o.replace)
  if (t !== document.title) document.title = t
}

/* ---------- ناظر DOM: هر رندر جدید ری‌اکت هم پوشش داده شود ---------- */
let started = false
let timer = null
const pending = new Set()

const flush = () => {
  timer = null
  for (const n of pending) {
    if (n.nodeType === Node.CHARACTER_DATA) processed.delete(n) // ری‌اکت متن نود را عوض کرده → دوباره بررسی شود
    else applyTree(n)
  }
  pending.clear()
  applyTree(document.body)
  fixTitle()
}
const queueNode = (n) => {
  pending.add(n)
  if (!timer) timer = setTimeout(flush, 100)
}

function startObserver() {
  if (started || typeof MutationObserver === 'undefined') return
  started = true
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'characterData' && m.target) queueNode(m.target)
      else if (m.type === 'childList') m.addedNodes.forEach((n) => queueNode(n))
    }
  })
  mo.observe(document.body, { childList: true, subtree: true, characterData: true })
}

/* ---------- لود از سرور + اعمال فوری ---------- */
export async function loadOverrides() {
  let list = []
  if (isServerUp() !== false) {
    try {
      const r = await req('/content/overrides')
      list = (r.overrides || [])
        .map((o) => ({ find: String(o.find || ''), replace: String(o.replace ?? '') }))
        .filter((o) => o.find.length >= 2)
      // بلندتر اول — تا جایگزینیِ جزئی، متن بلندتر را خراب نکند
      list.sort((a, b) => b.find.length - a.find.length)
    } catch {
      list = [] // سرور در دسترس نیست — بدون جایگزینی ادامه بده
    }
  }
  overrides = list
  processed = new WeakSet() // همه‌ی نودها یک بار دیگر بررسی شوند
  applyTree(document.body)
  fixTitle()
  return overrides
}

export function initTextOverrides() {
  startObserver()
  // اولین لود: بعد از رندر اولیه + کمی بعد (بعد از اولین fetchهای داده)
  setTimeout(loadOverrides, 250)
  setTimeout(loadOverrides, 2500)
}
