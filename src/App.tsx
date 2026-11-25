import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import SplashScreen from './components/SplashScreen'
import NoIndex from './components/NoIndex'
import HomePage from './pages/HomePage'
import OrderPage from './pages/OrderPage'
import TrackPage from './pages/TrackPage'
import ConfirmationPage from './pages/ConfirmationPage'
import LoginPage from './pages/admin/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'

export default function App() {
  return (
    <>
      <SplashScreen />
      <Routes>
        {/* Public */}
        <Route element={<Layout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/commander" element={<OrderPage />} />
          <Route path="/suivi" element={<TrackPage />} />
          <Route path="/confirmation" element={<ConfirmationPage />} />
        </Route>

        {/* Admin : une seule page */}
        <Route
          path="/admin/login"
          element={
            <>
              <NoIndex />
              <LoginPage />
            </>
          }
        />
        <Route
          path="/admin"
          element={
            <>
              <NoIndex />
              <AdminLayout />
            </>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="*" element={<Navigate to="/admin" replace />} />
        </Route>
      </Routes>
    </>
  )
}
