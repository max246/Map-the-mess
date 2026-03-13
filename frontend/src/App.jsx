import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import ReportLitter from './pages/ReportLitter'
import MapView from './pages/MapView'
import VolunteerDashboard from './pages/VolunteerDashboard'
import ReportDetail from './pages/ReportDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import Admin from './pages/Admin'
import UserManagement from './pages/UserManagement'

function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/report" element={<ReportLitter />} />
            <Route path="/map" element={<MapView />} />
            <Route path="/report/:id" element={<ReportDetail />} />
            <Route path="/volunteers" element={<VolunteerDashboard />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/admin/users" element={<UserManagement />} />
          </Routes>
        </main>
      </div>
    </AuthProvider>
  )
}

export default App
