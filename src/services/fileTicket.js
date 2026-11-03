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

/** افزودن تیکت به یک URL فایل آزمون */
export async function ticketedUrl(u) {
  if (!u || u.startsWith('data:')) return u
  const st = await getTicket()
  if (!st) return u
  return u + (u.includes('?') ? '&' : '?') + 'st=' + encodeURIComponent(st)
}

/** نسخه هوک برای لیست URL تصاویر (برگه سوال) — تا تیکت برسد null برمی‌گرداند */
export function useTicketedUrls(urls) {
  const list = Array.isArray(urls) ? urls : []
  const key = list.join('|')
  const [out, setOut] = useState(() => list.map(() => null))
  useEffect(() => {
    let alive = true
    getTicket().then((st) => {
      if (!alive) return
      setOut(list.map((u) => (u && st ? `${u}${u.includes('?') ? '&' : '?'}st=${encodeURIComponent(st)}` : null)))
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return out
}
