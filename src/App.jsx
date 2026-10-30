import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'

import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ErrorBoundary from './components/ErrorBoundary'
import { RouteGuard } from './components/guards'
import { LoadingScreen } from './components/LoadingScreen'
import { CartDrawer, Toasts } from './components/CartDrawer'
import { useApp } from './store/AppContext'
import { initPrefetch } from './lib/prefetch'

/* ---------- lazy loading با مکانیزم retry — رفع ارور «لود نشد» ----------
 * اگر بارگذاری chunk به‌خاطر قطعی لحظه‌ای اینترنت یا کشِ قدیمی مرورگر
 * (بعد از آپدیت سایت) شکست بخورد: ابتدا یک‌بار خودکار تلاش مجدد می‌کنیم و
 * اگر باز هم نشد، یک‌بار صفحه رفرش می‌شود تا HTML و chunkهای تازه گرفته شود.
 * (پرچم sessionStorage جلوی حلقه‌ی رفرش بی‌پایان را می‌گیرد) */
const lazyPage = (factory) =>
  lazy(() =>
    factory().catch(
      () =>
        new Promise((resolve, reject) => {
          setTimeout(() => {
            factory().then(resolve, (err) => {
              try {
                if (!sessionStorage.getItem('my_chunk_reload')) {
                  sessionStorage.setItem('my_chunk_reload', '1')
                  window.location.reload()
                  return
                }
              } catch { /* حالت ناشناس/خصوصی مرورگر */ }
              reject(err)
            })
          }, 400)
        })
    )
  )

/** با mount موفق برنامه، پرچم رفرش اضطراری پاک می‌شود */
function ChunkFlagClear() {
  useEffect(() => {
    try { sessionStorage.removeItem('my_chunk_reload') } catch { /* noop */ }
  }, [])
  return null
}

/** هشدار قطع/وصل شدن اینترنت — توضیح وقفه‌های بارگذاری برای کاربر */
function OfflineWatch() {
  const { toast } = useApp()
  useEffect(() => {
    const off = () => toast('اتصال اینترنت قطع شد! بارگذاری صفحات ممکن است با وقفه همراه باشد.', 'error')
    const on = () => toast('اتصال اینترنت برقرار شد.', 'success')
    window.addEventListener('offline', off)
    window.addEventListener('online', on)
    return () => {
      window.removeEventListener('offline', off)
      window.removeEventListener('online', on)
    }
  }, [toast])
  return null
}

/* ---------- صفحات با lazy loading (کد-اسپلیت خودکار) ---------- */
const Home = lazyPage(() => import('./pages/Home'))
const Resume = lazyPage(() => import('./pages/Resume'))
const Courses = lazyPage(() => import('./pages/Courses'))
const CourseDetail = lazyPage(() => import('./pages/CourseDetail'))
const LiveClasses = lazyPage(() => import('./pages/LiveClasses'))
const Teachers = lazyPage(() => import('./pages/Teachers'))
const TeacherProfile = lazyPage(() => import('./pages/TeacherProfile'))
const Market = lazyPage(() => import('./pages/Market'))
const ProductDetail = lazyPage(() => import('./pages/ProductDetail'))
const Blog = lazyPage(() => import('./pages/Blog'))
const BlogPost = lazyPage(() => import('./pages/BlogPost'))
const Checkout = lazyPage(() => import('./pages/Checkout'))
const OrderSuccess = lazyPage(() => import('./pages/OrderSuccess'))
const Contact = lazyPage(() => import('./pages/Contact'))
const Auth = lazyPage(() => import('./pages/Auth'))
const NotFound = lazyPage(() => import('./pages/NotFound'))

/* پنل دانش‌آموز */
const StudentPanel = lazyPage(() => import('./pages/student/StudentPanel'))
const SDashboard = lazyPage(() => import('./pages/student/SDashboard'))
const SSchedule = lazyPage(() => import('./pages/student/SSchedule'))
const SMyCourses = lazyPage(() => import('./pages/student/SMyCourses'))
const SMyClasses = lazyPage(() => import('./pages/student/SMyClasses'))
const SClassDetail = lazyPage(() => import('./pages/student/SClassDetail'))
const SCoursePlayer = lazyPage(() => import('./pages/student/SCoursePlayer'))
const SAssignments = lazyPage(() => import('./pages/student/SAssignments'))
const SCertificates = lazyPage(() => import('./pages/student/SCertificates'))
const SStudy = lazyPage(() => import('./pages/student/SStudy'))
const SOrders = lazyPage(() => import('./pages/student/SOrders'))
const SWishlist = lazyPage(() => import('./pages/student/SWishlist'))
const STickets = lazyPage(() => import('./pages/student/STickets'))
const SLiveRoom = lazyPage(() => import('./pages/student/SLiveRoom'))
const SExams = lazyPage(() => import('./pages/student/SExams'))
const SExamTake = lazyPage(() => import('./pages/student/SExamTake'))
const SExamResult = lazyPage(() => import('./pages/student/SExamResult'))

