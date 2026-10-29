import { useEffect, useState } from 'react'
import { useApp } from '../store/AppContext'

/* ============================================================
   هوک وضعیت کلاس‌ها — قلب تایمرهای زنده
   ------------------------------------------------------------
   - روزهای هفته فارسی: شنبه = Saturday در Date جاوااسکریپت
   - «زمان شروع بعدی» هر کلاس بر اساس واقعیت تقویم محاسبه می‌شود
   - اگر مدرس کلاس را شروع کرده باشد (liveSessions در AppContext)
     وضعیت «زنده» با تایمر سپری‌شده نمایش داده می‌شود
   ============================================================ */

/** ایندکس روز فارسی امروز (۰=شنبه … ۶=جمعه) */
export const todayIdx = () => (new Date().getDay() + 1) % 7

/** تبدیل ایندکس روز فارسی به ایندکس getDay جاوااسکریپت */
export const faToJsDay = (faIdx) => (faIdx + 6) % 7

/** ساعت رشته «HH:MM» (با پشتیبانی ارقام فارسی) → {h, m} */
const FA = '۰۱۲۳۴۵۶۷۸۹'
const parseHM = (s) => {
  const norm = String(s || '').replace(/[۰-۹]/g, (d) => FA.indexOf(d))
  const [h, m] = norm.split(':').map(Number)
  return { h: h || 0, m: m || 0 }
}

/** نزدیک‌ترین تاریخ وقوع (weekday + ساعت) — اگر امروز باشد و گذشته باشد → هفته بعد */
export function nextOccurrence(faDayIdx, start) {
  const { h, m } = parseHM(start)
  const now = new Date()
  const targetJsDay = faToJsDay(faDayIdx)
  for (let add = 0; add <= 7; add++) {
    const d = new Date(now)
    d.setDate(now.getDate() + add)
    d.setHours(h, m, 0, 0)
    if (d.getDay() === targetJsDay && d.getTime() > now.getTime() - 60_000) return d
  }
  const d = new Date(now)
  d.setDate(now.getDate() + 7)
  d.setHours(h, m, 0, 0)
  return d
}

/** تایمر همگام — هر interval میلی‌ثانیه یک بار re-render می‌کند */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return now
}

const pad2 = (n) => String(Math.floor(n)).padStart(2, '0')

/** میلی‌ثانیه → «HH:MM:SS» */
export function fmtDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const hm = `${pad2(h)}:${pad2(m)}:${pad2(sec)}`
  return d > 0 ? `${d} روز و ${hm}` : hm
}

/** بخش‌های شمارش معکوس برای نمایش گرافیکی */
export function splitDuration(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  return {
    d: Math.floor(s / 86400),
    h: Math.floor((s % 86400) / 3600),
    m: Math.floor((s % 3600) / 60),
    s: s % 60,
  }
}

/**
 * وضعیت یک کلاس/جلسه برنامه هفتگی
 * @param cls {day, start, dur, id?, liveId?}
 * @param now — زمان فعلی (از useNow)
 * @returns {{state: 'live'|'soon'|'upcoming'|'past', startsAt: Date, msLeft: number, elapsed: number, session: object|null}}
 */
export function useClassStatus(cls, now) {
  const { liveSessions } = useApp()
  if (!cls) return null
  const session = liveSessions?.[cls.liveId || cls.id]
  const startsAt = nextOccurrence(cls.day, cls.start)
  const msLeft = startsAt.getTime() - now
  const durMs = (cls.dur || 90) * 60_000

  // کلاس زنده بر اساس عمل مدرس (منبع حقیقت دمو)
  if (session?.startedAt && !session?.ended) {
    return { state: 'live', startsAt, msLeft, elapsed: now - session.startedAt, session }
  }
  // داخل بازه زمانی کلاس → عملاً «در حال برگزاری» فرض می‌شود
  if (msLeft <= 0 && msLeft > -durMs) {
    return { state: 'live', startsAt, msLeft: 0, elapsed: -msLeft, session: null }
  }
  if (msLeft <= -durMs) return { state: 'past', startsAt, msLeft: 0, elapsed: durMs, session }
  if (msLeft < 30 * 60_000) return { state: 'soon', startsAt, msLeft, elapsed: 0, session }
  return { state: 'upcoming', startsAt, msLeft, elapsed: 0, session }
}

/** متن بج وضعیت کلاس */
export const STATUS_LABEL = {
  live: 'در حال برگزاری',
  soon: 'به‌زودی شروع می‌شود',
  upcoming: 'زمان‌بندی شده',
  past: 'برگزار شد',
}
