import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import AdminLayout from './components/AdminLayout'
import HomePage from './pages/HomePage'
import OrderPage from './pages/OrderPage'
import TrackPage from './pages/TrackPage'
import ConfirmationPage from './pages/ConfirmationPage'
import LoginPage from './pages/admin/LoginPage'
import DashboardPage from './pages/admin/DashboardPage'
import OrdersPage from './pages/admin/OrdersPage'
import OrderDetailPage from './pages/admin/OrderDetailPage'

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route element={<Layout />}>
        <Route path="/" element={<HomePage />} />
        <Route path="/commander" element={<OrderPage />} />
        <Route path="/suivi" element={<TrackPage />} />
        <Route path="/confirmation" element={<ConfirmationPage />} />
      </Route>

      {/* Admin */}
      <Route path="/admin/login" element={<LoginPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="commandes" element={<OrdersPage />} />
        <Route path="commandes/:id" element={<OrderDetailPage />} />
      </Route>
    </Routes>
  )
}
