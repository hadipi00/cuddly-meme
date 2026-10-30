import PanelLayout from '../../components/PanelLayout'

const nav = [
 {
 group: 'تدریس',
 items: [
 { to: '/panel/teacher', icon: 'home', label: 'داشبورد مدرس' },
 { to: '/panel/teacher/classes', icon: 'calendar', label: 'کلاس‌های پیش‌رو', pill: 'مدیریت' },
 { to: '/panel/teacher/live', icon: 'video', label: 'کلاس زنده — برگزاری' },
 { to: '/panel/teacher/students', icon: 'users', label: 'دانشجوهای من' },
 { to: '/panel/teacher/assignments', icon: 'file', label: 'تکالیف و تصحیح' },
 { to: '/panel/teacher/exams', icon: 'check', label: 'آزمون‌ساز', pill: 'جدید' },
 ],
 },
 {
 group: 'حساب',
 items: [
 { to: '/panel/teacher/earnings', icon: 'wallet', label: 'درآمد و تسویه' },
 { to: '/panel/teacher/reviews', icon: 'star', label: 'نظرات دانشجوها' },
 { to: '/panel/teacher/profile', icon: 'user', label: 'پروفایل و رزومه من' },
 ],
 },
]

export default function TeacherPanel() {
 return <PanelLayout role="teacher" roleLabel="مدرس" nav={nav} />
}
