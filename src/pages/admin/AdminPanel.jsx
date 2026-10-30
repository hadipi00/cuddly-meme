import PanelLayout from '../../components/PanelLayout'

/**
 * پنل مدیریت — بیش از ۵۰ قابلیت در ۱۰ بخش:
 * ۱ داشبورد ۲-۳ کاربران (دانشجو/مدرس + ساخت اکانت) ۴ دوره‌ها ۵ کلاس‌های زنده
 * ۶-۷ مدرس‌مارکت (محصولات/سفارش‌ها) ۸-۹ مالی (تراکنش/کوپن) ۱۰-۱۱ پشتیبانی (تیکت/نظر)
 * ۱۲-۱۳ محتوا (وبلاگ/بنر) ۱۴ گزارش‌ها ۱۵-۱۹ تنظیمات (عمومی/درگاه/پیامک/نقش‌ها/لاگ)
 */
const nav = [
 {
 group: 'نمای کلی',
 items: [
 { to: '/panel/admin', icon: 'chart', label: 'داشبورد مدیریت' },
 { to: '/panel/admin/reports', icon: 'activity', label: 'گزارش‌های تحلیلی' },
 ],
 },
 {
 group: 'کاربران',
 items: [
 { to: '/panel/admin/students', icon: 'cap', label: 'دانشجوها', pill: '۱۰' },
 { to: '/panel/admin/teachers', icon: 'video', label: 'مدرسان + ساخت اکانت', pill: '۵' },
 ],
 },
 {
 group: 'آموزش',
 items: [
 { to: '/panel/admin/courses', icon: 'book', label: 'دوره‌ها و دسته‌ها' },
 { to: '/panel/admin/classes', icon: 'calendar', label: 'کلاس‌های زنده' },
 ],
 },
 {
 group: 'مدرس‌مارکت',
 items: [
 { to: '/panel/admin/market', icon: 'box', label: 'محصولات و سفارش‌ها' },
 ],
 },
 {
 group: 'مالی',
 items: [
 { to: '/panel/admin/finance', icon: 'wallet', label: 'تراکنش‌ها و کوپن‌ها' },
 ],
 },
 {
 group: 'پشتیبانی و محتوا',
 items: [
 { to: '/panel/admin/support', icon: 'chat', label: 'تیکت‌ها و نظرات' },
 { to: '/panel/admin/content', icon: 'file', label: 'محتوا و ویرایش متون' },
 ],
 },
 {
 group: 'سیستم',
 items: [
 { to: '/panel/admin/settings', icon: 'settings', label: 'تنظیمات (۵ بخش)' },
 ],
 },
]

export default function AdminPanel() {
 return <PanelLayout role="admin" roleLabel="مدیریت" nav={nav} />
}
