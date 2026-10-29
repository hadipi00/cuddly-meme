import { useEffect, useState } from 'react'
import { Routes, Route, useLocation, useLocation as useLoc2 } from 'react-router-dom'

import Navbar from './components/Navbar'
import Footer from './components/Footer'
import { CartDrawer, Toasts } from './components/CartDrawer'

import Home from './pages/Home'
import Resume from './pages/Resume'
import Courses from './pages/Courses'
import CourseDetail from './pages/CourseDetail'
import LiveClasses from './pages/LiveClasses'
import Teachers from './pages/Teachers'
import TeacherProfile from './pages/TeacherProfile'
import Market from './pages/Market'
import ProductDetail from './pages/ProductDetail'
import Blog from './pages/Blog'
import BlogPost from './pages/BlogPost'
import Checkout from './pages/Checkout'
import OrderSuccess from './pages/OrderSuccess'
import Contact from './pages/Contact'
import Auth from './pages/Auth'

import StudentPanel from './pages/student/StudentPanel'
import SDashboard from './pages/student/SDashboard'
import SSchedule from './pages/student/SSchedule'
import SMyCourses from './pages/student/SMyCourses'
import SCoursePlayer from './pages/student/SCoursePlayer'
import SAssignments from './pages/student/SAssignments'
import SCertificates from './pages/student/SCertificates'
import SStudy from './pages/student/SStudy'
import SOrders from './pages/student/SOrders'
import SWishlist from './pages/student/SWishlist'
import STickets from './pages/student/STickets'
import SLiveRoom from './pages/student/SLiveRoom'

import TeacherPanel from './pages/teacher/TeacherPanel'
import TDashboard from './pages/teacher/TDashboard'
import TClasses from './pages/teacher/TClasses'
import TLiveRoom from './pages/teacher/TLiveRoom'
import TStudents from './pages/teacher/TStudents'
import TAssignments from './pages/teacher/TAssignments'
import TEarnings from './pages/teacher/TEarnings'
import TReviews from './pages/teacher/TReviews'
import TProfile from './pages/teacher/TProfile'

import AdminPanel from './pages/admin/AdminPanel'
import ADashboard from './pages/admin/ADashboard'
import AUsers from './pages/admin/AUsers'
import ACourses from './pages/admin/ACourses'
import AClasses from './pages/admin/AClasses'
import AMarket from './pages/admin/AMarket'
import AFinance from './pages/admin/AFinance'
import ASupport from './pages/admin/ASupport'
import AContent from './pages/admin/AContent'
import AReports from './pages/admin/AReports'
import ASettings from './pages/admin/ASettings'

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
    <>
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

        {/* پنل دانش‌آموز */}
        <Route path="/panel/student" element={<StudentPanel />}>
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
        </Route>

        {/* پنل مدرس */}
        <Route path="/panel/teacher" element={<TeacherPanel />}>
          <Route index element={<TDashboard />} />
          <Route path="classes" element={<TClasses />} />
          <Route path="live" element={<TLiveRoom />} />
          <Route path="students" element={<TStudents />} />
          <Route path="assignments" element={<TAssignments />} />
          <Route path="earnings" element={<TEarnings />} />
          <Route path="reviews" element={<TReviews />} />
          <Route path="profile" element={<TProfile />} />
        </Route>

        {/* پنل مدیریت */}
        <Route path="/panel/admin" element={<AdminPanel />}>
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
        </Route>
      </Routes>
      <CartDrawerHolder />
      <Toasts />
    </>
  )
}

function CartDrawerHolder() {
  const loc = useLoc2()
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (loc.state?.openCart) setOpen(true)
  }, [loc.state])
  return <CartDrawer open={open} onClose={() => setOpen(false)} />
}