/* پنل مدرس */
const TeacherPanel = lazyPage(() => import('./pages/teacher/TeacherPanel'))
const TDashboard = lazyPage(() => import('./pages/teacher/TDashboard'))
const TClasses = lazyPage(() => import('./pages/teacher/TClasses'))
const TClassDetail = lazyPage(() => import('./pages/teacher/TClassDetail'))
const TLiveRoom = lazyPage(() => import('./pages/teacher/TLiveRoom'))
const TStudents = lazyPage(() => import('./pages/teacher/TStudents'))
const TAssignments = lazyPage(() => import('./pages/teacher/TAssignments'))
const TEarnings = lazyPage(() => import('./pages/teacher/TEarnings'))
const TReviews = lazyPage(() => import('./pages/teacher/TReviews'))
const TProfile = lazyPage(() => import('./pages/teacher/TProfile'))
const TExams = lazyPage(() => import('./pages/teacher/TExams'))
const TExamBuilder = lazyPage(() => import('./pages/teacher/TExamBuilder'))
const TExamDetail = lazyPage(() => import('./pages/teacher/TExamDetail'))

/* پنل مدیریت */
const AdminPanel = lazyPage(() => import('./pages/admin/AdminPanel'))
const ADashboard = lazyPage(() => import('./pages/admin/ADashboard'))
const AUsers = lazyPage(() => import('./pages/admin/AUsers'))
const ACourses = lazyPage(() => import('./pages/admin/ACourses'))
const AClasses = lazyPage(() => import('./pages/admin/AClasses'))
const AMarket = lazyPage(() => import('./pages/admin/AMarket'))
const AFinance = lazyPage(() => import('./pages/admin/AFinance'))
const ASupport = lazyPage(() => import('./pages/admin/ASupport'))
const AContent = lazyPage(() => import('./pages/admin/AContent'))
const AReports = lazyPage(() => import('./pages/admin/AReports'))
const ASettings = lazyPage(() => import('./pages/admin/ASettings'))

/* ---------- عنوان داینامیک هر مسیر (سئو و تجربه کاربری) ---------- */
const ROUTE_TITLES = {
 '/': 'خانه',
 '/resume': 'رزومه‌ساز',
 '/courses': 'دوره‌های آموزشی',
 '/live': 'کلاس‌های آنلاین',
 '/teachers': 'اساتید',
 '/market': 'مدرس‌مارکت',
 '/blog': 'بلاگ آموزشی',
 '/checkout': 'تسویه حساب',
 '/order-success': 'ثبت سفارش',
 '/contact': 'تماس با ما',
 '/auth': 'ورود و ثبت‌نام',
}

function titleFor(pathname) {
 if (pathname.startsWith('/panel/student')) return 'پنل دانش‌آموز'
 if (pathname.startsWith('/panel/teacher')) return 'پنل مدرس'
 if (pathname.startsWith('/panel/admin')) return 'پنل مدیریت'
 for (const base of Object.keys(ROUTE_TITLES)) {
 if (base !== '/' && pathname.startsWith(base)) return ROUTE_TITLES[base]
 }
 return ROUTE_TITLES[pathname]
}

const DEFAULT_TITLE = 'مدرس‌یار | پلتفرم کلاس آنلاین و فروش دوره‌های آموزشی'

/** عنوان تب مرورگر را بر اساس مسیر فعلی به‌روز می‌کند */
function TitleSync() {
 const { pathname } = useLocation()
 useEffect(() => {
 const t = titleFor(pathname)
 document.title = t ? `${t} | مدرس‌یار` : DEFAULT_TITLE
 }, [pathname])
 return null
}

function ScrollToTop() {
 const { pathname } = useLocation()
 useEffect(() => { window.scrollTo(0, 0) }, [pathname])
 return null
}

function Public({ children }) {
 return (
 <>
 <ScrollToTop />
 <Navbar />
 {children}
 <Footer />
 </>
 )
}

