import PanelLayout from '../../components/PanelLayout'

const nav = [
 {
 group: 'یادگیری',
 items: [
 { to: '/panel/student', icon: 'home', label: 'داشبورد من' },
 { to: '/panel/student/schedule', icon: 'calendar', label: 'برنامه هفتگی کلاس‌ها', pill: 'زنده' },
 { to: '/panel/student/classes', icon: 'video', label: 'کلاس‌های من' },
 { to: '/panel/student/courses', icon: 'book', label: 'دوره‌های من' },
 { to: '/panel/student/assignments', icon: 'file', label: 'تمرین و آزمون‌ها' },
 { to: '/panel/student/certificates', icon: 'award', label: 'گواهی‌نامه‌ها' },
 ],
 },
 {
 group: 'پیگیری',
 items: [
 { to: '/panel/student/study', icon: 'activity', label: 'میانگین مطالعه من' },
 { to: '/panel/student/orders', icon: 'wallet', label: 'سفارش‌ها و پرداخت‌ها' },
 { to: '/panel/student/wishlist', icon: 'heart', label: 'علاقه‌مندی‌ها' },
 { to: '/panel/student/tickets', icon: 'chat', label: 'پشتیبانی و تیکت' },
 ],
 },
]

export default function StudentPanel() {
 return <PanelLayout role="student" roleLabel="دانش‌آموز" nav={nav} />
}
