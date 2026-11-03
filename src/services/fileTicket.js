// =====================================================================
// تیکت کوتاه‌عمر برای فایل‌های آزمون (برگه سوال/پاسخنامه)
// فایل‌ها در سرور فقط با پارامتر امضاشده ?st=… سرو می‌شوند؛ این ماژول
// تیکت را یک بار می‌گیرد، کش می‌کند و به URLها می‌چسباند.
// =====================================================================
import { useEffect, useState } from 'react'
import { req } from './http'

let cache = null // { st, exp }
let inflight = null

export async function getTicket() {
  if (cache && cache.exp > Date.now() + 60_000) return cache.st
  if (!inflight) {
    inflight = req('/exams/file-ticket', { method: 'POST' })
      .then((r) => {
        cache = { st: r.st, exp: r.exp }
        inflight = null
        return r.st
      })
      .catch(() => {
        inflight = null
        return ''
      })
  }
  return inflight
}

/* [فیکس F34] ابطال کش تیکت — برای دکمهٔ «تلاش مجدد» بعد از شکست */
export function invalidateTicket() {
  cache = null
  inflight = null
}

/** افزودن تیکت به یک URL فایل آزمون */
export async function ticketedUrl(u) {
  if (!u || u.startsWith('data:')) return u
  const st = await getTicket()
  if (!st) return u
  return u + (u.includes('?') ? '&' : '?') + 'st=' + encodeURIComponent(st)
}

/**
 * نسخه هوک برای لیست URL تصاویر (برگه سوال).
 * تا تیکت برسد null برمی‌گرداند؛ [فیکس F34] اگر گرفتن تیکت شکست بخورد به‌جای
 * «در حال آماده‌سازی» ابدی، تا ۵ بار با فاصلهٔ ۳ ثانیه دوباره تلاش می‌شود و
 * در نهایت undefined برمی‌گردد تا UI دکمهٔ «تلاش مجدد» نشان دهد.
 * retryKey (اختیاری): با تغییر آن، تلاش دوباره از بیرون آغاز می‌شود.
 */
export function useTicketedUrls(urls, retryKey = 0) {
  const list = Array.isArray(urls) ? urls : []
  const key = list.join('|')
  const [out, setOut] = useState(() => list.map(() => null))
  const [attempt, setAttempt] = useState(0)
  const [failed, setFailed] = useState(false)
  useEffect(() => {
    let alive = true
    setFailed(false)
    let timer = null
    getTicket().then((st) => {
      if (!alive) return
      if (!st) {
        if (attempt < 5) timer = setTimeout(() => alive && setAttempt((t) => t + 1), 3000)
        else setFailed(true)
        return
      }
      setOut(list.map((u) => (u && st ? `${u}${u.includes('?') ? '&' : '?'}st=${encodeURIComponent(st)}` : null)))
    })
    return () => { alive = false; clearTimeout(timer) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, retryKey])
  return failed ? list.map(() => undefined) : out
}
