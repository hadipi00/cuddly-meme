import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { DEMO_USERS } from '../config/site'

// ================= استور مرکزی برنامه (ورود، سبد خرید، علاقه‌مندی، کلاس‌ها و ...) =================
// برای اتصال به بک‌اند: اکشن‌های این کانتکست به متدهای services/api وصل می‌شوند.

const KEY = 'modaresyar:v1'
const blank = {
 user: null, cart: [], wishlist: [], customClasses: [], lessonDone: {}, extraMinutes: 0,
 liveSessions: {}, // { [classId]: { startedAt, ended } } — وضعیت واقعی کلاس زنده (مدرس شروع/پایان می‌کند)
 recentlyViewed: [], coupons: {}, // کدهای تخفیف اعمال‌شده روی سبد
}

function load() {
 try { return { ...blank, ...JSON.parse(localStorage.getItem(KEY)) } } catch { return { ...blank } }
}

const Ctx = createContext(null)
export const useApp = () => useContext(Ctx)

export function AppProvider({ children }) {
 const [state, setState] = useState(load)
 const [toasts, setToasts] = useState([])

 useEffect(() => {
 try { localStorage.setItem(KEY, JSON.stringify(state)) } catch { /* ignore */ }
 }, [state])

 const toast = useCallback((msg, type = 'success') => {
 const id = Math.random().toString(36).slice(2)
 setToasts((t) => [...t, { id, msg, type }])
 setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200)
 }, [])

 const patch = (fn) => setState((s) => ({ ...s, ...fn(s) }))

 const value = useMemo(() => ({
 ...state,
 toasts,
 toast,
 login(role, name) {
 const u = { ...(DEMO_USERS[role] || DEMO_USERS.student) }
 if (name) u.name = name
 patch(() => ({ user: u }))
 toast(`خوش آمدید، ${u.name}!`)
 return u
 },
 logout() { patch(() => ({ user: null })) },
 addToCart(item, qty = 1) {
 setState((s) => {
 const cap = item.maxStock || 99
 const ex = s.cart.find((i) => i.id === item.id)
 if (ex) {
 return { ...s, cart: s.cart.map((i) => (i.id === item.id ? { ...i, qty: Math.min((i.qty || 1) + qty, cap) } : i)) }
 }
 return { ...s, cart: [...s.cart, { ...item, qty }] }
 })
 },
 /** تغییر تعداد یک قلم سبد (+۱ یا −۱) — حداقل ۱ و حداکثر موجودی انبار */
 updateQty(id, delta) {
 setState((s) => ({
 ...s,
 cart: s.cart.map((i) =>
 i.id === id ? { ...i, qty: Math.max(1, Math.min((i.qty || 1) + delta, i.maxStock || 99)) } : i
 ),
 }))
 },
 removeFromCart(id) { patch((s) => ({ cart: s.cart.filter((i) => i.id !== id) })) },
 clearCart() { patch(() => ({ cart: [] })) },
 toggleWish(item) {
 patch((s) => ({
 wishlist: s.wishlist.some((w) => w.id === item.id)
 ? s.wishlist.filter((w) => w.id !== item.id)
 : [...s.wishlist, item],
 }))
 },
 /** کلاس جدید (ساخت توسط مدرس/مدیر) — بلافاصله در جدول هفتگی دانش‌آموز دیده می‌شود */
 addClass(cls) {
 const id = 'cc' + Date.now()
 patch((s) => ({ customClasses: [...s.customClasses, { ...cls, id }] }))
 return id
 },
 updateClass(id, cls) {
 patch((s) => ({ customClasses: s.customClasses.map((c) => (c.id === id ? { ...c, ...cls } : c)) }))
 },
 removeClass(id) { patch((s) => ({ customClasses: s.customClasses.filter((c) => c.id !== id) })) },
 toggleLesson(courseId, lessonIdx) {
 patch((s) => {
 const key = String(courseId)
 const done = s.lessonDone[key] || []
 return {
 lessonDone: {
 ...s.lessonDone,
 [key]: done.includes(lessonIdx) ? done.filter((i) => i !== lessonIdx) : [...done, lessonIdx],
 },
 }
 })
 },
 addMinutes(min) { patch((s) => ({ extraMinutes: s.extraMinutes + min })) },
 placeOrder(order) {
 const code = 'ORD-' + Math.floor(7900 + Math.random() * 90)
 const today = new Date().toLocaleDateString('fa-IR')
 patch((s) => ({ orders: [...(s.orders || []), { code, date: today, ...order }], cart: [] }))
 return code
 },
 /* ---------- موتور کلاس زنده ---------- */
 /** مدرس کلاس را شروع می‌کند — دانش‌آموزان بلافاصله بج «زنده» و دکمه ورود می‌بینند */
 startLive(classId) {
 patch((s) => ({ liveSessions: { ...s.liveSessions, [classId]: { startedAt: Date.now(), ended: false } } }))
 },
 endLive(classId) {
 patch((s) => {
 const cur = s.liveSessions[classId]
 return { liveSessions: { ...s.liveSessions, [classId]: { ...(cur || {}), ended: true, startedAt: cur?.startedAt || Date.now() } } }
 })
 },
 /** ثبت آخرین بازدید محصول/دوره برای ریل «ادامه بده» */
 pushViewed(item) {
 patch((s) => ({ recentlyViewed: [item, ...s.recentlyViewed.filter((r) => r.id !== item.id)].slice(0, 8) }))
 },
 }), [state, toasts, toast])

 return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
