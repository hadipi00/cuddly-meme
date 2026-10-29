// =====================================================================
// لایه ارتباط با سرور (API Layer)
// فعلاً همه متدها داده نمونه را با تاخیر شبیه‌سازی‌شده برمی‌گردانند.
// برای اتصال به بک‌اند واقعی کافی است بدنه هر متد با fetch جایگزین شود:
// مثال: getProducts: () => fetch('/api/products').then(r => r.json())
// =====================================================================

const delay = (ms = 350) => new Promise((r) => setTimeout(r, ms))

import {
 courses, liveClasses, products, teachers, students, payments, marketOrders,
 tickets, reviews, blogPosts, coupons, testimonials,
} from '../data/mock'

export const api = {
 getCourses: async () => { await delay(); return courses },
 getCourse: async (id) => { await delay(); return courses.find((c) => c.id === Number(id)) },
 getLiveClasses: async () => { await delay(); return liveClasses },
 getMarketProducts: async () => { await delay(); return products },
 getTeachers: async () => { await delay(); return teachers },
 getStudents: async () => { await delay(); return students },
 getPayments: async () => { await delay(); return payments },
 getMarketOrders: async () => { await delay(); return marketOrders },
 getTickets: async () => { await delay(); return tickets },
 getReviews: async () => { await delay(); return reviews },
 getBlogPosts: async () => { await delay(); return blogPosts },
 getCoupons: async () => { await delay(); return coupons },
 getTestimonials: async () => { await delay(); return testimonials },

 submitContact: async (data) => { await delay(800); return { ok: true, data } },
 submitTicket: async (data) => { await delay(600); return { ok: true, id: 'TK-' + Math.floor(230 + Math.random() * 60) } },
 placeOrder: async (data) => {
 await delay(900)
 return { ok: true, code: 'ORD-' + Math.floor(7900 + Math.random() * 90) }
 },
 login: async ({ role }) => { await delay(600); return { ok: true, role } },
}
