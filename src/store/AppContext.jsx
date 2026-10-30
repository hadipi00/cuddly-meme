import { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { DEMO_USERS } from '../config/site'
import { req, setToken, getToken } from '../services/http'

// ================= استور مرکزی برنامه (ورود، سبد خرید، علاقه‌مندی، کلاس‌ها و ...) =================
// ورود/ثبت‌نام به بک‌اند واقعی (JWT) وصل است؛ اگر سرور در دسترس نباشد
// خودکار به حالت دمو (آفلاین) برمی‌گردد تا سایت هیچ‌وقت نمی‌شکند.

const KEY = 'modaresyar:v1'
const blank = {
 user: null, cart: [], wishlist: [], customClasses: [], lessonDone: {}, extraMinutes: 0,
 liveSessions: {}, // { [classId]: { startedAt, ended } } — آینه‌ی وضعیت سرور (poll هر ۴ ثانیه)
 recentlyViewed: [], coupons: {}, // کدهای تخفیف اعمال‌شده روی سبد
}

function load() {
 try { return { ...blank, ...JSON.parse(localStorage.getItem(KEY)), token: getToken() } } catch { return { ...blank, token: getToken() } }
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

 /* ---------- خودترمیمی هویت: تطبیق کاربر با توکن همین تب (sessionStorage) ---------- */
 useEffect(() => {
   if (!getToken()) return
   let alive = true
   req('/auth/me').then((r) => {
     if (!alive || !r.user) return
     if (r.token) setToken(r.token) // تمدید اسلایدی سشن — کاربر فعال هرگز منقضی نمی‌شود
     // کاربر همیشه با نسخه تازه سرور جایگزین می‌شود تا فیلدهای جدید (مثل roleLabel) هم بیاید
     setState((s) => (s.user?.id === r.user.id && s.user?.roleLabel === r.user.roleLabel ? s : { ...s, user: r.user, token: getToken() }))
   }).catch((e) => {
     if (!alive) return
     if (e.status === 401) { setToken(null); setState((s) => ({ ...s, user: null, token: null })) }
   })
   return () => { alive = false }
   // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [])

 /** حالت دمو (فقط وقتی بک‌اند در دسترس نیست) */
 const loginDemo = useCallback((role, name) => {
 const u = { ...(DEMO_USERS[role] || DEMO_USERS.student) }
 if (name) u.name = name
 patch(() => ({ user: u, token: null }))
 toast(`حالت آفلاین: با حساب آزمایشی ${u.roleLabel} وارد شدید`)
 return { ok: true, role: u.role, demo: true }
 }, [toast])

 /* ---------- همگام‌سازی وضعیت کلاس زنده از سرور (منبع حقیقت) ---------- */
 const liveRef = useRef({})
 useEffect(() => {
 let alive = true
 const tick = async () => {
 try {
 const r = await req('/live/overview')
 const next = {}
 for (const c of r.classes || []) {
 if (c.status === 'live') next[c.id] = { startedAt: c.startedAt, ended: false }
 else if (c.status === 'ended') next[c.id] = { startedAt: c.startedAt || Date.now(), ended: true, endedAt: c.endedAt }
 }
 // فقط وقتی واقعاً تغییری هست state را آپدیت کن (بدون re-render اضافی)
 if (JSON.stringify(next) !== JSON.stringify(liveRef.current)) {
 liveRef.current = next
 patch(() => ({ liveSessions: next }))
 }
 } catch { /* سرور قطع است — حالت دمو */ }
 }
 tick()
 const t = setInterval(tick, 4000)
 return () => { alive = false; clearInterval(t) }
 }, [])

 const value = useMemo(() => ({
 ...state,
 toasts,
 toast,
 /** ورود واقعی با بک‌اند (JWT) — اگر سرور قطع باشد → یک تلاش دوباره → بعد حالت دمو با نقش URL.
  *  تلاش دوباره ضد «تله حالت دمو» است: اگر لحظه ورود سرور کوتاه ری‌استارت شده باشد،
  *  ورود واقعی به‌جای سشن ساختگی آفلاین انجام می‌شود و سشن دیگر نمی‌پرد. */
 async login(email, password, fallbackRole = 'student') {
 let r
 try {
 r = await req('/auth/login', { method: 'POST', body: { email, password } })
 } catch (e) {
 if (!e.serverDown) return { ok: false, error: e.message }
 await new Promise((res) => setTimeout(res, 1500))
 try {
 r = await req('/auth/login', { method: 'POST', body: { email, password } })
 } catch (e2) {
 if (e2.serverDown) return loginDemo(fallbackRole)
 return { ok: false, error: e2.message }
 }
 }
 setToken(r.token)
 patch(() => ({ user: r.user, token: r.token }))
 toast(`خوش آمدید، ${r.user.name}!`)
 return { ok: true, role: r.user.role, demo: false }
 },
 /** ثبت‌نام واقعی (نقش: دانش‌آموز) — اگر سرور قطع باشد → یک تلاش دوباره → بعد حالت دمو */
 async register(name, email, password) {
 let r
 try {
 r = await req('/auth/register', { method: 'POST', body: { name, email, password } })
 } catch (e) {
 if (!e.serverDown) return { ok: false, error: e.message }
 await new Promise((res) => setTimeout(res, 1500))
 try {
 r = await req('/auth/register', { method: 'POST', body: { name, email, password } })
 } catch (e2) {
 if (e2.serverDown) return loginDemo('student', name)
 return { ok: false, error: e2.message }
 }
 }
 setToken(r.token)
 patch(() => ({ user: r.user, token: r.token }))
 toast(`حساب شما ساخته شد — خوش آمدید، ${r.user.name}!`)
 return { ok: true, role: r.user.role, demo: false }
 },
 loginDemo,
 logout() {
 setToken(null)
 patch(() => ({ user: null, token: null }))
 },
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
 /* ---------- موتور کلاس زنده — دستور مدرس به سرور + آپدیت خوش‌بینانه ---------- */
 /** مدرس کلاس را شروع می‌کند — برای همه کاربران (از سرور) بج «زنده» و دکمه ورود فعال می‌شود */
 startLive(classId) {
 patch((s) => ({ liveSessions: { ...s.liveSessions, [classId]: { startedAt: Date.now(), ended: false } } }))
 liveRef.current = { ...liveRef.current, [classId]: { startedAt: Date.now(), ended: false } }
 req(`/classes/${classId}/start`, { method: 'POST' }).catch((e) => {
 if (!e.serverDown) {
 if (e.status === 403) toast('با حساب دیگری وارد شده‌اید — با حساب مدرسِ همین کلاس وارد شوید', 'error')
 else toast(e.message || 'شروع کلاس ناموفق بود', 'error')
 }
 })
 },
 endLive(classId) {
 patch((s) => {
 const cur = s.liveSessions[classId]
 return { liveSessions: { ...s.liveSessions, [classId]: { ...(cur || {}), ended: true, startedAt: cur?.startedAt || Date.now() } } }
 })
 liveRef.current = { ...liveRef.current, [classId]: { ...(liveRef.current[classId] || {}), ended: true } }
 req(`/classes/${classId}/end`, { method: 'POST' }).catch((e) => {
 if (!e.serverDown) {
 if (e.status === 403) toast('با حساب دیگری وارد شده‌اید — با حساب مدرسِ همین کلاس وارد شوید', 'error')
 else toast(e.message || 'پایان کلاس ناموفق بود', 'error')
 }
 })
 },
 /** ثبت آخرین بازدید محصول/دوره برای ریل «ادامه بده» */
 pushViewed(item) {
 patch((s) => ({ recentlyViewed: [item, ...s.recentlyViewed.filter((r) => r.id !== item.id)].slice(0, 8) }))
 },
 }), [state, toasts, toast])

 return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
