import { lazy, Suspense, useEffect, useState } from 'react'
import { Routes, Route, useLocation, Navigate } from 'react-router-dom'

import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ErrorBoundary from './components/ErrorBoundary'
import { RouteGuard } from './components/guards'
import { LoadingScreen } from './components/LoadingScreen'
import { CartDrawer, Toasts } from './components/CartDrawer'

/* ---------- صفحات با lazy loading (کد-اسپلیت خودکار) ---------- */
const Home = lazy(() => import('./pages/Home'))
const Resume = lazy(() => import('./pages/Resume'))
const Courses = lazy(() => import('./pages/Courses'))
const CourseDetail = lazy(() => import('./pages/CourseDetail'))
const LiveClasses = lazy(() => import('./pages/LiveClasses'))
const Teachers = lazy(() => import('./pages/Teachers'))
const TeacherProfile = lazy(() => import('./pages/TeacherProfile'))
const Market = lazy(() => import('./pages/Market'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Blog = lazy(() => import('./pages/Blog'))
const BlogPost = lazy(() => import('./pages/BlogPost'))
const Checkout = lazy(() => import('./pages/Checkout'))
const OrderSuccess = lazy(() => import('./pages/OrderSuccess'))
const Contact = lazy(() => import('./pages/Contact'))
const Auth = lazy(() => import('./pages/Auth'))
const NotFound = lazy(() => import('./pages/NotFound'))

/* پنل دانش‌آموز */
const StudentPanel = lazy(() => import('./pages/student/StudentPanel'))
const SDashboard = lazy(() => import('./pages/student/SDashboard'))
const SSchedule = lazy(() => import('./pages/student/SSchedule'))
const SMyCourses = lazy(() => import('./pages/student/SMyCourses'))
const SCoursePlayer = lazy(() => import('./pages/student/SCoursePlayer'))
const SAssignments = lazy(() => import('./pages/student/SAssignments'))
const SCertificates = lazy(() => import('./pages/student/SCertificates'))
const SStudy = lazy(() => import('./pages/student/SStudy'))
const SOrders = lazy(() => import('./pages/student/SOrders'))
const SWishlist = lazy(() => import('./pages/student/SWishlist'))
const STickets = lazy(() => import('./pages/student/STickets'))
const SLiveRoom = lazy(() => import('./pages/student/SLiveRoom'))

/* پنل مدرس */
const TeacherPanel = lazy(() => import('./pages/teacher/TeacherPanel'))
const TDashboard = lazy(() => import('./pages/teacher/TDashboard'))
const TClasses = lazy(() => import('./pages/teacher/TClasses'))
const TLiveRoom = lazy(() => import('./pages/teacher/TLiveRoom'))
const TStudents = lazy(() => import('./pages/teacher/TStudents'))
const TAssignments = lazy(() => import('./pages/teacher/TAssignments'))
const TEarnings = lazy(() => import('./pages/teacher/TEarnings'))
const TReviews = lazy(() => import('./pages/teacher/TReviews'))
const TProfile = lazy(() => import('./pages/teacher/TProfile'))

/* پنل مدیریت */
const AdminPanel = lazy(() => import('./pages/admin/AdminPanel'))
const ADashboard = lazy(() => import('./pages/admin/ADashboard'))
const AUsers = lazy(() => import('./pages/admin/AUsers'))
const ACourses = lazy(() => import('./pages/admin/ACourses'))
const AClasses = lazy(() => import('./pages/admin/AClasses'))
const AMarket = lazy(() => import('./pages/admin/AMarket'))
const AFinance = lazy(() => import('./pages/admin/AFinance'))
const ASupport = lazy(() => import('./pages/admin/ASupport'))
const AContent = lazy(() => import('./pages/admin/AContent'))
const AReports = lazy(() => import('./pages/admin/AReports'))
const ASettings = lazy(() => import('./pages/admin/ASettings'))

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
  return (
    <ErrorBoundary>
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
            <Route path="courses" element={<SMyCourses />} />
            <Route path="player/:courseId" element={<SCoursePlayer />} />
            <Route path="assignments" element={<SAssignments />} />
            <Route path="certificates" element={<SCertificates />} />
            <Route path="study" element={<SStudy />} />
            <Route path="orders" element={<SOrders />} />
            <Route path="wishlist" element={<SWishlist />} />
            <Route path="tickets" element={<STickets />} />
            <Route path="live/:classId" element={<SLiveRoom />} />
            <Route path="*" element={<Navigate to="/panel/student" replace />} />
          </Route>

          {/* پنل مدرس — محافظت‌شده */}
          <Route path="/panel/teacher" element={<RouteGuard role="teacher"><TeacherPanel /></RouteGuard>}>
            <Route index element={<TDashboard />} />
            <Route path="classes" element={<TClasses />} />
            <Route path="live" element={<TLiveRoom />} />
            <Route path="students" element={<TStudents />} />
            <Route path="assignments" element={<TAssignments />} />
            <Route path="earnings" element={<TEarnings />} />
            <Route path="reviews" element={<TReviews />} />
            <Route path="profile" element={<TProfile />} />
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