export default function App() {
 useEffect(() => initPrefetch(), [])
 return (
 <ErrorBoundary>
 <ChunkFlagClear />
 <OfflineWatch />
 <TitleSync />
 <Suspense fallback={<LoadingScreen />}>
 <Routes>
 {/* سایت عمومی */}
 <Route path="/" element={<Public><Home /></Public>} />
 <Route path="/resume" element={<Public><Resume /></Public>} />
 <Route path="/courses" element={<Public><Courses /></Public>} />
 <Route path="/courses/:id" element={<Public><CourseDetail /></Public>} />
 <Route path="/live" element={<Public><LiveClasses /></Public>} />
 <Route path="/teachers" element={<Public><Teachers /></Public>} />
 <Route path="/teachers/:id" element={<Public><TeacherProfile /></Public>} />
 <Route path="/market" element={<Public><Market /></Public>} />
 <Route path="/market/:id" element={<Public><ProductDetail /></Public>} />
 <Route path="/blog" element={<Public><Blog /></Public>} />
 <Route path="/blog/:id" element={<Public><BlogPost /></Public>} />
 <Route path="/checkout" element={<Public><Checkout /></Public>} />
 <Route path="/order-success" element={<Public><OrderSuccess /></Public>} />
 <Route path="/contact" element={<Public><Contact /></Public>} />
 <Route path="/auth" element={<Auth />} />

 {/* پنل دانش‌آموز — محافظت‌شده */}
 <Route path="/panel/student" element={<RouteGuard role="student"><StudentPanel /></RouteGuard>}>
 <Route index element={<SDashboard />} />
 <Route path="schedule" element={<SSchedule />} />
 <Route path="classes" element={<SMyClasses />} />
 <Route path="classes/:classId" element={<SClassDetail />} />
 <Route path="courses" element={<SMyCourses />} />
 <Route path="player/:courseId" element={<SCoursePlayer />} />
 <Route path="assignments" element={<SAssignments />} />
 <Route path="certificates" element={<SCertificates />} />
 <Route path="study" element={<SStudy />} />
 <Route path="orders" element={<SOrders />} />
 <Route path="wishlist" element={<SWishlist />} />
 <Route path="tickets" element={<STickets />} />
 <Route path="live/:classId" element={<SLiveRoom />} />
 <Route path="exams" element={<SExams />} />
 <Route path="exams/:eid/take" element={<SExamTake />} />
 <Route path="exams/:eid/result" element={<SExamResult />} />
 <Route path="*" element={<Navigate to="/panel/student" replace />} />
 </Route>

 {/* پنل مدرس — محافظت‌شده */}
 <Route path="/panel/teacher" element={<RouteGuard role="teacher"><TeacherPanel /></RouteGuard>}>
 <Route index element={<TDashboard />} />
 <Route path="classes" element={<TClasses />} />
 <Route path="classes/:classId" element={<TClassDetail />} />
 <Route path="live" element={<TLiveRoom />} />
 <Route path="students" element={<TStudents />} />
 <Route path="assignments" element={<TAssignments />} />
 <Route path="earnings" element={<TEarnings />} />
 <Route path="reviews" element={<TReviews />} />
 <Route path="profile" element={<TProfile />} />
 <Route path="exams" element={<TExams />} />
 <Route path="exams/:eid" element={<TExamBuilder />} />
 <Route path="exams/:eid/analysis" element={<TExamDetail />} />
 <Route path="*" element={<Navigate to="/panel/teacher" replace />} />
 </Route>

 {/* پنل مدیریت — محافظت‌شده */}
 <Route path="/panel/admin" element={<RouteGuard role="admin"><AdminPanel /></RouteGuard>}>
 <Route index element={<ADashboard />} />
 <Route path="students" element={<AUsers kind="student" />} />
 <Route path="teachers" element={<AUsers kind="teacher" />} />
 <Route path="courses" element={<ACourses />} />
 <Route path="classes" element={<AClasses />} />
 <Route path="market" element={<AMarket />} />
 <Route path="finance" element={<AFinance />} />
 <Route path="support" element={<ASupport />} />
 <Route path="content" element={<AContent />} />
 <Route path="reports" element={<AReports />} />
 <Route path="settings" element={<ASettings />} />
 <Route path="*" element={<Navigate to="/panel/admin" replace />} />
 </Route>

 {/* هر آدرس ناشناخته → صفحه ۴۰۴ */}
 <Route path="*" element={<Public><NotFound /></Public>} />
 </Routes>
 </Suspense>
 <CartDrawerHolder />
 <Toasts />
 </ErrorBoundary>
 )
}

function CartDrawerHolder() {
 const loc = useLocation()
 const [open, setOpen] = useState(false)
 useEffect(() => {
 if (loc.state?.openCart) setOpen(true)
 }, [loc.state])
 return <CartDrawer open={open} onClose={() => setOpen(false)} />
}
